import { clamp, lerp, type Vec2 } from '../core/MathUtils';
import type { World } from '../world/World';

export interface SafeRect {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

const GRACE_PERIOD = 12;
const SHRINK_INTERVAL = 11;
const SHRINK_ANIMATION = 3;
const SHRINK_PER_SIDE = 2.5;
const MIN_SIZE = 7;
const DAMAGE_FRACTION_PER_SEC = 0.12;
const DAMAGE_TICK = 0.5;

/**
 * Showdown's closing poison gas: a rectangular safe area that steps inward on
 * a timer. Standing outside drains a fraction of max health per second and
 * never charges anyone's super.
 */
export class PoisonZone {
  current: SafeRect;
  private from: SafeRect;
  private target: SafeRect;
  private animT = 1;
  private nextShrinkAt = GRACE_PERIOD;
  private damageTimer = 0;

  constructor(private readonly mapSize: number) {
    const full = { minX: 1, minZ: 1, maxX: mapSize - 1, maxZ: mapSize - 1 };
    this.current = { ...full };
    this.from = { ...full };
    this.target = { ...full };
  }

  get isFullyShrunk(): boolean {
    return this.target.maxX - this.target.minX <= MIN_SIZE;
  }

  /** Seconds until the next shrink begins (for the HUD). */
  timeToNextShrink(time: number): number {
    return Math.max(0, this.nextShrinkAt - time);
  }

  get safeCenter(): Vec2 {
    return {
      x: (this.current.minX + this.current.maxX) / 2,
      z: (this.current.minZ + this.current.maxZ) / 2,
    };
  }

  contains(pos: Vec2): boolean {
    return (
      pos.x >= this.current.minX &&
      pos.x <= this.current.maxX &&
      pos.z >= this.current.minZ &&
      pos.z <= this.current.maxZ
    );
  }

  update(dt: number, world: World): void {
    if (world.time >= this.nextShrinkAt && this.animT >= 1 && !this.isFullyShrunk) {
      this.beginShrink();
      this.nextShrinkAt = world.time + SHRINK_INTERVAL;
    }

    if (this.animT < 1) {
      this.animT = Math.min(1, this.animT + dt / SHRINK_ANIMATION);
      this.current.minX = lerp(this.from.minX, this.target.minX, this.animT);
      this.current.minZ = lerp(this.from.minZ, this.target.minZ, this.animT);
      this.current.maxX = lerp(this.from.maxX, this.target.maxX, this.animT);
      this.current.maxZ = lerp(this.from.maxZ, this.target.maxZ, this.animT);
    }

    this.damageTimer += dt;
    if (this.damageTimer >= DAMAGE_TICK) {
      this.damageTimer -= DAMAGE_TICK;
      for (const b of world.brawlersAlive()) {
        if (!this.contains(b.position)) {
          // source=null: the gas kills without crediting or charging anyone.
          b.takeDamage(b.effectiveMaxHealth * DAMAGE_FRACTION_PER_SEC * DAMAGE_TICK, null, world);
        }
      }
    }
  }

  private beginShrink(): void {
    this.from = { ...this.current };
    const center = this.mapSize / 2;
    const shrink = (lo: number, hi: number): [number, number] => {
      let nLo = lo + SHRINK_PER_SIDE;
      let nHi = hi - SHRINK_PER_SIDE;
      if (nHi - nLo < MIN_SIZE) {
        nLo = clamp(center - MIN_SIZE / 2, lo, center);
        nHi = clamp(center + MIN_SIZE / 2, center, hi);
      }
      return [nLo, nHi];
    };
    const [minX, maxX] = shrink(this.target.minX, this.target.maxX);
    const [minZ, maxZ] = shrink(this.target.minZ, this.target.maxZ);
    this.target = { minX, minZ, maxX, maxZ };
    this.animT = 0;
  }
}
