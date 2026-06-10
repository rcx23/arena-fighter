import { Weapon } from '../Weapon';
import { Bullet } from '../../entities/projectiles/Bullet';
import { angleOf, fromAngle, sub, type Vec2 } from '../../core/MathUtils';
import type { Brawler } from '../../entities/Brawler';
import type { World } from '../../world/World';

export interface SpreadOptions {
  pellets: number;
  damagePerPellet: number;
  spreadRadians: number;
  range: number;
  speed: number;
  attackInterval: number;
}

/** Shotgunner basic attack: a fan of short-range pellets. */
export class SpreadWeapon extends Weapon {
  constructor(private readonly opts: SpreadOptions) {
    super(opts.attackInterval, opts.range);
  }

  protected fire(owner: Brawler, aimPoint: Vec2, world: World): void {
    const baseAngle = angleOf(sub(aimPoint, owner.position));
    const { pellets, spreadRadians } = this.opts;
    for (let i = 0; i < pellets; i++) {
      const t = pellets === 1 ? 0 : i / (pellets - 1) - 0.5;
      const dir = fromAngle(baseAngle + t * spreadRadians);
      const origin = {
        x: owner.position.x + dir.x * (owner.radius + 0.25),
        z: owner.position.z + dir.z * (owner.radius + 0.25),
      };
      world.add(
        new Bullet(owner, origin, dir, {
          damage: this.opts.damagePerPellet * owner.damageMultiplier,
          speed: this.opts.speed,
          range: this.opts.range * world.rng.range(0.85, 1),
          size: 0.09,
          color: 0xffa03e,
        }),
      );
    }
  }
}
