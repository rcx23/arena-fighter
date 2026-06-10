import { Gadget } from '../Gadget';
import type { Brawler } from '../../entities/Brawler';
import type { World } from '../../world/World';

/** Shotgunner gadget: slam a fresh magazine in — all ammo bars refilled. */
export class ShellReloadGadget extends Gadget {
  constructor() {
    super('Fast Hands', 3);
  }

  protected activate(owner: Brawler, _world: World): void {
    owner.ammo.refill();
  }
}
