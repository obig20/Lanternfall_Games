import * as THREE from 'three';
import { disposeObject } from '../core/dispose';

/**
 * The great tower in the distance: the player's destination.
 * Built from stacked 8-sided rings that taper, with glowing windows and a beacon on top.
 * It is far from the camera, so it reads as a silhouette on the horizon.
 */
export class Tower {
  readonly group = new THREE.Group();

  constructor() {
    const ringA = new THREE.MeshStandardMaterial({ color: 0x4a3f94, flatShading: true, roughness: 1 });
    const ringB = new THREE.MeshStandardMaterial({ color: 0x3a317f, flatShading: true, roughness: 1 });
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xffd36b });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x2c2570, flatShading: true });

    const rings = 9;
    const ringH = 8;
    for (let i = 0; i < rings; i++) {
      const rBottom = 11 - i * 0.55;
      const rTop = rBottom - 0.5;
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, ringH, 8), i % 2 ? ringB : ringA);
      ring.position.y = ringH / 2 + i * ringH;
      ring.rotation.y = i * 0.18;
      this.group.add(ring);

      // A few glowing windows around each ring (deterministic positions).
      for (let w = 0; w < 4; w++) {
        const a = ring.rotation.y + (w / 4) * Math.PI * 2 + 0.4;
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.4), windowMat);
        const r = (rBottom + rTop) / 2 + 0.2;
        win.position.set(Math.cos(a) * r, ring.position.y + 0.5, Math.sin(a) * r);
        win.rotation.y = -a + Math.PI / 2;
        this.group.add(win);
      }
    }

    const topY = rings * ringH;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(7, 14, 8), roofMat);
    roof.position.y = topY + 7;
    const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), windowMat);
    beacon.position.y = topY + 16;
    const beacon2 = new THREE.PointLight(0xffd36b, 400, 120, 2);
    beacon2.position.copy(beacon.position);
    this.group.add(roof, beacon, beacon2);
  }

  dispose(): void {
    disposeObject(this.group);
  }
}
