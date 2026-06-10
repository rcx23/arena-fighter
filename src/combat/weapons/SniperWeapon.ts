import { Weapon } from '../Weapon';
import { Bullet } from '../../entities/projectiles/Bullet';
import { norm, sub, type Vec2 } from '../../core/MathUtils';
import type { Brawler } from '../../entities/Brawler';
import type { World } from '../../world/World';

export interface SniperOptions {
  damage: number;
  range: number;
  speed: number;
  attackInterval: number;
}

/** Sniper basic attack: one slow-firing, long-range, high-damage round. */
export class SniperWeapon extends Weapon {
  constructor(private readonly opts: SniperOptions) {
    super(opts.attackInterval, opts.range);
  }

  protected fire(owner: Brawler, aimPoint: Vec2, world: World): void {
    const dir = norm(sub(aimPoint, owner.position));
    const origin = {
      x: owner.position.x + dir.x * (owner.radius + 0.3),
      z: owner.position.z + dir.z * (owner.radius + 0.3),
    };
    world.add(
      new Bullet(owner, origin, dir, {
        damage: this.opts.damage * owner.damageMultiplier,
        speed: this.opts.speed,
        range: this.opts.range,
        size: 0.15,
        color: 0x9be7ff,
      }),
    );
  }
}
