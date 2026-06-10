import * as THREE from 'three';
import { addOutline, makeToonMaterial, type OutlinePush } from './ToonFactory';
import type { BrawlerKind } from '../entities/Brawler';

export interface CharacterRig {
  root: THREE.Group;
  /** Inner group used for bob/lean animation without fighting the yaw. */
  body: THREE.Group;
  weapon: THREE.Object3D;
}

const SKIN = 0xeebd92;
const DARK = 0x2b2b34;
const LEATHER = 0x6b4a2c;

interface PartOptions {
  outline?: boolean;
  push?: OutlinePush;
  thickness?: number;
}

function part(
  geometry: THREE.BufferGeometry,
  color: number,
  x = 0,
  y = 0,
  z = 0,
  opts: PartOptions = {},
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, makeToonMaterial(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  // Outline only silhouette parts; trim pieces skip the extra draw call.
  if (opts.outline !== false) addOutline(mesh, opts.thickness ?? 0.035, opts.push ?? 'normal');
  return mesh;
}

/** Two cartoon eyes looking down +Z (the model's facing direction). */
function addFace(head: THREE.Mesh, headRadius: number): void {
  const eyeGeo = new THREE.SphereGeometry(headRadius * 0.13, 8, 8);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, makeToonMaterial(DARK));
    eye.position.set(side * headRadius * 0.38, headRadius * 0.1, headRadius * 0.85);
    head.add(eye);
  }
}

/** Tapered legs + chunky box boots — the action-figure lower body. */
function addLegs(
  body: THREE.Group,
  color: number,
  hipY: number,
  spread: number,
  legR: number,
  bootW: number,
): void {
  const bootH = 0.16;
  const legLen = Math.max(0.12, hipY - bootH);
  const legGeo = new THREE.CylinderGeometry(legR * 1.15, legR * 0.85, legLen, 8);
  const bootGeo = new THREE.BoxGeometry(bootW, bootH, bootW * 1.45);
  for (const side of [-1, 1]) {
    body.add(part(legGeo, color, side * spread, bootH + legLen / 2, 0, { outline: false }));
    body.add(part(bootGeo, DARK, side * spread, bootH / 2, 0.04, { push: 'scale', thickness: 0.06 }));
  }
}

/** Capsule arms angled forward + oversized glove spheres. Returns gloves. */
function addArms(
  body: THREE.Group,
  color: number,
  shoulderY: number,
  spread: number,
  gloveR: number,
  reach: number,
  armR = 0.07,
): [THREE.Mesh, THREE.Mesh] {
  const armGeo = new THREE.CapsuleGeometry(armR, 0.26, 4, 8);
  const gloves: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const arm = part(armGeo, color, side * spread, shoulderY - 0.14, reach * 0.5, { outline: false });
    arm.rotation.x = Math.PI / 3.2;
    arm.rotation.z = side * -0.15;
    body.add(arm);
    const glove = part(new THREE.SphereGeometry(gloveR, 10, 8), DARK, side * spread, shoulderY - 0.26, reach);
    body.add(glove);
    gloves.push(glove);
  }
  return gloves as [THREE.Mesh, THREE.Mesh];
}

function addBelt(body: THREE.Group, y: number, r: number): void {
  const belt = part(new THREE.CylinderGeometry(r, r, 0.07, 12), 0x40301c, 0, y, 0, { outline: false });
  const buckle = part(new THREE.BoxGeometry(0.09, 0.07, 0.03), 0xc8a23e, 0, y, r - 0.005, { outline: false });
  body.add(belt, buckle);
}

