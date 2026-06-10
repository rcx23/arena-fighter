import { Bullet, type BulletOptions } from './Bullet';
import type { Brawler } from '../Brawler';
import type { PowerCubeBox } from '../PowerCubeBox';
import type { Vec2 } from '../../core/MathUtils';
import type { World } from '../../world/World';

/**
 * Sniper super: a heavy round that passes through every brawler and box in
 * its path, only stopping at walls or max range.
 */
export class PiercingShot extends Bullet {
  private readonly pierced = new Set<Brawler | PowerCubeBox>();

  constructor(owner: Brawler, origin: Vec2, dir: Vec2, opts: BulletOptions) {
    super(owner, origin, dir, opts);
  }

  protected override onHitBrawler(target: Brawler, world: World): boolean {
    if (this.pierced.has(target)) return false;
    this.pierced.add(target);
    target.takeDamage(this.damage, this.owner, world);
    world.events.emit('hitImpact', { position: { ...this.position } });
    return false;
  }

  protected override onHitBox(box: PowerCubeBox, world: World): boolean {
    if (this.pierced.has(box)) return false;
    this.pierced.add(box);
    box.takeDamage(this.damage, this.owner, world);
    return false;
  }
}
