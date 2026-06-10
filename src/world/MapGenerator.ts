import { TileMap } from './TileMap';
import { TileType } from './tiles';
import { Rng, type Vec2 } from '../core/MathUtils';

export const MAP_SIZE = 32;

/**
 * Symmetric procedural arena: features are stamped into one half and mirrored
 * 180° about the center so spawns are fair, then validated by flood fill.
 */
export class MapGenerator {
  generate(seed: number): TileMap {
    for (let attempt = 0; attempt < 8; attempt++) {
      const map = this.tryGenerate(new Rng(seed + attempt * 7919));
      if (this.validate(map)) return map;
    }
    // Pathological seeds fall back to an open arena with a border.
    const map = new TileMap(MAP_SIZE, MAP_SIZE);
    this.stampBorder(map);
    return map;
  }

  private tryGenerate(rng: Rng): TileMap {
    const map = new TileMap(MAP_SIZE, MAP_SIZE);
    this.stampBorder(map);

    const half = Math.floor((MAP_SIZE * MAP_SIZE) / 2);
    const mirrored = (tx: number, tz: number, t: TileType) => {
      map.set(tx, tz, t);
      map.set(MAP_SIZE - 1 - tx, MAP_SIZE - 1 - tz, t);
    };
    const stampCluster = (cx: number, cz: number, w: number, h: number, t: TileType, fill = 1) => {
      for (let z = cz; z < cz + h; z++) {
        for (let x = cx; x < cx + w; x++) {
          if (x < 1 || z < 1 || x >= MAP_SIZE - 1 || z >= MAP_SIZE - 1) continue;
          if (rng.next() <= fill) mirrored(x, z, t);
        }
      }
    };
    const randomCell = () => {
      // Bias toward the generator half; mirroring covers the rest.
      const idx = rng.int(0, half - 1);
      return { tx: idx % MAP_SIZE, tz: Math.floor(idx / MAP_SIZE) };
    };

    // Wall clusters: bars, Ls and blocks for cover.
    const wallShapes: ReadonlyArray<readonly [number, number]> = [
      [1, 4], [4, 1], [2, 3], [3, 2], [2, 2], [1, 3], [3, 1],
    ];
    const wallCount = rng.int(7, 10);
    for (let i = 0; i < wallCount; i++) {
      const { tx, tz } = randomCell();
      const [w, h] = rng.pick(wallShapes);
      stampCluster(tx, tz, w, h, TileType.Wall);
    }

    // Bush patches: loose blobs.
    const bushCount = rng.int(6, 9);
    for (let i = 0; i < bushCount; i++) {
      const { tx, tz } = randomCell();
      const size = rng.int(2, 3);
      stampCluster(tx, tz, size, size, TileType.Bush, 0.85);
    }

    // A couple of small water pools.
    const waterCount = rng.int(1, 2);
    for (let i = 0; i < waterCount; i++) {
      const { tx, tz } = randomCell();
      stampCluster(tx, tz, rng.int(2, 3), rng.int(2, 3), TileType.Water);
    }

    // Keep the center open for the final zone showdown.
    const mid = MAP_SIZE / 2;
    for (let z = mid - 3; z < mid + 3; z++) {
      for (let x = mid - 3; x < mid + 3; x++) {
        map.set(x, z, TileType.Floor);
      }
    }
    return map;
  }

  private stampBorder(map: TileMap): void {
    for (let i = 0; i < MAP_SIZE; i++) {
      map.set(i, 0, TileType.Wall);
      map.set(i, MAP_SIZE - 1, TileType.Wall);
      map.set(0, i, TileType.Wall);
      map.set(MAP_SIZE - 1, i, TileType.Wall);
    }
  }

  /** Every walkable tile must be reachable from the center. */
  private validate(map: TileMap): boolean {
    const reached = map.floodFill(MAP_SIZE / 2, MAP_SIZE / 2);
    if (reached.size === 0) return false;
    let walkable = 0;
    for (let tz = 0; tz < MAP_SIZE; tz++) {
      for (let tx = 0; tx < MAP_SIZE; tx++) {
        if (map.isWalkableAt(tx, tz)) walkable++;
      }
    }
    // Allow a few unreachable pocket tiles, but reject choked layouts.
    return reached.size >= walkable * 0.97 && walkable > MAP_SIZE * MAP_SIZE * 0.6;
  }

  /** Spawn ring: positions near the arena edge, spread apart and walkable. */
  spawnPoints(map: TileMap, count: number, rng: Rng): Vec2[] {
    const points: Vec2[] = [];
    const cx = MAP_SIZE / 2;
    const radius = MAP_SIZE / 2 - 4;
    const startAngle = rng.range(0, Math.PI * 2);
    for (let i = 0; i < count; i++) {
      const angle = startAngle + (i / count) * Math.PI * 2;
      let best: Vec2 = { x: cx, z: cx };
      let found = false;
      // Walk inward from the ring until a walkable tile shows up.
      for (let r = radius; r > 3 && !found; r -= 1) {
        const tx = Math.floor(cx + Math.sin(angle) * r);
        const tz = Math.floor(cx + Math.cos(angle) * r);
        if (map.isWalkableAt(tx, tz)) {
          best = { x: tx + 0.5, z: tz + 0.5 };
          found = true;
        }
      }
      points.push(best);
    }
    return points;
  }

  /** Power cube box spots: mid-weighted, walkable, not too close together. */
  boxPoints(map: TileMap, count: number, rng: Rng): Vec2[] {
    const points: Vec2[] = [];
    const mid = MAP_SIZE / 2;
    // Guaranteed center box.
    if (map.isWalkableAt(mid, mid)) points.push({ x: mid + 0.5, z: mid + 0.5 });
    for (let guard = 0; guard < 400 && points.length < count; guard++) {
      // Gaussian-ish bias toward the middle of the arena.
      const tx = Math.floor((rng.next() + rng.next()) * 0.5 * (MAP_SIZE - 8)) + 4;
      const tz = Math.floor((rng.next() + rng.next()) * 0.5 * (MAP_SIZE - 8)) + 4;
      if (!map.isWalkableAt(tx, tz)) continue;
      const p = { x: tx + 0.5, z: tz + 0.5 };
      if (points.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 3)) continue;
      points.push(p);
    }
    return points;
  }
}
