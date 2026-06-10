import { Entity } from './Entity';
import { AmmoSystem } from '../combat/AmmoSystem';
import { TileType } from '../world/tiles';
import { angleOf, clamp, dist, len, norm, type Vec2 } from '../core/MathUtils';
import type { Weapon } from '../combat/Weapon';
import type { Super } from '../combat/Super';
import type { Gadget } from '../combat/Gadget';
import type { Controller } from '../control/Controller';
import type { World } from '../world/World';

/** Used by the render layer to pick a character mesh, and by UI for labels. */
export type BrawlerKind = 'shooter' | 'thrower' | 'sniper' | 'shotgunner';

export interface BrawlerStats {
  name: string;
  kind: BrawlerKind;
  maxHealth: number;
  /** Tiles per second. */
  moveSpeed: number;
  /** Total damage dealt needed to fill the super from empty. */
  superChargeDamage: number;
  /** Ammo bars regenerated per second. */
  ammoRegen: number;
  /** Primary body color for the character mesh. */
  color: number;
}

const CUBE_BONUS = 0.1; // each power cube: +10% max health and damage
const BUSH_REVEAL_TIME = 1.0;
const BUSH_REVEAL_DISTANCE = 2.5;

/**
 * Abstract base for all playable characters.
 *
 * Inheritance defines what a brawler IS (stats, silhouette); composition
 * defines what it DOES: the Weapon/Super/Gadget strategies and the Controller
 * (human or bot) are injected by the concrete subclass / spawner.
 */
export abstract class Brawler extends Entity {
  readonly stats: BrawlerStats;
  readonly ammo: AmmoSystem;
  controller: Controller;

  health: number;
  superCharge = 0;
  powerCubes = 0;
  inBush = false;
  isPlayer = false;

  /** Match clock timestamps used for bush reveal rules. */
  lastFiredAt = -Infinity;
  lastDamagedAt = -Infinity;

  // Timed move-speed buff (gadgets).
  private speedMult = 1;
  private speedMultUntil = 0;

  // Dash state (supers/gadgets): overrides normal movement while active.
  private dashRemaining = 0;
  private dashDir: Vec2 = { x: 0, z: 0 };
  private dashSpeed = 0;
  private dashDamage = 0;
  private dashBreaksWalls = false;
  private dashVictims = new Set<Brawler>();

  protected constructor(
    stats: BrawlerStats,
    controller: Controller,
    protected readonly weapon: Weapon,
    protected readonly superAbility: Super,
    readonly gadget: Gadget,
  ) {
    super();
    this.stats = stats;
    this.controller = controller;
    this.health = stats.maxHealth;
    this.ammo = new AmmoSystem(stats.ammoRegen);
    this.radius = 0.38;
  }

  get effectiveMaxHealth(): number {
    return Math.round(this.stats.maxHealth * (1 + CUBE_BONUS * this.powerCubes));
  }

  get damageMultiplier(): number {
    return 1 + CUBE_BONUS * this.powerCubes;
  }

  get weaponRange(): number {
    return this.weapon.range;
  }

  /** Defined only for area weapons (thrower); used by the aim indicator. */
  get weaponAoeRadius(): number | undefined {
    return this.weapon.aoeRadius;
  }

  get superReady(): boolean {
    return this.superCharge >= 1;
  }

  get isDashing(): boolean {
    return this.dashRemaining > 0;
  }

  update(dt: number, world: World): void {
    this.weapon.update(dt, this, world);
    this.gadget.update(dt);
    this.ammo.update(dt);

    if (this.dashRemaining > 0) {
      this.updateDash(dt, world);
    } else {
      const intent = this.controller.getIntent(this, world);
      this.applyMovement(intent.move, dt, world);
      this.applyFacing(intent, world);

      if (intent.useSuper) this.superAbility.tryActivate(this, intent.aimPoint, world);
      if (intent.useGadget) this.gadget.tryActivate(this, world);
      if (intent.attack) this.weapon.tryFire(this, intent.aimPoint, world);
    }

    this.inBush = world.map.tileAt(this.position) === TileType.Bush;
  }

  private applyMovement(move: Vec2, dt: number, world: World): void {
    const speed = this.stats.moveSpeed * (world.time < this.speedMultUntil ? this.speedMult : 1);
    const dir = norm(move);
    if (len(dir) === 0) return;
    world.physics.moveCircle(this.position, this.radius, dir.x * speed * dt, dir.z * speed * dt);
  }

