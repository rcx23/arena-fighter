import * as THREE from 'three';
import { buildCharacter, type CharacterRig } from './CharacterMeshBuilder';
import { buildMapVisual, hideWallInstance, type MapVisual } from './MapMeshBuilder';
import { addOutline, makeToonMaterial } from './ToonFactory';
import { getSharedGrunge, makeCrateTexture } from './InkTextures';
import { EffectsPool } from './EffectsPool';
import { AimIndicator } from './AimIndicator';
import { Brawler } from '../entities/Brawler';
import { Projectile } from '../entities/projectiles/Projectile';
import { PowerCube } from '../entities/PowerCube';
import { PowerCubeBox } from '../entities/PowerCubeBox';
import type { Entity } from '../entities/Entity';
import type { TileMap } from '../world/TileMap';
import type { World } from '../world/World';

interface EntityVisual {
  group: THREE.Object3D;
  rig?: CharacterRig;
  isBrawler: boolean;
  lastX: number;
  lastZ: number;
  bobPhase: number;
  faded: boolean;
}

const sphereGeo = new THREE.SphereGeometry(1, 10, 8);
const cubeGeo = new THREE.BoxGeometry(0.38, 0.38, 0.38);
const crateGeo = new THREE.BoxGeometry(0.92, 0.8, 0.92);

let crateTexture: THREE.CanvasTexture | null = null;
function getCrateTexture(): THREE.CanvasTexture {
  return (crateTexture ??= makeCrateTexture());
}

/**
 * Owns the Three.js scene: lighting, map meshes, per-entity visuals, the
 * poison zone overlay and transient effects. Reads simulation state every
 * frame; never writes to it.
 */
export class RenderSystem {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly effects: EffectsPool;
  readonly aimIndicator: AimIndicator;

  private visuals = new Map<number, EntityVisual>();
  private mapVisual: MapVisual | null = null;
  private zoneQuads: THREE.Mesh[] = [];
  private zoneMat: THREE.MeshBasicMaterial;

  constructor(canvas: HTMLCanvasElement, world: World) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    // Hard-edged shadows read as comic ink; also cheaper than PCF.
    this.renderer.shadowMap.type = THREE.BasicShadowMap;

    this.scene.background = new THREE.Color(0x241a26);
    this.effects = new EffectsPool(this.scene);
    this.aimIndicator = new AimIndicator(this.scene);

