/** 2D vector on the gameplay (XZ) plane. The 3D rendering maps x->x, z->z, height->y. */
export interface Vec2 {
  x: number;
  z: number;
}

export const vec2 = (x = 0, z = 0): Vec2 => ({ x, z });

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, z: a.z + b.z });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, z: a.z - b.z });
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, z: a.z * s });
export const len = (a: Vec2): number => Math.hypot(a.x, a.z);
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z);

export function norm(a: Vec2): Vec2 {
  const l = len(a);
  return l > 1e-6 ? { x: a.x / l, z: a.z / l } : { x: 0, z: 0 };
}

/** Angle of a direction vector, used as entity yaw (atan2 in XZ). */
export const angleOf = (a: Vec2): number => Math.atan2(a.x, a.z);
export const fromAngle = (rad: number): Vec2 => ({ x: Math.sin(rad), z: Math.cos(rad) });
export const rotate = (a: Vec2, rad: number): Vec2 => ({
  x: a.x * Math.cos(rad) + a.z * Math.sin(rad),
  z: -a.x * Math.sin(rad) + a.z * Math.cos(rad),
});

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Exponential smoothing factor that is stable across frame rates. */
export const damp = (a: number, b: number, lambda: number, dt: number): number =>
  lerp(a, b, 1 - Math.exp(-lambda * dt));

/** Seedable PRNG (mulberry32) so map generation is reproducible per match. */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  pick<T>(arr: readonly T[]): T {
    const item = arr[this.int(0, arr.length - 1)];
    if (item === undefined) throw new Error('Rng.pick on empty array');
    return item;
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      const a = arr[i] as T;
      arr[i] = arr[j] as T;
      arr[j] = a;
    }
    return arr;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }
}
