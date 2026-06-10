import { Brawler } from '../Brawler';
import { SpreadWeapon } from '../../combat/weapons/SpreadWeapon';
import { ChargeDashSuper } from '../../combat/supers/ChargeDashSuper';
import { ShellReloadGadget } from '../../combat/gadgets/ShellReloadGadget';
import type { Controller } from '../../control/Controller';

/** Close-range tank: brutal up close, harmless at distance. */
export class Shotgunner extends Brawler {
  constructor(controller: Controller, name = 'Buckshot') {
    super(
      {
        name,
        kind: 'shotgunner',
        maxHealth: 5200,
        moveSpeed: 4.4,
        superChargeDamage: 6000,
        ammoRegen: 1 / 1.8,
        color: 0x3f9b3f,
      },
      controller,
      new SpreadWeapon({
        pellets: 5,
        damagePerPellet: 420,
        spreadRadians: 0.42,
        range: 5.5,
        speed: 12,
        attackInterval: 0.7,
      }),
      new ChargeDashSuper(),
      new ShellReloadGadget(),
    );
  }
}
