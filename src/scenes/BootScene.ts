import Phaser from 'phaser';
import { SCENES, BG_COLOR } from '../constants';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.BOOT });
  }

  preload(): void {
    // Nothing to preload in boot - all assets are procedural
  }

  create(): void {
    // Set up device pixel ratio scaling
    const dpr = window.devicePixelRatio || 1;

    // Configure camera background
    this.cameras.main.setBackgroundColor(BG_COLOR);

    // Short delay then go to load scene
    this.time.delayedCall(100, () => {
      this.scene.start(SCENES.LOAD);
    });
  }
}
