import { Projectile } from './Projectile';
import { Brawler } from '../Brawler';
import { PowerCubeBox } from '../PowerCubeBox';
import { norm, type Vec2 } from '../../core/MathUtils';
import type { World } from '../../world/World';

export interface BulletOptions {
  damage: number;
  speed: number;
  range: number;
  size?: number;
  color?: number;
  /** Wall tiles hit are destroyed and the bullet continues (Bullet Storm super). */
  breaksWalls?: boolean;
}

/**
 * Straight-line projectile that stops on the first wall, box or brawler hit.
 */
export class Bullet extends Projectile {
  protected readonly dir: Vec2;
  protected readonly speed: number;
  protected readonly maxRange: number;
  protected traveled = 0;
  private readonly breaksWalls: boolean;

  constructor(owner: Brawler, origin: Vec2, dir: Vec2, opts: BulletOptions) {
    super(owner, opts.damage);
    this.position = { ...origin };
    this.dir = norm(dir);
    this.speed = opts.speed;
    this.maxRange = opts.range;
    this.breaksWalls = opts.breaksWalls ?? false;
    this.visualSize = opts.size ?? 0.13;
    this.visualColor = opts.color ?? 0xffd23e;
    this.radius = this.visualSize;
    this.visualHeight = 0.55;
  }

  update(dt: number, world: World): void {
    // Substep so fast projectiles can't tunnel through thin colliders.
    let step = this.speed * dt;
    while (step > 0 && this.alive) {
      const sub = Math.min(step, 0.2);
      step -= sub;
      this.advance(sub, world);
    }
  }

  private advance(step: number, world: World): void {
    this.position.x += this.dir.x * step;
    this.position.z += this.dir.z * step;
    this.traveled += step;

    if (this.traveled >= this.maxRange) {
      this.destroy();
      return;
    }

    if (world.map.blocksProjectileAt(this.position)) {
      this.onHitWall(world);
      if (!this.alive) return;
    }

    for (const target of world.brawlersInRadius(this.position, this.radius + 0.38, this.owner)) {
      if (this.onHitBrawler(target, world)) return;
    }
    for (const box of world.entitiesOfType(PowerCubeBox)) {
      const d = Math.hypot(box.position.x - this.position.x, box.position.z - this.position.z);
      if (d <= this.radius + box.radius) {
        if (this.onHitBox(box, world)) return;
      }
    }
  }

  /** @returns true if the projectile was consumed. */
  protected onHitBrawler(target: Brawler, world: World): boolean {
    target.takeDamage(this.damage, this.owner, world);
    world.events.emit('hitImpact', { position: { ...this.position } });
    this.destroy();
    return true;
  }

  protected onHitBox(box: PowerCubeBox, world: World): boolean {
    box.takeDamage(this.damage, this.owner, world);
    world.events.emit('hitImpact', { position: { ...this.position } });
    this.destroy();
    return true;
  }

  protected onHitWall(world: World): void {
    if (this.breaksWalls) {
      world.breakWall(Math.floor(this.position.x), Math.floor(this.position.z));
      return;
    }
    world.events.emit('hitImpact', { position: { ...this.position } });
    this.destroy();
  }
}
