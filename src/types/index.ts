export interface TileData {
  colorIndex: number;
  row: number;
  col: number;
  isMatched: boolean;
  isSpecial: boolean;
  specialType?: 'bomb' | 'rainbow' | 'lightning';
}

export interface MatchResult {
  tiles: TileData[];
  count: number;
  score: number;
  combo: number;
}

export interface GameState {
  score: number;
  level: number;
  moves: number;
  maxMoves: number;
  highScore: number;
  combo: number;
  isGameOver: boolean;
}

export interface GridConfig {
  rows: number;
  cols: number;
  tileSize: number;
  padding: number;
  offsetX: number;
  offsetY: number;
}

export interface AudioConfig {
  muted: boolean;
  volume: number;
}

export interface InputEvent {
  x: number;
  y: number;
  type: 'down' | 'up' | 'move';
}

export interface ParticleConfig {
  x: number;
  y: number;
  color: number;
  count: number;
  speed?: number;
  scale?: number;
  lifespan?: number;
}

export interface ScoreEntry {
  score: number;
  level: number;
  date: string;
}
