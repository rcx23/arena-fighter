import { AmmoSystem } from '../combat/AmmoSystem';
import type { Brawler, BrawlerKind } from '../entities/Brawler';
import type { ShowdownMode } from '../modes/ShowdownMode';
import type { World } from '../world/World';

interface EndScreenOptions {
  title: string;
  defeat: boolean;
  subtitle: string;
  onPlayAgain: () => void;
  onSpectate?: (() => void) | undefined;
}

const BRAWLER_CARDS: Array<{ kind: BrawlerKind; icon: string; title: string; desc: string }> = [
  { kind: 'shooter', icon: '🤠', title: 'Six-Gun', desc: 'Mid-range bursts. Super: wall-busting bullet storm. Gadget: speed boost.' },
  { kind: 'thrower', icon: '💣', title: 'Boomer', desc: 'Lobs bombs over walls. Super: area barrage. Gadget: self heal.' },
  { kind: 'sniper', icon: '🎯', title: 'Longshot', desc: 'Huge single hits at range. Super: piercing railshot. Gadget: blink back.' },
  { kind: 'shotgunner', icon: '🐗', title: 'Buckshot', desc: 'Tanky close-range spread. Super: wall-smashing charge. Gadget: instant reload.' },
];

/**
 * All fixed-position UI: ammo/super/gadget indicators, alive counter, zone
 * timer, countdown, kill feed, plus the select and end overlays.
 */
export class HUD {
  private alivePill: HTMLElement;
  private zonePill: HTMLElement;
  private ammoPips: HTMLElement[] = [];
  private superBtn: HTMLElement;
  private superCharge: HTMLElement;
  private gadgetBtn: HTMLElement;
  private countdownEl: HTMLElement;
  private killFeed: HTMLElement;
  private overlay: HTMLElement | null = null;

  constructor(
    private readonly root: HTMLElement,
    world: World,
  ) {
    const top = el('div', 'hud-top');
    this.alivePill = pill('ALIVE', '10');
    this.zonePill = pill('ZONE', '--');
    this.zonePill.querySelector('.value')!.id = 'zone-timer';
    top.append(this.alivePill, this.zonePill);

    const bottom = el('div', 'hud-bottom');
    const ammoBox = el('div', 'ammo-box');
    for (let i = 0; i < AmmoSystem.MAX_BARS; i++) {
      const pip = el('div', 'ammo-pip');
      const fill = el('div', 'fill');
      pip.appendChild(fill);
      this.ammoPips.push(pip);
      ammoBox.appendChild(pip);
    }
    this.superBtn = el('div', 'skill-btn');
    this.superBtn.innerHTML = '<span>SUPER</span><span class="key">SPACE</span>';
    this.superCharge = el('div', 'charge');
    this.superBtn.appendChild(this.superCharge);
    this.gadgetBtn = el('div', 'skill-btn');
    this.gadgetBtn.innerHTML = '<span>GADGET</span><span class="key">F</span>';
    bottom.append(ammoBox, this.superBtn, this.gadgetBtn);

    this.countdownEl = el('div', '');
    this.countdownEl.id = 'countdown';
    this.countdownEl.classList.add('hidden');

    this.killFeed = el('div', 'kill-feed');
    world.events.on('brawlerDied', ({ brawler, killer }) => {
      const by = killer ? killer.stats.name : 'the gas';
      this.addKillFeedEntry(`${brawler.stats.name} 💀 by ${by}`);
    });

    root.append(top, bottom, this.countdownEl, this.killFeed);
  }

