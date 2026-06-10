import { Gadget } from '../Gadget';
import type { Brawler } from '../../entities/Brawler';
import type { World } from '../../world/World';

/** Thrower gadget: patch yourself up mid-fight. */
export class SelfHealGadget extends Gadget {
  constructor() {
    super('First Aid', 3);
  }

  protected activate(owner: Brawler, world: World): void {
    owner.heal(1500, world);
  }
}
