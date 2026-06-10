import { Brawler } from '../Brawler';
import { LobWeapon } from '../../combat/weapons/LobWeapon';
import { AreaBarrageSuper } from '../../combat/supers/AreaBarrageSuper';
import { SelfHealGadget } from '../../combat/gadgets/SelfHealGadget';
import type { Controller } from '../../control/Controller';

/** Lobs explosives over cover; fragile but oppressive behind walls. */
export class Thrower extends Brawler {
  constructor(controller: Controller, name = 'Boomer') {
    super(
      {
        name,
        kind: 'thrower',
        maxHealth: 3000,
        moveSpeed: 4.4,
        superChargeDamage: 4400,
        ammoRegen: 1 / 2.0,
        color: 0xf08c1e,
      },
      controller,
      new LobWeapon({
        damage: 950,
        aoeRadius: 1.45,
        range: 8,
        speed: 7.5,
        attackInterval: 0.8,
      }),
      new AreaBarrageSuper(),
      new SelfHealGadget(),
    );
  }
}
