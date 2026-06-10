/**
 * Fixed-timestep simulation (60 Hz) with a render call every animation frame.
 * Keeps physics and AI frame-rate independent; long stalls are clamped so the
 * simulation never spirals.
 */
export class GameLoop {
  static readonly TICK = 1 / 60;
  private static readonly MAX_FRAME = 0.25;

  private accumulator = 0;
  private last = 0;
  private rafId = 0;
  private running = false;

  constructor(
    private readonly update: (dt: number) => void,
    private readonly render: (dt: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const frame = (now: number) => {
      if (!this.running) return;
      const elapsed = Math.min((now - this.last) / 1000, GameLoop.MAX_FRAME);
      this.last = now;
      this.accumulator += elapsed;
      while (this.accumulator >= GameLoop.TICK) {
        this.update(GameLoop.TICK);
        this.accumulator -= GameLoop.TICK;
      }
      this.render(elapsed);
      this.rafId = requestAnimationFrame(frame);
    };
    this.rafId = requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }
}
