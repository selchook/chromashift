# CHROMASHIFT — Implementation Specification

---

## 1. File Map

```
chromashift/
├── index.html                      # Shell: canvas mount, Vite entry point
├── vite.config.js                  # Vite build config, phaser alias, gzip target
├── package.json                    # Dependencies: phaser@3.60, vite
├── src/
│   ├── main.js                     # Phaser.Game instantiation, scene registry
│   ├── constants.js                # Grid dims, colors, timing, scoring consts
│   ├── scenes/
│   │   ├── BootScene.js            # Device-pixel-ratio setup, canvas scale config
│   │   ├── PreloadScene.js         # Procedural asset generation, progress bar draw
│   │   ├── MenuScene.js            # Title logo, play button, best-score display
│   │   ├── GameScene.js            # Core loop: grid, pieces, input, match logic
│   │   ├── HUDScene.js             # Parallel scene: score, level, combo counter
│   │   └── GameOverScene.js        # Final score, restart/menu CTA, share hook
│   ├── entities/
│   │   ├── Tile.js                 # Single cell: color, graphics object, tween refs
│   │   ├── Grid.js                 # 2D board state, match detection, gravity
│   │   ├── TilePool.js             # Object pool: acquire/release Tile instances
│   │   └── PieceQueue.js           # Next-3 preview queue, seeded RNG stream
│   ├── StateMachine.js             # Generic FSM: states map, transition guards
│   ├── audio/
│   │   └── SynthAudio.js           # Web Audio API synth: tones, sfx, no files
│   └── utils/
│       ├── ColorPalette.js         # HSL→hex palette generator, daltonize filter
│       └── ScoreManager.js         # Points calc, combo multiplier, localStorage
```

---

## 2. Scene Lifecycle

### Transition Diagram

```
BootScene
  │  configure scale, DPR, WebGL check
  ▼
PreloadScene
  │  generate all procedural textures into TextureManager
  │  draw loading bar with Graphics
  ▼
MenuScene  ◄──────────────────────────────────────────┐
  │  player presses PLAY                               │
  ▼                                                    │
GameScene (key: 'Game')                                │
  │  launches HUDScene in parallel (scene.launch)      │
  │  emits events on registry: 'scoreUpdate',          │
  │  'levelUp', 'gameOver'                             │
  │                             ┌──────────────────┐   │
  │  registry.on('gameOver')   │   HUDScene stops  │   │
  ▼                             └──────────────────┘   │
GameOverScene                                          │
  │  restart → scene.start('Game')                     │
  │  menu    → scene.start('Menu') ───────────────────►┘
```

### Per-Scene `init / create / update` Contract

| Scene | `init()` | `create()` | `update()` |
|---|---|---|---|
| BootScene | set `this.scale.scaleMode` | call `this.scene.start('Preload')` | — |
| PreloadScene | — | `generateTextures()`, draw bar | poll load % |
| MenuScene | read localStorage best | build UI GameObjects | idle tween loop |
| GameScene | reset StateMachine | build Grid, PieceQueue, bind input | tick StateMachine |
| HUDScene | — | subscribe registry events | update display text |
| GameOverScene | receive `finalScore` via `init(data)` | render results | — |

---

## 3. Entities & Classes

### `StateMachine` (`src/StateM