import Phaser from 'phaser';
import { SCENES, COLORS } from '../constants';
import { getTheme, Theme } from '../theme';

export class LoadScene extends Phaser.Scene {
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressBg!: Phaser.GameObjects.Graphics;
  private loadText!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private particles: Array<{ x: number; y: number; vx: number; vy: number; color: number; alpha: number; size: number }>;
  private particleGraphics!: Phaser.GameObjects.Graphics;
  private theme!: Theme;

  constructor() {
    super({ key: SCENES.LOAD });
    this.particles = [];
  }

  create(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    this.theme = getTheme();
    this.particles = [];
    this.cameras.main.setBackgroundColor(this.theme.bg);

    this.events.once('shutdown', this.cleanup, this);
    this.events.once('destroy', this.cleanup, this);

    this.titleText = this.add.text(cx, cy - 120, 'CHROMASHIFT', {
      fontSize: Math.min(width * 0.08, 52) + 'px',
      fontFamily: 'Arial Black, Arial',
      color: this.theme.textStr,
      stroke: this.theme.dangerStr,
      strokeThickness: 4,
      shadow: { offsetX: 2, offsetY: 2, color: this.theme.dangerStr, blur: 8, fill: true }
    }).setOrigin(0.5);

    this.loadText = this.add.text(cx, cy + 60, 'Generating Assets...', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: this.theme.textDimStr
    }).setOrigin(0.5);

    this.progressBg = this.add.graphics();
    this.progressBg.fillStyle(this.theme.bgCard, 1);
    this.progressBg.fillRoundedRect(cx - 200, cy + 80, 400, 20, 10);

    this.progressBar = this.add.graphics();

    this.particleGraphics = this.add.graphics();

    for (let i = 0; i < 20; i++) {
      this.particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha: Math.random() * 0.5 + 0.1,
        size: Math.random() * 8 + 4
      });
    }

    let progress = 0;
    const loadSteps = [
      'Initializing Grid...',
      'Generating Textures...',
      'Loading Color Palettes...',
      'Setting Up Audio...',
      'Preparing Effects...',
      'Ready!'
    ];
    let stepIdx = 0;
    const accent = this.theme.accent;

    const progressTimer = this.time.addEvent({
      delay: 120,
      repeat: 24,
      callback: () => {
        progress += 0.04;
        if (progress > 1) progress = 1;

        this.progressBar.clear();
        this.progressBar.fillStyle(accent, 1);
        const barWidth = 396 * progress;
        if (barWidth > 0) {
          this.progressBar.fillRoundedRect(cx - 198, cy + 82, barWidth, 16, 8);
        }

        const stepProgress = Math.floor(progress * loadSteps.length);
        if (stepProgress < loadSteps.length && stepProgress !== stepIdx) {
          stepIdx = stepProgress;
          this.loadText.setText(loadSteps[stepIdx]);
        }

        if (progress >= 1) {
          progressTimer.destroy();
          this.time.delayedCall(400, () => {
            this.cameras.main.fadeOut(400, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
              this.scene.start(SCENES.MENU);
            });
          });
        }
      }
    });

    this.tweens.add({
      targets: this.titleText,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  update(): void {
    const { width, height } = this.scale;
    this.particleGraphics.clear();

    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      this.particleGraphics.fillStyle(p.color, p.alpha);
      this.particleGraphics.fillCircle(p.x, p.y, p.size);
    }
  }

  private cleanup(): void {
    this.particles = [];
  }
}
