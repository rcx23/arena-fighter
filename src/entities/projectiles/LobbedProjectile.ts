import { Projectile } from './Projectile';
import { PowerCubeBox } from '../PowerCubeBox';
import { dist, lerp, type Vec2 } from '../../core/MathUtils';
import type { Brawler } from '../Brawler';
import type { World } from '../../world/World';

export interface LobOptions {
  damage: number;
  /** Area-of-effect radius at the landing point. */
  aoeRadius: number;
  /** Horizontal travel speed; flight time derives from distance. */
  speed: number;
  arcHeight?: number;
  color?: number;
  size?: number;
}

/**
 * Thrower projectile: flies over walls on a fixed arc to the target point and
 * explodes there, damaging everything in the blast radius.
 */
export class LobbedProjectile extends Projectile {
  private readonly origin: Vec2;
  private readonly target: Vec2;
  private readonly flightTime: number;
  private readonly aoeRadius: number;
  private readonly arcHeight: number;
  private t = 0;

  constructor(owner: Brawler, origin: Vec2, target: Vec2, opts: LobOptions) {
    super(owner, opts.damage);
    this.origin = { ...origin };
    this.target = { ...target };
    this.position = { ...origin };
    this.flightTime = Math.max(0.25, dist(origin, target) / opts.speed);
    this.aoeRadius = opts.aoeRadius;
    this.arcHeight = opts.arcHeight ?? 2.2;
    this.visualColor = opts.color ?? 0xff5e2c;
    this.visualSize = opts.size ?? 0.17;
  }

  update(dt: number, world: World): void {
    this.t += dt / this.flightTime;
    if (this.t >= 1) {
      this.explode(world);
      return;
    }
    this.position.x = lerp(this.origin.x, this.target.x, this.t);
    this.position.z = lerp(this.origin.z, this.target.z, this.t);
    // Parabolic arc, purely visual: gameplay stays on the XZ plane.
    this.visualHeight = 0.4 + this.arcHeight * 4 * this.t * (1 - this.t);
  }

  private explode(world: World): void {
    this.position = { ...this.target };
    for (const b of world.brawlersInRadius(this.target, this.aoeRadius, this.owner)) {
      b.takeDamage(this.damage, this.owner, world);
    }
    for (const box of world.entitiesOfType(PowerCubeBox)) {
      if (dist(box.position, this.target) <= this.aoeRadius + box.radius) {
        box.takeDamage(this.damage, this.owner, world);
      }
    }
    world.events.emit('explosion', { position: { ...this.target }, radius: this.aoeRadius });
    this.destroy();
  }
}
