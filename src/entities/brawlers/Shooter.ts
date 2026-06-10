import { Brawler } from '../Brawler';
import { RapidFireWeapon } from '../../combat/weapons/RapidFireWeapon';
import { BulletStormSuper } from '../../combat/supers/BulletStormSuper';
import { SpeedBoostGadget } from '../../combat/gadgets/SpeedBoostGadget';
import type { Controller } from '../../control/Controller';

/** Mid-range gunslinger: fast bursts, fast feet, modest health. */
export class Shooter extends Brawler {
  constructor(controller: Controller, name = 'Six-Gun') {
    super(
      {
        name,
        kind: 'shooter',
        maxHealth: 3600,
        moveSpeed: 4.6,
        superChargeDamage: 5200,
        ammoRegen: 1 / 1.6,
        color: 0xd9342b,
      },
      controller,
      new RapidFireWeapon({
        burst: 6,
        burstInterval: 0.08,
        damagePerBullet: 300,
        range: 9,
        speed: 14,
        attackInterval: 0.65,
      }),
      new BulletStormSuper(),
      new SpeedBoostGadget(),
    );
  }
}
