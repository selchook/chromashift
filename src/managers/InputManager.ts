import Phaser from 'phaser';
import { InputEvent } from '../types';

export class InputManager {
  private scene: Phaser.Scene;
  private callbacks: Map<string, ((event: InputEvent) => void)[]> = new Map();
  private pointerDown: boolean = false;
  private lastX: number = 0;
  private lastY: number = 0;
  private keyboardKeys: Map<string, Phaser.Input.Keyboard.Key> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.setupInput();
  }

  private setupInput(): void {
    const input = this.scene.input;

    input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.pointerDown = true;
      this.lastX = pointer.x;
      this.lastY = pointer.y;
      this.emit('down', { x: pointer.x, y: pointer.y, type: 'down' });
    });

    input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      this.pointerDown = false;
      this.emit('up', { x: pointer.x, y: pointer.y, type: 'up' });
    });

    input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.pointerDown) {
        this.lastX = pointer.x;
        this.lastY = pointer.y;
        this.emit('move', { x: pointer.x, y: pointer.y, type: 'move' });
      }
    });
  }

  addKey(keyCode: string): Phaser.Input.Keyboard.Key | null {
    if (!this.scene.input.keyboard) return null;
    const key = this.scene.input.keyboard.addKey(keyCode);
    this.keyboardKeys.set(keyCode, key);
    return key;
  }

  on(event: string, callback: (event: InputEvent) => void): void {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event)!.push(callback);
  }

  off(event: string, callback: (event: InputEvent) => void): void {
    const cbs = this.callbacks.get(event);
    if (cbs) {
      const idx = cbs.indexOf(callback);
      if (idx >= 0) cbs.splice(idx, 1);
    }
  }

  private emit(event: string, data: InputEvent): void {
    const cbs = this.callbacks.get(event);
    if (cbs) {
      cbs.forEach(cb => cb(data));
    }
  }

  destroy(): void {
    this.callbacks.clear();
    this.keyboardKeys.clear();
  }
}
