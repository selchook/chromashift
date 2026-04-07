import Phaser from 'phaser';
import {
  SCENES, BG_COLOR, COLORS, GRID_COLS, GRID_ROWS, CELL_SIZE,
  MATCH_MIN, BASE_SCORE, LEVEL_THRESHOLD,
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
  private gridOffsetX: number = 0;
  private gridOffsetY: number = 0;
  private bgGraphics!: Phaser.GameObjects.Graphics;
  private locationText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: SCENES.GAME });
  }

  private tileX(col: number): number {
    return this.gridOffsetX + col * CELL_SIZE + CELL_SIZE / 2;
  }

  private tileY(row: number): number {
    return this.gridOffsetY + row * CELL_SIZE + CELL_SIZE / 2;
  }

  create(): void {
    const HUD_HEIGHT = 80;
    this.gridOffsetX = Math.floor((this.scale.width - GRID_COLS * CELL_SIZE) / 2);
    this.gridOffsetY = HUD_HEIGHT + Math.max(0, Math.floor((this.scale.height - HUD_HEIGHT - GRID_ROWS * CELL_SIZE) / 2));

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
    this.bgGraphics = this.add.graphics().setDepth(-5);
    this.gridGraphics = this.add.graphics().setDepth(0);
    this.selectionGraphics = this.add.graphics().setDepth(20);
    this.particleGraphics = this.add.graphics().setDepth(30);

    this.locationText = this.add.text(this.scale.width / 2, this.scale.height - 14, '', {
      fontSize: '11px', fontFamily: 'Arial', color: '#ffffff'
    }).setOrigin(0.5, 1).setDepth(5).setAlpha(0);

    this.drawBackground(this.gameState.level);
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
      this.gridOffsetX - 2, this.gridOffsetY + 5,
      GRID_COLS * CELL_SIZE + 8, GRID_ROWS * CELL_SIZE + 8, 10
    );
    // Board background
    this.gridGraphics.fillStyle(0x0c0c26, 1);
    this.gridGraphics.fillRoundedRect(
      this.gridOffsetX - 4, this.gridOffsetY - 4,
      GRID_COLS * CELL_SIZE + 8, GRID_ROWS * CELL_SIZE + 8, 10
    );
    // Subtle cell slots
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        this.gridGraphics.fillStyle(0x111130, 1);
        this.gridGraphics.fillRoundedRect(
          this.gridOffsetX + col * CELL_SIZE + 3,
          this.gridOffsetY + row * CELL_SIZE + 3,
          CELL_SIZE - 6, CELL_SIZE - 6, 10
        );
      }
    }
  }

  /** Dispatch to per-shape builder. Shape is tied to logical colorIndex (not palette-shifted)
   *  so each tile type keeps its silhouette across Chromashift palette rotations. */
  private buildTileGraphics(colorIndex: number): Phaser.GameObjects.Graphics {
    const color = COLORS[(colorIndex + this.paletteShift) % COLORS.length];
    const g = this.add.graphics();
    const lc = Phaser.Display.Color.IntegerToColor(color); lc.lighten(18);
    const dc = Phaser.Display.Color.IntegerToColor(color); dc.darken(24);
    switch (colorIndex % 6) {
      case 0: this.drawCandyBall(g, color, lc.color, dc.color);    break;
      case 1: this.drawGem(g, color, lc.color, dc.color);          break;
      case 2: this.drawCoin(g, color, lc.color, dc.color);         break;
      case 3: this.drawGoldBar(g, color, lc.color, dc.color);      break;
      case 4: this.drawStar(g, color, lc.color, dc.color);         break;
      default: this.drawWrappedCandy(g, color, lc.color, dc.color); break;
    }
    return g;
  }

  // ─── Candy Ball — round hard candy / gumball ────────────────────────────────
  private drawCandyBall(g: Phaser.GameObjects.Graphics, color: number, light: number, dark: number): void {
    const R = 17;
    // Outer glow
    g.fillStyle(color, 0.20); g.fillCircle(0, 0, R + 5);
    // Drop shadow
    g.fillStyle(0x000000, 0.28); g.fillEllipse(2, R + 1, R * 2 - 2, 9);
    // Main sphere
    g.fillStyle(color, 1); g.fillCircle(0, 0, R);
    // Lower darkening (lower hemisphere)
    g.fillStyle(dark, 0.50); g.fillEllipse(0, 7, (R - 2) * 2, R + 2);
    // Swirl stripes — two opposing arcs
    g.lineStyle(4.5, light, 0.52);
    g.beginPath(); g.arc(0, 0, 10, Math.PI * 0.15, Math.PI * 0.85); g.strokePath();
    g.beginPath(); g.arc(0, 0, 10, Math.PI * 1.15, Math.PI * 1.85); g.strokePath();
    // Glass pill highlight
    g.fillStyle(0xffffff, 0.55); g.fillEllipse(-4, -8, 13, 9);
    // Bright top specular dot
    g.fillStyle(0xffffff, 0.90); g.fillEllipse(-5, -12, 7, 4);
    // Rim
    g.lineStyle(1.5, 0xffffff, 0.45); g.strokeCircle(0, 0, R);
  }

  // ─── Gem — faceted cut gemstone ────────────────────────────────────────────
  private drawGem(g: Phaser.GameObjects.Graphics, color: number, light: number, dark: number): void {
    const T  = {x: 0,   y: -19};
    const UL = {x: -13, y: -5 };
    const UR = {x: 13,  y: -5 };
    const LL = {x: -9,  y: 13 };
    const LR = {x: 9,   y: 13 };
    const B  = {x: 0,   y: 19 };
    // Aura
    g.fillStyle(color, 0.18); g.fillEllipse(0, 0, 34, 44);
    // Shadow
    g.fillStyle(0x000000, 0.25); g.fillEllipse(1, 21, 22, 7);
    // Pavilion — lower section, darkest
    g.fillStyle(dark, 1);
    g.fillTriangle(LL.x, LL.y, LR.x, LR.y, B.x, B.y);
    g.fillTriangle(UL.x, UL.y, LL.x, LL.y, B.x, B.y);
    g.fillTriangle(UR.x, UR.y, LR.x, LR.y, B.x, B.y);
    // Crown — upper section, main color
    g.fillStyle(color, 1);
    g.fillTriangle(T.x,  T.y,  UL.x, UL.y, UR.x, UR.y);
    g.fillTriangle(UL.x, UL.y, UR.x, UR.y, LL.x, LL.y);
    g.fillTriangle(UR.x, UR.y, LR.x, LR.y, LL.x, LL.y);
    // Left crown facet (lighter — faces the light source)
    g.fillStyle(light, 0.55); g.fillTriangle(T.x, T.y, UL.x, UL.y, -3, -5);
    // Right crown facet (slightly lighter)
    g.fillStyle(light, 0.22); g.fillTriangle(T.x, T.y, UR.x, UR.y, 3, -5);
    // Top sparkle
    g.fillStyle(0xffffff, 0.82); g.fillTriangle(T.x, T.y, -4, -11, 4, -11);
    // Left facet glint
    g.fillStyle(0xffffff, 0.28); g.fillTriangle(UL.x, UL.y, -9, -12, -4, -5);
    // Outline
    g.lineStyle(1.5, 0xffffff, 0.45);
    g.strokePoints([T, UR, LR, B, LL, UL], true);
  }

  // ─── Coin — token / medallion ───────────────────────────────────────────────
  private drawCoin(g: Phaser.GameObjects.Graphics, color: number, light: number, dark: number): void {
    const R = 17;
    // Aura
    g.fillStyle(color, 0.18); g.fillCircle(0, 0, R + 5);
    // Coin thickness edge (offset fill = visible rim on one side)
    g.fillStyle(dark, 1); g.fillCircle(0, 2, R);
    // Drop shadow
    g.fillStyle(0x000000, 0.22); g.fillEllipse(2, R + 3, 28, 8);
    // Main face
    g.fillStyle(color, 1); g.fillCircle(0, 0, R);
    // Outer rim groove
    g.lineStyle(2.5, dark, 0.65); g.strokeCircle(0, 0, R - 1.5);
    // Inner ring
    g.lineStyle(1.5, light, 0.45); g.strokeCircle(0, 0, R - 4);
    // Embossed 4-point star in center
    const sp: {x: number; y: number}[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI / 4) - Math.PI / 2;
      const r = i % 2 === 0 ? 8 : 3.5;
      sp.push({x: Math.cos(a) * r, y: Math.sin(a) * r});
    }
    g.fillStyle(light, 0.38); g.fillPoints(sp, true);
    // Glass pill highlight
    g.fillStyle(0xffffff, 0.52); g.fillEllipse(-4, -8, 13, 9);
    // Bright specular dot
    g.fillStyle(0xffffff, 0.85); g.fillEllipse(-5, -12, 7, 4);
    // Outer white rim
    g.lineStyle(1.5, 0xffffff, 0.38); g.strokeCircle(0, 0, R);
  }

  // ─── Gold Bar — ingot / bullion ─────────────────────────────────────────────
  private drawGoldBar(g: Phaser.GameObjects.Graphics, color: number, light: number, dark: number): void {
    // Trapezoid body — slightly wider at top (ingot perspective)
    const body  = [{x: -15, y: -12}, {x: 15, y: -12}, {x: 13, y: 14}, {x: -13, y: 14}];
    const inner = [{x: -9,  y: -6 }, {x: 9,  y: -6 }, {x: 8,  y: 8 }, {x: -8,  y: 8 }];
    // Aura
    g.fillStyle(color, 0.15); g.fillRoundedRect(-18, -15, 36, 32, 5);
    // Drop shadow
    g.fillStyle(0x000000, 0.28); g.fillRoundedRect(-12, 15, 25, 7, 3);
    // Main body
    g.fillStyle(color, 1); g.fillPoints(body, true);
    // Bottom darkening
    g.fillStyle(dark, 0.45);
    g.fillPoints([{x:-13,y:4},{x:13,y:4},{x:13,y:14},{x:-13,y:14}], true);
    // Left bevel (lighter — faces light)
    g.fillStyle(light, 0.28); g.fillRect(-14, -11, 3, 22);
    // Right bevel (darker — shadow side)
    g.fillStyle(dark, 0.32); g.fillRect(11, -11, 3, 22);
    // Inner recessed panel
    g.fillStyle(dark, 0.18); g.fillPoints(inner, true);
    g.lineStyle(1, light, 0.40); g.strokePoints(inner, true);
    // Main shine strip
    g.fillStyle(0xffffff, 0.52); g.fillRoundedRect(-13, -11, 19, 5, 2);
    // Top rim bright line
    g.fillStyle(0xffffff, 0.82); g.fillRect(-14, -12, 29, 3);
    // Outline
    g.lineStyle(1.5, 0xffffff, 0.40); g.strokePoints(body, true);
  }

  // ─── Star — 5-point star ────────────────────────────────────────────────────
  private drawStar(g: Phaser.GameObjects.Graphics, color: number, light: number, dark: number): void {
    const OR = 18, IR = 8, N = 5;
    const pts: {x: number; y: number}[] = [];
    for (let i = 0; i < N * 2; i++) {
      const a = (i * Math.PI / N) - Math.PI / 2;
      const r = i % 2 === 0 ? OR : IR;
      pts.push({x: Math.cos(a) * r, y: Math.sin(a) * r});
    }
    // Aura
    g.fillStyle(color, 0.20); g.fillCircle(0, 0, OR + 4);
    // Drop shadow
    g.fillStyle(0x000000, 0.25); g.fillEllipse(2, OR + 1, OR * 2 - 4, 8);
    // Main star body
    g.fillStyle(color, 1); g.fillPoints(pts, true);
    // Per-arm shading — top arms lighter, bottom arms darker
    for (let i = 0; i < N; i++) {
      const pi = pts[i * 2];
      const pl = pts[(i * 2 + N * 2 - 1) % (N * 2)];
      const pr = pts[(i * 2 + 1) % (N * 2)];
      const isUp = pi.y < 0;
      g.fillStyle(isUp ? light : dark, isUp ? 0.28 : 0.36);
      g.fillTriangle(pi.x, pi.y, pl.x, pl.y, pr.x, pr.y);
    }
    // Center circle highlight
    g.fillStyle(light, 0.42); g.fillCircle(0, 0, IR - 1);
    // Glass highlight on top arm
    g.fillStyle(0xffffff, 0.55); g.fillEllipse(0, -13, 9, 7);
    // Bright top specular
    g.fillStyle(0xffffff, 0.88); g.fillEllipse(-1, -16, 5, 3);
    // Outline
    g.lineStyle(1.5, 0xffffff, 0.42); g.strokePoints(pts, true);
  }

  // ─── Wrapped Candy — oval with twisted wrapper ends ─────────────────────────
  private drawWrappedCandy(g: Phaser.GameObjects.Graphics, color: number, light: number, dark: number): void {
    const bW = 30, bH = 20, hW = bW / 2, hH = bH / 2;
    // Aura
    g.fillStyle(color, 0.18); g.fillEllipse(0, 0, bW + 10, bH + 10);
    // Drop shadow
    g.fillStyle(0x000000, 0.25); g.fillEllipse(2, hH + 5, bW + 4, 8);
    // Wrapper twist ends (triangular points, dark)
    g.fillStyle(dark, 1);
    g.fillTriangle(-hW, -hH + 1, -hW - 8, 0, -hW, hH - 1);
    g.fillTriangle( hW, -hH + 1,  hW + 8, 0,  hW, hH - 1);
    // Lighter inner face of twist
    g.fillStyle(light, 0.38);
    g.fillTriangle(-hW, -hH + 2, -hW - 5, 0, -hW, -1);
    g.fillTriangle( hW, -hH + 2,  hW + 5, 0,  hW, -1);
    // Main oval body
    g.fillStyle(color, 1); g.fillEllipse(0, 0, bW, bH);
    // Bottom darkening
    g.fillStyle(dark, 0.48); g.fillEllipse(0, 5, bW - 4, hH + 2);
    // Diagonal wrap stripes
    g.lineStyle(3, light, 0.45);
    g.beginPath(); g.moveTo(-7, -hH + 1); g.lineTo(-1, hH - 1); g.strokePath();
    g.beginPath(); g.moveTo(1, -hH + 1);  g.lineTo(7,  hH - 1); g.strokePath();
    // Glass highlight
    g.fillStyle(0xffffff, 0.55); g.fillEllipse(-2, -5, 18, 7);
    // Bright specular
    g.fillStyle(0xffffff, 0.88); g.fillEllipse(-4, -7, 10, 4);
    // Body outline
    g.lineStyle(1.5, 0xffffff, 0.42); g.strokeEllipse(0, 0, bW, bH);
    // Wrapper end outlines
    g.lineStyle(1, 0xffffff, 0.22);
    g.strokePoints([{x:-hW,y:-hH+1},{x:-hW-8,y:0},{x:-hW,y:hH-1}], true);
    g.strokePoints([{x: hW,y:-hH+1},{x: hW+8,y:0},{x: hW,y:hH-1}], true);
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
        const startY = this.gridOffsetY - CELL_SIZE * (row + 2);
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
    const x = this.gridOffsetX + col * CELL_SIZE;
    const y = this.gridOffsetY + row * CELL_SIZE;
    this.selectionGraphics.lineStyle(2.5, 0xffffff, 1);
    this.selectionGraphics.strokeRoundedRect(x + 3, y + 3, CELL_SIZE - 6, CELL_SIZE - 6, 11);
    this.selectionGraphics.lineStyle(10, 0xffffff, 0.16);
    this.selectionGraphics.strokeRoundedRect(x, y, CELL_SIZE, CELL_SIZE, 13);
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

    const col = Math.floor((px - this.gridOffsetX) / CELL_SIZE);
    const row = Math.floor((py - this.gridOffsetY) / CELL_SIZE);

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

    const col = Math.floor((this.pointerDownX - this.gridOffsetX) / CELL_SIZE);
    const row = Math.floor((this.pointerDownY - this.gridOffsetY) / CELL_SIZE);
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

    // Level-up
    const newLevel = Math.floor(this.gameState.score / LEVEL_THRESHOLD) + 1;
    if (newLevel > this.gameState.level) {
      this.gameState.level = newLevel;
      this.drawBackground(this.gameState.level);
      this.audioManager.playLevelUp();
      this.cameras.main.flash(400, 255, 215, 80, false);
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
          const startY = this.gridOffsetY - CELL_SIZE * (spawnIdx + 1);
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

  // ─── Level Backgrounds — historic landmark silhouettes ────────────────────

  private static readonly LOCATIONS = [
    'Eiffel Tower · Paris, France',
    'Pyramids of Giza · Egypt',
    'Taj Mahal · Agra, India',
    'Colosseum · Rome, Italy',
    'Great Wall · China',
    'Machu Picchu · Peru',
    'Parthenon · Athens, Greece',
    'Chichen Itza · Mexico',
    'Angkor Wat · Cambodia',
    'Stonehenge · England'
  ];

  private drawBackground(level: number): void {
    this.bgGraphics.clear();
    const W  = this.scale.width;
    const H  = this.scale.height;
    const cx = W / 2;
    const gy = Math.round(H * 0.72); // ground line
    const idx = (level - 1) % 10;

    switch (idx) {
      case 0: this.bgEiffelTower(W, H, cx, gy); break;
      case 1: this.bgPyramids(W, H, cx, gy);    break;
      case 2: this.bgTajMahal(W, H, cx, gy);    break;
      case 3: this.bgColosseum(W, H, cx, gy);   break;
      case 4: this.bgGreatWall(W, H, cx, gy);   break;
      case 5: this.bgMachuPicchu(W, H, cx, gy); break;
      case 6: this.bgParthenon(W, H, cx, gy);   break;
      case 7: this.bgChichenItza(W, H, cx, gy); break;
      case 8: this.bgAngkorWat(W, H, cx, gy);   break;
      default: this.bgStonehenge(W, H, cx, gy); break;
    }

    // Uniform dark overlay so the grid and tiles stay readable
    this.bgGraphics.fillStyle(0x000000, 0.42);
    this.bgGraphics.fillRect(0, 0, W, H);

    // Fade-in location label at bottom
    this.locationText.setText(GameScene.LOCATIONS[idx]);
    this.locationText.setAlpha(0);
    this.tweens.add({
      targets: this.locationText, alpha: 0.60,
      duration: 700, delay: 300,
      yoyo: true, hold: 2200
    });
  }

  /** Smooth sky gradient: topColor → horizonColor, plus solid ground fill. */
  private bgSky(topHex: number, horizHex: number, groundHex: number, W: number, H: number, gy: number): void {
    const g  = this.bgGraphics;
    const tc = Phaser.Display.Color.IntegerToColor(topHex);
    const hc = Phaser.Display.Color.IntegerToColor(horizHex);
    const BANDS = 12;
    for (let i = 0; i <= BANDS; i++) {
      const t  = i / BANDS;
      const rv = Math.round(tc.red   + (hc.red   - tc.red)   * t);
      const gv = Math.round(tc.green + (hc.green - tc.green) * t);
      const bv = Math.round(tc.blue  + (hc.blue  - tc.blue)  * t);
      g.fillStyle(Phaser.Display.Color.GetColor(rv, gv, bv), 1);
      const y0 = Math.round(i * gy / BANDS);
      g.fillRect(0, y0, W, Math.round(gy / BANDS) + 2);
    }
    g.fillStyle(groundHex, 1);
    g.fillRect(0, gy, W, H - gy);
  }

  // ── 1. Eiffel Tower — Paris dusk ──────────────────────────────────────────
  private bgEiffelTower(W: number, H: number, cx: number, gy: number): void {
    const g = this.bgGraphics;
    this.bgSky(0x0e0520, 0xcc3300, 0x06030e, W, H, gy);
    const s = 0x040110;
    const th = Math.min(H * 0.42, 260); // tower height

    // City skyline blobs
    g.fillStyle(s, 1);
    g.fillRect(0,          gy - H*0.06, W*0.18, H*0.06);
    g.fillRect(W*0.75,     gy - H*0.05, W*0.25, H*0.05);
    g.fillRect(cx - W*0.35, gy - H*0.04, W*0.14, H*0.04);

    // Eiffel Tower
    g.fillStyle(s, 1);
    // Legs — two spread triangles
    g.fillTriangle(cx - 30, gy, cx - 4, gy - th*0.50, cx + 4, gy - th*0.50);
    g.fillTriangle(cx + 30, gy, cx + 4, gy - th*0.50, cx - 4, gy - th*0.50);
    // First-floor cross beam
    g.fillRect(cx - 25, gy - th*0.12, 50, 5);
    // Second-floor cross beam
    g.fillRect(cx - 12, gy - th*0.50, 24, 4);
    // Mid-section
    g.fillRect(cx - 5, gy - th*0.75, 10, th*0.25);
    // Upper cross beam
    g.fillRect(cx - 8, gy - th*0.77, 16, 3);
    // Top spire
    g.fillRect(cx - 2, gy - th, 4, th*0.25);
    // Antenna
    g.fillRect(Math.round(cx) - 1, gy - th*1.12, 2, th*0.12);

    // Warm glow at horizon
    g.fillStyle(0xff6600, 0.12);
    g.fillRect(0, gy - H*0.08, W, H*0.08);
  }

  // ── 2. Pyramids of Giza — Egyptian dawn ───────────────────────────────────
  private bgPyramids(W: number, H: number, cx: number, gy: number): void {
    const g = this.bgGraphics;
    this.bgSky(0x0a0400, 0xff7700, 0xb87010, W, H, gy);
    const s = 0x3d2000;

    // Great Pyramid (centre)
    g.fillStyle(s, 1);
    g.fillTriangle(cx - 80, gy, cx, gy - H*0.32, cx + 80, gy);
    // Second pyramid (right)
    g.fillTriangle(cx + 55, gy, cx + 130, gy - H*0.24, cx + 200, gy);
    // Third pyramid (left, small)
    g.fillTriangle(cx - 200, gy, cx - 130, gy - H*0.16, cx - 60, gy);
    // Sphinx silhouette (low elongated shape left of centre)
    g.fillRect(cx - 55, gy - H*0.07, 40, H*0.07);
    g.fillEllipse(cx - 20, gy - H*0.09, 28, 22);
    // Sand dunes
    g.fillStyle(0x8b5e00, 1);
    g.fillRect(0, gy, W, H - gy);
    // Horizon glow
    g.fillStyle(0xff9900, 0.15);
    g.fillRect(0, gy - H*0.06, W, H*0.06);
  }

  // ── 3. Taj Mahal — golden hour ─────────────────────────────────────────────
  private bgTajMahal(W: number, H: number, cx: number, gy: number): void {
    const g = this.bgGraphics;
    this.bgSky(0x050212, 0xddaa00, 0x180e00, W, H, gy);
    const s = 0x100800;

    // Reflection pool
    g.fillStyle(0xddaa00, 0.10);
    g.fillRect(cx - 55, gy, 110, H*0.06);

    g.fillStyle(s, 1);
    // Platform base
    g.fillRect(cx - 62, gy - H*0.04, 124, H*0.04);
    // Main building body
    g.fillRect(cx - 42, gy - H*0.14, 84, H*0.10);
    // Central dome (semicircle)
    g.beginPath(); g.arc(cx, gy - H*0.14, 30, -Math.PI, 0); g.closePath(); g.fillPath();
    // Dome finial
    g.fillRect(cx - 2, gy - H*0.14 - 38, 4, 14);
    // Four corner minarets
    for (const mx of [cx - 62, cx - 50, cx + 50, cx + 62]) {
      g.fillRect(mx - 5, gy - H*0.26, 10, H*0.22);
      g.beginPath(); g.arc(mx, gy - H*0.26, 7, -Math.PI, 0); g.closePath(); g.fillPath();
    }
    // Flanking pavilions
    g.fillRect(cx - 38, gy - H*0.08, 16, H*0.04);
    g.fillRect(cx + 22, gy - H*0.08, 16, H*0.04);
    g.beginPath(); g.arc(cx - 30, gy - H*0.08, 8, -Math.PI, 0); g.closePath(); g.fillPath();
    g.beginPath(); g.arc(cx + 30, gy - H*0.08, 8, -Math.PI, 0); g.closePath(); g.fillPath();
  }

  // ── 4. Colosseum — Roman afternoon ─────────────────────────────────────────
  private bgColosseum(W: number, H: number, cx: number, gy: number): void {
    const g = this.bgGraphics;
    this.bgSky(0x04091a, 0x1155aa, 0x1a0e00, W, H, gy);
    const s = 0x120900;
    const bH = H*0.28; // building height

    g.fillStyle(s, 1);
    // Main oval structure — three tiers
    // Ground tier (widest)
    g.fillRect(cx - 80, gy - bH*0.33, 160, bH*0.33);
    // Second tier
    g.fillRect(cx - 72, gy - bH*0.66, 144, bH*0.33);
    // Third tier
    g.fillRect(cx - 62, gy - bH, 124, bH*0.34);

    // Arched openings — ground tier (sky colour punched through)
    const skyMid = Phaser.Display.Color.IntegerToColor(0x1155aa);
    g.fillStyle(Phaser.Display.Color.GetColor(skyMid.red, skyMid.green, skyMid.blue), 1);
    for (let i = 0; i < 8; i++) {
      const ax = cx - 72 + i * 18 + 2;
      g.fillRoundedRect(ax, gy - bH*0.30, 13, bH*0.22, 6);
    }
    // Second tier openings
    for (let i = 0; i < 6; i++) {
      const ax = cx - 58 + i * 19 + 2;
      g.fillRoundedRect(ax, gy - bH*0.62, 14, bH*0.22, 6);
    }
    // Crumbled top-right section (partial wall)
    g.fillStyle(s, 1);
    g.fillRect(cx + 52, gy - bH*1.04, 12, bH*0.38);
  }

  // ── 5. Great Wall of China — misty morning ──────────────────────────────────
  private bgGreatWall(W: number, H: number, cx: number, gy: number): void {
    const g = this.bgGraphics;
    this.bgSky(0x04080e, 0x335577, 0x0a1008, W, H, gy);
    const s = 0x050a07;
    const m = 0x0a120d; // mountain colour

    // Mountain ranges (3 layers for depth)
    g.fillStyle(m, 1);
    g.fillTriangle(0, gy, W*0.22, gy - H*0.28, W*0.44, gy);
    g.fillTriangle(W*0.32, gy, W*0.60, gy - H*0.35, W*0.88, gy);
    g.fillTriangle(W*0.65, gy, W*0.88, gy - H*0.22, W, gy);
    g.fillTriangle(-20, gy, W*0.12, gy - H*0.18, W*0.28, gy);

    // Wall — zigzag following mountain ridges
    g.fillStyle(s, 1);
    // Segment 1 (left slope)
    g.fillRect(0, gy - H*0.14, W*0.22, H*0.025);
    // Segment 2 (up to first peak)
    const seg2pts = [
      {x:W*0.10,y:gy - H*0.14},{x:W*0.22,y:gy - H*0.28},
      {x:W*0.22 + 12,y:gy - H*0.28},{x:W*0.10 + 12,y:gy - H*0.14}
    ];
    g.fillPoints(seg2pts, true);
    // Segment 3 (down to valley, up to second peak)
    const seg3pts = [
      {x:W*0.22,y:gy - H*0.28},{x:W*0.60,y:gy - H*0.35},
      {x:W*0.60 + 12,y:gy - H*0.35},{x:W*0.22 + 12,y:gy - H*0.28}
    ];
    g.fillPoints(seg3pts, true);
    // Segment 4 (right slope down)
    const seg4pts = [
      {x:W*0.60,y:gy - H*0.35},{x:W,y:gy - H*0.08},
      {x:W,y:gy - H*0.08 + 12},{x:W*0.60 + 12,y:gy - H*0.35}
    ];
    g.fillPoints(seg4pts, true);

    // Guard towers at key points
    for (const [tx, ty] of [[W*0.22, gy - H*0.28],[W*0.60, gy - H*0.35],[W*0.88, gy - H*0.22]]) {
      g.fillRect(tx - 10, ty - H*0.06, 20, H*0.06 + 12);
      g.fillRect(tx - 12, ty - H*0.07, 24, 7); // battlement cap
    }

    // Mist layer
    g.fillStyle(0x7799bb, 0.07);
    g.fillRect(0, gy - H*0.22, W, H*0.18);
  }

  // ── 6. Machu Picchu — Andean mist ──────────────────────────────────────────
  private bgMachuPicchu(W: number, H: number, cx: number, gy: number): void {
    const g = this.bgGraphics;
    this.bgSky(0x020608, 0x1a3322, 0x0a1008, W, H, gy);
    const s = 0x080d08;
    const mt = 0x0d1510; // mountain

    // Huayna Picchu peak (right)
    g.fillStyle(mt, 1);
    g.fillTriangle(cx + 20, gy, W, gy - H*0.48, W + 60, gy);
    // Main mountain mass (left)
    g.fillTriangle(-60, gy, cx - 10, gy - H*0.40, cx + 30, gy);

    // Terraces (horizontal retaining walls cascading down the slope)
    g.fillStyle(s, 1);
    for (let i = 0; i < 7; i++) {
      const tx = cx - 55 + i * 4;
      const tw = 110 - i * 8;
      const ty = gy - H*0.10 - i * H*0.045;
      g.fillRect(tx, ty, tw, 8);
      g.fillRect(tx, ty, tw, H*0.045 + 8); // terrace face wall
    }

    // Main temple / Intihuatana buildings on top
    g.fillRect(cx - 35, gy - H*0.42, 70, H*0.10);
    g.fillRect(cx - 28, gy - H*0.50, 56, H*0.08);
    // Central temple doorway (arch)
    g.fillRect(cx - 40, gy - H*0.46, 12, H*0.08);
    g.fillRect(cx + 28, gy - H*0.46, 12, H*0.08);

    // Cloud wisps
    g.fillStyle(0x336655, 0.12);
    g.fillEllipse(W*0.15, gy - H*0.30, 90, 30);
    g.fillEllipse(W*0.80, gy - H*0.25, 70, 22);
  }

  // ── 7. Parthenon — Athenian dusk ────────────────────────────────────────────
  private bgParthenon(W: number, H: number, cx: number, gy: number): void {
    const g = this.bgGraphics;
    this.bgSky(0x060210, 0x2244aa, 0x100800, W, H, gy);
    const s = 0x0c0800;

    // Acropolis hill
    g.fillStyle(0x0f0a04, 1);
    g.fillTriangle(cx - 140, gy, cx, gy - H*0.15, cx + 140, gy);

    g.fillStyle(s, 1);
    // Stepped base (stylobate — 3 steps)
    g.fillRect(cx - 72, gy - H*0.20, 144, H*0.025);
    g.fillRect(cx - 68, gy - H*0.225, 136, H*0.025);
    g.fillRect(cx - 64, gy - H*0.25, 128, H*0.025);
    // Colonnade — 8 columns
    for (let i = 0; i < 8; i++) {
      const colX = cx - 56 + i * 16;
      g.fillRect(colX - 3, gy - H*0.42, 6, H*0.17);
    }
    // Entablature (horizontal beam above columns)
    g.fillRect(cx - 64, gy - H*0.43, 128, H*0.025);
    // Pediment (triangular gable)
    g.fillTriangle(cx - 64, gy - H*0.43, cx, gy - H*0.56, cx + 64, gy - H*0.43);
    // Opisthodomos columns (back, partially visible)
    for (let i = 0; i < 4; i++) {
      const colX = cx - 24 + i * 16;
      g.fillStyle(0x0a0600, 1);
      g.fillRect(colX - 2, gy - H*0.40, 4, H*0.15);
    }
  }

  // ── 8. Chichen Itza — Mayan twilight ────────────────────────────────────────
  private bgChichenItza(W: number, H: number, cx: number, gy: number): void {
    const g = this.bgGraphics;
    this.bgSky(0x050008, 0xaa2200, 0x06030a, W, H, gy);
    const s = 0x040208;

    // Jungle silhouette (tree line)
    g.fillStyle(0x060a04, 1);
    for (let x = 0; x < W; x += 28) {
      const th2 = H*0.08 + Math.sin(x * 0.08) * H*0.04;
      g.fillTriangle(x, gy, x + 14, gy - th2, x + 28, gy);
    }

    // El Castillo — four-sided stepped pyramid
    g.fillStyle(s, 1);
    const tiers = 9;
    for (let i = 0; i < tiers; i++) {
      const tw = 130 - i * 12;
      const th2 = H * 0.025;
      g.fillRect(cx - tw/2, gy - H*0.06 - (i+1)*th2, tw, th2 + 1);
    }
    // Temple on summit
    g.fillRect(cx - 14, gy - H*0.06 - tiers * H*0.025 - H*0.09, 28, H*0.09);
    g.fillRect(cx - 16, gy - H*0.06 - tiers * H*0.025 - H*0.095, 32, 6);
    // North staircase (central stripe up the face)
    g.fillStyle(0x080410, 1);
    g.fillRect(cx - 4, gy - H*0.06, 8, H*0.06 + tiers * H*0.025);
  }

  // ── 9. Angkor Wat — Khmer sunrise ───────────────────────────────────────────
  private bgAngkorWat(W: number, H: number, cx: number, gy: number): void {
    const g = this.bgGraphics;
    this.bgSky(0x050100, 0xff8800, 0x080300, W, H, gy);
    const s = 0x06030a;

    // Moat reflection glow
    g.fillStyle(0xff8800, 0.14);
    g.fillRect(cx - 110, gy, 220, H*0.05);

    g.fillStyle(s, 1);
    // Outer gallery (long low wall)
    g.fillRect(cx - 110, gy - H*0.06, 220, H*0.06);

    // Five towers — central tallest, two pairs flanking
    const towers: Array<[number, number]> = [
      [cx, H*0.38],          // central (tallest)
      [cx - 38, H*0.26],     // inner pair
      [cx + 38, H*0.26],
      [cx - 75, H*0.20],     // outer pair
      [cx + 75, H*0.20],
    ];
    for (const [tx, th] of towers) {
      // Tower body
      g.fillRect(tx - 10, gy - th, 20, th - H*0.06);
      // Curvilinear spire (stacked narrowing rects)
      for (let k = 0; k < 5; k++) {
        const w2 = 18 - k * 3;
        g.fillRect(tx - w2/2, gy - th - k * H*0.028, w2, H*0.028 + 1);
      }
      // Finial
      g.fillRect(tx - 2, gy - th - 5 * H*0.028 - H*0.04, 4, H*0.04);
    }
  }

  // ── 10. Stonehenge — English twilight ──────────────────────────────────────
  private bgStonehenge(W: number, H: number, cx: number, gy: number): void {
    const g = this.bgGraphics;
    this.bgSky(0x060810, 0x334466, 0x080a08, W, H, gy);
    const s = 0x080a08;

    // Flat heath
    g.fillStyle(0x0a0d0a, 1);
    g.fillRect(0, gy, W, H - gy);
    // Subtle horizon glow
    g.fillStyle(0x223355, 0.18);
    g.fillRect(0, gy - H*0.05, W, H*0.05);

    g.fillStyle(s, 1);
    // Outer ring — pairs of uprights with lintels
    const R = H * 0.14;
    const count = 6;
    for (let i = 0; i < count; i++) {
      const a  = (i / count) * Math.PI * 2 - Math.PI / 2;
      const sx = cx + Math.cos(a) * R;
      const sy = gy;
      const sh = H * 0.11;
      // Left upright
      g.fillRect(sx - 10, sy - sh, 8, sh);
      // Right upright
      g.fillRect(sx + 2,  sy - sh, 8, sh);
      // Lintel (horizontal capstone)
      g.fillRect(sx - 12, sy - sh - 6, 22, 7);
    }
    // Inner horseshoe trilithons (larger, fewer)
    const innerCount = 3;
    for (let i = 0; i < innerCount; i++) {
      const a  = (i / innerCount) * Math.PI - Math.PI * 0.75;
      const sx = cx + Math.cos(a) * R * 0.55;
      const sy = gy;
      const sh = H * 0.14;
      g.fillRect(sx - 6, sy - sh, 9, sh);
      g.fillRect(sx + 4, sy - sh, 9, sh);
      g.fillRect(sx - 8, sy - sh - 7, 24, 8);
    }
    // Altar stone flat on ground
    g.fillRect(cx - 12, gy - 5, 24, 6);
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
