import type { Controller, ControlIntent } from './Controller';
import type { Input } from '../core/Input';
import type { Brawler } from '../entities/Brawler';
import type { World } from '../world/World';
import type { Vec2 } from '../core/MathUtils';

/** Anything that can turn a screen position into a point on the ground. */
export interface GroundPicker {
  screenToGround(x: number, y: number): Vec2;
}

/**
 * Human driver: WASD to move, mouse to aim, LMB to attack,
 * Space / RMB for the super, F for the gadget.
 */
export class PlayerController implements Controller {
  constructor(
    private readonly input: Input,
    private readonly picker: GroundPicker,
  ) {}

  getIntent(_self: Brawler, _world: World): ControlIntent {
    const move = { x: 0, z: 0 };
    if (this.input.isDown('KeyW') || this.input.isDown('ArrowUp')) move.z -= 1;
    if (this.input.isDown('KeyS') || this.input.isDown('ArrowDown')) move.z += 1;
    if (this.input.isDown('KeyA') || this.input.isDown('ArrowLeft')) move.x -= 1;
    if (this.input.isDown('KeyD') || this.input.isDown('ArrowRight')) move.x += 1;

    return {
      move,
      aimPoint: this.picker.screenToGround(this.input.mouseScreen.x, this.input.mouseScreen.y),
      attack: this.input.mouseDown,
      useSuper: this.input.wasPressed('Space') || this.input.wasPressed('MouseRight'),
      useGadget: this.input.wasPressed('KeyF'),
    };
  }
}
