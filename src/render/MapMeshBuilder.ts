import * as THREE from 'three';
import { makeToonMaterial, makeOutlineMaterial } from './ToonFactory';
import { makeFloorTexture, makeWallTexture, makeBushTexture } from './InkTextures';
import { TileType } from '../world/tiles';
import type { TileMap } from '../world/TileMap';

export interface MapVisual {
  group: THREE.Group;
  /** tileIndex (tx + tz * width) -> wall instance id, for destructibility. */
  wallInstances: Map<number, number>;
  walls: THREE.InstancedMesh;
  dispose(): void;
}

/**
 * Builds all static map visuals: a hand-drawn floor sheet plus instanced wall
 * blocks and bush blobs, each with an instanced ink-outline hull sharing the
 * same instance matrices.
 */
export function buildMapVisual(map: TileMap): MapVisual {
  const group = new THREE.Group();

  // --- floor: one big hand-inked canvas (tiles, grout, cracks, water rims) ---
  const floorTexture = makeFloorTexture(map);
  const floorMat = makeToonMaterial(0xffffff, floorTexture);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(map.width, map.height), floorMat);
  floor.rotation.x = -Math.PI / 2;
  // With the plane rotated flat and default texture flipY, canvas row 0
  // lands at world z=0, matching tile coordinates.
  floor.position.set(map.width / 2, 0, map.height / 2);
  floor.receiveShadow = true;
  group.add(floor);

  // --- collect tiles ---
  const wallTiles: number[] = [];
  const bushTiles: number[] = [];
  for (let tz = 0; tz < map.height; tz++) {
    for (let tx = 0; tx < map.width; tx++) {
      const t = map.get(tx, tz);
      if (t === TileType.Wall) wallTiles.push(tx + tz * map.width);
      else if (t === TileType.Bush) bushTiles.push(tx + tz * map.width);
    }
  }

  // --- walls: rocky panel texture + instanced 'scale' outline ---
  const wallGeo = new THREE.BoxGeometry(0.98, 1.1, 0.98);
  const wallTexture = makeWallTexture();
  const walls = new THREE.InstancedMesh(wallGeo, makeToonMaterial(0xffffff, wallTexture), wallTiles.length);
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
  const wallOutline = new THREE.InstancedMesh(wallGeo, makeOutlineMaterial(0.04, 'scale'), wallTiles.length);
  // Share the matrix attribute: hiding a wall instance hides its outline too.
  wallOutline.instanceMatrix = walls.instanceMatrix;
  wallOutline.frustumCulled = false;
  group.add(walls, wallOutline);

  // --- bushes: scribbled-leaf spheres + instanced 'normal' outline ---
  const bushGeo = new THREE.SphereGeometry(0.58, 10, 8);
  const bushTexture = makeBushTexture();
  const bushes = new THREE.InstancedMesh(bushGeo, makeToonMaterial(0xffffff, bushTexture), bushTiles.length);
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
    s.set(0.8 + j * 0.45, 0.5 + j * 0.25, 0.8 + j * 0.45);
    m.compose(p, q, s);
    bushes.setMatrixAt(i, m);
  });
  const bushOutline = new THREE.InstancedMesh(bushGeo, makeOutlineMaterial(0.05, 'normal'), bushTiles.length);
  bushOutline.instanceMatrix = bushes.instanceMatrix;
  bushOutline.frustumCulled = false;
  group.add(bushes, bushOutline);

  return {
    group,
    wallInstances,
    walls,
    dispose() {
      floorTexture.dispose();
      wallTexture.dispose();
      bushTexture.dispose();
      wallGeo.dispose();
      bushGeo.dispose();
      floor.geometry.dispose();
      floorMat.dispose();
      for (const mesh of [walls, wallOutline, bushes, bushOutline]) {
        (mesh.material as THREE.Material).dispose();
      }
    },
  };
}

/** Collapse a destroyed wall's instance so the hole appears instantly. */
export function hideWallInstance(visual: MapVisual, tx: number, tz: number, mapWidth: number): void {
  const instance = visual.wallInstances.get(tx + tz * mapWidth);
  if (instance === undefined) return;
  const m = new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001);
  // The outline InstancedMesh shares this attribute, so it collapses too.
  visual.walls.setMatrixAt(instance, m);
  visual.walls.instanceMatrix.needsUpdate = true;
}
