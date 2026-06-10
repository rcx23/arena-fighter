import { GameLoop } from './GameLoop';
import { Input } from './Input';
import { World } from '../world/World';
import { TileMap } from '../world/TileMap';
import { MAP_SIZE } from '../world/MapGenerator';
import { ShowdownMode, type MatchState } from '../modes/ShowdownMode';
import { PlayerController } from '../control/PlayerController';
import { RenderSystem } from '../render/RenderSystem';
import { CameraRig } from '../render/CameraRig';
import { HUD } from '../ui/HUD';
import { HealthBarLayer } from '../ui/HealthBarLayer';
import { DamageNumbers } from '../ui/DamageNumbers';
import type { Brawler, BrawlerKind } from '../entities/Brawler';

/**
 * Composition root: owns the loop, world, mode, rendering and UI, and routes
 * state-machine transitions to overlay screens.
 */
export class Game {
  private readonly input: Input;
  private readonly world: World;
  private readonly mode: ShowdownMode;
  private readonly renderSystem: RenderSystem;
  private readonly cameraRig: CameraRig;
  private readonly playerController: PlayerController;
  private readonly hud: HUD;
  private readonly healthBars: HealthBarLayer;
  private readonly damageNumbers: DamageNumbers;
  private readonly loop: GameLoop;

  private lastState: MatchState = 'idle';
  private lastKind: BrawlerKind = 'shooter';

  constructor(canvas: HTMLCanvasElement, hudRoot: HTMLElement) {
    this.input = new Input(canvas);
    this.world = new World(new TileMap(MAP_SIZE, MAP_SIZE));
    this.renderSystem = new RenderSystem(canvas, this.world);
    this.cameraRig = new CameraRig(window.innerWidth / window.innerHeight);
    this.playerController = new PlayerController(this.input, this.cameraRig);
    this.hud = new HUD(hudRoot, this.world);
    this.healthBars = new HealthBarLayer(hudRoot);
    this.damageNumbers = new DamageNumbers(hudRoot, this.world);

    this.mode = new ShowdownMode(this.world, {
      onMapChanged: (map) => this.renderSystem.setMap(map),
      onMatchReset: () => {
        this.renderSystem.resetMatch();
        this.healthBars.clear();
        this.damageNumbers.clear();
      },
    });

    window.addEventListener('resize', () => {
      this.cameraRig.resize(window.innerWidth / window.innerHeight);
    });

    this.loop = new GameLoop(
      (dt) => this.update(dt),
      (dt) => this.render(dt),
    );
  }

  start(): void {
    this.hud.showSelectScreen((kind) => this.startMatch(kind));
    this.loop.start();
  }

  private startMatch(kind: BrawlerKind): void {
    this.lastKind = kind;
    this.mode.start(kind, this.playerController);
    this.cameraRig.snapTo(this.mode.cameraTarget());
  }

  private update(dt: number): void {
    this.mode.update(dt);
    this.input.endFrame();
    this.handleStateTransition();
  }

  private handleStateTransition(): void {
    const state = this.mode.state;
    if (state === this.lastState) return;
    this.lastState = state;

    const onChangeBrawler = () => this.hud.showSelectScreen((kind) => this.startMatch(kind));
    if (state === 'defeated') {
      this.hud.showEndScreen({
        title: 'DEFEATED',
        defeat: true,
        subtitle: `Rank #${this.mode.playerRank} of 10 · ${this.mode.playerKills} kills`,
        onPlayAgain: () => this.startMatch(this.lastKind),
        onChangeBrawler,
        onSpectate: () => this.mode.spectate(),
      });
    } else if (state === 'over') {
      const victory = this.mode.player?.alive ?? false;
      this.hud.showEndScreen({
        title: victory ? 'VICTORY!' : 'MATCH OVER',
        defeat: !victory,
        subtitle: victory
          ? `Last one standing · ${this.mode.playerKills} kills`
          : `${this.mode.winnerName} won · you placed #${this.mode.playerRank} · ${this.mode.playerKills} kills`,
        onPlayAgain: () => this.startMatch(this.lastKind),
        onChangeBrawler,
      });
    }
  }

  private render(dt: number): void {
    const playerAlive = this.mode.player?.alive ?? false;
    this.cameraRig.update(this.mode.cameraTarget(), dt);

    const aiming = playerAlive && this.mode.state === 'playing';
    this.renderSystem.aimIndicator.update(
      aiming ? this.mode.player : null,
      aiming ? this.cameraRig.screenToGround(this.input.mouseScreen.x, this.input.mouseScreen.y) : null,
    );

    // Stealth is evaluated from the player's perspective; once spectating,
    // everything is visible.
    const stealthViewer: Brawler | null = playerAlive ? this.mode.player : null;
    this.renderSystem.sync(this.world, stealthViewer, dt);
    this.renderSystem.render(this.cameraRig.camera);

    this.hud.update(this.mode.player, this.world, this.mode);
    this.healthBars.update(this.world, this.cameraRig.camera, stealthViewer);
    this.damageNumbers.update(this.cameraRig.camera, dt);
  }
}
