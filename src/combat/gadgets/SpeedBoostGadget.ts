import { Gadget } from '../Gadget';
import type { Brawler } from '../../entities/Brawler';
import type { World } from '../../world/World';

/** Shooter gadget: a short burst of movement speed. */
export class SpeedBoostGadget extends Gadget {
  constructor() {
    super('Adrenaline', 3);
  }

  protected activate(owner: Brawler, world: World): void {
    owner.applySpeedBuff(1.45, 3, world);
  }
}
