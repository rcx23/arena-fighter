import * as THREE from 'three';
import type { Vec2 } from '../core/MathUtils';
import type { World } from '../world/World';

interface FloatingNumber {
  el: HTMLSpanElement;
  pos: Vec2;
  age: number;
  drift: number;
  total: number;
  key: object | null;
}

const LIFETIME = 0.75;
const MAX_ACTIVE = 50;
/** Hits on the same target within this window merge into one number. */
const MERGE_WINDOW = 0.25;

/** Floating combat text spawned from damage/heal events. */
export class DamageNumbers {
  private active: FloatingNumber[] = [];
  private readonly projected = new THREE.Vector3();

  constructor(
    private readonly container: HTMLElement,
    world: World,
  ) {
    world.events.on('damageDealt', ({ target, amount }) => {
      this.spawn(target, target.position, amount, false);
    });
    world.events.on('healed', ({ target, amount }) => {
      this.spawn(target, target.position, amount, true);
    });
  }

  private spawn(key: object, pos: Vec2, amount: number, heal: boolean): void {
    // Burst weapons land many hits at once; merge them so the text is readable.
    const existing = this.active.find((n) => n.key === key && n.age < MERGE_WINDOW);
    if (existing) {
      existing.total += amount;
      existing.el.textContent = heal ? `+${existing.total}` : `${existing.total}`;
      return;
    }
    if (this.active.length >= MAX_ACTIVE) return;
    const el = document.createElement('span');
    el.className = heal ? 'damage-number heal' : 'damage-number';
    el.textContent = heal ? `+${amount}` : `${amount}`;
    this.container.appendChild(el);
    this.active.push({
      el,
      pos: { x: pos.x + (Math.random() - 0.5) * 0.5, z: pos.z },
      age: 0,
      drift: (Math.random() - 0.5) * 30,
      total: amount,
      key,
    });
  }

  update(camera: THREE.PerspectiveCamera, dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const n = this.active[i] as FloatingNumber;
      n.age += dt;
      const t = n.age / LIFETIME;
      if (t >= 1) {
        n.el.remove();
        this.active.splice(i, 1);
        continue;
      }
      this.projected.set(n.pos.x, 1.7, n.pos.z).project(camera);
      const x = ((this.projected.x + 1) / 2) * window.innerWidth + n.drift * t;
      const y = ((1 - this.projected.y) / 2) * window.innerHeight - 55 * t;
      n.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      n.el.style.opacity = `${1 - t * t}`;
    }
  }

  clear(): void {
    for (const n of this.active) n.el.remove();
    this.active = [];
  }
}
