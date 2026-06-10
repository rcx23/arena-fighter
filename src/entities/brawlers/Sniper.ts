import { Brawler } from '../Brawler';
import { SniperWeapon } from '../../combat/weapons/SniperWeapon';
import { PiercingShotSuper } from '../../combat/supers/PiercingShotSuper';
import { BlinkBackGadget } from '../../combat/gadgets/BlinkBackGadget';
import type { Controller } from '../../control/Controller';

/** Long-range glass cannon: huge single hits, slow ammo, low health. */
export class Sniper extends Brawler {
  constructor(controller: Controller, name = 'Longshot') {
    super(
      {
        name,
        kind: 'sniper',
        maxHealth: 2800,
        moveSpeed: 3.4,
        superChargeDamage: 4800,
        ammoRegen: 1 / 2.4,
        color: 0x7a4fd1,
      },
      controller,
      new SniperWeapon({
        damage: 1450,
        range: 14,
        speed: 22,
        attackInterval: 1.0,
      }),
      new PiercingShotSuper(),
      new BlinkBackGadget(),
    );
  }
}
