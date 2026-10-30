import * as THREE from 'three';
import { Synth } from '../audio/Synth';
import { Sparkles } from '../fx/Sparkles';
import { Input } from '../input/Input';
import { CharacterModel } from '../player/CharacterModel';
import { Player } from '../player/Player';
import { ThirdPersonCamera } from '../player/ThirdPersonCamera';
import { Hud } from '../ui/Hud';
import { Environment } from '../world/Environment';
import { Level } from '../world/Level';
import { Lantern, RevealTracker } from '../world/LightReveal';
import {
  BEACONS, BeaconDef, CHECKPOINTS, GOAL, KILL_Y, PLATFORMS, SPAWN, TriggerDef,
  inTrigger, platformById, platformUnder, pulseReaches, respawnPosition,
} from '../world/LevelData';
import { EventBus } from './EventBus';
import { FallLog } from './FallLog';
import { Records, formatTime } from './Records';
import { SettingsStore } from './Settings';
import { browserStore } from './storage';
import { GameState } from './GameState';

export type GameEvents = { tick: { dt: number } };

const STEP = 1 / 60; // physics runs at a fixed rate so the game feels the same on any screen
const GOLD = 0xffd36b;
/** Paths are under /public. Add `extraClips: { run: '...' }` once you have a Mixamo running FBX. */
const CHARACTER_ASSETS = {
  fbx: `${import.meta.env.BASE_URL}models/character/character.fbx`,
  baseColor: `${import.meta.env.BASE_URL}models/character/base_color.png`,
};
/** Run id used for saved records. One id per full route through the tower. */
const RUN_ID = 'tower';
const OBJ_START = 'Reach the golden gate';
const OBJ_BEACON = 'Find the crystal and wake it with a pulse (Q)';
const OBJ_BRIDGE = 'Cross the light bridge to the gate';

