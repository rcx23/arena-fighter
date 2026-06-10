import type { Vec2 } from '../core/MathUtils';
import type { Brawler } from '../entities/Brawler';
import type { World } from '../world/World';

/**
 * A brawler's ultimate. Charged by dealing damage (see Brawler.addSuperCharge)
 * and consumed on activation.
 */
export abstract class Super {
  constructor(readonly name: string) {}

  tryActivate(owner: Brawler, aimPoint: Vec2, world: World): boolean {
    if (owner.superCharge < 1) return false;
    owner.superCharge = 0;
    this.activate(owner, aimPoint, world);
    owner.noteFired(world);
    return true;
  }

  protected abstract activate(owner: Brawler, aimPoint: Vec2, world: World): void;
}