/**
 * Builds a Borderlands-flavored action figure out of primitives: ~1.45-1.85
 * units tall, head about a quarter of the height, chunky boots and gloves.
 * Each class keeps a strong top-down silhouette.
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

/** Slim gunslinger, ~1.70 tall: serape, cowboy hat, twin pistols. */
function buildShooter(root: THREE.Group, body: THREE.Group, color: number): CharacterRig {
  addLegs(body, DARK, 0.62, 0.13, 0.07, 0.15);

  const torso = part(new THREE.CapsuleGeometry(0.18, 0.34, 6, 12), color, 0, 0.86);
  torso.scale.z = 0.85;
  // Serape draped over the shoulders.
  const serape = part(new THREE.CylinderGeometry(0.21, 0.31, 0.26, 10), 0x8c2f24, 0, 1.02);
  addBelt(body, 0.64, 0.2);

  const head = part(new THREE.SphereGeometry(0.21, 16, 14), SKIN, 0, 1.34);
  addFace(head, 0.21);
  const brim = part(new THREE.CylinderGeometry(0.36, 0.38, 0.05, 16), LEATHER, 0, 1.5);
  const crown = part(new THREE.CylinderGeometry(0.15, 0.18, 0.17, 12), LEATHER, 0, 1.6);
  const hatBand = part(new THREE.CylinderGeometry(0.185, 0.185, 0.05, 12), DARK, 0, 1.54, 0, { outline: false });

  const gloves = addArms(body, color, 1.06, 0.3, 0.11, 0.24);
  const pistolGeo = new THREE.BoxGeometry(0.07, 0.1, 0.34);
  const gripGeo = new THREE.BoxGeometry(0.06, 0.13, 0.08);
  const pistols: THREE.Mesh[] = [];
  for (const glove of gloves) {
    const pistol = part(pistolGeo, DARK, 0, 0.04, 0.18, { push: 'scale', thickness: 0.05 });
    pistol.add(part(gripGeo, LEATHER, 0, -0.08, -0.1, { outline: false }));
    glove.add(pistol);
    pistols.push(pistol);
  }

  body.add(torso, serape, head, brim, crown, hatBand);
  return { root, body, weapon: pistols[0] as THREE.Mesh };
}

/** Squat demolitions guy, ~1.45: barrel body, tanks over the shoulders. */
function buildThrower(root: THREE.Group, body: THREE.Group, color: number): CharacterRig {
  addLegs(body, DARK, 0.42, 0.16, 0.1, 0.2);

  const torso = part(new THREE.SphereGeometry(0.34, 16, 14), color, 0, 0.72);
  torso.scale.set(1.25, 0.85, 1.1);
  // Chest harness straps (no outline - trim).
  for (const side of [-1, 1]) {
    const strap = part(new THREE.BoxGeometry(0.07, 0.42, 0.02), 0x40301c, side * 0.12, 0.78, 0.35, { outline: false });
    strap.rotation.z = side * 0.45;
    body.add(strap);
  }

  const backpack = part(new THREE.BoxGeometry(0.36, 0.42, 0.2), LEATHER, 0, 0.78, -0.4, { push: 'scale', thickness: 0.05 });
  // Twin tanks poking above the shoulders - key top-down read.
  const tankGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.34, 10);
  for (const side of [-1, 1]) {
    body.add(part(tankGeo, 0x9a3a2a, side * 0.12, 1.06, -0.38));
  }

  const head = part(new THREE.SphereGeometry(0.2, 16, 14), SKIN, 0, 1.16);
  addFace(head, 0.2);
  const hardHat = part(
    new THREE.SphereGeometry(0.24, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    0xffce2e, 0, 1.18,
  );
  const hatBrim = part(new THREE.CylinderGeometry(0.26, 0.27, 0.04, 14), 0xffce2e, 0, 1.2, 0.04, { outline: false });
  const hatRidge = part(new THREE.BoxGeometry(0.06, 0.05, 0.34), 0xe0b020, 0, 1.4, 0, { outline: false });

  const gloves = addArms(body, color, 0.92, 0.36, 0.12, 0.26, 0.09);
  const bomb = part(new THREE.SphereGeometry(0.14, 12, 10), DARK, 0, 0.08, 0.04);
  const fuse = part(new THREE.CylinderGeometry(0.018, 0.018, 0.1, 6), 0xc8a23e, 0.03, 0.18, 0, { outline: false });
  fuse.rotation.z = -0.4;
  bomb.add(fuse);
  (gloves[0] as THREE.Mesh).add(bomb);

  body.add(torso, backpack, head, hardHat, hatBrim, hatRidge);
  return { root, body, weapon: bomb };
}

