import * as THREE from 'three';
import { addOutline, makeToonMaterial } from './ToonFactory';
import type { BrawlerKind } from '../entities/Brawler';

export interface CharacterRig {
  root: THREE.Group;
  /** Inner group used for bob/lean animation without fighting the yaw. */
  body: THREE.Group;
  weapon: THREE.Object3D;
}

const SKIN = 0xffd9a8;
const DARK = 0x2b2b34;

function part(
  geometry: THREE.BufferGeometry,
  color: number,
  x = 0,
  y = 0,
  z = 0,
  outline = true,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, makeToonMaterial(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  if (outline) addOutline(mesh);
  return mesh;
}

/** Two cartoon eyes looking down +Z (the model's facing direction). */
function addFace(head: THREE.Mesh, headRadius: number): void {
  const eyeGeo = new THREE.SphereGeometry(headRadius * 0.16, 8, 8);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, makeToonMaterial(DARK));
    eye.position.set(side * headRadius * 0.38, headRadius * 0.1, headRadius * 0.82);
    head.add(eye);
  }
}

/**
 * Builds a chunky cartoon character out of primitives. Each class gets its
 * own silhouette, hat and weapon prop so they read at gameplay zoom.
 */
export function buildCharacter(kind: BrawlerKind, color: number): CharacterRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  switch (kind) {
    case 'shooter':
      return buildShooter(root, body, color);
    case 'thrower':
      return buildThrower(root, body, color);
    case 'sniper':
      return buildSniper(root, body, color);
    case 'shotgunner':
      return buildShotgunner(root, body, color);
  }
}

function buildShooter(root: THREE.Group, body: THREE.Group, color: number): CharacterRig {
  const torso = part(new THREE.CapsuleGeometry(0.26, 0.3, 6, 14), color, 0, 0.5);
  const head = part(new THREE.SphereGeometry(0.26, 16, 14), SKIN, 0, 0.98);
  addFace(head, 0.26);
  // Cowboy hat: brim + crown.
  const brim = part(new THREE.CylinderGeometry(0.34, 0.36, 0.05, 16), 0x8a5a2b, 0, 1.16);
  const crown = part(new THREE.CylinderGeometry(0.17, 0.2, 0.18, 14), 0x8a5a2b, 0, 1.27);
  // Twin pistols.
  const pistolGeo = new THREE.BoxGeometry(0.09, 0.12, 0.34);
  const weapon = part(pistolGeo, DARK, 0.3, 0.58, 0.22);
  const offhand = part(pistolGeo, DARK, -0.3, 0.58, 0.22);
  const hands = [
    part(new THREE.SphereGeometry(0.09, 10, 8), SKIN, 0.3, 0.58, 0.08),
    part(new THREE.SphereGeometry(0.09, 10, 8), SKIN, -0.3, 0.58, 0.08),
  ];
  body.add(torso, head, brim, crown, weapon, offhand, ...hands);
  return { root, body, weapon };
}

function buildThrower(root: THREE.Group, body: THREE.Group, color: number): CharacterRig {
  const torso = part(new THREE.SphereGeometry(0.36, 16, 14), color, 0, 0.45);
  torso.scale.set(1.1, 0.85, 1.05);
  const head = part(new THREE.SphereGeometry(0.24, 16, 14), SKIN, 0, 0.95);
  addFace(head, 0.24);
  // Hard hat.
  const hat = part(new THREE.SphereGeometry(0.26, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0xffce2e, 0, 1.0);
  const backpack = part(new THREE.BoxGeometry(0.34, 0.4, 0.2), 0x6b4a2c, 0, 0.55, -0.34);
  // A bomb held ready to throw.
  const weapon = part(new THREE.SphereGeometry(0.13, 12, 10), DARK, 0.32, 0.62, 0.18);
  const hands = [
    part(new THREE.SphereGeometry(0.09, 10, 8), SKIN, 0.34, 0.5, 0.14),
    part(new THREE.SphereGeometry(0.09, 10, 8), SKIN, -0.34, 0.5, 0.1),
  ];
  body.add(torso, head, hat, backpack, weapon, ...hands);
  return { root, body, weapon };
}

function buildSniper(root: THREE.Group, body: THREE.Group, color: number): CharacterRig {
  const torso = part(new THREE.CapsuleGeometry(0.22, 0.46, 6, 14), color, 0, 0.56);
  const head = part(new THREE.SphereGeometry(0.24, 16, 14), SKIN, 0, 1.1);
  addFace(head, 0.24);
  // Wide-brim hat.
  const brim = part(new THREE.CylinderGeometry(0.4, 0.42, 0.04, 16), color, 0, 1.27);
  const top = part(new THREE.ConeGeometry(0.2, 0.22, 14), color, 0, 1.4);
  // Long rifle.
  const weapon = new THREE.Group();
  const barrel = part(new THREE.CylinderGeometry(0.045, 0.045, 0.95, 10), DARK, 0, 0, 0.3);
  barrel.rotation.x = Math.PI / 2;
  const stock = part(new THREE.BoxGeometry(0.09, 0.14, 0.3), 0x6b4a2c, 0, -0.02, -0.2);
  weapon.add(barrel, stock);
  weapon.position.set(0.26, 0.66, 0.1);
  const hands = [
    part(new THREE.SphereGeometry(0.08, 10, 8), SKIN, 0.26, 0.62, 0.3),
    part(new THREE.SphereGeometry(0.08, 10, 8), SKIN, 0.24, 0.64, -0.06),
  ];
  body.add(torso, head, brim, top, weapon, ...hands);
  return { root, body, weapon };
}

function buildShotgunner(root: THREE.Group, body: THREE.Group, color: number): CharacterRig {
  const torso = part(new THREE.CapsuleGeometry(0.34, 0.26, 6, 14), color, 0, 0.5);
  torso.scale.set(1.15, 1, 1.05);
  const head = part(new THREE.SphereGeometry(0.27, 16, 14), SKIN, 0, 1.0);
  addFace(head, 0.27);
  // Beanie.
  const beanie = part(new THREE.SphereGeometry(0.28, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), 0x37424f, 0, 1.06);
  // Fat double-barrel shotgun.
  const weapon = new THREE.Group();
  for (const side of [-1, 1]) {
    const barrel = part(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 10), DARK, side * 0.065, 0, 0.18);
    barrel.rotation.x = Math.PI / 2;
    weapon.add(barrel);
  }
  const grip = part(new THREE.BoxGeometry(0.16, 0.12, 0.22), 0x6b4a2c, 0, -0.03, -0.12);
  weapon.add(grip);
  weapon.position.set(0.3, 0.56, 0.2);
  const hands = [
    part(new THREE.SphereGeometry(0.1, 10, 8), SKIN, 0.3, 0.52, 0.32),
    part(new THREE.SphereGeometry(0.1, 10, 8), SKIN, 0.28, 0.5, 0.0),
  ];
  body.add(torso, head, beanie, weapon, ...hands);
  return { root, body, weapon };
}
