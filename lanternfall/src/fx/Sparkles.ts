import * as THREE from 'three';

/** A small pool of glowing points used for reveal bursts, landing dust, and the lantern pulse. */
export class Sparkles {
  readonly points: THREE.Points;
  private readonly count = 300;
  private readonly pos = new Float32Array(this.count * 3);
  private readonly col = new Float32Array(this.count * 3);
  private readonly base = new Float32Array(this.count * 3);
  private readonly vel = new Float32Array(this.count * 3);
  private readonly life = new Float32Array(this.count);
  private readonly maxLife = new Float32Array(this.count);
  private next = 0;

  constructor() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.22,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  /** Spray `n` particles from a point. `up` adds upward drift. */
  burst(x: number, y: number, z: number, n: number, color: number, speed = 2.5, up = 1.5): void {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      const k = this.next;
      this.next = (this.next + 1) % this.count;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.pos.set([x, y, z], k * 3);
      this.vel.set([Math.cos(a) * s, up * (0.3 + Math.random()), Math.sin(a) * s], k * 3);
      this.base.set([c.r, c.g, c.b], k * 3);
      this.life[k] = this.maxLife[k] = 0.5 + Math.random() * 0.6;
    }
  }

  /** A flat ring of particles flying outward (the lantern pulse). */
  ring(x: number, y: number, z: number, n: number, color: number, speed: number): void {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      const k = this.next;
      this.next = (this.next + 1) % this.count;
      const a = (i / n) * Math.PI * 2;
      this.pos.set([x, y, z], k * 3);
      this.vel.set([Math.cos(a) * speed, 0.2, Math.sin(a) * speed], k * 3);
      this.base.set([c.r, c.g, c.b], k * 3);
      this.life[k] = this.maxLife[k] = 0.7;
    }
  }

  update(dt: number): void {
    for (let k = 0; k < this.count; k++) {
      if (this.life[k] <= 0) {
        this.col[k * 3] = this.col[k * 3 + 1] = this.col[k * 3 + 2] = 0;
        continue;
      }
      this.life[k] -= dt;
      const f = Math.max(0, this.life[k] / this.maxLife[k]);
      for (let a = 0; a < 3; a++) {
        this.pos[k * 3 + a] += this.vel[k * 3 + a] * dt;
        this.col[k * 3 + a] = this.base[k * 3 + a] * f;
      }
      this.vel[k * 3 + 1] -= 2 * dt;
    }
    (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
