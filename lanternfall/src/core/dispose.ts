import * as THREE from 'three';

/** Frees GPU memory for everything under `root`. three.js does not do this automatically. */
export function disposeObject(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
      obj.geometry.dispose();
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach((m: THREE.Material) => m.dispose());
    }
    if (obj instanceof THREE.Light && obj.shadow?.map) {
      obj.shadow.map.dispose();
    }
  });
}
