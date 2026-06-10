import { Super } from '../Super';
import { PiercingShot } from '../../entities/projectiles/PiercingShot';
import { norm, sub, type Vec2 } from '../../core/MathUtils';
import type { Brawler } from '../../entities/Brawler';
import type { World } from '../../world/World';

/** Sniper super: a massive round that pierces every enemy in a line. */
export class PiercingShotSuper extends Super {
  constructor() {
    super('Railshot');
  }

  protected activate(owner: Brawler, aimPoint: Vec2, world: World): void {
    const dir = norm(sub(aimPoint, owner.position));
    const origin = {
      x: owner.position.x + dir.x * (owner.radius + 0.3),
      z: owner.position.z + dir.z * (owner.radius + 0.3),
    };
    world.add(
      new PiercingShot(owner, origin, dir, {
        damage: 2200 * owner.damageMultiplier,
        speed: 28,
        range: 16,
        size: 0.22,
        color: 0x6cf0ff,
      }),
    );
  }
}
