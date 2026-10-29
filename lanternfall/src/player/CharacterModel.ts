import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { disposeObject } from '../core/dispose';

export interface CharacterAssets {
  /** Rigged character with at least one animation clip (Mixamo-style FBX). */
  fbx: string;
  /** Base-colour texture. The FBX file itself references no texture files. */
  baseColor: string;
  /** Optional extra clips by name, e.g. { run: '.../run.fbx' } (any Mixamo FBX with the same skeleton). */
  extraClips?: Record<string, string>;
}

/** Matches the player's physics box (1.8 m tall), so the feet line up with the platforms. */
const TARGET_HEIGHT = 1.8;

/**
 * A skinned, animated character loaded from FBX.
 * Clip names used by the game: 'idle', 'jump', and (if provided) 'run'.
 */
export class CharacterModel {
  readonly root = new THREE.Group();
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private readonly texture: THREE.Texture;
  private current: string | null = null;

  private constructor(private readonly model: THREE.Group, texture: THREE.Texture) {
    this.texture = texture;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;

    // Replace the FBX's own material (it has no textures) with one that uses our texture.
    model.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const old = Array.isArray(obj.material) ? obj.material : [obj.material];
      old.forEach((m: THREE.Material) => m.dispose());
      obj.material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85, metalness: 0 });
      obj.castShadow = true;
      obj.frustumCulled = false; // skinned meshes can be culled wrongly while animating
    });

    // FBX files from Mixamo are usually in centimetres: scale to 1.8 m and stand the feet on y = 0.
    model.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(model);
    const height = box.max.y - box.min.y;
    if (height > 0) model.scale.multiplyScalar(TARGET_HEIGHT / height);
    model.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(model);
    model.position.x -= (box.min.x + box.max.x) / 2;
    model.position.z -= (box.min.z + box.max.z) / 2;
    model.position.y -= box.min.y;

    this.root.add(model);
    this.mixer = new THREE.AnimationMixer(model);

    const clip = model.animations[0];
    if (clip) {
      CharacterModel.stripRootMotion(clip);
      this.addClip('jump', clip, true);
      // The first frames of the jump clip are a standing pose: use them as a still "idle".
      this.addClip('idle', THREE.AnimationUtils.subclip(clip, 'idle', 0, 2, 30), false);
    }
  }

  static async load(assets: CharacterAssets): Promise<CharacterModel> {
    const loader = new FBXLoader();
    const [fbx, texture] = await Promise.all([
      loader.loadAsync(assets.fbx),
      new THREE.TextureLoader().loadAsync(assets.baseColor),
    ]);
    const character = new CharacterModel(fbx, texture);
    for (const [name, url] of Object.entries(assets.extraClips ?? {})) {
      const extra = await loader.loadAsync(url);
      const clip = extra.animations[0];
      if (clip) {
        CharacterModel.stripRootMotion(clip);
        character.addClip(name, clip, false);
      }
    }
    character.play('idle', 0);
    return character;
  }

  /**
   * Mixamo clips move the hips through space. Our physics already moves the player,
   * so keeping that motion would make the character float above or ahead of its box.
   */
  private static stripRootMotion(clip: THREE.AnimationClip): void {
    clip.tracks = clip.tracks.filter((t) => !/Hips\.position$/.test(t.name));
  }

  private addClip(name: string, clip: THREE.AnimationClip, once: boolean): void {
    const action = this.mixer.clipAction(clip);
    if (once) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true; // hold the last pose while still falling
    }
    this.actions.set(name, action);
  }

  has(name: string): boolean {
    return this.actions.has(name);
  }

  /** Cross-fade to a clip. Does nothing if it is already playing or does not exist. */
  play(name: string, fade = 0.15): void {
    if (this.current === name) return;
    const next = this.actions.get(name);
    if (!next) return;
    const prev = this.current ? this.actions.get(this.current) : undefined;
    next.reset().setEffectiveWeight(1).fadeIn(fade).play();
    prev?.fadeOut(fade);
    this.current = name;
  }

  update(dt: number): void {
    this.mixer.update(dt);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    this.model.traverse((obj) => {
      if (obj instanceof THREE.SkinnedMesh) obj.skeleton.dispose();
    });
    this.texture.dispose();
    disposeObject(this.root);
  }
}
