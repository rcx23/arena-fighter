# Arena Fighter

A web-based, Brawl Stars-inspired top-down arena shooter for PC, built with
**TypeScript + Three.js + Vite** — no game engine. Cel-shaded ("toon" stepped
lighting + bold ink outlines) with chunky cartoon characters built entirely
from primitives.

## Play

```bash
npm install
npm run dev      # open http://localhost:5173
```

| Input | Action |
| --- | --- |
| WASD / arrows | Move |
| Mouse | Aim |
| Left click | Attack (3 ammo bars, regenerating) |
| Space / right click | Super (charged by dealing damage) |
| F | Gadget (3 uses per match) |

## Game mode: Solo Showdown

10 brawlers (you + 9 bots) drop into a procedurally generated 32×32 arena.
Poison gas closes in on a timer; crates drop power cubes (+10% damage and max
health each); bushes hide you until you shoot, take damage, or someone walks
in. Last one standing wins.

## Brawlers

| Class | Basic attack | Super | Gadget |
| --- | --- | --- | --- |
| **Six-Gun** (Shooter) | Mid-range bullet burst | Bullet Storm — wall-busting volley | Adrenaline — speed boost |
| **Boomer** (Thrower) | Bombs lobbed over walls | Area Barrage — explosive carpet | First Aid — self heal |
| **Longshot** (Sniper) | Slow, huge single shots | Railshot — pierces everything in a line | Backpedal — blink away |
| **Buckshot** (Shotgunner) | Close-range pellet spread | Bull Charge — wall-smashing dash | Fast Hands — instant reload |

## Architecture

Classic OOP: inheritance defines what a brawler *is*, composition (Strategy
pattern) defines what it *does*.

```
Entity (abstract)
├── Brawler (abstract) ──► Shooter / Thrower / Sniper / Shotgunner
│     ├ composes Weapon (RapidFire / Lob / Sniper / Spread)
│     ├ composes Super  (BulletStorm / AreaBarrage / PiercingShot / ChargeDash)
│     ├ composes Gadget (SpeedBoost / SelfHeal / BlinkBack / ShellReload)
│     └ driven by Controller (PlayerController | BotController FSM)
├── Projectile (abstract) ──► Bullet ──► PiercingShot
│                         └─► LobbedProjectile
├── PowerCubeBox / PowerCube
```

- `src/core/` — fixed-timestep game loop, input, typed event bus
- `src/world/` — tile map, symmetric procedural map generator, entity registry
- `src/physics/` — 2D circle-vs-tile collision on the XZ plane (3D is visual only)
- `src/combat/` — weapon/super/gadget strategies, ammo system
- `src/control/` — the `Controller` seam: human input or bot FSM (wander / loot / engage / flee)
- `src/modes/` — Showdown match state machine + poison zone
- `src/render/` — Three.js scene: toon materials, inverted-hull outlines, procedural characters, instanced map, effects
- `src/ui/` — DOM HUD, projected health bars, floating damage numbers

## Scripts

- `npm run dev` — dev server
- `npm run build` — type-check + production build
- `npm run typecheck` — `tsc --noEmit`
