import * as THREE from 'three';
import { disposeObject } from '../core/dispose';
import { PlayerBody } from '../physics/PlayerBody';
import { Vec3 } from '../physics/aabb';
import { CharacterModel } from './CharacterModel';

/**
 * The player = a physics body (PlayerBody, no graphics) + a little procedural
 * character (this file). Gameplay reads the body; the avatar just follows it.
 */
export class Player {
  readonly body: PlayerBody;
  readonly group = new THREE.Group();
  /** The built-in blocky character. Hidden once an FBX model is attached; kept as a fallback. */
  private readonly procedural = new THREE.Group();
  private model: CharacterModel | null = null;
  private readonly legL: THREE.Mesh;
  private readonly legR: THREE.Mesh;
  private readonly armL: THREE.Mesh;
  private readonly lanternLight: THREE.PointLight;
  private readonly aura: THREE.Mesh;
  private facing = Math.PI; // faces -Z at the start (toward the route)
  private walkPhase = 0;
  private auraRadius = 1;
  private squash = 0; // + = stretch tall (jump), - = squash flat (landing); decays to 0

  constructor(start: Vec3) {
    this.body = new PlayerBody(start);
    this.group.add(this.procedural);

    const cloth = new THREE.MeshStandardMaterial({ color: 0xf3e8cf, flatShading: true, roughness: 0.9 });
    const scarf = new THREE.MeshStandardMaterial({ color: 0xff6b3d, flatShading: true, roughness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xf0c8a0, flatShading: true, roughness: 0.9 });
    const boots = new THREE.MeshStandardMaterial({ color: 0x3b2f5c, flatShading: true, roughness: 1 });

    const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      this.procedural.add(m);
      return m;
    };

    mesh(new THREE.CylinderGeometry(0.26, 0.34, 0.85, 6), cloth, 0, 0.98, 0); // torso / tunic
    mesh(new THREE.TorusGeometry(0.27, 0.07, 5, 8), scarf, 0, 1.4, 0).rotation.x = Math.PI / 2; // scarf
    mesh(new THREE.IcosahedronGeometry(0.22, 0), skin, 0, 1.6, 0); // head
    mesh(new THREE.ConeGeometry(0.27, 0.42, 6), scarf, 0, 1.92, 0); // pointed hat

    this.legL = mesh(new THREE.BoxGeometry(0.17, 0.55, 0.17), boots, -0.12, 0.3, 0);
    this.legR = mesh(new THREE.BoxGeometry(0.17, 0.55, 0.17), boots, 0.12, 0.3, 0);
    this.legL.geometry.translate(0, -0.2, 0);
    this.legR.geometry.translate(0, -0.2, 0);
    this.legL.position.y = 0.55;
    this.legR.position.y = 0.55;
    this.armL = mesh(new THREE.BoxGeometry(0.13, 0.5, 0.13), cloth, 0.38, 1.1, 0);

    // The lantern held in the right hand (character faces local +Z, so its right is -X).
    const lanternBody = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.17, 0),
      new THREE.MeshBasicMaterial({ color: 0xffd36b }),
    );
    lanternBody.position.set(-0.5, 1.15, 0.2);
    this.group.add(lanternBody);
    mesh(new THREE.BoxGeometry(0.13, 0.55, 0.13), cloth, -0.4, 1.2, 0.1).rotation.z = -0.5;

    this.lanternLight = new THREE.PointLight(0xffa83a, 42, 16, 2);
    this.lanternLight.position.copy(lanternBody.position);
    this.group.add(this.lanternLight);

    // Flat ring that shows how far the lantern's light reaches (so the rule is visible).
    this.aura = new THREE.Mesh(
      new THREE.RingGeometry(0.97, 1, 64),
      new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.aura.rotation.x = -Math.PI / 2;

    this.syncTransform();
  }

  /** Where the lantern is, for the light rule (also used by tests via the same formula). */
  get lanternPos(): Vec3 {
    return { x: this.body.pos.x, y: this.body.feetY + 1.3, z: this.body.pos.z };
  }

  /** Swap the blocky stand-in for a loaded FBX character. */
  attachModel(model: CharacterModel): void {
    this.model?.dispose();
    this.model = model;
    this.procedural.visible = false;
    this.group.add(model.root);
  }

  get auraMesh(): THREE.Mesh {
    return this.aura;
  }

  /** Squash/stretch pop for jumps (+) and landings (-). */
  kick(amount: number): void {
    this.squash = amount;
  }

  /** Turn toward the movement direction and animate limbs. */
  updateVisual(dt: number, time: number, lightRadius: number, pulsing: boolean): void {
    const speed = Math.hypot(this.body.vel.x, this.body.vel.z);
    if (speed > 0.4) {
      const target = Math.atan2(this.body.vel.x, this.body.vel.z);
      let diff = target - this.facing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest way round
      this.facing += diff * (1 - Math.exp(-14 * dt));
    }

    if (this.model) {
      const moving = speed > 0.4 && this.body.grounded;
      this.model.play(!this.body.grounded ? 'jump' : moving && this.model.has('run') ? 'run' : 'idle');
      this.model.update(dt);
      // Without a run clip, fake movement with a forward lean and a small bob.
      const lean = moving && !this.model.has('run');
      this.model.root.rotation.x += ((lean ? 0.14 : 0) - this.model.root.rotation.x) * (1 - Math.exp(-10 * dt));
      this.model.root.position.y = lean ? Math.abs(Math.sin(this.walkPhase)) * 0.05 : 0;
    }

    const swing = this.body.grounded ? Math.min(1, speed / 6) : 0.2;
    this.walkPhase += dt * (4 + speed * 1.8);
    const s = Math.sin(this.walkPhase) * 0.8 * swing;
    this.legL.rotation.x = s;
    this.legR.rotation.x = -s;
    this.armL.rotation.x = -s * 0.8;
    if (!this.body.grounded) {
      this.legL.rotation.x = 0.5;
      this.legR.rotation.x = -0.3;
    }

    this.lanternLight.intensity = (pulsing ? 95 : 42) + Math.sin(time * 9) * 3;
    this.auraRadius += (lightRadius - this.auraRadius) * (1 - Math.exp(-7 * dt));
    this.aura.scale.setScalar(this.auraRadius);
    (this.aura.material as THREE.MeshBasicMaterial).opacity = pulsing ? 0.7 : 0.35;

    this.squash *= Math.exp(-12 * dt);
    this.group.scale.set(1 - this.squash * 0.5, 1 + this.squash, 1 - this.squash * 0.5);

    this.syncTransform();
  }

  private syncTransform(): void {
    const feet = this.body.feetY;
    this.group.position.set(this.body.pos.x, feet, this.body.pos.z);
    this.group.rotation.y = this.facing;
    const lp = this.lanternPos;
    this.aura.position.set(lp.x, lp.y - 0.25, lp.z);
  }

  /** Face the route direction again after a respawn. */
  faceRoute(): void {
    this.facing = Math.PI;
  }

  dispose(): void {
    this.model?.dispose();
    disposeObject(this.group);
    disposeObject(this.aura);
  }
}

