import { Super } from '../Super';
import { LobbedProjectile } from '../../entities/projectiles/LobbedProjectile';
import { dist, norm, scale, sub, add, type Vec2 } from '../../core/MathUtils';
import type { Brawler } from '../../entities/Brawler';
import type { World } from '../../world/World';

const RANGE = 9;
const SHELLS = 6;

/** Thrower super: carpets an area around the aim point with explosives. */
export class AreaBarrageSuper extends Super {
  constructor() {
    super('Area Barrage');
  }

  protected activate(owner: Brawler, aimPoint: Vec2, world: World): void {
    let center = aimPoint;
    if (dist(owner.position, aimPoint) > RANGE) {
      center = add(owner.position, scale(norm(sub(aimPoint, owner.position)), RANGE));
    }
    for (let i = 0; i < SHELLS; i++) {
      const angle = world.rng.range(0, Math.PI * 2);
      const r = i === 0 ? 0 : world.rng.range(0.4, 2.2);
      const target = { x: center.x + Math.sin(angle) * r, z: center.z + Math.cos(angle) * r };
      world.add(
        new LobbedProjectile(owner, owner.position, target, {
          damage: 800 * owner.damageMultiplier,
          aoeRadius: 1.6,
          // Varied speeds stagger the impacts into a rolling barrage.
          speed: world.rng.range(5.5, 8.5),
          arcHeight: 3,
          color: 0xff3e2c,
          size: 0.2,
        }),
      );
    }
  }
}
