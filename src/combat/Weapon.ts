import type { Vec2 } from '../core/MathUtils';
import type { Brawler } from '../entities/Brawler';
import type { World } from '../world/World';

/**
 * Strategy object for a brawler's basic attack. Subclasses implement fire();
 * the base class owns cooldown and ammo bookkeeping. Burst weapons can keep
 * spawning projectiles from update().
 */
export abstract class Weapon {
  protected cooldown = 0;

  constructor(
    /** Seconds between attacks (one ammo bar each). */
    protected readonly attackInterval: number,
    /** Max range, used by bot AI to pick engagement distance. */
    readonly range: number,
    /** Blast radius for area weapons; drives the aim indicator's AoE circle. */
    readonly aoeRadius?: number,
  ) {}

  tryFire(owner: Brawler, aimPoint: Vec2, world: World): boolean {
    if (this.cooldown > 0 || !owner.ammo.canFire()) return false;
    owner.ammo.consume();
    this.cooldown = this.attackInterval;
    this.fire(owner, aimPoint, world);
    owner.noteFired(world);
    return true;
  }

  update(dt: number, _owner: Brawler, _world: World): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
  }

  protected abstract fire(owner: Brawler, aimPoint: Vec2, world: World): void;
}
