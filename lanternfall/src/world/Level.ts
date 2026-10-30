import * as THREE from 'three';
import { disposeObject } from '../core/dispose';
import { Box } from '../physics/aabb';
import { HiddenPlatform, RevealTracker } from './LightReveal';
import { BEACONS, CHECKPOINTS, GOAL, MOVERS, MoverDef, PLATFORMS, PlatformDef, PLATFORM_THICKNESS, platformBox } from './LevelData';
import { moverBox, moverTop } from './MovingPlatform';

const STONE = 0xcdb9a3; // warm sandstone: stands out against the cool violet world
const MOSS = 0x56d4a4;
const GOLD = 0xffd36b;

interface HiddenView {
  group: THREE.Group;
  plate: THREE.MeshStandardMaterial;
  body: THREE.MeshStandardMaterial;
  ghost: THREE.LineSegments;
  pop: number;
}

interface MoverView {
  def: MoverDef;
  group: THREE.Group;
  /** Dotted outline of a hidden mover (null for visible ones). */
  ghost: THREE.LineSegments | null;
}

interface CheckpointView {
  id: string;
  flag: THREE.MeshStandardMaterial;
  light: THREE.PointLight;
}

interface BeaconView {
  id: string;
  crystal: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  light: THREE.PointLight;
  baseY: number;
}

/** Builds the meshes for every room from LevelData and animates them. Collision is NOT done here. */
export class Level {
  readonly group = new THREE.Group();
  readonly hidden: HiddenPlatform[];
  private readonly staticBoxes: Box[];
  private readonly hiddenViews = new Map<string, HiddenView>();
  private readonly checkpoints: CheckpointView[] = [];
  private readonly beacons: BeaconView[] = [];
  private readonly moverViews: MoverView[] = [];
  private readonly goalRing: THREE.Mesh;
  private readonly goalBeam: THREE.Mesh;
  private readonly goalPortal: THREE.Mesh;

