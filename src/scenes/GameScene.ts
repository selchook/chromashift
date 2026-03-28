import Phaser from 'phaser';
import {
  SCENES, BG_COLOR, COLORS, GRID_COLS, GRID_ROWS, CELL_SIZE,
  GRID_OFFSET_X, GRID_OFFSET_Y, MATCH_MIN, BASE_SCORE,
  COMBO_MULTIPLIER, STORAGE_KEY, DANGER_THRESHOLD, RESOLVE_DELAY, CHROMASHIFT_INTERVAL
} from '../constants';
import { AudioManager } from '../managers/AudioManager';
import { TileData, GameState } from '../types';

export class GameScene extends Phaser.Scene {
  private audioManager!: AudioManager;
  private grid: (TileData | null)[][] = [];
  private tileGraphics: (Phaser.GameObjects.Graphics | null)[][] = [];
  private tileTexts: (Phaser.GameObjects.Text | null)[][] = [];
  private selectedTile: { row: number; col: number } | null = null;
  private gameState!: GameState;
  private isResolving: boolean = false;
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

  create(): void {
    this.cameras.main.setBackgroundColor(BG_COLOR);
    this.cameras.main.fadeIn(400, 0, 0, 0);

    this.audioManager = this.registry.get('audioManager') || new AudioManager();
    if (!this.registry.get('audioManager')) {
      this.registry.set('audioManager', this.audioManager);
    }

    this.gameState = {
      score: 0,
      level: 1,
      moves: 0,
      maxMoves: 30,
      highScore: parseInt(localStorage.getItem(STORAGE_KEY) || '0'),
      combo: 0,
      isGameOver: false
    };

    this.isResolving = false;
    this.selectedTile = null;
    this.totalClears = 0;
    this.paletteShift = 0;
    this.particles = [];

    this.gridGraphics = this.add.graphics();
    this.selectionGraphics = this.add.graphics();
    this.particleGraphics = this.add.graphics();

    this.initGrid();
    this.drawGrid();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handlePointerDown(pointer.x, pointer.y);
    });

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-R', () => this.restartGame());
      this.input.keyboard.on('keydown-ESC', () => this.goToMenu());
    }

    this.scene.launch(SCENES.HUD);
    this.scene.get(SCENES.HUD)?.events.emit('updateState', this.gameState);
    this.audioManager.startMusic();
  }

  private initGrid(): void {
    this.grid = [];
    this.tileGraphics = [];
    this.tileTexts = [];

    for (let row = 0; row < GRID_ROWS; row++) {
      this.grid[row] = [];
      this.tileGraphics[row] = [];
      this.tileTexts[row] = [];
      for (let col = 0; col < GRID_COLS; col++) {
        const colorIndex = Math.floor(Math.random() * COLORS.length);
        this.grid[row][col] = {
          colorIndex,
          row,
          col,
          isMatched: false,
          isSpecial: false
        };
        this.tileGraphics[row][col] = null;
        this.tileTexts[row][col] = null;
      }
    }

    // Ensure no initial matches
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        let attempts = 0;
        while (this.hasMatchAt(row, col) && attempts < 10) {
          const tile = this.grid[row][col];
          if (tile) tile.colorIndex = Math.floor(Math.random() * COLORS.length);
          attempts++;
        }
      }
    }
  }

  private hasMatchAt(row: number, col: number): boolean {
    const tile = this.grid[row][col];
    if (!tile) return false;
    const ci = tile.colorIndex;

    // Check horizontal
    if (col >= 2) {
      const t1 = this.grid[row][col - 1];
      const t2 = this.grid[row][col - 2];
      if (t1 && t2 && t1.colorIndex === ci && t2.colorIndex === ci) return true;
    }
    // Check vertical
    if (row >= 2) {
      const t1 = this.grid[row - 1][col];
      const t2 = this.grid[row - 2][col];
      if (t1 && t2 && t1.colorIndex === ci && t2.colorIndex === ci) return true;
    }
    return false;
  }

  private drawGrid(): void {
    this.gridGraphics.clear();

    // Draw grid background
    this.gridGraphics.fillStyle(0x111133, 0.8);
    this.gridGraphics.fillRoundedRect(
      GRID_OFFSET_X - 4,
      GRID_OFFSET_Y - 4,
      GRID_COLS * CELL_SIZE + 8,
      GRID_ROWS * CELL_SIZE + 8,
      8
    );

    // Draw grid lines
    this.gridGraphics.lineStyle(1, 0x222244, 0.5);
    for (let row = 0; row <= GRID_ROWS; row++) {
      this.gridGraphics.beginPath();
      this.gridGraphics.moveTo(GRID_OFFSET_X, GRID_OFFSET_Y + row * CELL_SIZE);
      this.gridGraphics.lineTo(GRID_OFFSET_X + GRID_COLS * CELL_SIZE, GRID_OFFSET_Y + row * CELL_SIZE);
      this.gridGraphics.strokePath();
    }
    for (let col = 0; col <= GRID_COLS; col++) {
      this.gridGraphics.beginPath();
      this.gridGraphics.moveTo(GRID_OFFSET_X + col * CELL_SIZE, GRID_OFFSET_Y);
      this.gridGraphics.lineTo(GRID_OFFSET_X + col * CELL_SIZE, GRID_OFFSET_Y + GRID_ROWS * CELL_SIZE);
      this.gridGraphics.strokePath();
    }

    // Draw tiles
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        this.drawTile(row, col);
      }
    }
  }

  private drawTile(row: number, col: number): void {
    // Remove old graphics for this tile
    if (this.tileGraphics[row][col]) {
      this.tileGraphics[row][col]!.destroy();
      this.tileGraphics[row][col] = null;
    }
    if (this.tileTexts[row][col]) {
      this.tileTexts[row][col]!.destroy();
      this.tileTexts[row][col] = null;
    }

    const tile = this.grid[row][col];
    if (!tile) return;

    const x = GRID_OFFSET_X + col * CELL_SIZE;
    const y = GRID_OFFSET_Y + row * CELL_SIZE;
    const padding = 3;
    const colorIndex = (tile.colorIndex + this.paletteShift) % COLORS.length;
    const color = COLORS[colorIndex];

    const g = this.add.graphics();
    g.fillStyle(color, 0.9);
    g.fillRoundedRect(x + padding, y + padding, CELL_SIZE - padding * 2, CELL_SIZE - padding * 2, 6);

    // Highlight top edge
    g.fillStyle(0xffffff, 0.2);
    g.fillRoundedRect(x + padding, y + padding, CELL_SIZE - padding * 2, 6, { tl: 6, tr: 6, bl: 0, br: 0 });

    this.tileGraphics[row][col] = g;
  }

  private drawSelection(): void {
    this.selectionGraphics.clear();
    if (!this.selectedTile) return;

    const { row, col } = this.selectedTile;
    const x = GRID_OFFSET_X + col * CELL_SIZE;
    const y = GRID_OFFSET_Y + row * CELL_SIZE;

    this.selectionGraphics.lineStyle(3, 0xffffff, 1);
    this.selectionGraphics.strokeRoundedRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4, 6);

    // Glow effect
    this.selectionGraphics.lineStyle(6, 0xffffff, 0.3);
    this.selectionGraphics.strokeRoundedRect(x, y, CELL_SIZE, CELL_SIZE, 8);
  }

  private handlePointerDown(px: number, py: number): void {
    if (this.isResolving || this.gameState.isGameOver) return;

    const col = Math.floor((px - GRID_OFFSET_X) / CELL_SIZE);
    const row = Math.floor((py - GRID_OFFSET_Y) / CELL_SIZE);

    if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) {
      this.selectedTile = null;
      this.drawSelection();
      return;
    }

    if (!this.grid[row][col]) return;

    if (!this.selectedTile) {
      this.selectedTile = { row, col };
      this.audioManager.playTileSelect();
      this.drawSelection();
    } else {
      const dr = Math.abs(row - this.selectedTile.row);
      const dc = Math.abs(col - this.selectedTile.col);

      if (dr + dc === 1) {
        // Adjacent - swap
        this.swapTiles(this.selectedTile.row, this.selectedTile.col, row, col);
        this.selectedTile = null;
        this.drawSelection();
      } else if (row === this.selectedTile.row && col === this.selectedTile.col) {
        // Same tile - deselect
        this.selectedTile = null;
        this.drawSelection();
      } else {
        // Different non-adjacent tile - reselect
        this.selectedTile = { row, col };
        this.audioManager.playTileSelect();
        this.drawSelection();
      }
    }
  }

  private swapTiles(r1: number, c1: number, r2: number, c2: number): void {
    this.audioManager.playSwap();
    this.gameState.moves++;

    const temp = this.grid[r1][c1];
    this.grid[r1][c1] = this.grid[r2][c2];
    this.grid[r2][c2] = temp;

    // Update positions in tile data
    if (this.grid[r1][c1]) { this.grid[r1][c1]!.row = r1; this.grid[r1][c1]!.col = c1; }
    if (this.grid[r2][c2]) { this.grid[r2][c2]!.row = r2; this.grid[r2][c2]!.col = c2; }

    this.drawTile(r1, c1);
    this.drawTile(r2, c2);

    // Check for matches
    const matches = this.findAllMatches();
    if (matches.length > 0) {
      this.gameState.combo = 0;
      this.isResolving = true;
      this.time.delayedCall(RESOLVE_DELAY, () => this.resolveMatches(matches));
    } else {
      // No match - swap back
      this.audioManager.playNoMatch();
      this.time.delayedCall(200, () => {
        const t = this.grid[r1][c1];
        this.grid[r1][c1] = this.grid[r2][c2];
        this.grid[r2][c2] = t;
        if (this.grid[r1][c1]) { this.grid[r1][c1]!.row = r1; this.grid[r1][c1]!.col = c1; }
        if (this.grid[r2][c2]) { this.grid[r2][c2]!.row = r2; this.grid[r2][c2]!.col = c2; }
        this.drawTile(r1, c1);
        this.drawTile(r2, c2);
      });
    }

    this.updateHUD();

    if (this.gameState.moves >= this.gameState.maxMoves && !this.isResolving) {
      this.time.delayedCall(300, () => this.endGame());
    }
  }

  private findAllMatches(): Array<{ row: number; col: number }> {
    const matched = new Set<string>();

    // Horizontal matches
    for (let row = 0; row < GRID_ROWS; row++) {
      let runStart = 0;
      for (let col = 1; col <= GRID_COLS; col++) {
        const prev = this.grid[row][col - 1];
        const curr = col < GRID_COLS ? this.grid[row][col] : null;
        if (!curr || !prev || curr.colorIndex !== prev.colorIndex) {
          if (col - runStart >= MATCH_MIN) {
            for (let k = runStart; k < col; k++) matched.add(`${row},${k}`);
          }
          runStart = col;
        }
      }
    }

    // Vertical matches
    for (let col = 0; col < GRID_COLS; col++) {
      let runStart = 0;
      for (let row = 1; row <= GRID_ROWS; row++) {
        const prev = this.grid[row - 1][col];
        const curr = row < GRID_ROWS ? this.grid[row][col] : null;
        if (!curr || !prev || curr.colorIndex !== prev.colorIndex) {
          if (row - runStart >= MATCH_MIN) {
            for (let k = runStart; k < row; k++) matched.add(`${k},${col}`);
          }
          runStart = row;
        }
      }
    }

    return Array.from(matched).map(s => {
      const [r, c] = s.split(',').map(Number);
      return { row: r, col: c };
    });
  }

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

    // Spawn particles for matched tiles
    for (const { row, col } of matches) {
      const tile = this.grid[row][col];
      if (tile) {
        const cx = GRID_OFFSET_X + col * CELL_SIZE + CELL_SIZE / 2;
        const cy = GRID_OFFSET_Y + row * CELL_SIZE + CELL_SIZE / 2;
        const colorIndex = (tile.colorIndex + this.paletteShift) % COLORS.length;
        this.spawnParticles(cx, cy, COLORS[colorIndex], 5);
      }
      this.grid[row][col] = null;
      if (this.tileGraphics[row][col]) {
        this.tileGraphics[row][col]!.destroy();
        this.tileGraphics[row][col] = null;
      }
    }

    // Camera flash
    this.cameras.main.flash(100, 255, 255, 255, false);

    // Chromashift event
    if (Math.floor(this.totalClears / CHROMASHIFT_INTERVAL) > this.paletteShift) {
      this.paletteShift++;
      this.cameras.main.flash(300, 180, 50, 200, false);
      this.audioManager.playSpecial();
    }

    // Apply gravity
    this.time.delayedCall(200, () => {
      this.applyGravity();
      this.fillEmptyCells();
      this.drawGrid();

      // Check for cascades
      this.time.delayedCall(300, () => {
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

    this.updateHUD();
  }

  private applyGravity(): void {
    for (let col = 0; col < GRID_COLS; col++) {
      let writeRow = GRID_ROWS - 1;
      for (let row = GRID_ROWS - 1; row >= 0; row--) {
        if (this.grid[row][col] !== null) {
          if (row !== writeRow) {
            this.grid[writeRow][col] = this.grid[row][col];
            this.grid[row][col] = null;
            if (this.grid[writeRow][col]) {
              this.grid[writeRow][col]!.row = writeRow;
            }
          }
          writeRow--;
        }
      }
    }
  }

  private fillEmptyCells(): void {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (!this.grid[row][col]) {
          this.grid[row][col] = {
            colorIndex: Math.floor(Math.random() * COLORS.length),
            row,
            col,
            isMatched: false,
            isSpecial: false
          };
        }
      }
    }
  }

  private spawnParticles(x: number, y: number, color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 60 + Math.random() * 80;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        alpha: 1,
        size: 4 + Math.random() * 4,
        life: 1,
        maxLife: 0.6 + Math.random() * 0.4
      });
    }
  }

  private updateHUD(): void {
    const hudScene = this.scene.get(SCENES.HUD);
    if (hudScene) {
      hudScene.events.emit('updateState', this.gameState);
    }
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

  update(time: number, delta: number): void {
    // Update particles
    const dt = delta / 1000;
    this.particleGraphics.clear();

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 150 * dt; // gravity
      p.life -= dt / p.maxLife;
      p.alpha = Math.max(0, p.life);
      p.size *= 0.98;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.particleGraphics.fillStyle(p.color, p.alpha);
      this.particleGraphics.fillCircle(p.x, p.y, p.size);
    }
  }

  shutdown(): void {
    this.particles = [];
    this.input.off('pointerdown');
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (this.tileGraphics[row]?.[col]) {
          this.tileGraphics[row][col]!.destroy();
        }
      }
    }
  }
}
