import { Entity } from './Entity';
import type { World } from '../world/World';

const PICKUP_RADIUS = 0.75;

/** Dropped buff pickup: +10% damage and max health to whoever grabs it. */
export class PowerCube extends Entity {
  constructor(x: number, z: number) {
    super();
    this.position = { x, z };
    this.radius = 0.2;
  }

  update(_dt: number, world: World): void {
    for (const b of world.brawlersInRadius(this.position, PICKUP_RADIUS)) {
      b.addPowerCube();
      world.events.emit('cubePickedUp', { brawler: b });
      this.destroy();
      return;
    }
  }
}
