import type { TileMap } from '../world/TileMap';
import type { Vec2 } from '../core/MathUtils';

/** A static circular blocker (power cube boxes register one while alive). */
export interface CircleObstacle {
  position: Vec2;
  radius: number;
}

/**
 * Minimal 2D physics on the XZ plane: circles vs solid tiles plus circle
 * obstacles. Movement is resolved per axis, which gives natural wall sliding.
 */
export class PhysicsWorld {
  private obstacles = new Set<CircleObstacle>();

  constructor(private map: TileMap) {}

  setMap(map: TileMap): void {
    this.map = map;
    this.obstacles.clear();
  }

  addObstacle(o: CircleObstacle): void {
    this.obstacles.add(o);
  }

  removeObstacle(o: CircleObstacle): void {
    this.obstacles.delete(o);
  }

  /** Move a circle by delta, sliding along walls. Mutates and returns pos. */
  moveCircle(pos: Vec2, radius: number, dx: number, dz: number): Vec2 {
    if (dx !== 0 && !this.circleBlocked({ x: pos.x + dx, z: pos.z }, radius)) pos.x += dx;
    if (dz !== 0 && !this.circleBlocked({ x: pos.x, z: pos.z + dz }, radius)) pos.z += dz;
    return pos;
  }

  circleBlocked(pos: Vec2, radius: number): boolean {
    const minX = Math.floor(pos.x - radius);
    const maxX = Math.floor(pos.x + radius);
    const minZ = Math.floor(pos.z - radius);
    const maxZ = Math.floor(pos.z + radius);
    for (let tz = minZ; tz <= maxZ; tz++) {
      for (let tx = minX; tx <= maxX; tx++) {
        if (this.map.isWalkableAt(tx, tz)) continue;
        // Circle vs tile AABB.
        const nearestX = Math.max(tx, Math.min(pos.x, tx + 1));
        const nearestZ = Math.max(tz, Math.min(pos.z, tz + 1));
        const ddx = pos.x - nearestX;
        const ddz = pos.z - nearestZ;
        if (ddx * ddx + ddz * ddz < radius * radius) return true;
      }
    }
    for (const o of this.obstacles) {
      const r = radius + o.radius;
      const ox = pos.x - o.position.x;
      const oz = pos.z - o.position.z;
      if (ox * ox + oz * oz < r * r) return true;
    }
    return false;
  }
}
