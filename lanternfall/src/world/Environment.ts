import * as THREE from 'three';
import { disposeObject } from '../core/dispose';
import { GOAL, CHECKPOINTS } from './LevelData';
import { Tower } from './Tower';

/** Deterministic pseudo-random numbers, so the world looks the same every run. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HAZE = 0x9a68bd; // horizon colour; fog uses the same so distant things melt into the sky

/** Sky, stars, moon, lights, mist, floating rocks, ruins, and the far tower. */
export class Environment {
  readonly group = new THREE.Group();
  private readonly tower = new Tower();
  private readonly moon: THREE.DirectionalLight;
  private readonly rocks: { mesh: THREE.Mesh; baseY: number; phase: number }[] = [];

  constructor(scene: THREE.Scene) {
    scene.background = new THREE.Color(HAZE);
    scene.fog = new THREE.Fog(HAZE, 55, 200);

    this.group.add(this.buildSky(), this.buildStars(), this.buildMoon());

    // Readable lighting: bright violet sky light + cool moon with soft shadows.
    const hemi = new THREE.HemisphereLight(0xb7a8ff, 0x6a4a86, 1.2);
    this.moon = new THREE.DirectionalLight(0xdfe6ff, 2.5);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(2048, 2048);
    Object.assign(this.moon.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
    this.moon.shadow.bias = -0.0006;
    this.group.add(hemi, this.moon, this.moon.target);

    // Sea of mist far below the platforms.
    const mist = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.MeshBasicMaterial({ color: 0x6a4aa6, transparent: true, opacity: 0.92 }),
    );
    mist.rotation.x = -Math.PI / 2;
    mist.position.y = -14;
    this.group.add(mist);

    this.tower.group.position.set(GOAL.x, -14, GOAL.z - 32);
    this.group.add(this.tower.group);

    this.buildRocks();
    this.buildRuins();
  }

  /** Keep the shadow-casting moon centred on the player so shadows stay sharp. */
  update(playerPos: THREE.Vector3, time: number): void {
    this.moon.position.set(playerPos.x - 25, playerPos.y + 45, playerPos.z + 20);
    this.moon.target.position.copy(playerPos);
    for (const r of this.rocks) r.mesh.position.y = r.baseY + Math.sin(time * 0.5 + r.phase) * 0.6;
  }

  private buildSky(): THREE.Mesh {
    const geo = new THREE.SphereGeometry(400, 24, 16);
    const pos = geo.getAttribute('position');
    const colors: number[] = [];
    const top = new THREE.Color(0x0e0a3a);
    const mid = new THREE.Color(0x3a2f9a);
    const horizon = new THREE.Color(HAZE);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = THREE.MathUtils.clamp(pos.getY(i) / 400, 0, 1);
      if (t < 0.35) c.lerpColors(horizon, mid, t / 0.35);
      else c.lerpColors(mid, top, (t - 0.35) / 0.65);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  }

  private buildStars(): THREE.Points {
    const r = rng(7);
    const pts: number[] = [];
    for (let i = 0; i < 500; i++) {
      const a = r() * Math.PI * 2;
      const e = 0.12 + r() * 1.3; // elevation above horizon
      const d = 380;
      pts.push(Math.cos(a) * Math.cos(e) * d, Math.sin(e) * d, Math.sin(a) * Math.cos(e) * d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xfff3c9, size: 2, sizeAttenuation: false, fog: false }));
  }

  private buildMoon(): THREE.Group {
    const g = new THREE.Group();
    const moon = new THREE.Mesh(new THREE.SphereGeometry(22, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff1c9, fog: false }));
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(36, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xcdbfff, transparent: true, opacity: 0.18, fog: false, depthWrite: false }),
    );
    g.add(moon, halo);
    g.position.set(-160, 190, -300);
    return g;
  }

  private buildRocks(): void {
    const r = rng(21);
    const mat = new THREE.MeshStandardMaterial({ color: 0x5d5199, flatShading: true, roughness: 1 }); // darker than gameplay stone
    for (let i = 0; i < 22; i++) {
      const side = i % 2 ? 1 : -1;
      const size = 1.5 + r() * 3.5;
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 0), mat);
      const x = side * (14 + r() * 28);
      const y = -6 + r() * 22;
      const z = 10 - r() * 100;
      mesh.position.set(x, y, z);
      mesh.rotation.set(r() * 3, r() * 3, r() * 3);
      mesh.scale.y = 0.7 + r() * 0.6;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.rocks.push({ mesh, baseY: y, phase: r() * 6 });
    }
  }

  private column(x: number, baseY: number, z: number, h: number, broken: boolean): void {
    const mat = new THREE.MeshStandardMaterial({ color: 0xd9c9b0, flatShading: true, roughness: 0.9 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, h, 6), mat);
    shaft.position.set(x, baseY + h / 2, z);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 1.4), mat);
    base.position.set(x, baseY + 0.15, z);
    const parts: THREE.Mesh[] = [shaft, base];
    if (!broken) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.35, 1.3), mat);
      cap.position.set(x, baseY + h + 0.17, z);
      parts.push(cap);
    } else {
      shaft.rotation.z = 0.06; // a little crooked
    }
    for (const p of parts) {
      p.castShadow = true;
      p.receiveShadow = true;
      this.group.add(p);
    }
  }

  private buildRuins(): void {
    // Start platform: crumbling columns and a glowing rune circle.
    this.column(-5.2, 0, -5.2, 6, false);
    this.column(5.2, 0, -5.2, 3, true);
    this.column(-5.2, 0, 5.2, 2.2, true);
    const rune = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 2.6, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    rune.rotation.x = -Math.PI / 2;
    rune.position.set(0, 0.03, 0);
    this.group.add(rune);

    // Checkpoint platform.
    for (const c of CHECKPOINTS) {
      this.column(c.x - 2.4, c.y, c.z + 2.3, 4.5, false);
      this.column(c.x + 0.2, c.y, c.z + 2.6, 2, true);
    }

    // Goal gate: two columns and a lintel framing the ring.
    const gx = GOAL.x;
    this.column(gx - 2.4, GOAL.y, GOAL.z - 0.5, 6.5, false);
    this.column(gx + 2.4, GOAL.y, GOAL.z - 0.5, 6.5, false);
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(6.8, 0.9, 1.4),
      new THREE.MeshStandardMaterial({ color: 0xd9c9b0, flatShading: true }),
    );
    lintel.position.set(gx, GOAL.y + 7.4, GOAL.z - 0.5);
    lintel.castShadow = true;
    this.group.add(lintel);
  }

  dispose(): void {
    this.tower.dispose();
    disposeObject(this.group);
  }
}