  constructor() {
    this.staticBoxes = PLATFORMS.filter((p) => !p.hidden).map(platformBox);
    this.hidden = PLATFORMS.filter((p) => p.hidden).map((p) => ({ id: p.id, box: platformBox(p), locked: p.locked }));

    for (const def of PLATFORMS) {
      if (def.hidden) this.buildHidden(def);
      else this.buildSolid(def);
    }
    for (const m of MOVERS) this.buildMover(m);
    for (const c of CHECKPOINTS) this.buildCheckpoint(c.id, c.x, c.y, c.z);
    for (const b of BEACONS) this.buildBeacon(b.id, b.x, b.y, b.z);

    // Goal: a glowing ring + light beam inside a ruined arch (arch built in Environment).
    this.goalRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.5, 0.14, 6, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe08a, toneMapped: false }), // unlit + bright: always reads as glowing
    );
    this.goalPortal = new THREE.Mesh(
      new THREE.CircleGeometry(1.4, 32),
      new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.goalPortal.position.set(GOAL.x, GOAL.y + 2.3, GOAL.z);
    this.goalRing.position.set(GOAL.x, GOAL.y + 2.3, GOAL.z);
    this.goalBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.9, 40, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.goalBeam.position.set(GOAL.x, GOAL.y + 20, GOAL.z);
    const goalLight = new THREE.PointLight(GOLD, 130, 28, 2);
    goalLight.position.set(GOAL.x, GOAL.y + 2.5, GOAL.z);
    this.group.add(this.goalRing, this.goalPortal, this.goalBeam, goalLight);
  }

  /** Hidden platforms and hidden movers, with each mover's box at time `t`. This is what the lantern tests against. */
  hiddenNow(t: number): HiddenPlatform[] {
    const movers = MOVERS.filter((m) => m.hidden).map((m) => ({ id: m.id, box: moverBox(m, t) }));
    return [...this.hidden, ...movers];
  }

  isHiddenMover(id: string): boolean {
    return MOVERS.some((m) => m.id === id && m.hidden);
  }

  /** Boxes of the movers the player can stand on at time `t` (hidden ones only while lit). */
  moverSolids(reveal: RevealTracker, t: number): Box[] {
    return MOVERS.filter((m) => !m.hidden || reveal.isSolid(m.id)).map((m) => moverBox(m, t));
  }

  /** Boxes the player can currently collide with (everything except movers, see moverSolids). */
  solids(reveal: RevealTracker): Box[] {
    const out = [...this.staticBoxes];
    for (const h of this.hidden) if (reveal.isSolid(h.id)) out.push(h.box);
    return out;
  }

  /** Trigger the "pop" animation when a platform is revealed. */
  pop(id: string): void {
    const v = this.hiddenViews.get(id);
    if (v) v.pop = 1;
  }

  setActiveCheckpoint(id: string | null): void {
    for (const c of this.checkpoints) {
      const on = c.id === id;
      c.flag.color.set(on ? GOLD : 0x6d6a8f);
      c.flag.emissive.set(on ? GOLD : 0x000000);
      c.flag.emissiveIntensity = on ? 1.2 : 0;
      c.light.intensity = on ? 30 : 0;
    }
  }

  /** Light up one beacon crystal, or pass null to put them all back to sleep (restart). */
  setBeaconActive(id: string | null): void {
    for (const b of this.beacons) {
      const on = b.id === id;
      b.mat.color.set(on ? GOLD : 0x6d6a8f);
      b.mat.emissive.set(on ? GOLD : 0x2a2466);
      b.mat.emissiveIntensity = on ? 1.6 : 0.5;
      b.light.intensity = on ? 40 : 6;
    }
  }

  update(dt: number, time: number, reveal: RevealTracker, moverTime = 0): void {
    for (const b of this.beacons) {
      b.crystal.rotation.y = time * 1.1;
      b.crystal.position.y = b.baseY + Math.sin(time * 1.8) * 0.12;
    }
    for (const [id, v] of this.hiddenViews) {
      const vis = reveal.visibility(id);
      v.group.visible = vis > 0.01;
      v.plate.opacity = vis;
      v.body.opacity = vis;
      v.pop = Math.max(0, v.pop - dt * 3);
      const glow = 0.5 + v.pop * 1.6;
      v.plate.emissiveIntensity = glow;
      v.body.emissiveIntensity = glow * 0.35;
      v.group.scale.y = 1 + v.pop * 0.35;
      (v.ghost.material as THREE.LineBasicMaterial).opacity = vis > 0.5 ? 0 : 0.2 + Math.sin(time * 2.5) * 0.06;
    }
    for (const v of this.moverViews) {
      const c = moverTop(v.def, moverTime);
      v.group.position.set(c.x, c.topY, c.z);
      v.ghost?.position.set(c.x, c.topY - 0.04, c.z);
    }
    this.goalRing.rotation.y = time * 0.9;
    const bob = GOAL.y + 2.3 + Math.sin(time * 1.6) * 0.15;
    this.goalRing.position.y = bob;
    this.goalPortal.position.y = bob;
    (this.goalPortal.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(time * 2.4) * 0.1;
    (this.goalBeam.material as THREE.MeshBasicMaterial).opacity = 0.26 + Math.sin(time * 2) * 0.06;
  }

  private slab(def: PlatformDef, bodyMat: THREE.Material, plateMat: THREE.Material): THREE.Group {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(def.w, PLATFORM_THICKNESS - 0.1, def.d), bodyMat);
    body.position.y = -(PLATFORM_THICKNESS - 0.1) / 2 - 0.1;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(def.w, 0.1, def.d), plateMat);
    plate.position.y = -0.05;
    // Floating-island underside: an upside-down rocky cone.
    const under = new THREE.Mesh(new THREE.ConeGeometry(Math.min(def.w, def.d) * 0.62, 2.2 + def.w * 0.15, 5), bodyMat);
    under.rotation.x = Math.PI;
    under.position.y = -PLATFORM_THICKNESS - 1.0 - def.w * 0.07;
    for (const m of [body, plate, under]) {
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
    g.position.set(def.cx, def.topY, def.cz);
    return g;
  }

  /** A mover is built like a normal platform at its start point; update() slides it along its path. */
  private buildMover(m: MoverDef): void {
    const def: PlatformDef = { id: m.id, hidden: m.hidden, cx: m.from.x, topY: m.from.topY, cz: m.from.z, w: m.w, d: m.d, locked: false };
    if (m.hidden) {
      const view = this.buildHidden(def);
      this.moverViews.push({ def: m, group: view.group, ghost: view.ghost });
    } else {
      this.moverViews.push({ def: m, group: this.buildSolid(def), ghost: null });
    }
  }

  private buildSolid(def: PlatformDef): THREE.Group {
    const body = new THREE.MeshStandardMaterial({ color: STONE, flatShading: true, roughness: 0.95 });
    // A little self-glow keeps the walkable top readable even in shadow.
    const plate = new THREE.MeshStandardMaterial({ color: MOSS, emissive: 0x1f6b50, emissiveIntensity: 0.35, flatShading: true, roughness: 0.9 });
    const group = this.slab(def, body, plate);
    this.group.add(group);
    return group;
  }

  private buildHidden(def: PlatformDef): HiddenView {
    const body = new THREE.MeshStandardMaterial({ color: 0xc9b6ff, emissive: GOLD, emissiveIntensity: 0.2, flatShading: true, transparent: true, opacity: 0 });
    const plate = new THREE.MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 0.5, flatShading: true, transparent: true, opacity: 0 });
    const group = this.slab(def, body, plate);
    group.visible = false;

    // A faint outline so the player can tell "something is here" before it is lit.
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(def.w, 0.08, def.d)),
      new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.2 }),
    );
    edges.position.set(def.cx, def.topY - 0.04, def.cz);
    this.group.add(group, edges);
    const view: HiddenView = { group, plate, body, ghost: edges, pop: 0 };
    this.hiddenViews.set(def.id, view);
    return view;
  }

  /** A floating crystal on a small pedestal. Dim until a pulse wakes it. */
  private buildBeacon(id: string, x: number, y: number, z: number): void {
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.5, 0.7, 6),
      new THREE.MeshStandardMaterial({ color: 0xcfc8ff, flatShading: true }),
    );
    pedestal.position.set(x, y + 0.35, z);
    pedestal.castShadow = true;
    const mat = new THREE.MeshStandardMaterial({ color: 0x6d6a8f, emissive: 0x2a2466, emissiveIntensity: 0.5, flatShading: true });
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), mat);
    const baseY = y + 1.2;
    crystal.position.set(x, baseY, z);
    crystal.scale.y = 1.5;
    crystal.castShadow = true;
    const light = new THREE.PointLight(GOLD, 6, 14, 2);
    light.position.set(x, baseY + 0.6, z);
    this.group.add(pedestal, crystal, light);
    this.beacons.push({ id, crystal, mat, light, baseY });
  }

  private buildCheckpoint(id: string, x: number, y: number, z: number): void {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.09, 3, 6),
      new THREE.MeshStandardMaterial({ color: 0xcfc8ff, flatShading: true }),
    );
    const flagMat = new THREE.MeshStandardMaterial({ color: 0x6d6a8f, flatShading: true, side: THREE.DoubleSide });
    const flag = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.05), flagMat);
    const light = new THREE.PointLight(GOLD, 0, 12, 2);
    const ox = x + 2.2;
    pole.position.set(ox, y + 1.5, z);
    flag.position.set(ox + 0.58, y + 2.5, z);
    light.position.set(ox, y + 3.4, z);
    pole.castShadow = true;
    flag.castShadow = true;
    this.group.add(pole, flag, light);
    this.checkpoints.push({ id, flag: flagMat, light });
  }

  dispose(): void {
    disposeObject(this.group);
  }
}
