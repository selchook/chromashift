import Phaser from 'phaser';
import {
  SCENES, BG_COLOR, COLORS, GRID_COLS, GRID_ROWS, CELL_SIZE,
  GRID_OFFSET_X, GRID_OFFSET_Y, MATCH_MIN, BASE_SCORE,
  COMBO_MULTIPLIER, STORAGE_KEY, CHROMASHIFT_INTERVAL
} from '../constants';
import { AudioManager } from '../managers/AudioManager';
import { TileData, GameState } from '../types';

export class GameScene extends Phaser.Scene {
  private audioManager!: AudioManager;
  private grid: (TileData | null)[][] = [];
  private tileContainers: (Phaser.GameObjects.Container | null)[][] = [];
  private selectedTile: { row: number; col: number } | null = null;
  private selectionPulseTween: Phaser.Tweens.Tween | null = null;
  private gameState!: GameState;
  private isResolving: boolean = false;
  private pointerDownX: number = 0;
  private pointerDownY: number = 0;
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private selectionGraphics!: Phaser.GameObjects.Graphics;
  private particleGraphics!: Phaser.GameObjects.Graphics;
  private particles: Array<{
    x: number; y: number; vx: number; vy: number;
    color: number; alpha: number; size: number; life: number; maxLife: number;
  }> = [];
  private totalClears: number = 0;
  private paletteShift: number = 0;

  constructor() {
    super({ key: SCENES.GAME });
  }

  private tileX(col: number): number {
    return GRID_OFFSET_X + col * CELL_SIZE + CELL_SIZE / 2;
  }

  private tileY(row: number): number {
    return GRID_OFFSET_Y + row * CELL_SIZE + CELL_SIZE / 2;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BG_COLOR);
    this.cameras.main.fadeIn(400, 0, 0, 0);

    this.audioManager = this.registry.get('audioManager') || new AudioManager();
    if (!this.registry.get('audioManager')) {
      this.registry.set('audioManager', this.audioManager);
    }

    this.gameState = {
      score: 0, level: 1, moves: 0, maxMoves: 30,
      highScore: parseInt(localStorage.getItem(STORAGE_KEY) || '0'),
      combo: 0, isGameOver: false
    };

    this.isResolving = false;
    this.selectedTile = null;
    this.totalClears = 0;
    this.paletteShift = 0;
    this.particles = [];

    // Layer order via depth
    this.gridGraphics = this.add.graphics().setDepth(0);
    this.selectionGraphics = this.add.graphics().setDepth(20);
    this.particleGraphics = this.add.graphics().setDepth(30);

