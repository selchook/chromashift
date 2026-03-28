export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 640;

export const GRID_COLS = 8;
export const GRID_ROWS = 10;
export const CELL_SIZE = 48;
export const GRID_OFFSET_X = (GAME_WIDTH - GRID_COLS * CELL_SIZE) / 2;
export const GRID_OFFSET_Y = 80;

export const COLORS: number[] = [
  0xe74c3c, // red
  0x3498db, // blue
  0x2ecc71, // green
  0xf39c12, // orange
  0x9b59b6, // purple
  0xff2d78  // pink
];

export const COLOR_NAMES: string[] = ['red', 'blue', 'green', 'orange', 'purple', 'pink'];

export const BG_COLOR = 0x0a0a1a;
export const HIGHLIGHT_COLOR = 0xe94560;
export const ACCENT_COLOR = 0x533483;

export const SCENES = {
  BOOT: 'Boot',
  LOAD: 'Load',
  MENU: 'Menu',
  GAME: 'Game',
  HUD: 'HUD',
  GAME_OVER: 'GameOver'
};

export const STORAGE_KEY = 'chromashift_highscore';

export const MATCH_MIN = 3;
export const BASE_SCORE = 100;
export const COMBO_MULTIPLIER = 1.5;
export const LEVEL_THRESHOLD = 1000;
export const DANGER_THRESHOLD = 0.8;
export const RESOLVE_DELAY = 400;
export const CHROMASHIFT_INTERVAL = 10;
