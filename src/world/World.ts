import { Entity } from '../entities/Entity';
import { Brawler } from '../entities/Brawler';
import { EventBus } from '../core/EventBus';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { TileMap } from './TileMap';
import { TileType } from './tiles';
import { Rng, type Vec2 } from '../core/MathUtils';
import type { PoisonZone } from '../modes/PoisonZone';

/**
 * Entity registry plus the shared simulation context (map, physics, events,
 * clock). Adds/removes are deferred to a post-update flush so entities can
 * spawn projectiles or die mid-iteration safely.
 */
export class World {
  readonly events = new EventBus();
  readonly entities: Entity[] = [];
  physics: PhysicsWorld;
  zone: PoisonZone | null = null;
  rng = new Rng(1);
  /** Simulation clock in seconds, reset per match. */
  time = 0;

  private pendingAdd: Entity[] = [];

  constructor(public map: TileMap) {
    this.physics = new PhysicsWorld(map);
  }

  setMap(map: TileMap): void {
    this.map = map;
    this.physics.setMap(map);
  }

  add<T extends Entity>(entity: T): T {
    this.pendingAdd.push(entity);
    return entity;
  }

  update(dt: number): void {
    this.time += dt;
    for (const e of this.entities) {
      if (e.alive) e.update(dt, this);
    }
    this.flush();
  }

  flush(): void {
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i] as Entity;
      if (!e.alive) {
        this.entities.splice(i, 1);
        e.onRemoved(this);
      }
    }
    if (this.pendingAdd.length > 0) {
      this.entities.push(...this.pendingAdd);
      this.pendingAdd = [];
    }
  }

  clear(): void {
    for (const e of this.entities) e.onRemoved(this);
    this.entities.length = 0;
    this.pendingAdd = [];
    this.time = 0;
  }

  /** prototype-based signature so abstract/protected-ctor classes work too */
  entitiesOfType<T extends Entity>(ctor: Function & { prototype: T }): T[] {
    return this.entities.filter((e): e is T => e.alive && e instanceof ctor);
  }

  brawlersAlive(): Brawler[] {
    return this.entitiesOfType(Brawler);
  }

  brawlersInRadius(pos: Vec2, radius: number, except?: Brawler): Brawler[] {
    return this.brawlersAlive().filter(
      (b) => b !== except && Math.hypot(b.position.x - pos.x, b.position.z - pos.z) <= radius,
    );
  }

  /** Destroy a wall tile (super effects) and notify the renderer. */
  breakWall(tx: number, tz: number): void {
    // Never break the arena border.
    if (tx <= 0 || tz <= 0 || tx >= this.map.width - 1 || tz >= this.map.height - 1) return;
    if (this.map.get(tx, tz) !== TileType.Wall) return;
    this.map.set(tx, tz, TileType.Floor);
    this.events.emit('wallBroken', { tx, tz });
  }
}
