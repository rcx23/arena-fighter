import { Game } from './core/Game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const hudRoot = document.getElementById('hud') as HTMLElement;

// One-time film-grain tile for the #hud::after overlay (see style.css).
function installGrain(): void {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  const img = ctx.createImageData(96, 96);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(Math.random() * 256);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  hudRoot.style.setProperty('--grain', `url(${c.toDataURL()})`);
}

installGrain();
new Game(canvas, hudRoot).start();
