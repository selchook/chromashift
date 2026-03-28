# Error Reference Guide: Addictive Puzzle Game (Phaser 3)

---

## 1. npm install / Vite Build Errors

### E1.1 — `Cannot find module 'phaser'`
**Cause:** Phaser not installed or missing from `node_modules`.
```bash
npm install phaser
```
Verify `package.json` contains:
```json
"dependencies": {
  "phaser": "^3.60.0"
}
```

---

### E1.2 — `Failed to resolve import "phaser"`
**Cause:** Vite cannot locate Phaser during bundling.

**Fix — `vite.config.js`:**
```js
import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    include: ['phaser']
  },
  build: {
    commonjsOptions: {
      include: [/phaser/, /node_modules/]
    }
  }
});
```

---

### E1.3 — `ENOENT: no such file or directory` during build
**Cause:** Asset paths in code do not match actual file locations.

**Checklist:**
- All assets live under `public/assets/`
- Paths in `this.load.image(...)` start with `/assets/`
- Filenames are **case-sensitive** on Linux/CI servers

---

### E1.4 — `Top-level await is not available`
**Cause:** Vite target set below ES2022.

**Fix — `vite.config.js`:**
```js
export default defineConfig({
  build: {
    target: 'es2022'
  }
});
```

---

### E1.5 — `Rollup: Circular dependency` warning
**Cause:** Common in Phaser internals — **safe to ignore** unless it's your own code.

For your own modules, restructure imports to break the cycle:
```js
// Instead of cross-importing between Scene files,
// use a shared EventEmitter or registry:
this.registry.set('score', 0);
```

---

## 2. Phaser 3 Engine Errors

### E2.1 — `Phaser is not defined`
**Cause:** Incorrect import syntax.

**Wrong:**
```js
import Phaser from 'phaser/dist/phaser.js';
```
**Correct:**
```js
import Phaser from 'phaser';
```

---

### E2.2 — `Scene is not a constructor`
**Cause:** Scene class not extending `Phaser.Scene` properly.

**Wrong:**
```js
class GameScene {
  create() {}
}
```
**Correct:**
```js
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }
  create() {}
}
```

---

### E2.3 — `Cannot read properties of undefined (reading 'sys')`
**Cause:** Accessing Phaser systems before scene is ready, or referencing a scene that hasn't launched.

**Fix:**
```js
// Wait for scene to be fully ready
this.events.once('create', () => {
  // safe to access this.sys, this.add, etc.
});

// Or check scene is active before accessing
if (this.scene.isActive('UIScene')) {
  this.scene.get('UIScene').updateScore(score);
}
```

---

### E2.4 — Game config `type: Phaser.AUTO` falls back to Canvas unexpectedly
**Cause:** WebGL context creation failed silently.

**Fix — force WebGL with fallback logging:**
```js
const config = {
  type: Phaser.WEBGL,
  failIfMajorPerformanceCaveat: false,
  callbacks: {
    postBoot: (game) => {
      console.log('Renderer:', game.renderer.type === 1 ? 'WebGL' : 'Canvas');
    }
  }
};
```

---

### E2.5 —