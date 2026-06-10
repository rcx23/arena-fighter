import type { Vec2 } from './MathUtils';
import type { Brawler } from '../entities/Brawler';
import type { PowerCubeBox } from '../entities/PowerCubeBox';

/**
 * Typed game events. Combat raises these; super charging, HUD, effects and
 * AI aggro all subscribe instead of being hard-wired to each other.
 */
export interface GameEvents {
  damageDealt: { source: Brawler | null; target: Brawler; amount: number };
  healed: { target: Brawler; amount: number };
  brawlerDied: { brawler: Brawler; killer: Brawler | null };
  brawlerFired: { brawler: Brawler };
  boxDestroyed: { box: PowerCubeBox };
  cubePickedUp: { brawler: Brawler };
  wallBroken: { tx: number; tz: number };
  explosion: { position: Vec2; radius: number };
  hitImpact: { position: Vec2 };
}

type Handler<T> = (payload: T) => void;

export class EventBus {
  private handlers = new Map<keyof GameEvents, Set<Handler<never>>>();

  on<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<never>);
    return () => set.delete(handler as Handler<never>);
  }

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of set) (handler as Handler<GameEvents[K]>)(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}
