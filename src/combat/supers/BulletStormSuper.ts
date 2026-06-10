import { Super } from '../Super';
import { Entity } from '../../entities/Entity';
import { Bullet } from '../../entities/projectiles/Bullet';
import { angleOf, fromAngle, sub, type Vec2 } from '../../core/MathUtils';
import type { Brawler } from '../../entities/Brawler';
import type { World } from '../../world/World';

/** Helper entity that spawns the super's bullets over time, then expires. */
class BurstSpawner extends Entity {
  private timer = 0;
  private shotsLeft: number;

  constructor(
    private readonly owner: Brawler,
    private readonly angle: number,
    shots: number,
    private readonly interval: number,
    private readonly spawn: (owner: Brawler, dir: Vec2, world: World) => void,
  ) {
    super();
    this.shotsLeft = shots;
    this.position = { ...owner.position };
  }

  update(dt: number, world: World): void {
    if (!this.owner.alive) {
      this.destroy();
      return;
    }
    this.timer -= dt;
    while (this.timer <= 0 && this.shotsLeft > 0) {
      this.timer += this.interval;
      this.shotsLeft--;
      this.spawn(this.owner, fromAngle(this.angle + (world.rng.next() - 0.5) * 0.06), world);
    }
    if (this.shotsLeft <= 0) this.destroy();
  }
}

/**
 * Shooter super: a long burst of heavy rounds that blast through walls,
 * carving a line through the map.
 */
export class BulletStormSuper extends Super {
  constructor() {
    super('Bullet Storm');
  }

  protected activate(owner: Brawler, aimPoint: Vec2, world: World): void {
    const angle = angleOf(sub(aimPoint, owner.position));
    world.add(
      new BurstSpawner(owner, angle, 10, 0.07, (o, dir, w) => {
        const origin = {
          x: o.position.x + dir.x * (o.radius + 0.25),
          z: o.position.z + dir.z * (o.radius + 0.25),
        };
        w.add(
          new Bullet(o, origin, dir, {
            damage: 380 * o.damageMultiplier,
            speed: 16,
            range: 10,
            size: 0.16,
            color: 0xff4d3e,
            breaksWalls: true,
          }),
        );
      }),
    );
  }
}
