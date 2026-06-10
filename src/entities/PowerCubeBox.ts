import { Entity } from './Entity';
import { PowerCube } from './PowerCube';
import type { Brawler } from './Brawler';
import type { World } from '../world/World';
import type { CircleObstacle } from '../physics/PhysicsWorld';

/**
 * Destructible crate that blocks movement and projectiles, dropping a power
 * cube (occasionally two) when broken.
 */
export class PowerCubeBox extends Entity {
  static readonly MAX_HEALTH = 600;
  health = PowerCubeBox.MAX_HEALTH;
  private obstacle: CircleObstacle;
  private registered = false;

  constructor(x: number, z: number) {
    super();
    this.position = { x, z };
    this.radius = 0.48;
    this.obstacle = { position: this.position, radius: this.radius };
  }

  update(_dt: number, world: World): void {
    if (!this.registered) {
      world.physics.addObstacle(this.obstacle);
      this.registered = true;
    }
  }

  takeDamage(amount: number, _source: Brawler | null, world: World): void {
    if (!this.alive) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.alive = false;
      world.events.emit('boxDestroyed', { box: this });
      const drops = world.rng.chance(0.15) ? 2 : 1;
      for (let i = 0; i < drops; i++) {
        const jitter = i === 0 ? 0 : 0.5;
        world.add(new PowerCube(this.position.x + world.rng.range(-jitter, jitter), this.position.z + world.rng.range(-jitter, jitter)));
      }
    }
  }

  override onRemoved(world: World): void {
    world.physics.removeObstacle(this.obstacle);
  }
}
