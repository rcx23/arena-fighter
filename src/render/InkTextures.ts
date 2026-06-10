import * as THREE from 'three';
import { TileType } from '../world/tiles';
import type { TileMap } from '../world/TileMap';

/**
 * Procedural canvas textures for the hand-inked Borderlands look: grunge,
 * panel lines and hatched grime, all generated at startup — no asset files.
 */

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return [canvas, canvas.getContext('2d') as CanvasRenderingContext2D];
}

function toTexture(canvas: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Deterministic per-call RNG so textures look the same every load. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function speckle(ctx: CanvasRenderingContext2D, size: number, rand: () => number, range: number, base: number): void {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = base + rand() * range;
    d[i] = Math.min(255, ((d[i] as number) * n) / 255);
    d[i + 1] = Math.min(255, ((d[i + 1] as number) * n) / 255);
    d[i + 2] = Math.min(255, ((d[i + 2] as number) * n) / 255);
  }
  ctx.putImageData(img, 0, 0);
}

function blotches(ctx: CanvasRenderingContext2D, size: number, rand: () => number, count: number, alpha: number): void {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = `rgba(20, 12, 8, ${alpha * (0.5 + rand())})`;
    ctx.beginPath();
    ctx.ellipse(rand() * size, rand() * size, (4 + rand() * 14) * (size / 128), (3 + rand() * 9) * (size / 128), rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

let sharedGrunge: THREE.CanvasTexture | null = null;

/**
 * Neutral near-white grunge multiplied under material.color — one texture
 * tints to every class/prop color. Shared singleton, never disposed.
 */
export function getSharedGrunge(): THREE.CanvasTexture {
  if (sharedGrunge) return sharedGrunge;
  const size = 128;
  const [canvas, ctx] = makeCanvas(size, size);
  const rand = rng(0xa11ce);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  speckle(ctx, size, rand, 20, 235);
  blotches(ctx, size, rand, 9, 0.05);
  // Faint scratches.
  ctx.strokeStyle = 'rgba(30, 20, 15, 0.1)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    const x = rand() * size;
    const y = rand() * size;
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 60, y + (rand() - 0.5) * 60);
    ctx.stroke();
  }
  sharedGrunge = toTexture(canvas, true);
  return sharedGrunge;
}

/** Jittered polyline — the "drawn by hand" line everything here relies on. */
function inkLine(
  ctx: CanvasRenderingContext2D,
  rand: () => number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  jitter: number,
  segments = 6,
): void {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    ctx.lineTo(
      x0 + (x1 - x0) * t + (rand() - 0.5) * jitter,
      y0 + (y1 - y0) * t + (rand() - 0.5) * jitter,
    );
  }
  ctx.stroke();
}

/** Rocky cover panel with cracks and a bold ink frame on every box face. */
export function makeWallTexture(): THREE.CanvasTexture {
  const size = 128;
  const [canvas, ctx] = makeCanvas(size, size);
  const rand = rng(0xbeef);
  ctx.fillStyle = '#8a6a48';
  ctx.fillRect(0, 0, size, size);

  // Horizontal strata cracks with a light catch above each.
  for (const y of [44, 86]) {
    ctx.strokeStyle = 'rgba(240, 220, 190, 0.35)';
    ctx.lineWidth = 2;
    inkLine(ctx, rand, 0, y - 3, size, y - 3, 4);
    ctx.strokeStyle = '#1c140f';
    ctx.lineWidth = 4;
    inkLine(ctx, rand, 0, y, size, y, 6);
  }
  // Short vertical crack stubs.
  ctx.strokeStyle = 'rgba(28, 20, 15, 0.8)';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 5; i++) {
    const x = 12 + rand() * (size - 24);
    const y = rand() * size;
    inkLine(ctx, rand, x, y, x + (rand() - 0.5) * 10, y + 14 + rand() * 16, 5, 3);
  }
  speckle(ctx, size, rand, 36, 222);
  blotches(ctx, size, rand, 6, 0.06);
  // Grounded base.
  const grad = ctx.createLinearGradient(0, size * 0.8, 0, size);
  grad.addColorStop(0, 'rgba(20, 12, 8, 0)');
  grad.addColorStop(1, 'rgba(20, 12, 8, 0.3)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  // Ink frame: reinforces every cube edge as drawn line work.
  ctx.strokeStyle = '#16100c';
  ctx.lineWidth = 9;
  ctx.strokeRect(0, 0, size, size);
  return toTexture(canvas);
}

const FLOOR_BASE: [number, number, number] = [216, 162, 102];

/**
 * The whole arena floor as one hand-drawn sheet: per-tile tone jitter, wobbly
 * grout, cracks, grime, water with wave strokes, and edge darkening.
 */