/** Owns the renderer and the main loop; wires every system together. */
export class Game {
  readonly state = new GameState();
  readonly events = new EventBus<GameEvents>();

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1000);
  private readonly env: Environment;
  private readonly level = new Level();
  private readonly player = new Player(SPAWN);
  private readonly rig: ThirdPersonCamera;
  private readonly input = new Input();
  private readonly audio = new Synth();
  private readonly hud: Hud;
  private readonly sparkles = new Sparkles();
  private readonly lantern = new Lantern();
  private readonly reveal = new RevealTracker();
  private readonly resizeObserver: ResizeObserver;
  private readonly settings = new SettingsStore(browserStore());
  private readonly records = new Records(browserStore());
  private unsubscribeSettings: () => void = () => {};

  private respawnPoint: { x: number; y: number; z: number } = { ...SPAWN };
  private activeCheckpoint: string | null = null;
  private stats = { time: 0, falls: 0 };
  private accumulator = 0;
  private lastTime = -1;
  private elapsed = 0;
  private jumpQueued = false;
  private pulseQueued = false;
  private readonly beaconsActive = new Set<string>();
  private readonly fallLog = new FallLog();
  private lastPlatform: string | null = null;
  private stepTimer = 0;
  private disposed = false;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    container.appendChild(this.renderer.domElement);

    this.env = new Environment(this.scene);
    this.scene.add(this.env.group, this.level.group, this.player.group, this.player.auraMesh, this.sparkles.points);

    this.rig = new ThirdPersonCamera(this.camera, this.renderer.domElement);

    this.hud = new Hud(container);
    this.hud.onStart = () => this.begin();
    this.hud.onResume = () => this.togglePause();
    this.hud.onRestart = () => this.restart();
    this.hud.onSettings = (patch) => this.settings.set(patch);
    this.unsubscribeSettings = this.settings.onChange((v) => this.applySettings(v));
    this.applySettings(this.settings.get());
    this.hud.setSettings(this.settings.get());
    this.hud.showTitle(true);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    void this.loadCharacter();
  }

  private applySettings(v: Readonly<{ volume: number; sensitivity: number; invertY: boolean }>): void {
    this.audio.setVolume(v.volume);
    this.rig.sensitivity = v.sensitivity;
    this.rig.invertY = v.invertY;
  }

  /** Load the FBX character in the background; the built-in character is used until (or unless) it loads. */
  private async loadCharacter(): Promise<void> {
    try {
      const model = await CharacterModel.load(CHARACTER_ASSETS);
      if (this.disposed) model.dispose();
      else this.player.attachModel(model);
    } catch (err) {
      console.warn('Character model failed to load; keeping the built-in character.', err);
    }
  }

  start(): void {
    this.renderer.setAnimationLoop(this.frame);
  }

  // --- flow ------------------------------------------------------------------
  private begin(): void {
    this.audio.unlock(); // browsers require a user click before audio can play
    if (this.state.transition('playing')) {
      this.hud.showTitle(false);
      this.hud.showHud(true);
      this.hud.toast('Walk to the edge. Your lantern reveals hidden stones.', 4);
    }
  }

  private togglePause(): void {
    if (this.state.phase === 'playing' && this.state.transition('paused')) this.hud.showPause(true);
    else if (this.state.phase === 'paused' && this.state.transition('playing')) {
      this.hud.showPause(false);
      this.lastTime = -1; // avoid a big time jump after resuming
    }
  }

  private restart(): void {
    this.respawnPoint = { ...SPAWN };
    this.activeCheckpoint = null;
    this.level.setActiveCheckpoint(null);
    this.level.setBeaconActive(null);
    this.reveal.clearPins();
    this.beaconsActive.clear();
    this.hud.setObjective(OBJ_START);
    this.hud.setCheckpoint('start');
    this.stats = { time: 0, falls: 0 };
    this.fallLog.reset();
    this.placePlayer();
    if (this.state.transition('playing')) this.hud.showWin(false);
  }

  private placePlayer(): void {
    this.player.body.reset(this.respawnPoint);
    this.player.faceRoute();
    this.reveal.reset();
    this.lantern.reset();
    this.rig.yaw = 0;
    this.rig.snap();
    this.accumulator = 0;
    this.lastPlatform = null;
  }

  private respawn(fell: boolean): void {
    if (fell) {
      this.stats.falls++;
      this.fallLog.record(this.lastPlatform);
    }
    this.placePlayer();
    this.audio.respawn();
    this.hud.flash();
    if (fell) this.hud.toast('You fell. Back to the last checkpoint.');
  }

  private win(): void {
    if (!this.state.transition('won')) return;
    this.audio.win();
    const p = this.player.body.pos;
    this.sparkles.burst(p.x, p.y, p.z, 120, GOLD, 5, 4);
    const worst = this.fallLog.worst();
    const out = this.records.submit(RUN_ID, { time: this.stats.time, falls: this.stats.falls });
    const { bestTime, fewestFalls } = out.record;
    let bestLine = `Best ${formatTime(bestTime ?? this.stats.time)}  ·  Fewest falls ${fewestFalls ?? this.stats.falls}`;
    if (out.newBestTime) bestLine = `New best time!  ${bestLine}`;
    else if (out.newBestFalls) bestLine = `New fewest falls!  ${bestLine}`;
    this.hud.showWin(true, this.stats.time, this.stats.falls, worst ? `leaving ${worst.id} (${worst.count} falls)` : '', bestLine);
  }

  // --- main loop -------------------------------------------------------------
  private frame = (timeMs: number): void => {
    const t = timeMs / 1000;
    const dt = this.lastTime < 0 ? 0 : Math.min(t - this.lastTime, 0.1);
    this.lastTime = t;
    this.elapsed += dt;

    this.handleKeys();

    if (this.state.phase === 'playing') {
      if (this.input.down('ArrowLeft')) this.rig.rotate(-1.8 * dt);
      if (this.input.down('ArrowRight')) this.rig.rotate(1.8 * dt);
      if (this.input.pressed('Space')) this.jumpQueued = true;
      if (this.input.pressed('KeyQ')) this.pulseQueued = true;

      this.accumulator += dt;
      while (this.accumulator >= STEP) {
        this.simulate(STEP);
        this.accumulator -= STEP;
      }
      this.stats.time += dt;
    } else if (this.state.phase === 'menu') {
      this.rig.rotate(0.12 * dt); // slow cinematic orbit behind the title screen
    }

    const bodyPos = this.player.body.pos;
    const target = new THREE.Vector3(bodyPos.x, bodyPos.y, bodyPos.z);
    this.player.updateVisual(dt, this.elapsed, this.lantern.radius, this.lantern.pulsing);
    this.level.update(dt, this.elapsed, this.reveal);
    this.sparkles.update(dt);
    this.env.update(target, this.elapsed);
    this.rig.update(dt, target, this.level.solids(this.reveal));
    this.hud.setPulse(this.lantern.charge, this.lantern.pulsing);

    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  };

  private handleKeys(): void {
    if (this.input.pressed('Escape') || this.input.pressed('KeyP')) this.togglePause();
    if (this.input.pressed('KeyM')) this.hud.toast(this.audio.toggleMute() ? 'Sound off' : 'Sound on', 1.2);
    if (this.input.pressed('KeyR') && this.state.phase === 'playing') this.respawn(false);
  }

  /** One fixed physics/gameplay step. */
  private simulate(dt: number): void {
    this.events.emit('tick', { dt });
    const body = this.player.body;

    // 1. Lantern
    this.lantern.update(dt);
    if (this.pulseQueued) {
      this.pulseQueued = false;
      const lp = this.player.lanternPos;
      if (this.lantern.tryPulse()) {
        this.audio.pulse();
        this.sparkles.ring(lp.x, lp.y, lp.z, 60, GOLD, 9);
        for (const b of BEACONS) if (!this.beaconsActive.has(b.id) && pulseReaches(b, lp)) this.activateBeacon(b);
      }
    }

    // 2. Which hidden platforms does the light reach? (rules live in LightReveal.ts)
    const change = this.reveal.update(dt, this.level.hidden, this.player.lanternPos, this.lantern.radius);
    for (const id of change.revealed) {
      const def = platformById(id);
      this.level.pop(id);
      this.audio.reveal();
      this.sparkles.burst(def.cx, def.topY + 0.3, def.cz, 22, GOLD, 2, 2.5);
    }

    // 3. Movement relative to the camera
    const f = this.rig.forward();
    const r = this.rig.right();
    const ix = (this.input.down('KeyD') ? 1 : 0) - (this.input.down('KeyA') ? 1 : 0);
    const iz = (this.input.down('KeyW') ? 1 : 0) - (this.input.down('KeyS') ? 1 : 0);
    const ev = body.step(
      dt,
      { moveX: r.x * ix + f.x * iz, moveZ: r.z * ix + f.z * iz, jumpPressed: this.jumpQueued },
      this.level.solids(this.reveal),
    );
    this.jumpQueued = false;
    if (ev.jumped) {
      this.audio.jump();
      this.player.kick(0.18); // stretch
    }
    if (ev.landed) {
      this.audio.land(ev.landSpeed);
      this.player.kick(-Math.min(0.28, ev.landSpeed * 0.02)); // squash
      this.sparkles.burst(body.pos.x, body.feetY + 0.1, body.pos.z, 10, 0xe9e2ff, 1.8, 0.6);
    }

    // Remember the last platform we stood on (for the "toughest jump" stat) and play footsteps.
    if (body.grounded) {
      this.lastPlatform = platformUnder({ x: body.pos.x, y: body.feetY, z: body.pos.z }, PLATFORMS) ?? this.lastPlatform;
      this.stepTimer -= dt;
      if (this.stepTimer <= 0 && Math.hypot(body.vel.x, body.vel.z) > 2) {
        this.audio.step();
        this.stepTimer = 0.3;
      }
    }

    // 4. Checkpoints, goal, falling
    const feet = { x: body.pos.x, y: body.feetY, z: body.pos.z };
    CHECKPOINTS.forEach((c, i) => this.tryCheckpoint(c, i, feet));
    if (inTrigger(feet, GOAL)) this.win();
    else if (body.pos.y < KILL_Y) this.respawn(true);
  }

  private tryCheckpoint(c: TriggerDef, index: number, feet: { x: number; y: number; z: number }): void {
    if (this.activeCheckpoint === c.id || !inTrigger(feet, c)) return;
    this.activeCheckpoint = c.id;
    this.respawnPoint = respawnPosition(c);
    this.level.setActiveCheckpoint(c.id);
    this.audio.checkpoint();
    this.sparkles.burst(c.x, c.y + 1, c.z, 40, GOLD, 3, 3);
    this.hud.setCheckpoint(`${index + 1} of ${CHECKPOINTS.length}`);
    this.hud.toast('Checkpoint reached');
    if (c.id === 'C2' && this.beaconsActive.size === 0) this.hud.setObjective(OBJ_BEACON);
  }

  /** A pulse reached a crystal: wake it and make its bridge permanently solid. */
  private activateBeacon(b: BeaconDef): void {
    this.beaconsActive.add(b.id);
    this.level.setBeaconActive(b.id);
    this.audio.checkpoint();
    this.sparkles.burst(b.x, b.y + 1.2, b.z, 50, GOLD, 3.5, 3);
    for (const id of this.reveal.unlock(b.unlocks)) {
      const def = platformById(id);
      this.level.pop(id);
      this.sparkles.burst(def.cx, def.topY + 0.3, def.cz, 22, GOLD, 2, 2.5);
    }
    this.audio.reveal();
    this.hud.toast('The crystal wakes. A bridge of light appears.');
    this.hud.setObjective(OBJ_BRIDGE);
  }

  private resize(): void {
    const w = Math.max(this.container.clientWidth, 1);
    const h = Math.max(this.container.clientHeight, 1);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.rig.dispose();
    this.input.dispose();
    this.audio.dispose();
    this.unsubscribeSettings();
    this.hud.dispose();
    this.sparkles.dispose();
    this.player.dispose();
    this.level.dispose();
    this.env.dispose();
    this.events.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
