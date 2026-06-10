import { Game } from './core/Game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const hudRoot = document.getElementById('hud') as HTMLElement;

new Game(canvas, hudRoot).start();
