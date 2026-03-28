import { AudioConfig } from '../types';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private config: AudioConfig = { muted: false, volume: 0.7 };
  private musicOscillators: OscillatorNode[] = [];
  private musicPlaying: boolean = false;
  private musicInterval: number | null = null;
  private noteIndex: number = 0;

  // Pentatonic scale for background music
  private readonly MELODY: number[] = [
    261.63, 293.66, 329.63, 392.00, 440.00,
    392.00, 329.63, 293.66, 261.63, 220.00,
    261.63, 329.63, 392.00, 440.00, 523.25,
    440.00, 392.00, 329.63
  ];

  constructor() {
    this.config.muted = false;
  }

  private ensureContext(): void {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.config.muted ? 0 : this.config.volume;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.3;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.7;
      this.sfxGain.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTileSelect(): void {
    this.playTone(440, 'sine', 0.1, 0.05);
  }

  playMatch(combo: number): void {
    const freq = 523.25 + (combo * 50);
    this.playTone(freq, 'triangle', 0.15, 0.2);
    setTimeout(() => this.playTone(freq * 1.25, 'triangle', 0.1, 0.15), 80);
  }

  playNoMatch(): void {
    this.playTone(180, 'sawtooth', 0.1, 0.15);
  }

  playLevelUp(): void {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 'triangle', 0.2, 0.3), i * 100);
    });
  }

  playGameOver(): void {
    const notes = [440, 349.23, 293.66, 220];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 'sawtooth', 0.2, 0.4), i * 150);
    });
  }

  playSpecial(): void {
    this.playTone(880, 'sine', 0.2, 0.1);
    setTimeout(() => this.playTone(1108.73, 'sine', 0.15, 0.1), 60);
    setTimeout(() => this.playTone(1318.51, 'sine', 0.1, 0.2), 120);
  }

  playSwap(): void {
    this.playTone(330, 'sine', 0.08, 0.08);
    setTimeout(() => this.playTone(392, 'sine', 0.08, 0.08), 60);
  }

  playExplosion(): void {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gainNode = this.ctx.createGain();
    gainNode.gain.value = 0.4;
    source.connect(gainNode);
    gainNode.connect(this.sfxGain);
    source.start();
    source.stop(this.ctx.currentTime + 0.3);
  }

  private playTone(freq: number, type: OscillatorType, gain: number, duration: number): void {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain || this.config.muted) return;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gainNode.gain.setValueAtTime(gain, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gainNode);
    gainNode.connect(this.sfxGain);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);
  }

  startMusic(): void {
    this.ensureContext();
    if (this.musicPlaying) return;
    this.musicPlaying = true;
    this.noteIndex = 0;
    this.playNextNote();
  }

  private playNextNote(): void {
    if (!this.musicPlaying || !this.ctx || !this.musicGain) return;
    const freq = this.MELODY[this.noteIndex % this.MELODY.length];
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gainNode.gain.setValueAtTime(this.config.muted ? 0 : 0.08, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);
    osc.connect(gainNode);
    gainNode.connect(this.musicGain);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + 0.4);
    this.noteIndex++;
    this.musicInterval = window.setTimeout(() => this.playNextNote(), 400) as unknown as number;
  }

  stopMusic(): void {
    this.musicPlaying = false;
    if (this.musicInterval !== null) {
      clearTimeout(this.musicInterval);
      this.musicInterval = null;
    }
  }

  toggleMute(): boolean {
    this.config.muted = !this.config.muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.config.muted ? 0 : this.config.volume;
    }
    return this.config.muted;
  }

  isMuted(): boolean {
    return this.config.muted;
  }

  destroy(): void {
    this.stopMusic();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}
