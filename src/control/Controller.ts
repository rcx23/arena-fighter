import type { Vec2 } from '../core/MathUtils';
import type { Brawler } from '../entities/Brawler';
import type { World } from '../world/World';

/** What a brawler wants to do this tick, regardless of who is driving it. */
export interface ControlIntent {
  /** Normalized desired move direction; zero vector when idle. */
  move: Vec2;
  /** World-space point being aimed at. */
  aimPoint: Vec2;
  attack: boolean;
  useSuper: boolean;
  useGadget: boolean;
}

export const idleIntent = (self: Brawler): ControlIntent => ({
  move: { x: 0, z: 0 },
  aimPoint: { ...self.position },
  attack: false,
  useSuper: false,
  useGadget: false,
});

/**
 * The seam between input and simulation: a Brawler polls its Controller every
 * tick and never knows whether a human or a bot is driving it.
 */
export interface Controller {
  getIntent(self: Brawler, world: World): ControlIntent;
}
