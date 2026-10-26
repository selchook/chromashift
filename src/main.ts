import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { LoadScene } from './scenes/LoadScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { HUDScene } from './scenes/HUDScene';
import { GameOverScene } from './scenes/GameOverScene';
import { setPlatformAudio } from './managers/AudioManager';
import { onPlatform } from './ayvago/platform';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'gameCanvas',
  backgroundColor: '#0a0a1a',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [BootScene, LoadScene, MenuScene, GameScene, HUDScene, GameOverScene]
};

const game = new Phaser.Game(config);

// Safety net for phone rotation: Phaser's orientation and resize handlers can race and leave the
// canvas at the old size. Shortly after the window settles, re-read the parent size and refresh.
let resizeTimer = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    game.scale.getParentBounds();
    game.scale.refresh();
  }, 250);
});

// Inside Ayvago the platform pauses the game when its tab is hidden and can mute it.
onPlatform((platform) => {
  platform.onPause(() => {
    game.loop.sleep();
    setPlatformAudio({ paused: true });
  });
  platform.onResume(() => {
    game.loop.wake();
    setPlatformAudio({ paused: false });
  });
  platform.onMute((muted) => setPlatformAudio({ muted }));
});
