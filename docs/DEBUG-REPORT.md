I'll analyze the complete project systematically, checking for all the focus areas mentioned.

=== FILE: package.json ===
{
  "name": "chromashift",
  "version": "1.0.0",
  "description": "An addictive color-shifting puzzle game",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "phaser": "^3.60.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vite": "^5.2.0"
  },
  "engines": { "node": ">=20.0.0" }
}

=== FILE: tsconfig.json ===
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}

=== FILE: vite.config.js ===
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      input: { main: 'index.html' }
    }
  },
  server: {
    port: 3000,
    open: true
  }
});

=== FILE: index.html ===
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
  <title>ChromaShift</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: 100%;
      height: 100%;
      background: #000;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      user-select: none;
      -webkit-user-select: none;
      -ms-user-select: none;
    }
    #game-container {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    canvas {
      display: block;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }
  </style>
</head>
<body>
  <div id="game-container"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>

=== FILE: src/constants.ts ===
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 640;

// Grid settings
export const GRID_COLS = 8;
export const GRID_ROWS = 10;
export const CELL_SIZE = 48;
export const GRID_OFFSET_X = (GAME_WIDTH - GRID_COLS * CELL_SIZE) / 2;
export const GRID_OFFSET_Y = 80;

// Colors (as Phaser-compatible hex numbers)
export const COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9