/** Tall thin marksman, ~1.85: long coat, wide hat, oversized rifle. */
function buildSniper(root: THREE.Group, body: THREE.Group, color: number): CharacterRig {
  // Lower legs peeking under the coat.
  addLegs(body, DARK, 0.5, 0.11, 0.06, 0.13);
  // Long coat skirt replacing the upper legs.
  const coatColor = 0x4a3380;
  const coat = part(new THREE.CylinderGeometry(0.2, 0.34, 0.55, 12), coatColor, 0, 0.78);

  const torso = part(new THREE.CapsuleGeometry(0.17, 0.4, 6, 12), color, 0, 1.04);
  addBelt(body, 0.84, 0.21);

  const head = part(new THREE.SphereGeometry(0.2, 16, 14), SKIN, 0, 1.5);
  addFace(head, 0.2);
  const brim = part(new THREE.CylinderGeometry(0.4, 0.42, 0.04, 16), coatColor, 0, 1.68);
  const dome = part(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), coatColor, 0, 1.68);

  // Oversized rifle dwarfing everything else top-down.
  const weapon = new THREE.Group();
  const barrel = part(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 10), DARK, 0, 0, 0.35);
  barrel.rotation.x = Math.PI / 2;
  const scope = part(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 8), DARK, 0, 0.07, 0.2, { outline: false });
  scope.rotation.x = Math.PI / 2;
  const muzzle = part(new THREE.BoxGeometry(0.09, 0.09, 0.12), DARK, 0, 0, 0.95, { push: 'scale', thickness: 0.05 });
  const stock = part(new THREE.BoxGeometry(0.07, 0.13, 0.3), LEATHER, 0, -0.03, -0.32, { push: 'scale', thickness: 0.05 });
  weapon.add(barrel, scope, muzzle, stock);
  weapon.position.set(0.24, 1.1, 0.12);

  // Gloved hands along the rifle.
  const gloveGeo = new THREE.SphereGeometry(0.09, 10, 8);
  body.add(part(gloveGeo, DARK, 0.24, 1.08, 0.45));
  body.add(part(gloveGeo, DARK, 0.22, 1.06, -0.04));

  body.add(coat, torso, head, brim, dome, weapon);
  return { root, body, weapon };
}

/** Huge bruiser, ~1.75 and the widest: shoulder pads, sunken head. */
function buildShotgunner(root: THREE.Group, body: THREE.Group, color: number): CharacterRig {
  addLegs(body, DARK, 0.55, 0.18, 0.11, 0.24);

  const torso = part(new THREE.CapsuleGeometry(0.3, 0.3, 6, 14), color, 0, 0.92);
  torso.scale.set(1.3, 1, 1.05);
  addBelt(body, 0.62, 0.34);

  // Sphere shoulder pads at the widest point of any class.
  const padGeo = new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.8);
  for (const side of [-1, 1]) {
    body.add(part(padGeo, 0x55452f, side * 0.42, 1.22, 0));
  }

  // Head sunk low into the shoulders, no neck.
  const head = part(new THREE.SphereGeometry(0.2, 16, 14), SKIN, 0, 1.42);
  addFace(head, 0.2);
  const beanie = part(
    new THREE.SphereGeometry(0.21, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2.4),
    0x37424f, 0, 1.47,
  );

  const gloves = addArms(body, color, 1.06, 0.4, 0.13, 0.28, 0.1);
  // Fat double-barrel with pump grip.
  const weapon = new THREE.Group();
  for (const side of [-1, 1]) {
    const barrel = part(new THREE.CylinderGeometry(0.065, 0.065, 0.65, 10), DARK, side * 0.07, 0, 0.2);
    barrel.rotation.x = Math.PI / 2;
    weapon.add(barrel);
  }
  const receiver = part(new THREE.BoxGeometry(0.22, 0.15, 0.26), LEATHER, 0, -0.02, -0.16, { push: 'scale', thickness: 0.05 });
  const pump = part(new THREE.BoxGeometry(0.16, 0.09, 0.14), 0x40301c, 0, -0.07, 0.22, { outline: false });
  weapon.add(receiver, pump);
  weapon.position.set(0.34, 0.98, 0.24);
  (gloves[0] as THREE.Mesh).position.z += 0.06;

  body.add(torso, head, beanie, weapon);
  return { root, body, weapon };
}
