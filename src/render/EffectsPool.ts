import * as THREE from 'three';
import { fromAngle, type Vec2 } from '../core/MathUtils';

interface Effect {
  object: THREE.Object3D;
  age: number;
  ttl: number;
  tick(t: number, object: THREE.Object3D): void;
  onDone?: () => void;
}

const ringGeo = new THREE.RingGeometry(0.5, 0.85, 24);
const puffGeo = new THREE.SphereGeometry(0.16, 8, 8);
const flashGeo = new THREE.SphereGeometry(0.12, 8, 8);

function basicMat(color: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/**
 * Transient, untracked visuals: explosion rings, muzzle flashes, hit puffs
 * and death tumbles. Purely cosmetic — nothing here touches the simulation.
 */
export class EffectsPool {
  private effects: Effect[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  update(dt: number): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i] as Effect;
      e.age += dt;
      const t = Math.min(1, e.age / e.ttl);
      e.tick(t, e.object);
      if (t >= 1) {
        this.scene.remove(e.object);
        e.onDone?.();
        this.effects.splice(i, 1);
      }
    }
  }

  clear(): void {
    for (const e of this.effects) this.scene.remove(e.object);
    this.effects = [];
  }

  private push(effect: Effect): void {
    this.scene.add(effect.object);
    this.effects.push(effect);
  }

  explosion(position: Vec2, radius: number): void {
    // Black ink ring just behind the hot ring - comic-book blast read.
    const inkMat = basicMat(0x140c10);
    const inkRing = new THREE.Mesh(ringGeo, inkMat);
    inkRing.rotation.x = -Math.PI / 2;
    inkRing.position.set(position.x, 0.05, position.z);
    this.push({
      object: inkRing,
      age: 0,
      ttl: 0.4,
      tick(t, o) {
        const s = (0.3 + (radius / 0.85) * t) * 1.18;
        o.scale.set(s, s, s);
        inkMat.opacity = 0.9 * (1 - t);
      },
      onDone: () => inkMat.dispose(),
    });
    const mat = basicMat(0xffb234);
    const ring = new THREE.Mesh(ringGeo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(position.x, 0.06, position.z);
    this.push({
      object: ring,
      age: 0,
      ttl: 0.4,
      tick(t, o) {
        const s = 0.3 + (radius / 0.85) * t;
        o.scale.set(s, s, s);
        mat.opacity = 1 - t;
      },
      onDone: () => mat.dispose(),
    });
    const flashMat = basicMat(0xfff1ba);
    const flash = new THREE.Mesh(puffGeo, flashMat);
    flash.position.set(position.x, 0.4, position.z);
    this.push({
      object: flash,
      age: 0,
      ttl: 0.22,
      tick(t, o) {
        const s = 1 + radius * 2.2 * t;
        o.scale.set(s, s, s);
        flashMat.opacity = 0.9 * (1 - t);
      },
      onDone: () => flashMat.dispose(),
    });
  }

  hitPuff(position: Vec2): void {
    const mat = basicMat(0xffffff);
    const puff = new THREE.Mesh(puffGeo, mat);
    puff.position.set(position.x, 0.85, position.z);
    this.push({
      object: puff,
      age: 0,
      ttl: 0.18,
      tick(t, o) {
        const s = 0.6 + 1.6 * t;
        o.scale.set(s, s, s);
        mat.opacity = 0.8 * (1 - t);
      },
      onDone: () => mat.dispose(),
    });
  }

  muzzleFlash(position: Vec2, rotation: number): void {
    const dir = fromAngle(rotation);
    const mat = basicMat(0xffe27a);
    const flash = new THREE.Mesh(flashGeo, mat);
    flash.position.set(position.x + dir.x * 0.65, 0.95, position.z + dir.z * 0.65);
    this.push({
      object: flash,
      age: 0,
      ttl: 0.08,
      tick(t, o) {
        o.scale.setScalar(1 + t);
        mat.opacity = 1 - t;
      },
      onDone: () => mat.dispose(),
    });
  }

  /** Takes ownership of a character group and tumbles it into the ground. */
  corpse(group: THREE.Object3D, onDone: () => void): void {
    const startY = group.position.y;
    this.push({
      object: group,
      age: 0,
      ttl: 0.7,
      tick(t, o) {
        o.rotation.x = (-Math.PI / 2) * Math.min(1, t * 1.4);
        o.position.y = startY - 0.4 * t * t;
        const s = 1 - 0.55 * t;
        o.scale.setScalar(Math.max(0.05, s));
      },
      onDone,
    });
  }
}
