# Game Design Document
## *CHROMASHIFT* — A Procedural Color-Chain Puzzle Game

> **Elevator Pitch:** Drag, rotate, and lock colored tiles onto a grid to form matching chains before the board overflows. Each chain cleared generates satisfying screen-pulse feedback and escalating tempo — pure browser-native, zero-download dopamine.

---

## 1. Concept & Hook

### Core Fantasy
"One more move" tension meets pattern-recognition satisfaction. Players feel clever, not lucky.

### Hook Statement
A **Tetris-adjacent, color-chain puzzle** where the player places procedurally generated 1–4 tile *Shards* onto a 7×7 grid. When **3+ same-colored tiles form an orthogonal chain**, they detonate, score points, and briefly unlock a cascade window for combos. The grid slowly fills; the player must survive while chasing high scores.

### Why It Works on Web
| Factor | Justification |
|---|---|
| Instant start | No loading screen > 3s, no account needed |
| Short feedback loops | First chain fires within 10–15 seconds |
| One-cursor input | Works on phone, tablet, laptop equally |
| Readable grid | Minimal UI, bold shapes, no text dependency |
| Replayability | Procedural shard generation = no two sessions alike |

### Unique Differentiator
**Chromashift Mechanic:** Every 10 clears, the entire board's color palette *shifts* — tiles don't change position, but their hue maps to the next palette. Players must mentally re-map their strategy mid-session, creating escalating cognitive pressure.

---

## 2. Core Loop

```
┌─────────────────────────────────────────────────────┐
│                   SESSION START                      │
│  Board: empty 7×7 grid | Queue: 3 upcoming shards   │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  PLACE PHASE                                        │
│  • Player sees Next Queue (3 shards)                │
│  • Drag/click to place on valid cell                │
│  • Rotate shard with R / right-click / two-finger   │
│  • One shard placed per turn                        │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  RESOLVE PHASE (auto, 400ms animation)              │
│  • Scan all orthogonal chains ≥3 same color         │
│  • Detonate matching chains (score + particles)     │
│  • Remaining tiles fall (gravity = down)            │
│  • Cascade check: new chains formed? → loop         │
└──────────────────────┬──────────────────────────────┘
                       │
              ┌────────┴────────┐
              │                 │
         [No overflow]     [Grid ≥ 80% full]
              │            after resolve
              │                 │
              ▼                 ▼
         NEXT TURN        DANGER MODE
         (loop)           (board edge pulses red,
                           tempo increases +15%)
                                │
                    [Board full / no valid place]
                                │
                                ▼
                          GAME OVER SCREEN
                          Score | Best | Restart
```

### Session Rhythm
| Phase | Duration | Feel |
|---|---|---|
| Opening (turns 1–8) | ~1–2 min | Calm, planning, setup |
| Mid-game (turns 9–25) | ~3–5 min | Combos firing, tension rising |
| Endgame (turns 26+) | ~2–3 min | Survival mode, desperate clears |
| Chromashift events | Every 10 clears | Surprise, re-orientation |

---

## 3. Mechanics

### 3.1 Grid System