    // Warm key light with shadows covering the whole arena, plus sky fill.
    // Sun from the camera's side of the sky so the surfaces players see are
    // the lit ones; the angle still leaves shade bands for the hatching.
    const sun = new THREE.DirectionalLight(0xffe8c8, 2.6);
    sun.position.set(26, 26, 34);
    sun.target.position.set(16, 0, 16);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -26;
    sun.shadow.camera.right = 26;
    sun.shadow.camera.top = 26;
    sun.shadow.camera.bottom = -26;
    sun.shadow.camera.near = 4;
    sun.shadow.camera.far = 70;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun, sun.target);
    // Dim fill: the shadow band must stay dark enough for tint + hatching.
    this.scene.add(new THREE.HemisphereLight(0xbfd9ff, 0xc9854f, 0.65));

    // Dark apron so the void outside the arena reads as canyon floor.
    const apronGrunge = getSharedGrunge().clone();
    apronGrunge.repeat.set(40, 40);
    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 300),
      makeToonMaterial(0x46332a, apronGrunge),
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(16, -0.08, 16);
    this.scene.add(apron);

    // Poison gas overlay quads (resized every frame from the zone rect).
    this.zoneMat = new THREE.MeshBasicMaterial({
      color: 0x7ad62c,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    for (let i = 0; i < 4; i++) {
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.zoneMat);
      quad.rotation.x = -Math.PI / 2;
      quad.visible = false;
      this.zoneQuads.push(quad);
      this.scene.add(quad);
    }

    this.subscribe(world);
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  private subscribe(world: World): void {
    world.events.on('explosion', ({ position, radius }) => this.effects.explosion(position, radius));
    world.events.on('hitImpact', ({ position }) => this.effects.hitPuff(position));
    world.events.on('brawlerFired', ({ brawler }) =>
      this.effects.muzzleFlash(brawler.position, brawler.rotation),
    );
    world.events.on('wallBroken', ({ tx, tz }) => {
      if (this.mapVisual) hideWallInstance(this.mapVisual, tx, tz, world.map.width);
      this.effects.explosion({ x: tx + 0.5, z: tz + 0.5 }, 0.6);
    });
    world.events.on('boxDestroyed', ({ box }) => this.effects.explosion(box.position, 0.5));
  }

  setMap(map: TileMap): void {
    if (this.mapVisual) {
      this.scene.remove(this.mapVisual.group);
      this.mapVisual.dispose();
    }
    this.mapVisual = buildMapVisual(map);
    this.scene.add(this.mapVisual.group);
  }

  /** Drop all per-entity visuals and effects (match restart). */
  resetMatch(): void {
    for (const v of this.visuals.values()) {
      this.scene.remove(v.group);
      disposeObject(v.group);
    }
    this.visuals.clear();
    this.effects.clear();
  }

  sync(world: World, localPlayer: Brawler | null, dt: number): void {
    const time = world.time;
    const seen = new Set<number>();

    for (const e of world.entities) {
      if (!e.alive) continue;
      seen.add(e.id);
      let v = this.visuals.get(e.id);
      if (!v) {
        v = this.createVisual(e);
        this.visuals.set(e.id, v);
      }
      this.syncEntity(e, v, localPlayer, time, dt);
    }

    // Entities gone from the world: tumble brawlers, drop the rest.
    for (const [id, v] of this.visuals) {
      if (seen.has(id)) continue;
      this.visuals.delete(id);
      if (v.isBrawler) {
        this.effects.corpse(v.group, () => disposeObject(v.group));
      } else {
        this.scene.remove(v.group);
        disposeObject(v.group);
      }
    }

    this.syncZone(world, time);
    this.effects.update(dt);
  }

  private createVisual(e: Entity): EntityVisual {
    let group: THREE.Object3D;
    let rig: CharacterRig | undefined;
    let isBrawler = false;

    if (e instanceof Brawler) {
      rig = buildCharacter(e.stats.kind, e.stats.color);
      rig.weapon.userData.baseZ = rig.weapon.position.z;
      group = rig.root;
      isBrawler = true;
    } else if (e instanceof Projectile) {
      const mesh = new THREE.Mesh(
        sphereGeo,
        new THREE.MeshBasicMaterial({ color: e.visualColor }),
      );
      mesh.scale.setScalar(e.visualSize);
      addOutline(mesh, 0.25);
      group = mesh;
    } else if (e instanceof PowerCube) {
      const mat = makeToonMaterial(0x4ddb3a);
      mat.emissive = new THREE.Color(0x1a4d12); // pops even in gas/shadow
      const mesh = new THREE.Mesh(cubeGeo, mat);
      mesh.castShadow = true;
      addOutline(mesh, 0.04, 'scale');
      group = mesh;
    } else if (e instanceof PowerCubeBox) {
      const mesh = new THREE.Mesh(crateGeo, makeToonMaterial(0xffffff, getCrateTexture()));
      mesh.castShadow = true;
      mesh.position.y = 0.4;
      addOutline(mesh, 0.05, 'scale');
      const wrapper = new THREE.Group();
      wrapper.add(mesh);
      group = wrapper;
    } else {
      // Logic-only entities (burst spawners) get an empty placeholder.
      group = new THREE.Group();
      group.visible = false;
    }

    this.scene.add(group);
    return { group, rig, isBrawler, lastX: e.position.x, lastZ: e.position.z, bobPhase: 0, faded: false };
  }

  private syncEntity(
    e: Entity,
    v: EntityVisual,
    localPlayer: Brawler | null,
    time: number,
    dt: number,
  ): void {
    v.group.position.set(e.position.x, e.visualHeight * (e instanceof Brawler ? 0 : 1), e.position.z);
    v.group.rotation.y = e.rotation;

    if (e instanceof PowerCube) {
      v.group.rotation.y = time * 2.2;
      v.group.position.y = 0.32 + Math.sin(time * 3.5) * 0.07;
      return;
    }

    if (!(e instanceof Brawler) || !v.rig) return;

    // Run bob: speed estimated from movement since last frame.
    const moved = Math.hypot(e.position.x - v.lastX, e.position.z - v.lastZ);
    v.lastX = e.position.x;
    v.lastZ = e.position.z;
    const speed = dt > 0 ? moved / dt : 0;
    if (speed > 0.5) {
      v.bobPhase += dt * 11;
      v.rig.body.position.y = Math.abs(Math.sin(v.bobPhase)) * 0.09;
      v.rig.body.rotation.x = 0.08;
    } else {
      v.rig.body.position.y *= 0.8;
      v.rig.body.rotation.x *= 0.8;
    }
    // Recoil: kick the weapon back on fire, then ease it home.
    const baseZ = (v.rig.weapon.userData.baseZ as number) ?? 0;
    const targetZ = baseZ + (time - e.lastFiredAt < 0.1 ? -0.08 : 0);
    v.rig.weapon.position.z += (targetZ - v.rig.weapon.position.z) * 0.5;

    // Bush stealth, from the local player's point of view.
    if (localPlayer && e !== localPlayer) {
      v.group.visible = !e.isHiddenFrom(localPlayer, time);
    } else {
      v.group.visible = true;
    }

    // The local player turns translucent while hidden in a bush.
    if (e.isPlayer) {
      const shouldFade = e.inBush;
      if (shouldFade !== v.faded) {
        v.faded = shouldFade;
        setGroupOpacity(v.group, shouldFade ? 0.5 : 1);
      }
    }
  }

  private syncZone(world: World, time: number): void {
    const zone = world.zone;
    if (!zone) {
      for (const q of this.zoneQuads) q.visible = false;
      return;
    }
    const { minX, minZ, maxX, maxZ } = zone.current;
    const W = world.map.width;
    const H = world.map.height;
    const y = 0.05;
    const margin = 6; // extend past the border walls so no floor peeks out
    const rects: Array<[number, number, number, number]> = [
      [-margin, -margin, W + margin, minZ], // north band
      [-margin, maxZ, W + margin, H + margin], // south band
      [-margin, minZ, minX, maxZ], // west band
      [maxX, minZ, W + margin, maxZ], // east band
    ];
    rects.forEach(([x0, z0, x1, z1], i) => {
      const quad = this.zoneQuads[i] as THREE.Mesh;
      const w = Math.max(0, x1 - x0);
      const h = Math.max(0, z1 - z0);
      quad.visible = w > 0.01 && h > 0.01;
      quad.scale.set(Math.max(w, 0.01), Math.max(h, 0.01), 1);
      quad.position.set(x0 + w / 2, y, z0 + h / 2);
    });
    this.zoneMat.opacity = 0.3 + Math.sin(time * 2.5) * 0.05;
  }

  render(camera: THREE.PerspectiveCamera): void {
    this.renderer.render(this.scene, camera);
  }
}

function setGroupOpacity(root: THREE.Object3D, opacity: number): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const mat = obj.material as THREE.Material;
      mat.transparent = opacity < 1;
      mat.opacity = opacity;
    }
  });
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      // Geometries are shared between a mesh and its outline child; double
      // dispose is harmless. Shared primitive geometries stay alive.
      if (obj.geometry !== sphereGeo && obj.geometry !== cubeGeo && obj.geometry !== crateGeo) {
        obj.geometry.dispose();
      }
      (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => m.dispose());
    }
  });
}
