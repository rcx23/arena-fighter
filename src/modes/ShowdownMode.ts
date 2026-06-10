import { PoisonZone } from './PoisonZone';
import { MapGenerator, MAP_SIZE } from '../world/MapGenerator';
import { PowerCubeBox } from '../entities/PowerCubeBox';
import { PowerCube } from '../entities/PowerCube';
import { Shooter } from '../entities/brawlers/Shooter';
import { Thrower } from '../entities/brawlers/Thrower';
import { Sniper } from '../entities/brawlers/Sniper';
import { Shotgunner } from '../entities/brawlers/Shotgunner';
import { BotController } from '../control/ai/BotController';
import { Rng, dist, type Vec2 } from '../core/MathUtils';
import type { Brawler, BrawlerKind } from '../entities/Brawler';
import type { Controller } from '../control/Controller';
import type { TileMap } from '../world/TileMap';
import type { World } from '../world/World';

export type MatchState = 'idle' | 'countdown' | 'playing' | 'defeated' | 'spectating' | 'over';

const PLAYER_COUNT = 10;
const BOX_COUNT = 14;
const COUNTDOWN_SECONDS = 3;

const BOT_NAMES = [
  'Rico', 'Tara', 'Bram', 'Juno', 'Kit', 'Otis', 'Vex', 'Mona', 'Zed',
  'Pip', 'Nash', 'Lula', 'Grit', 'Sage',
];

const BRAWLER_FACTORIES: Record<BrawlerKind, (c: Controller, name: string) => Brawler> = {
  shooter: (c, n) => new Shooter(c, n),
  thrower: (c, n) => new Thrower(c, n),
  sniper: (c, n) => new Sniper(c, n),
  shotgunner: (c, n) => new Shotgunner(c, n),
};

export interface ShowdownCallbacks {
  onMapChanged(map: TileMap): void;
  onMatchReset(): void;
}

/**
 * Solo Showdown: 10 brawlers (1 human, 9 bots), shrinking poison gas, power
 * cube crates, last one standing wins. Owns the match state machine.
 */
export class ShowdownMode {
  state: MatchState = 'idle';
  player: Brawler | null = null;
  countdownRemaining = 0;
  playerRank = PLAYER_COUNT;
  playerKills = 0;
  winnerName = '';
  zone: PoisonZone | null = null;

  private readonly generator = new MapGenerator();
  private spectateTarget: Brawler | null = null;

  constructor(
    private readonly world: World,
    private readonly callbacks: ShowdownCallbacks,
  ) {
    world.events.on('brawlerDied', ({ brawler, killer }) => {
      // Victims spill their power cubes around the corpse.
      for (let i = 0; i < brawler.powerCubes; i++) {
        const angle = world.rng.range(0, Math.PI * 2);
        const r = world.rng.range(0.3, 1.1);
        const pos = this.findDropSpot(brawler.position, angle, r);
        world.add(new PowerCube(pos.x, pos.z));
      }
      if (killer === this.player && brawler !== this.player) this.playerKills++;
      if (brawler === this.player) {
        this.playerRank = world.brawlersAlive().length + 1;
      }
    });
  }

  get aliveCount(): number {
    return this.world.brawlersAlive().length;
  }

  start(playerKind: BrawlerKind, playerController: Controller): void {
    const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    const rng = new Rng(seed);

    this.world.clear();
    this.callbacks.onMatchReset();
    this.world.rng = rng;

    const map = this.generator.generate(seed);
    this.world.setMap(map);
    this.callbacks.onMapChanged(map);

    this.zone = new PoisonZone(MAP_SIZE);
    this.world.zone = this.zone;

    // Player + 9 bots on a spawn ring; every class appears at least twice.
    const spawns = this.generator.spawnPoints(map, PLAYER_COUNT, rng);
    const kinds: BrawlerKind[] = ['shooter', 'thrower', 'sniper', 'shotgunner'];
    const botKinds = rng.shuffle([
      ...kinds,
      ...kinds,
      rng.pick(kinds),
    ]);
    const botNames = rng.shuffle([...BOT_NAMES]);

    this.player = BRAWLER_FACTORIES[playerKind](playerController, 'You');
    this.player.isPlayer = true;
    this.player.position = { ...(spawns[0] as Vec2) };
    this.world.add(this.player);

    for (let i = 0; i < PLAYER_COUNT - 1; i++) {
      const kind = botKinds[i] as BrawlerKind;
      const bot = BRAWLER_FACTORIES[kind](new BotController(new Rng(seed + i * 31)), botNames[i] ?? `Bot ${i}`);
      bot.position = { ...(spawns[i + 1] as Vec2) };
      this.world.add(bot);
    }

    for (const p of this.generator.boxPoints(map, BOX_COUNT, rng)) {
      this.world.add(new PowerCubeBox(p.x, p.z));
    }
    this.world.flush();

    this.playerRank = PLAYER_COUNT;
    this.playerKills = 0;
    this.winnerName = '';
    this.spectateTarget = null;
    this.countdownRemaining = COUNTDOWN_SECONDS;
    this.state = 'countdown';
  }

  /** Switch from the defeat screen to watching the rest of the match. */
  spectate(): void {
    if (this.state === 'defeated') this.state = 'spectating';
  }

  update(dt: number): void {
    switch (this.state) {
      case 'idle':
      case 'over':
        return;
      case 'countdown':
        this.countdownRemaining -= dt;
        if (this.countdownRemaining <= 0) this.state = 'playing';
        return;
      case 'playing':
      case 'defeated':
      case 'spectating':
        this.world.update(dt);
        this.zone?.update(dt, this.world);
        this.checkMatchEnd();
        return;
    }
  }

  private checkMatchEnd(): void {
    const alive = this.world.brawlersAlive();
    const playerAlive = this.player?.alive ?? false;

    if (this.state === 'playing' && !playerAlive) {
      this.state = 'defeated';
      return;
    }
    if (alive.length <= 1) {
      this.winnerName = alive[0]?.stats.name ?? 'No one';
      if (playerAlive) this.playerRank = 1;
      this.state = 'over';
    }
  }

  /** Camera focus: the player while alive, then whoever is worth watching. */
  cameraTarget(): Vec2 {
    if (this.player?.alive) return this.player.position;
    if (!this.spectateTarget?.alive) {
      const alive = this.world.brawlersAlive();
      const from = this.spectateTarget?.position ?? this.player?.position ?? { x: MAP_SIZE / 2, z: MAP_SIZE / 2 };
      this.spectateTarget =
        alive.sort((a, b) => dist(a.position, from) - dist(b.position, from))[0] ?? null;
    }
    return this.spectateTarget?.position ?? this.zone?.safeCenter ?? { x: MAP_SIZE / 2, z: MAP_SIZE / 2 };
  }

  private findDropSpot(origin: Vec2, angle: number, r: number): Vec2 {
    const p = { x: origin.x + Math.sin(angle) * r, z: origin.z + Math.cos(angle) * r };
    return this.world.map.isWalkableAt(Math.floor(p.x), Math.floor(p.z)) ? p : { ...origin };
  }
}
