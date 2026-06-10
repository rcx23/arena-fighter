import * as THREE from 'three';
import { makeToonMaterial } from './ToonFactory';
import { TileType } from '../world/tiles';
import type { TileMap } from '../world/TileMap';

export interface MapVisual {
  group: THREE.Group;
  /** tileIndex (tx + tz * width) -> wall instance id, for destructibility. */
  wallInstances: Map<number, number>;
  walls: THREE.InstancedMesh;
  dispose(): void;
}

const FLOOR_A = 0xdca468;
const FLOOR_B = 0xd29a5c;
const WATER = 0x4aa3df;
const BUSH_BASE = 0x4f8a35;

/**
 * Builds all static map visuals: a single textured floor plane (checker, with
 * water/bush base colors painted in) plus instanced wall blocks and bush blobs.
 */
export function buildMapVisual(map: TileMap): MapVisual {
  const group = new THREE.Group();

  // --- floor: one canvas pixel per tile, NearestFilter keeps edges crisp ---
  const canvas = document.createElement('canvas');
  canvas.width = map.width;
  canvas.height = map.height;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  for (let tz = 0; tz < map.height; tz++) {
    for (let tx = 0; tx < map.width; tx++) {
      const tile = map.get(tx, tz);
      let color = (tx + tz) % 2 === 0 ? FLOOR_A : FLOOR_B;
      if (tile === TileType.Water) color = WATER;
      else if (tile === TileType.Bush) color = BUSH_BASE;
      ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
      ctx.fillRect(tx, tz, 1, 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  const floorMat = new THREE.MeshToonMaterial({ map: texture });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(map.width, map.height), floorMat);
  floor.rotation.x = -Math.PI / 2;
  // With the plane rotated flat and default texture flipY, canvas row 0
  // lands at world z=0, matching tile coordinates.
  floor.position.set(map.width / 2, 0, map.height / 2);
  floor.receiveShadow = true;
  group.add(floor);

  // --- walls ---
  const wallTiles: number[] = [];
  const bushTiles: number[] = [];
  for (let tz = 0; tz < map.height; tz++) {
    for (let tx = 0; tx < map.width; tx++) {
      const t = map.get(tx, tz);
      if (t === TileType.Wall) wallTiles.push(tx + tz * map.width);
      else if (t === TileType.Bush) bushTiles.push(tx + tz * map.width);
    }
  }

  const wallGeo = new THREE.BoxGeometry(0.98, 1.1, 0.98);
  const walls = new THREE.InstancedMesh(wallGeo, makeToonMaterial(0x9a6a3f), wallTiles.length);
  walls.castShadow = true;
  walls.receiveShadow = true;
  const wallInstances = new Map<number, number>();
  const m = new THREE.Matrix4();
  wallTiles.forEach((idx, i) => {
    const tx = idx % map.width;
    const tz = Math.floor(idx / map.width);
    m.makeTranslation(tx + 0.5, 0.55, tz + 0.5);
    walls.setMatrixAt(i, m);
    wallInstances.set(idx, i);
  });
  group.add(walls);

  // --- bushes: squashed spheres with per-tile jitter ---
  const bushGeo = new THREE.SphereGeometry(0.58, 10, 8);
  const bushes = new THREE.InstancedMesh(bushGeo, makeToonMaterial(0x5fae3e), bushTiles.length);
  bushes.castShadow = true;
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  bushTiles.forEach((idx, i) => {
    const tx = idx % map.width;
    const tz = Math.floor(idx / map.width);
    // Deterministic jitter from the tile index.
    const j = Math.sin(idx * 127.1) * 0.5 + 0.5;
    p.set(tx + 0.5 + (j - 0.5) * 0.2, 0.25, tz + 0.5 + (j - 0.5) * 0.2);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), j * Math.PI);
    s.set(0.9 + j * 0.25, 0.55 + j * 0.15, 0.9 + j * 0.25);
    m.compose(p, q, s);
    bushes.setMatrixAt(i, m);
  });
  group.add(bushes);

  return {
    group,
    wallInstances,
    walls,
    dispose() {
      texture.dispose();
      wallGeo.dispose();
      bushGeo.dispose();
      floor.geometry.dispose();
      floorMat.dispose();
      (walls.material as THREE.Material).dispose();
      (bushes.material as THREE.Material).dispose();
    },
  };
}

/** Collapse a destroyed wall's instance so the hole appears instantly. */
export function hideWallInstance(visual: MapVisual, tx: number, tz: number, mapWidth: number): void {
  const instance = visual.wallInstances.get(tx + tz * mapWidth);
  if (instance === undefined) return;
  const m = new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001);
  visual.walls.setMatrixAt(instance, m);
  visual.walls.instanceMatrix.needsUpdate = true;
}
