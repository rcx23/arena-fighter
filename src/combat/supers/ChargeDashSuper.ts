import { Super } from '../Super';
import { sub, type Vec2 } from '../../core/MathUtils';
import type { Brawler } from '../../entities/Brawler';
import type { World } from '../../world/World';

/**
 * Shotgunner super: a charging dash that damages everyone in the way and
 * smashes through walls.
 */
export class ChargeDashSuper extends Super {
  constructor() {
    super('Bull Charge');
  }

  protected activate(owner: Brawler, aimPoint: Vec2, world: World): void {
    owner.startDash(sub(aimPoint, owner.position), 6.5, 16, {
      damage: 1200,
      breaksWalls: true,
    });
    world.events.emit('explosion', { position: { ...owner.position }, radius: 0.8 });
  }
}
