import * as THREE from 'three';
import { Brawler } from '../entities/Brawler';
import type { World } from '../world/World';

interface BarElements {
  root: HTMLDivElement;
  name: HTMLDivElement;
  fill: HTMLDivElement;
  cubes: HTMLDivElement;
}

const HEAD_HEIGHT = 1.75;

/**
 * HTML health bars projected over each brawler's head. DOM instead of sprite
 * billboards: crisp text at any DPI and trivial styling.
 */
export class HealthBarLayer {
  private bars = new Map<number, BarElements>();
  private readonly projected = new THREE.Vector3();

  constructor(private readonly container: HTMLElement) {}

  update(world: World, camera: THREE.PerspectiveCamera, localPlayer: Brawler | null): void {
    const seen = new Set<number>();
    for (const b of world.brawlersAlive()) {
      // Respect bush stealth: hidden enemies don't get a floating bar either.
      if (localPlayer && b !== localPlayer && b.isHiddenFrom(localPlayer, world.time)) continue;

      this.projected.set(b.position.x, HEAD_HEIGHT, b.position.z).project(camera);
      if (this.projected.z > 1) continue; // behind the camera

      seen.add(b.id);
      let bar = this.bars.get(b.id);
      if (!bar) {
        bar = this.createBar(b);
        this.bars.set(b.id, bar);
      }
      const x = ((this.projected.x + 1) / 2) * window.innerWidth;
      const y = ((1 - this.projected.y) / 2) * window.innerHeight;
      bar.root.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      bar.fill.style.width = `${((b.health / b.effectiveMaxHealth) * 100).toFixed(1)}%`;
      bar.cubes.textContent = b.powerCubes > 0 ? `■ ${b.powerCubes}` : '';
    }

    for (const [id, bar] of this.bars) {
      if (!seen.has(id)) {
        bar.root.remove();
        this.bars.delete(id);
      }
    }
  }

  clear(): void {
    for (const bar of this.bars.values()) bar.root.remove();
    this.bars.clear();
  }

  private createBar(b: Brawler): BarElements {
    const root = document.createElement('div');
    root.className = b.isPlayer ? 'health-bar friendly' : 'health-bar';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = b.stats.name;
    const barOuter = document.createElement('div');
    barOuter.className = 'bar';
    const fill = document.createElement('div');
    fill.className = 'fill';
    barOuter.appendChild(fill);
    const cubes = document.createElement('div');
    cubes.className = 'cubes';
    root.append(name, barOuter, cubes);
    this.container.appendChild(root);
    return { root, name, fill, cubes };
  }
}
