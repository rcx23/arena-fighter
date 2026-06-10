/**
 * Brawl Stars-style ammo: 3 bars that refill over time. Bars are fractional
 * so the HUD can show a bar filling up. Regen pauses briefly after firing.
 */
export class AmmoSystem {
  static readonly MAX_BARS = 3;
  private static readonly REGEN_PAUSE = 0.35;

  bars = AmmoSystem.MAX_BARS;
  private pause = 0;

  constructor(private readonly regenPerSecond: number) {}

  canFire(): boolean {
    return this.bars >= 1;
  }

  consume(): void {
    this.bars = Math.max(0, this.bars - 1);
    this.pause = AmmoSystem.REGEN_PAUSE;
  }

  refill(): void {
    this.bars = AmmoSystem.MAX_BARS;
  }

  update(dt: number): void {
    if (this.pause > 0) {
      this.pause -= dt;
      return;
    }
    this.bars = Math.min(AmmoSystem.MAX_BARS, this.bars + this.regenPerSecond * dt);
  }
}
