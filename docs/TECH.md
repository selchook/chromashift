# CHROMASHIFT — Technical Architecture Document

---

## 1. Engine Choice: Phaser 3

**Rationale:**
- Native Canvas/WebGL renderer with automatic fallback — guaranteed Chrome/Edge compatibility
- Built-in Scene Manager eliminates manual state-machine boilerplate
- `Phaser.GameObjects.Graphics` API enables 100% procedural asset generation at runtime
- Pointer + touch events unified under a single input abstraction (`Phaser.Input.Pointer`)
- `Phaser.Tweens` and `Phaser.Cameras.Scene2D.Effects` deliver the screen-pulse feedback chain at near-zero cost
- Tree-shakeable via Vite + phaser/src imports → final bundle stays under 1 MB gzipped
- Active CrazyGames HTML5 catalogue — no plugin requirements

**Version pin:** `phaser@3.70.0`

---

## 2. Project File Structure

```
chromashift/
├── index.html                  # Single entry point, <canvas id="gameCanvas">
├── package.json
├── vite.config.js              # Vite build config
├── dist/                       # Build output (gitignored)
│
└── src/
    ├── main.js                 # Phaser.Game bootstrap, config object
    ├── constants.js            # Grid dims, colors, timing, scoring
    │
    ├── scenes/
    │   ├── BootScene.js        # Phaser.Scene: key='Boot'
    │   ├── PreloadScene.js     # Phaser.Scene: key='Preload'  (procedural gen only)
    │   ├── MenuScene.js        # Phaser.Scene: key='Menu'
    │   ├── GameScene.js        # Phaser.Scene: key='Game'     (primary logic)
    │   ├── HUDScene.js         # Phaser.Scene: key='HUD'      (parallel overlay)
    │   └── GameOverScene.js    # Phaser.Scene: key='GameOver'
    │
    ├── game/
    │   ├── StateMachine.js     # Lightweight finite-state machine class
    │   ├── Grid.js             # Board model — 2-D array, chain detection
    │   ├── TilePool.js         # Object pool for Tile game objects
    │   ├── Tile.js             # Single tile entity (color, shape, Phaser.GO)
    │   ├── PieceQueue.js       # Procedural next-piece generator
    │   ├── ChainSolver.js      # BFS/flood-fill chain validator
    │   └── ScoreManager.js     # Combo multipliers, high-score (localStorage)
    │
    ├── input/
    │   ├── InputRouter.js      # Unifies keyboard + pointer + touch
    │   ├── DragHandler.js      # Pointer drag → grid snap logic
    │   └── KeyboardHandler.js  # Arrow/WASD rotate, SPACE lock, R restart
    │
    ├── audio/
    │   ├── AudioEngine.js      # Web Audio API context manager
    │   ├── SoundBank.js        # Procedural tone/noise generators
    │   └── MusicLoop.js        # Generative background pulse loop
    │
    ├── graphics/
    │   ├── TextureFactory.js   # Generates all RenderTextures at startup
    │   ├── TileRenderer.js     # Draws tile faces (glow, bevel, gradient)
    │   ├── ParticleConfig.js   # Phaser particle emitter configs (procedural)
    │   └── ScreenFX.js         # Camera flash/shake, chromatic-aberration shader
    │
    └── utils/
        ├── ColorPalette.js     # HSL-derived 6-color palette + dark/light variants
        ├── EventBus.js         # Phaser.Events.EventEmitter singleton
        └── MathUtils.js        # Grid↔