    this.drawGridBackground();
    this.initGrid();
    this.dropInAllTiles();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.pointerDownX = pointer.x;
      this.pointerDownY = pointer.y;
      this.handlePointerDown(pointer.x, pointer.y);
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      this.handlePointerUp(pointer.x, pointer.y);
    });

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-R', () => this.restartGame());
      this.input.keyboard.on('keydown-ESC', () => this.goToMenu());
    }

    this.scene.launch(SCENES.HUD);
    this.scene.get(SCENES.HUD)?.events.emit('updateState', this.gameState);
    this.audioManager.startMusic();
  }

  // ─── Grid init ────────────────────────────────────────────────────────────

  private initGrid(): void {
    this.grid = [];
    this.tileContainers = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      this.grid[row] = [];
      this.tileContainers[row] = [];
      for (let col = 0; col < GRID_COLS; col++) {
        this.grid[row][col] = {
          colorIndex: Math.floor(Math.random() * COLORS.length),
          row, col, isMatched: false, isSpecial: false
        };
        this.tileContainers[row][col] = null;
      }
    }
    // Remove any initial matches
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        let tries = 0;
        while (this.hasMatchAt(row, col) && tries++ < 10) {
          const t = this.grid[row][col];
          if (t) t.colorIndex = Math.floor(Math.random() * COLORS.length);
        }
      }
    }
  }

  private hasMatchAt(row: number, col: number): boolean {
    const t = this.grid[row][col];
    if (!t) return false;
    const ci = t.colorIndex;
    if (col >= 2) {
      const a = this.grid[row][col - 1], b = this.grid[row][col - 2];
      if (a && b && a.colorIndex === ci && b.colorIndex === ci) return true;
    }
    if (row >= 2) {
      const a = this.grid[row - 1][col], b = this.grid[row - 2][col];
      if (a && b && a.colorIndex === ci && b.colorIndex === ci) return true;
    }
    return false;
  }

  // ─── Visual helpers ────────────────────────────────────────────────────────

  private drawGridBackground(): void {
    this.gridGraphics.clear();
    // Outer glow/shadow
    this.gridGraphics.fillStyle(0x000000, 0.5);
    this.gridGraphics.fillRoundedRect(
      GRID_OFFSET_X - 2, GRID_OFFSET_Y + 5,
      GRID_COLS * CELL_SIZE + 8, GRID_ROWS * CELL_SIZE + 8, 10
    );
    // Board background
    this.gridGraphics.fillStyle(0x0c0c26, 1);
    this.gridGraphics.fillRoundedRect(
      GRID_OFFSET_X - 4, GRID_OFFSET_Y - 4,
      GRID_COLS * CELL_SIZE + 8, GRID_ROWS * CELL_SIZE + 8, 10
    );
    // Subtle cell slots
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        this.gridGraphics.fillStyle(0x111130, 1);
        this.gridGraphics.fillRoundedRect(
          GRID_OFFSET_X + col * CELL_SIZE + 3,
          GRID_OFFSET_Y + row * CELL_SIZE + 3,
          CELL_SIZE - 6, CELL_SIZE - 6, 6
        );
      }
    }
  }

  /** Build the graphics inside a tile container (without creating the container). */
  private buildTileGraphics(colorIndex: number): Phaser.GameObjects.Graphics {
    const color = COLORS[(colorIndex + this.paletteShift) % COLORS.length];
    const half = CELL_SIZE / 2;
    const pad = 4;
    const r = 7;
    const w = CELL_SIZE - pad * 2;
    const h = CELL_SIZE - pad * 2;

    const g = this.add.graphics();

    // Drop shadow
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(-half + pad + 2, -half + pad + 3, w, h, r);

    // Main body with slight gradient illusion (two-tone)
    g.fillStyle(color, 1);
    g.fillRoundedRect(-half + pad, -half + pad, w, h, r);

    // Darker lower half for depth
    const darkColor = Phaser.Display.Color.IntegerToColor(color);
    darkColor.darken(25);
    g.fillStyle(darkColor.color, 0.5);
    g.fillRoundedRect(-half + pad, 0, w, h / 2, { tl: 0, tr: 0, bl: r, br: r });

    // Top shine strip
    g.fillStyle(0xffffff, 0.28);
    g.fillRoundedRect(-half + pad + 3, -half + pad + 3, w - 6, Math.floor(h * 0.32), { tl: r, tr: r, bl: 0, br: 0 });

    // Inner border highlight
    g.lineStyle(1.5, 0xffffff, 0.15);
    g.strokeRoundedRect(-half + pad, -half + pad, w, h, r);

    return g;
  }

  private createTileContainer(row: number, col: number, startY?: number): Phaser.GameObjects.Container {
    const tile = this.grid[row][col]!;
    const tx = this.tileX(col);
    const ty = startY !== undefined ? startY : this.tileY(row);
    const g = this.buildTileGraphics(tile.colorIndex);
    const container = this.add.container(tx, ty, [g]);
    container.setSize(CELL_SIZE - 4, CELL_SIZE - 4);
    container.setDepth(10);
    return container;
  }

  private refreshTileVisual(row: number, col: number): void {
    const c = this.tileContainers[row][col];
    const t = this.grid[row][col];
    if (!c || !t) return;
    c.removeAll(true);
    c.add(this.buildTileGraphics(t.colorIndex));
  }

  // ─── Drop-in animation (initial board) ────────────────────────────────────

  private dropInAllTiles(): void {
    for (let col = 0; col < GRID_COLS; col++) {
      for (let row = 0; row < GRID_ROWS; row++) {
        const startY = GRID_OFFSET_Y - CELL_SIZE * (row + 2);
        const container = this.createTileContainer(row, col, startY);
        container.setScale(0.6).setAlpha(0);
        this.tileContainers[row][col] = container;

        this.tweens.add({
          targets: container,
          y: this.tileY(row),
          scaleX: 1, scaleY: 1, alpha: 1,
          duration: 420,
          delay: col * 50 + row * 28,
          ease: 'Back.easeOut'
        });
      }
    }
  }

  // ─── Selection ────────────────────────────────────────────────────────────

  private drawSelection(): void {
    this.selectionGraphics.clear();
    if (this.selectionPulseTween) { this.selectionPulseTween.stop(); this.selectionPulseTween = null; }

    if (!this.selectedTile) return;
    const { row, col } = this.selectedTile;
    const container = this.tileContainers[row][col];
    if (!container) return;

    // Pulse scale on the tile itself
    this.selectionPulseTween = this.tweens.add({
      targets: container,
      scaleX: 1.14, scaleY: 1.14,
      duration: 380,
      yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Bright ring + soft outer glow
    const x = GRID_OFFSET_X + col * CELL_SIZE;
    const y = GRID_OFFSET_Y + row * CELL_SIZE;
    this.selectionGraphics.lineStyle(2.5, 0xffffff, 1);
    this.selectionGraphics.strokeRoundedRect(x + 3, y + 3, CELL_SIZE - 6, CELL_SIZE - 6, 7);
    this.selectionGraphics.lineStyle(8, 0xffffff, 0.18);
    this.selectionGraphics.strokeRoundedRect(x, y, CELL_SIZE, CELL_SIZE, 9);
  }

  private clearSelection(): void {
    if (this.selectionPulseTween) { this.selectionPulseTween.stop(); this.selectionPulseTween = null; }
    if (this.selectedTile) {
      const c = this.tileContainers[this.selectedTile.row]?.[this.selectedTile.col];
      if (c) this.tweens.add({ targets: c, scaleX: 1, scaleY: 1, duration: 120, ease: 'Sine.easeOut' });
    }
    this.selectionGraphics.clear();
    this.selectedTile = null;
  }

  // ─── Input ────────────────────────────────────────────────────────────────

  private handlePointerDown(px: number, py: number): void {
    if (this.isResolving || this.gameState.isGameOver) return;

    const col = Math.floor((px - GRID_OFFSET_X) / CELL_SIZE);
    const row = Math.floor((py - GRID_OFFSET_Y) / CELL_SIZE);

    if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS || !this.grid[row][col]) {
      this.clearSelection();
      return;
    }

    if (!this.selectedTile) {
      this.selectedTile = { row, col };
      this.audioManager.playTileSelect();
      this.drawSelection();
      // Quick pop on select
      const c = this.tileContainers[row][col];
      if (c) this.tweens.add({ targets: c, scaleX: 1.18, scaleY: 0.88, duration: 60, yoyo: true, ease: 'Sine.easeInOut' });
    } else {
      const dr = Math.abs(row - this.selectedTile.row);
      const dc = Math.abs(col - this.selectedTile.col);

      if (dr + dc === 1) {
        const prev = { ...this.selectedTile };
        this.clearSelection();
        this.swapTiles(prev.row, prev.col, row, col);
      } else if (row === this.selectedTile.row && col === this.selectedTile.col) {
        this.clearSelection();
      } else {
        this.clearSelection();
        this.selectedTile = { row, col };
        this.audioManager.playTileSelect();
        this.drawSelection();
        const c = this.tileContainers[row][col];
        if (c) this.tweens.add({ targets: c, scaleX: 1.18, scaleY: 0.88, duration: 60, yoyo: true, ease: 'Sine.easeInOut' });
      }
    }
  }

  private handlePointerUp(px: number, py: number): void {
    if (this.isResolving || this.gameState.isGameOver) return;

    const dx = px - this.pointerDownX;
    const dy = py - this.pointerDownY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const SWIPE_THRESHOLD = 20;

    if (dist < SWIPE_THRESHOLD) return; // tap, already handled by pointerdown

    const col = Math.floor((this.pointerDownX - GRID_OFFSET_X) / CELL_SIZE);
    const row = Math.floor((this.pointerDownY - GRID_OFFSET_Y) / CELL_SIZE);
    if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS || !this.grid[row][col]) return;

    let dr = 0, dc = 0;
    if (Math.abs(dx) > Math.abs(dy)) {
      dc = dx > 0 ? 1 : -1;
    } else {
      dr = dy > 0 ? 1 : -1;
    }

    const r2 = row + dr, c2 = col + dc;
    if (r2 < 0 || r2 >= GRID_ROWS || c2 < 0 || c2 >= GRID_COLS || !this.grid[r2][c2]) return;

    this.clearSelection();
    this.swapTiles(row, col, r2, c2);
  }

  // ─── Swap ─────────────────────────────────────────────────────────────────

  private swapTiles(r1: number, c1: number, r2: number, c2: number): void {
    this.audioManager.playSwap();
    this.gameState.moves++;

    const con1 = this.tileContainers[r1][c1];
    const con2 = this.tileContainers[r2][c2];
    const tx1 = this.tileX(c1), ty1 = this.tileY(r1);
    const tx2 = this.tileX(c2), ty2 = this.tileY(r2);

    // Swap data
    const td = this.grid[r1][c1];
    this.grid[r1][c1] = this.grid[r2][c2];
    this.grid[r2][c2] = td;
    if (this.grid[r1][c1]) { this.grid[r1][c1]!.row = r1; this.grid[r1][c1]!.col = c1; }
    if (this.grid[r2][c2]) { this.grid[r2][c2]!.row = r2; this.grid[r2][c2]!.col = c2; }
    this.tileContainers[r1][c1] = con2;
    this.tileContainers[r2][c2] = con1;

    // Animate both containers to new positions
    let done = 0;
    const onBothDone = () => {
      const matches = this.findAllMatches();
      if (matches.length > 0) {
        this.gameState.combo = 0;
        this.isResolving = true;
        this.time.delayedCall(80, () => this.resolveMatches(matches));
      } else {
        this.audioManager.playNoMatch();
        // Swap data back
        const td2 = this.grid[r1][c1];
        this.grid[r1][c1] = this.grid[r2][c2];
        this.grid[r2][c2] = td2;
        if (this.grid[r1][c1]) { this.grid[r1][c1]!.row = r1; this.grid[r1][c1]!.col = c1; }
        if (this.grid[r2][c2]) { this.grid[r2][c2]!.row = r2; this.grid[r2][c2]!.col = c2; }
        this.tileContainers[r1][c1] = con1;
        this.tileContainers[r2][c2] = con2;
        // Animate back with slight overshoot wobble
        if (con1) this.tweens.add({ targets: con1, x: tx1, y: ty1, duration: 200, ease: 'Back.easeOut' });
        if (con2) this.tweens.add({
          targets: con2, x: tx2, y: ty2, duration: 200, ease: 'Back.easeOut',
          onComplete: () => { this.wobbleTile(r1, c1); this.wobbleTile(r2, c2); }
        });
      }
      this.updateHUD();
      if (this.gameState.moves >= this.gameState.maxMoves && !this.isResolving) {
        this.time.delayedCall(300, () => this.endGame());
      }
    };

    if (con1) {
      this.tweens.add({ targets: con1, x: tx2, y: ty2, duration: 220, ease: 'Back.easeOut', onComplete: () => { if (++done === 2) onBothDone(); } });
    } else { done++; }

    if (con2) {
      this.tweens.add({ targets: con2, x: tx1, y: ty1, duration: 220, ease: 'Back.easeOut', onComplete: () => { if (++done === 2) onBothDone(); } });
    } else { done++; }

    if (done === 2) onBothDone();
  }

  private wobbleTile(row: number, col: number): void {
    const c = this.tileContainers[row][col];
    if (!c) return;
    this.tweens.add({
      targets: c, scaleX: 1.1, scaleY: 0.9,
      duration: 70, yoyo: true, repeat: 2,
      ease: 'Sine.easeInOut',
      onComplete: () => c.setScale(1)
    });
  }

  // ─── Match detection ──────────────────────────────────────────────────────

  private findAllMatches(): Array<{ row: number; col: number }> {
    const matched = new Set<string>();
    for (let row = 0; row < GRID_ROWS; row++) {
      let s = 0;
      for (let col = 1; col <= GRID_COLS; col++) {
        const prev = this.grid[row][col - 1], curr = col < GRID_COLS ? this.grid[row][col] : null;
        if (!curr || !prev || curr.colorIndex !== prev.colorIndex) {
          if (col - s >= MATCH_MIN) for (let k = s; k < col; k++) matched.add(`${row},${k}`);
          s = col;
        }
      }
    }
    for (let col = 0; col < GRID_COLS; col++) {
      let s = 0;
      for (let row = 1; row <= GRID_ROWS; row++) {
        const prev = this.grid[row - 1][col], curr = row < GRID_ROWS ? this.grid[row][col] : null;
        if (!curr || !prev || curr.colorIndex !== prev.colorIndex) {
          if (row - s >= MATCH_MIN) for (let k = s; k < row; k++) matched.add(`${k},${col}`);
          s = row;
        }
      }
    }
    return Array.from(matched).map(s => { const [r, c] = s.split(',').map(Number); return { row: r, col: c }; });
  }

  // ─── Resolve ──────────────────────────────────────────────────────────────

  private resolveMatches(matches: Array<{ row: number; col: number }>): void {
    this.gameState.combo++;
    const multiplier = Math.pow(COMBO_MULTIPLIER, this.gameState.combo - 1);
    const points = Math.floor(matches.length * BASE_SCORE * multiplier);
    this.gameState.score += points;
    this.totalClears += matches.length;

    if (this.gameState.score > this.gameState.highScore) {
      this.gameState.highScore = this.gameState.score;
      localStorage.setItem(STORAGE_KEY, String(this.gameState.highScore));
    }

    this.audioManager.playMatch(this.gameState.combo);
    this.cameras.main.flash(70, 255, 255, 255, false);

    // Chromashift
    if (Math.floor(this.totalClears / CHROMASHIFT_INTERVAL) > this.paletteShift) {
      this.paletteShift++;
      this.cameras.main.flash(350, 170, 40, 210, false);
      this.cameras.main.shake(220, 0.007);
      this.audioManager.playSpecial();
    }

    // Animate each matched tile: burst scale → shrink with pop
    let animsDone = 0;
    const total = matches.length;

    for (const { row, col } of matches) {
      const tile = this.grid[row][col];
      if (tile) {
        const cx = this.tileX(col), cy = this.tileY(row);
        const color = COLORS[(tile.colorIndex + this.paletteShift) % COLORS.length];
        this.spawnParticles(cx, cy, color, 12);
      }

      const container = this.tileContainers[row][col];
      this.grid[row][col] = null;
      this.tileContainers[row][col] = null;

      if (container) {
        // Quick scale-up pop then shrink out
        this.tweens.add({
          targets: container, scaleX: 1.35, scaleY: 1.35,
          duration: 70, ease: 'Sine.easeOut',
          onComplete: () => {
            this.tweens.add({
              targets: container,
              scaleX: 0, scaleY: 0, alpha: 0,
              duration: 200, ease: 'Back.easeIn',
              onComplete: () => {
                container.destroy();
                if (++animsDone === total) this.afterMatchDestroy();
              }
            });
          }
        });
      } else {
        if (++animsDone === total) this.afterMatchDestroy();
      }
    }

    this.updateHUD();
  }

  private afterMatchDestroy(): void {
    // If chromashift, refresh surviving tile colors
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (this.tileContainers[r][c]) this.refreshTileVisual(r, c);
      }
    }

    this.applyGravity();

    this.animateGravityFall(() => {
      this.fillEmptyCells();
      this.spawnNewTiles(() => {
        this.time.delayedCall(80, () => {
          const newMatches = this.findAllMatches();
          if (newMatches.length > 0) {
            this.resolveMatches(newMatches);
          } else {
            this.gameState.combo = 0;
            this.isResolving = false;
            this.updateHUD();
            if (this.gameState.moves >= this.gameState.maxMoves) {
              this.time.delayedCall(300, () => this.endGame());
            }
          }
        });
      });
    });
  }

  // ─── Gravity ──────────────────────────────────────────────────────────────

  private applyGravity(): void {
    for (let col = 0; col < GRID_COLS; col++) {
      let writeRow = GRID_ROWS - 1;
      for (let row = GRID_ROWS - 1; row >= 0; row--) {
        if (this.grid[row][col] !== null) {
          if (row !== writeRow) {
            this.grid[writeRow][col] = this.grid[row][col];
            this.tileContainers[writeRow][col] = this.tileContainers[row][col];
            this.grid[row][col] = null;
            this.tileContainers[row][col] = null;
            if (this.grid[writeRow][col]) this.grid[writeRow][col]!.row = writeRow;
          }
          writeRow--;
        }
      }
    }
  }

  private animateGravityFall(onComplete: () => void): void {
    let pending = 0;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const container = this.tileContainers[row][col];
        const targetY = this.tileY(row);
        if (container && Math.abs(container.y - targetY) > 1) {
          pending++;
          const dist = Math.abs(targetY - container.y);
          const duration = Math.min(500, 120 + dist * 1.1);
          // Stagger fall by column so it looks like a wave
          const delay = col * 15;
          this.tweens.add({
            targets: container,
            y: targetY,
            duration, delay,
            ease: 'Bounce.easeOut',
            onComplete: () => { if (--pending === 0) onComplete(); }
          });
        }
      }
    }
    if (pending === 0) onComplete();
  }

  private fillEmptyCells(): void {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (!this.grid[row][col]) {
          this.grid[row][col] = {
            colorIndex: Math.floor(Math.random() * COLORS.length),
            row, col, isMatched: false, isSpecial: false
          };
        }
      }
    }
  }

  private spawnNewTiles(onComplete: () => void): void {
    let pending = 0;
    for (let col = 0; col < GRID_COLS; col++) {
      let spawnIdx = 0;
      for (let row = 0; row < GRID_ROWS; row++) {
        if (!this.tileContainers[row][col] && this.grid[row][col]) {
          pending++;
          // Start above the grid, staggered by spawn index within column
          const startY = GRID_OFFSET_Y - CELL_SIZE * (spawnIdx + 1);
          const container = this.createTileContainer(row, col, startY);
          container.setScale(0.4).setAlpha(0.5);
          this.tileContainers[row][col] = container;
          spawnIdx++;

          const delay = col * 25 + spawnIdx * 40;
          this.tweens.add({
            targets: container,
            y: this.tileY(row),
            scaleX: 1, scaleY: 1, alpha: 1,
            duration: 340, delay,
            ease: 'Bounce.easeOut',
            onComplete: () => {
              // Landing squish
              this.tweens.add({ targets: container, scaleX: 1.12, scaleY: 0.88, duration: 60, yoyo: true, ease: 'Sine.easeInOut' });
              if (--pending === 0) onComplete();
            }
          });
        }
      }
    }
    if (pending === 0) onComplete();
  }

  // ─── Particles ────────────────────────────────────────────────────────────

  private spawnParticles(x: number, y: number, color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.9;
      const speed = 90 + Math.random() * 160;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50,
        color,
        alpha: 1,
        size: 5 + Math.random() * 6,
        life: 1,
        maxLife: 0.45 + Math.random() * 0.55
      });
    }
    // White sparkles
    for (let i = 0; i < 5; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 18,
        y: y + (Math.random() - 0.5) * 18,
        vx: (Math.random() - 0.5) * 80,
        vy: -90 - Math.random() * 70,
        color: 0xffffff,
        alpha: 1,
        size: 2 + Math.random() * 2.5,
        life: 1,
        maxLife: 0.35 + Math.random() * 0.3
      });
    }
  }

  // ─── HUD / State ──────────────────────────────────────────────────────────

  private updateHUD(): void {
    const hudScene = this.scene.get(SCENES.HUD);
    if (hudScene) hudScene.events.emit('updateState', this.gameState);
  }

  private endGame(): void {
    if (this.gameState.isGameOver) return;
    this.gameState.isGameOver = true;
    this.audioManager.playGameOver();
    this.audioManager.stopMusic();
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop(SCENES.HUD);
      this.scene.start(SCENES.GAME_OVER, { gameState: this.gameState });
    });
  }

  private restartGame(): void {
    this.audioManager.stopMusic();
    this.scene.stop(SCENES.HUD);
    this.scene.restart();
  }

  private goToMenu(): void {
    this.audioManager.stopMusic();
    this.scene.stop(SCENES.HUD);
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.MENU);
    });
  }

  // ─── Update loop ──────────────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.particleGraphics.clear();

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt; // gravity pull
      p.vx *= 0.98;     // air drag
      p.life -= dt / p.maxLife;
      p.alpha = Math.max(0, p.life * p.life); // quadratic fade = stays bright longer
      p.size *= 0.975;

      if (p.life <= 0) { this.particles.splice(i, 1); continue; }

      this.particleGraphics.fillStyle(p.color, p.alpha);
      this.particleGraphics.fillCircle(p.x, p.y, p.size);
    }
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  shutdown(): void {
    this.particles = [];
    if (this.selectionPulseTween) { this.selectionPulseTween.stop(); this.selectionPulseTween = null; }
    this.input.off('pointerdown');
    this.input.off('pointerup');
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        this.tileContainers[row]?.[col]?.destroy();
      }
    }
  }
}
