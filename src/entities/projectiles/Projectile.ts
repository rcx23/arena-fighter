import { Entity } from '../Entity';
import type { Brawler } from '../Brawler';

/**
 * Base for everything fired by a weapon or super. Damage is already scaled
 * by the owner's power-cube multiplier when the projectile is created.
 */
export abstract class Projectile extends Entity {
  /** Render hints so one mesh factory covers all projectile types. */
  visualSize = 0.13;
  visualColor = 0xffd23e;

  protected constructor(
    readonly owner: Brawler,
    readonly damage: number,
  ) {
    super();
    this.radius = 0.13;
  }
}
