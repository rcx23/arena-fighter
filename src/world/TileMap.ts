import { TileType, isWalkable, blocksProjectile } from './tiles';
import type { Vec2 } from '../core/MathUtils';

/**
 * Square tile grid. Tile (tx, tz) occupies world space
 * [tx, tx+1) x [tz, tz+1); tile centers are at (tx + 0.5, tz + 0.5).
 */
export class TileMap {
  private tiles: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.tiles = new Uint8Array(width * height);
  }

  inBounds(tx: number, tz: number): boolean {
    return tx >= 0 && tz >= 0 && tx < this.width && tz < this.height;
  }

  get(tx: number, tz: number): TileType {
    if (!this.inBounds(tx, tz)) return TileType.Wall;
    return this.tiles[tz * this.width + tx] as TileType;
  }

  set(tx: number, tz: number, t: TileType): void {
    if (this.inBounds(tx, tz)) this.tiles[tz * this.width + tx] = t;
  }

  tileAt(pos: Vec2): TileType {
    return this.get(Math.floor(pos.x), Math.floor(pos.z));
  }

  isWalkableAt(tx: number, tz: number): boolean {
    return isWalkable(this.get(tx, tz));
  }

  blocksProjectileAt(pos: Vec2): boolean {
    return blocksProjectile(this.tileAt(pos));
  }

  /**
   * Grid DDA raycast: returns true if a wall tile lies on the segment a->b.
   * Used for line-of-sight and AI wall avoidance.
   */
  raycastWall(a: Vec2, b: Vec2): boolean {
    let tx = Math.floor(a.x);
    let tz = Math.floor(a.z);
    const endX = Math.floor(b.x);
    const endZ = Math.floor(b.z);
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const stepX = Math.sign(dx);
    const stepZ = Math.sign(dz);
    // tMax: segment parameter t at which the ray crosses the next tile
    // boundary on each axis; tDelta: t advance per whole tile.
    const tDeltaX = stepX !== 0 ? Math.abs(1 / dx) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dz) : Infinity;
    let tMaxX = stepX > 0 ? (tx + 1 - a.x) * tDeltaX : stepX < 0 ? (a.x - tx) * tDeltaX : Infinity;
    let tMaxZ = stepZ > 0 ? (tz + 1 - a.z) * tDeltaZ : stepZ < 0 ? (a.z - tz) * tDeltaZ : Infinity;

    const maxSteps = this.width + this.height;
    for (let i = 0; i < maxSteps; i++) {
      if (this.get(tx, tz) === TileType.Wall) return true;
      if ((tx === endX && tz === endZ) || Math.min(tMaxX, tMaxZ) > 1) return false;
      if (tMaxX < tMaxZ) {
        tMaxX += tDeltaX;
        tx += stepX;
      } else {
        tMaxZ += tDeltaZ;
        tz += stepZ;
      }
    }
    return false;
  }

  /** Flood fill of walkable tiles from a start tile; returns the visited set. */
  floodFill(startX: number, startZ: number): Set<number> {
    const visited = new Set<number>();
    if (!this.isWalkableAt(startX, startZ)) return visited;
    const queue: number[] = [startZ * this.width + startX];
    visited.add(queue[0] as number);
    while (queue.length > 0) {
      const idx = queue.pop() as number;
      const tx = idx % this.width;
      const tz = Math.floor(idx / this.width);
      for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = tx + ox;
        const nz = tz + oz;
        const nIdx = nz * this.width + nx;
        if (this.inBounds(nx, nz) && !visited.has(nIdx) && this.isWalkableAt(nx, nz)) {
          visited.add(nIdx);
          queue.push(nIdx);
        }
      }
    }
    return visited;
  }
}