export function makeFloorTexture(map: TileMap, tilePx = 24): THREE.CanvasTexture {
  const w = map.width * tilePx;
  const h = map.height * tilePx;
  const [canvas, ctx] = makeCanvas(w, h);
  const rand = rng(0xf100d);

  for (let tz = 0; tz < map.height; tz++) {
    for (let tx = 0; tx < map.width; tx++) {
      const tile = map.get(tx, tz);
      const x = tx * tilePx;
      const y = tz * tilePx;
      // Deterministic per-tile jitter so reloads look identical.
      const j = Math.abs(Math.sin((tx * 131 + tz * 197) * 12.9898)) % 1;

      if (tile === TileType.Water) {
        ctx.fillStyle = `rgb(${50 + j * 14}, ${134 + j * 12}, ${196 + j * 10})`;
        ctx.fillRect(x, y, tilePx, tilePx);
        ctx.strokeStyle = 'rgba(225, 245, 255, 0.5)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 2; i++) {
          const wy = y + tilePx * (0.3 + i * 0.4) + (j - 0.5) * 4;
          inkLine(ctx, rand, x + 3, wy, x + tilePx - 3, wy, 3, 3);
        }
        continue;
      }

      const checker = (tx + tz) % 2 === 0 ? 1 : 0.93;
      const dark = tile === TileType.Bush ? 0.55 : 1;
      const tone = checker * dark * (0.94 + j * 0.12);
      const [r, g, b] = FLOOR_BASE;
      const green = tile === TileType.Bush ? 0.85 : 1;
      ctx.fillStyle = `rgb(${Math.round(r * tone * (green === 1 ? 1 : 0.45))}, ${Math.round(g * tone * green)}, ${Math.round(b * tone * (green === 1 ? 1 : 0.5))})`;
      ctx.fillRect(x, y, tilePx, tilePx);

      // Wobbly grout on two edges (the neighbor draws the other two).
      ctx.strokeStyle = 'rgba(58, 42, 28, 0.4)';
      ctx.lineWidth = 1.6;
      inkLine(ctx, rand, x, y, x + tilePx, y, 2.2, 3);
      inkLine(ctx, rand, x, y, x, y + tilePx, 2.2, 3);

      // Occasional crack or scuff.
      if (j > 0.84 && tile === TileType.Floor) {
        ctx.strokeStyle = 'rgba(40, 26, 16, 0.55)';
        ctx.lineWidth = 1.4;
        const cx = x + tilePx * (0.2 + j * 0.5);
        inkLine(ctx, rand, cx, y + 4, cx + (j - 0.5) * 16, y + tilePx - 4, 4, 3);
      }
    }
  }

  // Water gets an ink rim where it meets land.
  ctx.strokeStyle = '#14202c';
  ctx.lineWidth = 2.5;
  for (let tz = 0; tz < map.height; tz++) {
    for (let tx = 0; tx < map.width; tx++) {
      if (map.get(tx, tz) !== TileType.Water) continue;
      const x = tx * tilePx;
      const y = tz * tilePx;
      if (map.get(tx, tz - 1) !== TileType.Water) inkLine(ctx, rand, x, y, x + tilePx, y, 2, 3);
      if (map.get(tx, tz + 1) !== TileType.Water) inkLine(ctx, rand, x, y + tilePx, x + tilePx, y + tilePx, 2, 3);
      if (map.get(tx - 1, tz) !== TileType.Water) inkLine(ctx, rand, x, y, x, y + tilePx, 2, 3);
      if (map.get(tx + 1, tz) !== TileType.Water) inkLine(ctx, rand, x + tilePx, y, x + tilePx, y + tilePx, 2, 3);
    }
  }

  // Big soft dirt patches + darkening toward the border.
  blotches(ctx, w, (rng(0xd127)), 14, 0.05);
  const edge = ctx.createRadialGradient(w / 2, h / 2, w * 0.32, w / 2, h / 2, w * 0.72);
  edge.addColorStop(0, 'rgba(16, 10, 8, 0)');
  edge.addColorStop(1, 'rgba(16, 10, 8, 0.28)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, w, h);

  return toTexture(canvas);
}

/** Scribbled leaf clusters for the bush blob spheres. */
export function makeBushTexture(): THREE.CanvasTexture {
  const size = 64;
  const [canvas, ctx] = makeCanvas(size, size);
  const rand = rng(0x1eaf);
  // Vertical gradient: darker base, lighter crown.
  const grad = ctx.createLinearGradient(0, size, 0, 0);
  grad.addColorStop(0, '#3c7028');
  grad.addColorStop(1, '#69b743');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  // Leaf-cluster scribble arcs in two darker greens.
  for (const [color, n] of [['#2e5a1e', 16], ['#477f2e', 12]] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      const x = rand() * size;
      const y = rand() * size;
      ctx.arc(x, y, 3 + rand() * 5, rand() * Math.PI, rand() * Math.PI + 1.8 + rand());
      ctx.stroke();
    }
  }
  speckle(ctx, size, rand, 30, 225);
  return toTexture(canvas, true);
}

/** Wooden plank crate with cross-brace and ink border. */
export function makeCrateTexture(): THREE.CanvasTexture {
  const size = 64;
  const [canvas, ctx] = makeCanvas(size, size);
  const rand = rng(0xc4a7e);
  ctx.fillStyle = '#b98c4a';
  ctx.fillRect(0, 0, size, size);
  // Planks.
  ctx.strokeStyle = '#5a3c1c';
  ctx.lineWidth = 2.5;
  for (const y of [21, 42]) inkLine(ctx, rand, 0, y, size, y, 2);
  // X cross-brace.
  ctx.strokeStyle = 'rgba(74, 50, 22, 0.85)';
  ctx.lineWidth = 4;
  inkLine(ctx, rand, 6, 6, size - 6, size - 6, 3);
  inkLine(ctx, rand, size - 6, 6, 6, size - 6, 3);
  speckle(ctx, size, rand, 30, 226);
  // Ink border.
  ctx.strokeStyle = '#16100c';
  ctx.lineWidth = 5;
  ctx.strokeRect(0, 0, size, size);
  return toTexture(canvas);
}