  update(player: Brawler | null, world: World, mode: ShowdownMode): void {
    this.alivePill.querySelector('.value')!.textContent = `${mode.aliveCount}`;

    const zone = world.zone;
    const zoneValue = this.zonePill.querySelector('.value') as HTMLElement;
    if (!zone || zone.isFullyShrunk) {
      zoneValue.textContent = 'FINAL';
    } else {
      const t = zone.timeToNextShrink(world.time);
      zoneValue.textContent = t <= 0.5 ? 'CLOSING' : `${Math.ceil(t)}s`;
    }

    if (player) {
      this.ammoPips.forEach((pip, i) => {
        const fill = pip.firstElementChild as HTMLElement;
        const amount = Math.max(0, Math.min(1, player.ammo.bars - i));
        fill.style.width = `${(amount * 100).toFixed(0)}%`;
      });
      this.superBtn.classList.toggle('ready', player.superReady);
      this.superCharge.style.height = `${(player.superCharge * 100).toFixed(0)}%`;
      const uses = player.gadget.usesLeft;
      this.gadgetBtn.classList.toggle('spent', uses <= 0);
      this.gadgetBtn.querySelector('span')!.textContent = `GADGET ${uses}`;
    }

    if (mode.state === 'countdown') {
      const n = Math.ceil(mode.countdownRemaining);
      this.countdownEl.textContent = n > 0 ? `${n}` : 'GO!';
      this.countdownEl.classList.remove('hidden');
    } else if (mode.state === 'playing' && world.time < 0.8) {
      this.countdownEl.textContent = 'GO!';
      this.countdownEl.classList.remove('hidden');
    } else {
      this.countdownEl.classList.add('hidden');
    }
  }

  showSelectScreen(onPick: (kind: BrawlerKind) => void): void {
    this.closeOverlay();
    const overlay = el('div', 'overlay');
    const title = document.createElement('h1');
    title.textContent = 'ARENA FIGHTER';
    const sub = document.createElement('h2');
    sub.textContent = 'Pick your brawler';
    const help = document.createElement('p');
    help.textContent = 'WASD move · mouse aim · click shoot · SPACE super · F gadget. Last one standing out of 10 wins. Grab power cubes, stay out of the gas!';
    const cards = el('div', 'brawler-cards');
    for (const def of BRAWLER_CARDS) {
      const card = el('div', 'brawler-card');
      card.innerHTML = `<div class="icon">${def.icon}</div><div class="cls">${def.title}</div><div class="desc">${def.desc}</div>`;
      card.addEventListener('click', () => {
        this.closeOverlay();
        onPick(def.kind);
      });
      cards.appendChild(card);
    }
    overlay.append(title, sub, help, cards);
    this.root.appendChild(overlay);
    this.overlay = overlay;
  }

  showEndScreen(opts: EndScreenOptions): void {
    this.closeOverlay();
    const overlay = el('div', 'overlay');
    const title = document.createElement('h1');
    title.textContent = opts.title;
    if (opts.defeat) title.classList.add('defeat');
    const sub = document.createElement('h2');
    sub.textContent = opts.subtitle;
    const buttons = el('div', 'buttons');
    const again = document.createElement('button');
    again.textContent = 'PLAY AGAIN';
    again.addEventListener('click', () => {
      this.closeOverlay();
      opts.onPlayAgain();
    });
    buttons.appendChild(again);
    if (opts.onSpectate) {
      const spectate = document.createElement('button');
      spectate.textContent = 'SPECTATE';
      spectate.className = 'secondary';
      spectate.addEventListener('click', () => {
        this.closeOverlay();
        opts.onSpectate?.();
      });
      buttons.appendChild(spectate);
    }
    overlay.append(title, sub, buttons);
    this.root.appendChild(overlay);
    this.overlay = overlay;
  }

  closeOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
  }

  private addKillFeedEntry(text: string): void {
    const entry = el('div', 'entry');
    entry.textContent = text;
    this.killFeed.appendChild(entry);
    while (this.killFeed.children.length > 5) this.killFeed.firstElementChild?.remove();
    setTimeout(() => entry.remove(), 4500);
  }
}

function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function pill(label: string, value: string): HTMLElement {
  const node = el('div', 'hud-pill');
  node.innerHTML = `<span class="label">${label}</span><span class="value">${value}</span>`;
  return node;
}
