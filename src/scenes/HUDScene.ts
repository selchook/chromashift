import Phaser from 'phaser';
import { SCENES, BG_COLOR, HIGHLIGHT_COLOR, COLORS, GAME_WIDTH } from '../constants';
import { GameState } from '../types';

export class HUDScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private highScoreText!: Phaser.GameObjects.Text;
  private movesText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: SCENES.HUD });
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const right = this.scale.width - 16;

    // Score
    this.scoreText = this.add.text(right, 16, 'Score: 0', {
      fontSize: '20px',
      fontFamily: 'Arial Black, Arial',
      color: '#ffffff'
    }).setOrigin(1, 0);

    // High score
    this.highScoreText = this.add.text(right, 40, 'Best: 0', {
      fontSize: '13px',
      fontFamily: 'Arial',
      color: '#FFD700'
    }).setOrigin(1, 0);

    // Moves
    this.movesText = this.add.text(20, 20, 'Moves: 0/30', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#aaaacc'
    }).setOrigin(0, 0);

    // Level
    this.levelText = this.add.text(20, 40, 'Level: 1', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#aaaacc'
    }).setOrigin(0, 0);

    // Combo
    this.comboText = this.add.text(cx, 65, '', {
      fontSize: '16px',
      fontFamily: 'Arial Black, Arial',
      color: '#ff6b7a'
    }).setOrigin(0.5, 0).setAlpha(0);

    this.events.on('updateState', (state: GameState) => {
      this.scoreText.setText(`Score: ${state.score}`);
      this.highScoreText.setText(`Best: ${state.highScore}`);
      this.movesText.setText(`Moves: ${state.moves}/${state.maxMoves}`);
      this.levelText.setText(`Level: ${state.level}`);

      if (state.combo > 1) {
        this.comboText.setText(`x${state.combo} COMBO!`);
        this.comboText.setAlpha(1);
        this.tweens.add({ targets: this.comboText, alpha: 0, duration: 800, delay: 600 });
      }
    });
  }
}
