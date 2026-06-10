import { Gadget } from '../Gadget';
import { fromAngle, scale } from '../../core/MathUtils';
import type { Brawler } from '../../entities/Brawler';
import type { World } from '../../world/World';

/** Sniper gadget: a quick hop backwards to reset the engagement distance. */
export class BlinkBackGadget extends Gadget {
  constructor() {
    super('Backpedal', 3);
  }

  protected activate(owner: Brawler, _world: World): void {
    owner.startDash(scale(fromAngle(owner.rotation), -1), 3.5, 18);
  }
}
