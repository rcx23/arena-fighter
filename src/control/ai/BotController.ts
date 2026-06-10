import { idleIntent, type Controller, type ControlIntent } from '../Controller';
import { PowerCube } from '../../entities/PowerCube';
import { PowerCubeBox } from '../../entities/PowerCubeBox';
import {
  add, dist, fromAngle, len, norm, rotate, scale, sub, type Vec2, type Rng,
} from '../../core/MathUtils';
import type { Brawler } from '../../entities/Brawler';
import type { World } from '../../world/World';

type BotState = 'wander' | 'seekCube' | 'engage' | 'flee';

const THINK_INTERVAL = 0.3;
const FLEE_HEALTH_FRACTION = 0.3;
const CUBE_SEARCH_RADIUS = 12;

/**
 * Finite-state-machine bot driver. Decisions are re-evaluated a few times a
 * second (staggered per bot); the produced intent is continuous so movement
 * stays smooth between thinks.
 */
export class BotController implements Controller {
  private state: BotState = 'wander';
  private nextThinkAt: number;
  private wanderTarget: Vec2 | null = null;
  private targetBrawler: Brawler | null = null;
  private targetLoot: PowerCube | PowerCubeBox | null = null;
  private strafeDir = 1;
  private aimError: Vec2 = { x: 0, z: 0 };
  private engagedAt = 0;
  private lastThinkPos: Vec2 = { x: 0, z: 0 };
  private wantSuper = false;
  private wantGadget = false;
  private readonly reactionDelay: number;
  /** Opening grace: bots loot instead of brawling unless provoked. */
  private readonly peacefulUntil: number;

  constructor(private readonly rng: Rng) {
    // Stagger thinks so 9 bots don't all decide on the same tick.
    this.nextThinkAt = rng.range(0, THINK_INTERVAL);
    this.reactionDelay = rng.range(0.2, 0.5);
    this.strafeDir = rng.chance(0.5) ? 1 : -1;
    this.peacefulUntil = rng.range(5, 9);
  }

  getIntent(self: Brawler, world: World): ControlIntent {
    if (world.time >= this.nextThinkAt) {
      this.think(self, world);
      this.nextThinkAt = world.time + THINK_INTERVAL;
    }

    const intent = idleIntent(self);
    switch (this.state) {
      case 'wander':
        this.applyWander(self, world, intent);
        break;
      case 'seekCube':
        this.applySeekCube(self, world, intent);
        break;
      case 'engage':
        this.applyEngage(self, world, intent);
        break;
      case 'flee':
        this.applyFlee(self, world, intent);
        break;
    }

    // Poison gas overrides everything: get back inside the safe zone.
    const zone = world.zone;
    if (zone && !zone.contains(self.position)) {
      intent.move = sub(zone.safeCenter, self.position);
    }

    intent.move = this.avoidWalls(self, world, intent.move);
    if (this.wantSuper) {
      intent.useSuper = true;
      this.wantSuper = false;
    }
    if (this.wantGadget) {
      intent.useGadget = true;
      this.wantGadget = false;
    }
    return intent;
  }

  // ----- decision making -----

  private think(self: Brawler, world: World): void {
    const enemy = this.findTarget(self, world);
    const healthFraction = self.health / self.effectiveMaxHealth;

    if (healthFraction < FLEE_HEALTH_FRACTION && enemy) {
      this.state = 'flee';
      this.targetBrawler = enemy;
      // Panic button: heal/escape gadgets shine here.
      if (this.rng.chance(0.5)) this.wantGadget = true;
    } else if (enemy) {
      if (this.state !== 'engage' || this.targetBrawler !== enemy) {
        this.engagedAt = world.time;
        this.targetBrawler = enemy;
      }
      this.state = 'engage';
      this.aimError = {
        x: this.rng.range(-0.85, 0.85),
        z: this.rng.range(-0.85, 0.85),
      };
      if (this.rng.chance(0.1)) this.strafeDir *= -1;
      if (self.superReady && this.rng.chance(0.3)) this.wantSuper = true;
      if (healthFraction < 0.55 && this.rng.chance(0.2)) this.wantGadget = true;
    } else {
      const loot = this.findLoot(self, world);
      if (loot) {
        this.state = 'seekCube';
        this.targetLoot = loot;
      } else {
        this.state = 'wander';
      }
    }

    // Stuck detection: wanted to move but barely did -> reroll destination.
    if (this.state === 'wander' && this.wanderTarget) {
      if (dist(self.position, this.lastThinkPos) < 0.15) this.wanderTarget = null;
    }
    this.lastThinkPos = { ...self.position };
  }

  private findTarget(self: Brawler, world: World): Brawler | null {
    // Opening peace: go for boxes, not fights — unless someone hits us first.
    if (world.time < this.peacefulUntil && world.time - self.lastDamagedAt > 2) return null;
    // Cap sight range so long-range classes don't snipe across the map and
    // turn the opening seconds into a bloodbath.
    const seeRange = Math.min(Math.max(self.weaponRange * 1.25, 7), 11);
    let best: Brawler | null = null;
    let bestDist = Infinity;
    for (const b of world.brawlersAlive()) {
      if (b === self) continue;
      const d = dist(self.position, b.position);
      if (d > seeRange || d >= bestDist) continue;
      if (b.isHiddenFrom(self, world.time)) continue;
      // Throwers can pressure over walls; everyone else needs line of sight.
      if (self.stats.kind !== 'thrower' && world.map.raycastWall(self.position, b.position)) continue;
      best = b;
      bestDist = d;
    }
    return best;
  }

