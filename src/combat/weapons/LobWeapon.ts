import { Weapon } from '../Weapon';
import { LobbedProjectile } from '../../entities/projectiles/LobbedProjectile';
import { dist, norm, scale, sub, add, type Vec2 } from '../../core/MathUtils';
import type { Brawler } from '../../entities/Brawler';
import type { World } from '../../world/World';

export interface LobWeaponOptions {
  damage: number;
  aoeRadius: number;
  range: number;
  speed: number;
  attackInterval: number;
}

/** Thrower basic attack: a grenade lobbed over walls to the aim point. */
export class LobWeapon extends Weapon {
  constructor(private readonly opts: LobWeaponOptions) {
    super(opts.attackInterval, opts.range);
  }

  protected fire(owner: Brawler, aimPoint: Vec2, world: World): void {
    // Clamp the landing point to weapon range.
    let target = aimPoint;
    const d = dist(owner.position, aimPoint);
    if (d > this.opts.range) {
      target = add(owner.position, scale(norm(sub(aimPoint, owner.position)), this.opts.range));
    }
    world.add(
      new LobbedProjectile(owner, owner.position, target, {
        damage: this.opts.damage * owner.damageMultiplier,
        aoeRadius: this.opts.aoeRadius,
        speed: this.opts.speed,
      }),
    );
  }
}
