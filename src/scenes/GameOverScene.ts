import Phaser from 'phaser';
import { SCENES } from '../constants';
import { GameState } from '../types';
import { getTheme, Theme } from '../theme';

export class GameOverScene extends Phaser.Scene {
  private theme!: Theme;

  constructor() {
    super({ key: SCENES.GAME_OVER });
  }

  create(data: { gameState: GameState }): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    this.theme = getTheme();

    const state = (data && data.gameState)
      ? data.gameState
      : { score: 0, highScore: 0, moves: 0, level: 1 };

    this.cameras.main.setBackgroundColor(this.theme.bg);
    this.cameras.main.fadeIn(500, 0, 0, 0);

    this.events.once('shutdown', this.cleanup, this);
    this.events.once('destroy', this.cleanup, this);

    // Background overlay
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(0, 0, width, height);

    // Panel
    const panelW = 320;
    const panelH = 360;
    const panel = this.add.graphics();
    panel.fillStyle(this.theme.bgCard, 1);
    panel.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 16);
    panel.lineStyle(2, this.theme.accent, 0.8);
    panel.strokeRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 16);

    // Game Over title
    this.add.text(cx, cy - 140, 'GAME OVER', {
      fontSize: '36px',
      fontFamily: 'Arial Black, Arial',
      color: this.theme.dangerStr,
      stroke: '#000',
      strokeThickness: 3
    }).setOrigin(0.5);

    // Score label
    this.add.text(cx, cy - 70, 'Score', {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: this.theme.textDimStr
    }).setOrigin(0.5);

    // Score value
    this.add.text(cx, cy - 45, '' + state.score, {
      fontSize: '40px',
      fontFamily: 'Arial Black, Arial',
      color: this.theme.textStr
    }).setOrigin(0.5);

    // High score
    const isNew = state.score >= state.highScore && state.score > 0;
    const hsColor = isNew ? '#FFD700' : this.theme.textMutedStr;
    this.add.text(cx, cy + 10, isNew ? '★ NEW HIGH SCORE! ★' : 'Best: ' + state.highScore, {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: hsColor
    }).setOrigin(0.5);

    // Moves
    this.add.text(cx, cy + 45, 'Moves used: ' + state.moves, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: this.theme.textDimStr
    }).setOrigin(0.5);

    // Play Again button
    const btnW = 200;
    const btnH = 50;
    const btnContainer = this.add.container(cx, cy + 110);
    const accent = this.theme.accent;

    const btnBg = this.add.graphics();
    btnBg.fillStyle(accent, 1);
    btnBg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 10);

    const btnLabel = this.add.text(0, 0, 'PLAY AGAIN', {
      fontSize: '22px',
      fontFamily: 'Arial Black, Arial',
      color: this.theme.textStr
    }).setOrigin(0.5);

    btnContainer.add([btnBg, btnLabel]);
    btnContainer.setSize(btnW, btnH);
    btnContainer.setInteractive({ useHandCursor: true });

    btnContainer.on('pointerover', () => {
      btnBg.clear();
      btnBg.fillStyle(0xff6b7a, 1);
      btnBg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 10);
    });
    btnContainer.on('pointerout', () => {
      btnBg.clear();
      btnBg.fillStyle(accent, 1);
      btnBg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 10);
    });
    btnContainer.on('pointerdown', () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start(SCENES.GAME);
      });
    });

    // Menu button
    const mutedColor = this.theme.textMutedStr;
    const menuBtn = this.add.text(cx, cy + 165, '← Back to Menu', {
      fontSize: '15px',
      fontFamily: 'Arial',
      color: mutedColor
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    menuBtn.on('pointerover', () => menuBtn.setColor(this.theme.textStr));
    menuBtn.on('pointerout', () => menuBtn.setColor(mutedColor));
    menuBtn.on('pointerdown', () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start(SCENES.MENU);
      });
    });

    // Keyboard
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-R', () => this.scene.start(SCENES.GAME));
      this.input.keyboard.on('keydown-ESC', () => this.scene.start(SCENES.MENU));
    }
  }

  private cleanup(): void {
    if (this.input.keyboard) {
      this.input.keyboard.removeAllListeners();
    }
  }
}
