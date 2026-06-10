import * as THREE from 'three';
import { angleOf, dist, norm, sub, type Vec2 } from '../core/MathUtils';
import type { Brawler } from '../entities/Brawler';

const Y = 0.04; // just above the floor, below everything else

function flatMaterial(color: number, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/**
 * Ground-projected aim guide for the local player: a direction line clamped
 * to weapon range with an arrow tip, a reticle at the cursor, and — for area
 * weapons — a blast circle at the landing point.
 */
export class AimIndicator {
  private readonly group = new THREE.Group();
  private readonly line: THREE.Mesh;
  private readonly chevron: THREE.Mesh;
  private readonly reticle: THREE.Mesh;
  private readonly aoeRing: THREE.Mesh;
  private readonly aoeFill: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    // Long thin quad extending +Z from its origin; scale.z = range.
    const lineGeo = new THREE.PlaneGeometry(0.16, 1);
    lineGeo.rotateX(-Math.PI / 2);
    lineGeo.translate(0, 0, 0.5);
    this.line = new THREE.Mesh(lineGeo, flatMaterial(0xffffff, 0.28));

    // Arrow tip pointing +Z (shape drawn toward -Y; rotateX maps -Y to +Z).
    const shape = new THREE.Shape();
    shape.moveTo(-0.22, 0);
    shape.lineTo(0.22, 0);
    shape.lineTo(0, -0.34);
    const chevGeo = new THREE.ShapeGeometry(shape);
    chevGeo.rotateX(-Math.PI / 2);
    this.chevron = new THREE.Mesh(chevGeo, flatMaterial(0xffffff, 0.4));

    const reticleGeo = new THREE.RingGeometry(0.22, 0.3, 24);
    reticleGeo.rotateX(-Math.PI / 2);
    this.reticle = new THREE.Mesh(reticleGeo, flatMaterial(0xffd23e, 0.55));

    // Unit-radius blast indicators, scaled to the weapon's aoeRadius.
    const aoeRingGeo = new THREE.RingGeometry(0.92, 1, 36);
    aoeRingGeo.rotateX(-Math.PI / 2);
    this.aoeRing = new THREE.Mesh(aoeRingGeo, flatMaterial(0xff5e2c, 0.6));
    const aoeFillGeo = new THREE.CircleGeometry(0.92, 36);
    aoeFillGeo.rotateX(-Math.PI / 2);
    this.aoeFill = new THREE.Mesh(aoeFillGeo, flatMaterial(0xff5e2c, 0.14));

    this.group.add(this.line, this.chevron, this.reticle, this.aoeRing, this.aoeFill);
    this.group.visible = false;
    scene.add(this.group);
  }

  update(player: Brawler | null, aimPoint: Vec2 | null): void {
    if (!player || !aimPoint || !player.alive) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;

    const toAim = sub(aimPoint, player.position);
    const angle = angleOf(toAim);
    const range = player.weaponRange;
    const aimDist = dist(player.position, aimPoint);

    this.line.position.set(player.position.x, Y, player.position.z);
    this.line.rotation.y = angle;
    this.line.scale.z = range;

    const dir = norm(toAim);
    this.chevron.position.set(
      player.position.x + dir.x * range,
      Y,
      player.position.z + dir.z * range,
    );
    this.chevron.rotation.y = angle;

    this.reticle.position.set(aimPoint.x, Y, aimPoint.z);

    const aoe = player.weaponAoeRadius;
    if (aoe !== undefined) {
      // Blast lands where the shot actually will: aim point clamped to range.
      const landDist = Math.min(aimDist, range);
      const lx = player.position.x + dir.x * landDist;
      const lz = player.position.z + dir.z * landDist;
      this.aoeRing.visible = this.aoeFill.visible = true;
      this.aoeRing.position.set(lx, Y, lz);
      this.aoeFill.position.set(lx, Y + 0.005, lz);
      this.aoeRing.scale.setScalar(aoe);
      this.aoeFill.scale.setScalar(aoe);
    } else {
      this.aoeRing.visible = this.aoeFill.visible = false;
    }
  }
}
