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

Scenes are registered in order in `src/main.ts`. `Phaser.Scale.RESIZE` mode is active — the canvas fills the full viewport; all scenes derive layout from `this.scale.width / height` at `create()` time.

### Key Files

| File | Role |
|---|---|
| `src/constants.ts` | Single source of truth for grid dims (`GRID_COLS`, `GRID_ROWS`, `CELL_SIZE`), color palette, scoring constants, scene keys (`SCENES.*`) |
| `src/types/index.ts` | All shared interfaces: `TileData`, `GameState`, `GridConfig`, etc. |
| `src/managers/AudioManager.ts` | Web Audio API synth — seeded into `this.registry` by MenuScene, retrieved by all other scenes |
| `src/managers/InputManager.ts` | Thin wrapper over Phaser pointer/keyboard events (not currently used in GameScene, which wires input directly) |

### GameScene internals

`GameScene` owns all game logic. Critical design decisions:

- **Grid offsets are computed at `create()` time** (`this.gridOffsetX`, `this.gridOffsetY`), not from constants, so the grid centers correctly in any viewport. The constants `GRID_OFFSET_X`/`GRID_OFFSET_Y` in `constants.ts` are kept only for `HUDScene`'s reference.
- **`buildTileGraphics(colorIndex)`** is the single function that draws tiles. It is called both at spawn time and on `refreshTileVisual()` after a Chromashift palette rotation. Tile graphics live inside `Phaser.GameObjects.Container`s stored in `tileContainers[row][col]`.
- **Input dual-mode:** `pointerdown` records position and handles tap-select; `pointerup` compares displacement — if ≥ 20 px it's treated as a directional swipe, otherwise the tap is used.
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
- HUDScene is the exception: score anchors to `this.scale.width - 16` (right edge), moves/level anchor to `x = 20` (left edge).
- Tile rendering uses container-local coordinates centered at `(0, 0)` — tile rect spans `±(CELL_SIZE/2 - pad)`.

### Deployment

`vercel.json` is configured for Vite. `npm run build` outputs to `dist/`. The `index.html` entry point contains markdown code fences on line 1 (artifact from generation) — browsers tolerate this but do not remove them without verifying the page still renders correctly.
