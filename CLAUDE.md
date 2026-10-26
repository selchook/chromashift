# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server (hot-reload)
npm run build      # tsc + Vite production build → dist/
npm run preview    # Serve the dist/ build locally
```

No test runner is configured. TypeScript type-checking runs as part of `npm run build`.

## Architecture

**Stack:** Phaser 3.70 + TypeScript + Vite. Zero external assets — everything is drawn procedurally with `Phaser.GameObjects.Graphics` and synthesized with the Web Audio API.

### Scene Pipeline

```
Boot → Load → Menu → Game ──scene.launch()──► HUD  (parallel overlay)
               ↑                                │
               └──────── GameOver ◄─────────────┘  (HUD stopped before transition)
```

Scenes are registered in order in `src/main.ts`. `Phaser.Scale.RESIZE` mode is active — the canvas fills the full viewport; all scenes derive layout from `this.scale.width / height` at `create()` time and react to resizes (phone rotation, the Ayvago player changing size). `main.ts` also re-reads the parent size 250 ms after a window resize, because Phaser's orientation and resize handlers can race and leave the canvas at the old size.

### Key Files

| File | Role |
|---|---|
| `src/constants.ts` | Single source of truth for grid dims (`GRID_COLS`, `GRID_ROWS`, `CELL_SIZE`), color palette, scoring constants, scene keys (`SCENES.*`) |
| `src/types/index.ts` | All shared interfaces: `TileData`, `GameState`, `GridConfig`, etc. |
| `src/managers/AudioManager.ts` | Web Audio API synth — seeded into `this.registry` by MenuScene, retrieved by all other scenes |
| `src/managers/InputManager.ts` | Thin wrapper over Phaser pointer/keyboard events (not currently used in GameScene, which wires input directly) |

### GameScene internals

`GameScene` owns all game logic. Critical design decisions:

- **The board lives in its own coordinate space**: CELL_SIZE (48) units with the origin at the top-left cell (`gridOffsetX/Y` are 0). Three containers hold it: `boardBack` (slots), `tileLayer` (tile containers) and `boardFront` (selection, particles). `layoutBoard()` scales and centres them to fit below the HUD (24–60 px per cell) and runs again on every resize. Pointer positions go through `toBoard()`. Tweens keep using board units and absolute tile scales (1, 1.14, …), so they are unaffected by the board scale.
- **`buildTileGraphics(colorIndex)`** is the single function that draws tiles. It is called both at spawn time and on `refreshTileVisual()` after a Chromashift palette rotation. Tile graphics live inside `Phaser.GameObjects.Container`s stored in `tileContainers[row][col]`.
- **Input dual-mode:** `pointerdown` records position and handles tap-select; `pointerup` compares displacement — if ≥ 20 board units (about 17–25 px) it's treated as a directional swipe, otherwise the tap is used.
- **Match/resolve loop:** `findAllMatches()` → `resolveMatches()` → `afterMatchDestroy()` → gravity → `spawnNewTiles()` → cascade check. The `isResolving` flag blocks all input during this chain.
- **Chromashift:** every `CHROMASHIFT_INTERVAL` tile clears, `paletteShift` increments, which rotates the color array index for all tiles.

### HUD communication

HUDScene is a parallel scene launched by GameScene. It is **purely event-driven** — GameScene calls `hudScene.events.emit('updateState', gameState)` after any state change. HUDScene never reads from GameScene.

```ts
// GameScene side
const hud = this.scene.get(SCENES.HUD);
if (hud) hud.events.emit('updateState', this.gameState);
```

Always `scene.stop(SCENES.HUD)` before `scene.restart()` or transitioning away from GameScene — otherwise HUD double-launches.

### Layout conventions

- All scene content positions derive from `const { width, height } = this.scale` at `create()` start.
- MenuScene squeezes its vertical spacing by `k = min(1, height / 640)` and places the title letters by their measured widths. Menu and GameOver restart themselves (deferred) when the size changes. GameOver scales its panel to fit.
- HUDScene: score anchors to `this.scale.width - 16` (right edge), moves/level anchor to `x = 20` (left edge); the right and centred texts move on resize.
- Tile rendering uses container-local coordinates centered at `(0, 0)` — tile rect spans `±(CELL_SIZE/2 - pad)`.

### Deployment

`vercel.json` is configured for Vite. `npm run build` outputs to `dist/`. (The markdown code fences that `index.html` once had around it were removed; they showed up as text on top of the game.)
