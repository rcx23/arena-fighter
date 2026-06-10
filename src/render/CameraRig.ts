import * as THREE from 'three';
import { damp, type Vec2 } from '../core/MathUtils';
import type { GroundPicker } from '../control/PlayerController';

const OFFSET = new THREE.Vector3(0, 15, 9.3);

/**
 * Fixed-yaw angled top-down camera that smoothly follows a focus point.
 * Also converts screen rays to ground points for aiming.
 */
export class CameraRig implements GroundPicker {
  readonly camera: THREE.PerspectiveCamera;
  private focus = new THREE.Vector3();
  private readonly raycaster = new THREE.Raycaster();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(48, aspect, 0.5, 100);
    this.camera.position.copy(OFFSET);
    this.camera.lookAt(0, 0, 0);
  }

  snapTo(target: Vec2): void {
    this.focus.set(target.x, 0, target.z);
    this.syncCamera();
  }

  update(target: Vec2, dt: number): void {
    this.focus.x = damp(this.focus.x, target.x, 8, dt);
    this.focus.z = damp(this.focus.z, target.z, 8, dt);
    this.syncCamera();
  }

  private syncCamera(): void {
    this.camera.position.copy(this.focus).add(OFFSET);
    this.camera.lookAt(this.focus);
  }

  screenToGround(x: number, y: number): Vec2 {
    const ndc = new THREE.Vector2(
      (x / window.innerWidth) * 2 - 1,
      -(y / window.innerHeight) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.groundPlane, hit);
    return { x: hit.x, z: hit.z };
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
