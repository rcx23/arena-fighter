import type { Brawler } from '../entities/Brawler';
import type { World } from '../world/World';

/**
 * A limited-use utility ability with a short cooldown between uses.
 */
export abstract class Gadget {
  usesLeft: number;
  private cooldown = 0;

  constructor(
    readonly name: string,
    uses: number,
    private readonly cooldownSeconds = 3,
  ) {
    this.usesLeft = uses;
  }

  tryActivate(owner: Brawler, world: World): boolean {
    if (this.usesLeft <= 0 || this.cooldown > 0) return false;
    this.usesLeft--;
    this.cooldown = this.cooldownSeconds;
    this.activate(owner, world);
    return true;
  }

  update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
  }

  protected abstract activate(owner: Brawler, world: World): void;
}
