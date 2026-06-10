import { Weapon } from '../Weapon';
import { Bullet } from '../../entities/projectiles/Bullet';
import { angleOf, fromAngle, sub, type Vec2 } from '../../core/MathUtils';
import type { Brawler } from '../../entities/Brawler';
import type { World } from '../../world/World';

export interface RapidFireOptions {
  burst: number;
  burstInterval: number;
  damagePerBullet: number;
  range: number;
  speed: number;
  attackInterval: number;
}

/**
 * Shooter basic attack: one ammo bar fires a quick burst of bullets toward
 * the aim direction. Remaining burst shots are spawned from update().
 */
export class RapidFireWeapon extends Weapon {
  private burstLeft = 0;
  private burstTimer = 0;
  private burstAngle = 0;

  constructor(private readonly opts: RapidFireOptions) {
    super(opts.attackInterval, opts.range);
  }

  protected fire(owner: Brawler, aimPoint: Vec2, world: World): void {
    this.burstAngle = angleOf(sub(aimPoint, owner.position));
    this.burstLeft = this.opts.burst;
    this.burstTimer = 0;
    this.spawnBullet(owner, world);
  }

  override update(dt: number, owner: Brawler, world: World): void {
    super.update(dt, owner, world);
    if (this.burstLeft > 0 && owner.alive) {
      this.burstTimer -= dt;
      if (this.burstTimer <= 0) this.spawnBullet(owner, world);
    }
  }

  private spawnBullet(owner: Brawler, world: World): void {
    this.burstLeft--;
    this.burstTimer = this.opts.burstInterval;
    // Small per-shot jitter so bursts feel like gunfire, not a laser.
    const dir = fromAngle(this.burstAngle + world.rng.range(-0.025, 0.025));
    const origin = {
      x: owner.position.x + dir.x * (owner.radius + 0.25),
      z: owner.position.z + dir.z * (owner.radius + 0.25),
    };
    world.add(
      new Bullet(owner, origin, dir, {
        damage: this.opts.damagePerBullet * owner.damageMultiplier,
        speed: this.opts.speed,
        range: this.opts.range,
        size: 0.11,
        color: 0xffd23e,
      }),
    );
  }
}