  private findLoot(self: Brawler, world: World): PowerCube | PowerCubeBox | null {
    let best: PowerCube | PowerCubeBox | null = null;
    let bestDist = CUBE_SEARCH_RADIUS;
    for (const cube of world.entitiesOfType(PowerCube)) {
      const d = dist(self.position, cube.position);
      if (d < bestDist) {
        best = cube;
        bestDist = d;
      }
    }
    for (const box of world.entitiesOfType(PowerCubeBox)) {
      const d = dist(self.position, box.position);
      // Boxes need breaking, so prefer cubes by handicapping boxes a bit.
      if (d * 1.5 < bestDist) {
        best = box;
        bestDist = d * 1.5;
      }
    }
    return best;
  }

  // ----- state behaviors -----

  private applyWander(self: Brawler, world: World, intent: ControlIntent): void {
    if (!this.wanderTarget || dist(self.position, this.wanderTarget) < 1) {
      this.wanderTarget = this.pickWanderPoint(self, world);
    }
    if (this.wanderTarget) intent.move = sub(this.wanderTarget, self.position);
  }

  private pickWanderPoint(self: Brawler, world: World): Vec2 | null {
    const zone = world.zone;
    for (let i = 0; i < 10; i++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const r = this.rng.range(5, 10);
      const p = add(self.position, scale(fromAngle(angle), r));
      if (zone && !zone.contains(p)) continue;
      if (world.map.isWalkableAt(Math.floor(p.x), Math.floor(p.z))) return p;
    }
    return zone ? { ...zone.safeCenter } : null;
  }

  private applySeekCube(self: Brawler, world: World, intent: ControlIntent): void {
    const loot = this.targetLoot;
    if (!loot || !loot.alive) {
      this.state = 'wander';
      return;
    }
    const d = dist(self.position, loot.position);
    if (loot instanceof PowerCubeBox) {
      const inRange = d < self.weaponRange * 0.85;
      const canHit =
        self.stats.kind === 'thrower' || !world.map.raycastWall(self.position, loot.position);
      if (inRange && canHit) {
        intent.aimPoint = { ...loot.position };
        intent.attack = true;
      } else {
        intent.move = sub(loot.position, self.position);
      }
    } else {
      intent.move = sub(loot.position, self.position);
    }
  }

  private applyEngage(self: Brawler, world: World, intent: ControlIntent): void {
    const target = this.targetBrawler;
    if (!target || !target.alive || target.isHiddenFrom(self, world.time)) {
      this.state = 'wander';
      this.targetBrawler = null;
      return;
    }
    const toTarget = sub(target.position, self.position);
    const d = len(toTarget);
    const preferred = self.weaponRange * (self.stats.kind === 'shotgunner' ? 0.55 : 0.7);

    // Orbit at preferred range: strafe sideways, drift in/out to hold distance.
    const toward = norm(toTarget);
    const strafe = rotate(toward, (Math.PI / 2) * this.strafeDir);
    const rangeCorrection = scale(toward, (d - preferred) * 0.5);
    intent.move = add(strafe, rangeCorrection);

    intent.aimPoint = add(target.position, this.aimError);
    const reacted = world.time - this.engagedAt > this.reactionDelay;
    const canHit =
      self.stats.kind === 'thrower' || !world.map.raycastWall(self.position, target.position);
    intent.attack = reacted && canHit && d < self.weaponRange * 1.05;
  }

  private applyFlee(self: Brawler, world: World, intent: ControlIntent): void {
    const threat = this.targetBrawler;
    let away: Vec2 = { x: 0, z: 0 };
    if (threat?.alive) away = norm(sub(self.position, threat.position));
    const zone = world.zone;
    const toSafety = zone ? norm(sub(zone.safeCenter, self.position)) : { x: 0, z: 0 };
    intent.move = add(scale(away, 1.2), toSafety);
    // Keep shooting back while retreating if the threat is close.
    if (threat?.alive && dist(self.position, threat.position) < self.weaponRange) {
      intent.aimPoint = add(threat.position, this.aimError);
      intent.attack = self.stats.kind === 'thrower' || !world.map.raycastWall(self.position, threat.position);
    }
  }

  /** Cheap steering: if the desired direction runs into a wall, try rotating away. */
  private avoidWalls(self: Brawler, world: World, move: Vec2): Vec2 {
    const dir = norm(move);
    if (len(dir) === 0) return move;
    const probe = (d: Vec2) =>
      world.map.raycastWall(self.position, add(self.position, scale(d, 1.4)));
    if (!probe(dir)) return move;
    for (const angle of [0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
      const candidate = rotate(dir, angle);
      if (!probe(candidate)) return candidate;
    }
    return move;
  }
}
