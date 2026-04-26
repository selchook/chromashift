import Phaser from 'phaser';
import { SCENES, BG_COLOR, HIGHLIGHT_COLOR, ACCENT_COLOR, COLORS, STORAGE_KEY } from '../constants';
import { AudioManager } from '../managers/AudioManager';

export class MenuScene extends Phaser.Scene {
  private audioManager!: AudioManager;
  private bgParticles: Array<{
    x: number; y: number; vx: number; vy: number;
    color: number; alpha: number; size: number; rotation: number; rotSpeed: number;
  }>;
  private bgGraphics!: Phaser.GameObjects.Graphics;
  private titleLetters: Phaser.GameObjects.Text[];
  private playButton!: Phaser.GameObjects.Container;
  private highScoreText!: Phaser.GameObjects.Text;
  private muteBtn!: Phaser.GameObjects.Text;
  private isTransitioning: boolean;

  constructor() {
    super({ key: SCENES.MENU });
    this.bgParticles = [];
    this.titleLetters = [];
    this.isTransitioning = false;
  }

  create(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    this.isTransitioning = false;
    this.bgParticles = [];
    this.titleLetters = [];
    this.cameras.main.setBackgroundColor(BG_COLOR);
    this.cameras.main.fadeIn(600, 0, 0, 0);

    this.events.once('shutdown', this.cleanup, this);
    this.events.once('destroy', this.cleanup, this);

    if (!this.registry.get('audioManager')) {
      this.audioManager = new AudioManager();
      this.registry.set('audioManager', this.audioManager);
    } else {
      this.audioManager = this.registry.get('audioManager');
    }

    this.bgGraphics = this.add.graphics();

    this.bgParticles = [];
    for (let i = 0; i < 30; i++) {
      this.bgParticles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha: Math.random() * 0.3 + 0.05,
        size: Math.random() * 30 + 10,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.02
      });
    }

    this.drawDecorativeGrid(cx, cy - 20, width, height);

    const title = 'CHROMASHIFT';
    const tFontSize = Math.min(width * 0.085, 58);
    const totalWidth = title.length * (tFontSize * 0.62);
    const startX = cx - totalWidth / 2 + (tFontSize * 0.31);

    this.titleLetters = [];
    for (let i = 0; i < title.length; i++) {
      const color = COLORS[i % COLORS.length];
      const hex = '#' + color.toString(16).padStart(6, '0');
      const letter = this.add.text(startX + i * (tFontSize * 0.62), cy - 200, title[i], {
        fontSize: tFontSize + 'px',
        fontFamily: 'Arial Black, Arial',
        color: hex,
        stroke: '#000000',
        strokeThickness: 3
      }).setOrigin(0.5).setAlpha(0);

      this.titleLetters.push(letter);

      this.tweens.add({
        targets: letter,
        alpha: 1,
        y: cy - 210,
        duration: 400,
        delay: i * 60,
        ease: 'Back.easeOut'
      });

      this.time.delayedCall(i * 60 + 400, () => {
        this.tweens.add({
          targets: letter,
          y: cy - 215,
          duration: 1200 + i * 80,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      });
    }

    const subtitle = this.add.text(cx, cy - 150, 'Color Matching Puzzle', {
      fontSize: Math.min(width * 0.04, 20) + 'px',
      fontFamily: 'Arial',
      color: '#aaaacc',
      alpha: 0
    } as any).setOrigin(0.5);
    this.tweens.add({ targets: subtitle, alpha: 1, duration: 600, delay: 700 });

    const highScore = localStorage.getItem(STORAGE_KEY) || '0';
    this.highScoreText = this.add.text(cx, cy - 110, 'Best Score: ' + highScore, {
      fontSize: Math.min(width * 0.04, 18) + 'px',
      fontFamily: 'Arial',
      color: '#FFD700',
      alpha: 0
    } as any).setOrigin(0.5);
    this.tweens.add({ targets: this.highScoreText, alpha: 1, duration: 600, delay: 900 });

    this.playButton = this.createPlayButton(cx, cy + 30);
    this.playButton.setAlpha(0);
    this.tweens.add({ targets: this.playButton, alpha: 1, y: cy + 40, duration: 600, delay: 1000, ease: 'Back.easeOut' });

    this.createHowToPlay(cx, cy + 140, width);

    this.muteBtn = this.add.text(width - 20, 20, '🔊', {
      fontSize: '24px',
      fontFamily: 'Arial'
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });

    this.muteBtn.on('pointerdown', () => {
      const muted = this.audioManager.toggleMute();
      this.muteBtn.setText(muted ? '🔇' : '🔊');
      if (!muted) this.audioManager.startMusic();
    });

    this.add.text(cx, height - 20, 'v1.0  |  Tap/Click to Match Colors', {
      fontSize: '12px',
      fontFamily: 'Arial',
      color: '#444466'
    }).setOrigin(0.5, 1);

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-M', () => {
        const muted = this.audioManager.toggleMute();
        this.muteBtn.setText(muted ? '🔇' : '🔊');
        if (!muted) this.audioManager.startMusic();
      });
    }
  }

  private cleanup(): void {
    if (this.input.keyboard) {
      this.input.keyboard.removeAllListeners();
    }
  }

  private createPlayButton(x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const btnW = 220;
    const btnH = 60;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.4);
    shadow.fillRoundedRect(-btnW / 2 + 4, -btnH / 2 + 4, btnW, btnH, 12);

    const bg = this.add.graphics();
    bg.fillStyle(HIGHLIGHT_COLOR, 1);
    bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);

    const border = this.add.graphics();
    border.lineStyle(2, 0xffffff, 0.4);
    border.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);

    const label = this.add.text(0, 0, 'PLAY', {
      fontSize: '28px',
      fontFamily: 'Arial Black, Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    container.add([shadow, bg, border, label]);
    container.setSize(btnW, btnH);
    container.setInteractive({ useHandCursor: true });

    container.on('pointerover', () => {
      this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 100 });
      bg.clear();
      bg.fillStyle(0xff6b7a, 1);
      bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);
    });

    container.on('pointerout', () => {
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 100 });
      bg.clear();
      bg.fillStyle(HIGHLIGHT_COLOR, 1);
      bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);
    });

    container.on('pointerdown', () => {
      if (this.isTransitioning) return;
      this.isTransitioning = true;
      this.audioManager.playTileSelect();
      this.tweens.add({ targets: container, scaleX: 0.95, scaleY: 0.95, duration: 80, yoyo: true });
      this.time.delayedCall(200, () => {
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.audioManager.stopMusic();
          this.scene.start(SCENES.GAME);
        });
      });
    });

    return container;
  }

  private createHowToPlay(x: number, y: number, width: number): void {
    const instructions = [
      'Click tiles to select • Click adjacent to swap',
      'Match 3+ same colors to clear • Chain combos for bonus!'
    ];

    instructions.forEach((text, i) => {
      this.add.text(x, y + i * 24, text, {
        fontSize: Math.min(width * 0.032, 14) + 'px',
        fontFamily: 'Arial',
        color: '#8888aa',
        alpha: 0
      } as any).setOrigin(0.5).setAlpha(0);

      this.tweens.add({
        targets: this.children.getChildren()[this.children.getChildren().length - 1],
        alpha: 1,
        duration: 500,
        delay: 1200 + i * 150
      });
    });
  }

  private drawDecorativeGrid(cx: number, cy: number, width: number, height: number): void {
    const g = this.add.graphics();
    const cellSize = 38;
    const cols = 6;
    const rows = 5;
    const gridW = cols * cellSize;
    const gridH = rows * cellSize;
    const startX = cx - gridW / 2;
    const startY = cy + 60;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const colorIdx = (row * cols + col) % COLORS.length;
        const color = COLORS[colorIdx];
        const alpha = 0.08 + Math.random() * 0.06;
        g.fillStyle(color, alpha);
        g.fillRoundedRect(
          startX + col * cellSize + 2,
          startY + row * cellSize + 2,
          cellSize - 4,
          cellSize - 4,
          4
        );
      }
    }
  }

  update(): void {
    const { width, height } = this.scale;
    this.bgGraphics.clear();

    for (const p of this.bgParticles) {
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotSpeed;
      if (p.x < -50) p.x = width + 50;
      if (p.x > width + 50) p.x = -50;
      if (p.y < -50) p.y = height + 50;
      if (p.y > height + 50) p.y = -50;

      this.bgGraphics.fillStyle(p.color, p.alpha);
      this.bgGraphics.fillCircle(p.x, p.y, p.size);
    }
  }
}
