import type { Object3D } from 'three';
import type { Vec2 } from '../core/MathUtils';
import type { World } from '../world/World';

let nextId = 1;

/**
 * Base of the whole game-object hierarchy. Gameplay state lives on the XZ
 * plane; `object3D` is the visual root, created and owned by the RenderSystem.
 */
export abstract class Entity {
  readonly id = nextId++;
  position: Vec2 = { x: 0, z: 0 };
  /** Yaw in radians; 0 faces +Z, matching angleOf/fromAngle. */
  rotation = 0;
  radius = 0.4;
  alive = true;
  /** Extra render height (lobbed projectiles arc with this). */
  visualHeight = 0;
  object3D: Object3D | null = null;

  abstract update(dt: number, world: World): void;

  /** Called once by the World after the entity is flushed out. */
  onRemoved(_world: World): void {}

  destroy(): void {
    this.alive = false;
  }
}