  private applyFacing(intent: { move: Vec2; aimPoint: Vec2; attack: boolean }, world: World): void {
    // Face the aim point while attacking or shortly after; otherwise face movement.
    const recentlyFired = world.time - this.lastFiredAt < 0.6;
    if (intent.attack || recentlyFired) {
      const toAim = { x: intent.aimPoint.x - this.position.x, z: intent.aimPoint.z - this.position.z };
      if (len(toAim) > 0.01) this.rotation = angleOf(toAim);
    } else if (len(intent.move) > 0.01) {
      this.rotation = angleOf(intent.move);
    }
  }

  // ----- combat -----

  takeDamage(amount: number, source: Brawler | null, world: World): void {
    if (!this.alive) return;
    const dealt = Math.min(this.health, amount);
    this.health -= dealt;
    this.lastDamagedAt = world.time;
    world.events.emit('damageDealt', { source, target: this, amount: Math.round(amount) });
    source?.addSuperCharge(dealt);
    if (this.health <= 0) {
      this.alive = false;
      world.events.emit('brawlerDied', { brawler: this, killer: source });
    }
  }

  heal(amount: number, world: World): void {
    if (!this.alive) return;
    const healed = Math.min(this.effectiveMaxHealth - this.health, amount);
    if (healed <= 0) return;
    this.health += healed;
    world.events.emit('healed', { target: this, amount: Math.round(healed) });
  }

  addSuperCharge(damageDealt: number): void {
    this.superCharge = clamp(this.superCharge + damageDealt / this.stats.superChargeDamage, 0, 1);
  }

  addPowerCube(): void {
    this.powerCubes++;
    // Keep the gained portion of max health as current health.
    this.health = Math.min(this.effectiveMaxHealth, this.health + this.stats.maxHealth * CUBE_BONUS);
  }

  /** Record an attack for bush-reveal and effects; called by Weapon/Super. */
  noteFired(world: World): void {
    this.lastFiredAt = world.time;
    world.events.emit('brawlerFired', { brawler: this });
  }

  applySpeedBuff(multiplier: number, seconds: number, world: World): void {
    this.speedMult = multiplier;
    this.speedMultUntil = world.time + seconds;
  }

  // ----- dash (used by ChargeDash super, BlinkBack gadget) -----

  startDash(dir: Vec2, distance: number, speed: number, opts?: { damage?: number; breaksWalls?: boolean }): void {
    const d = norm(dir);
    if (len(d) === 0) return;
    this.dashDir = d;
    this.dashRemaining = distance;
    this.dashSpeed = speed;
    this.dashDamage = opts?.damage ?? 0;
    this.dashBreaksWalls = opts?.breaksWalls ?? false;
    this.dashVictims.clear();
    this.rotation = angleOf(d);
  }

  private updateDash(dt: number, world: World): void {
    const step = Math.min(this.dashRemaining, this.dashSpeed * dt);
    this.dashRemaining -= step;

    if (this.dashBreaksWalls) {
      // Clear wall tiles in front of the dash before moving through them.
      const ahead = {
        x: this.position.x + this.dashDir.x * (this.radius + 0.4),
        z: this.position.z + this.dashDir.z * (this.radius + 0.4),
      };
      world.breakWall(Math.floor(ahead.x), Math.floor(ahead.z));
      world.breakWall(Math.floor(this.position.x), Math.floor(this.position.z));
    }

    const before = { ...this.position };
    world.physics.moveCircle(this.position, this.radius, this.dashDir.x * step, this.dashDir.z * step);
    // Stop early if a wall fully blocked us.
    if (dist(before, this.position) < step * 0.2) this.dashRemaining = 0;

    if (this.dashDamage > 0) {
      for (const other of world.brawlersInRadius(this.position, this.radius + 0.5, this)) {
        if (this.dashVictims.has(other)) continue;
        this.dashVictims.add(other);
        other.takeDamage(this.dashDamage * this.damageMultiplier, this, world);
      }
    }
  }

  // ----- stealth -----

  /** Bush stealth: hidden unless close, recently fired, or recently damaged. */
  isHiddenFrom(viewer: Brawler, time: number): boolean {
    if (!this.inBush) return false;
    if (dist(this.position, viewer.position) < BUSH_REVEAL_DISTANCE) return false;
    if (time - this.lastFiredAt < BUSH_REVEAL_TIME) return false;
    if (time - this.lastDamagedAt < BUSH_REVEAL_TIME) return false;
    return true;
  }
}
