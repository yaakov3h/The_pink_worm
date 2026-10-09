export type GameScreen = 
  | 'TITLE'
  | 'INTERMISSION'
  | 'PLAYING'
  | 'PAUSED'
  | 'GAME_OVER'
  | 'VICTORY';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  decay: number;
  gravity?: number;
  shape?: 'circle' | 'square' | 'sparkle' | 'leaf' | 'dirt' | 'rain';
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
  scale?: number;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isPlayer: boolean;
  color: string;
  lifetime: number;
  isMega?: boolean;
  penetrations?: number;
}

export interface Collectible {
  id: number;
  x: number;
  y: number;
  type: 'yellow_shroom' | 'purple_shroom' | 'water_drop' | 'mega_drop' | 'golden_shroom';
  collected: boolean;
  wobble: number;
}

export interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'ground' | 'branch' | 'trunk' | 'rock' | 'thorns';
}

export type EnemyType = 'ant' | 'caterpillar' | 'beetle' | 'bird' | 'mole' | 'spider';

export interface Enemy {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  facing: 1 | -1;
  patrolMin: number;
  patrolMax: number;
  isAlive: boolean;
  stateTimer: number;
  isArmoredFront?: boolean;
  animTimer: number;
}

export interface Boss {
  name: string;
  title: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  phase: number;
  maxPhases: number;
  facing: 1 | -1;
  state: 'idle' | 'charge' | 'dive' | 'fly' | 'burrow' | 'attack' | 'hurt' | 'defeated';
  stateTimer: number;
  hitFlash: number;
  active: boolean;
  defeated: boolean;
  barrierX: number;
  barrierActive: boolean;
  animTimer: number;
}

export interface EnemyGuide {
  icon: string;
  name: string;
  weakness: string;
}

export interface DigTrack {
  x: number;
  y: number;
  r: number;
}

export interface StageConfig {
  id: number;
  name: string;
  subtitle: string;
  bossName: string;
  bossTip: string;
  weather: 'sunny' | 'vignette' | 'sunset_rain' | 'dark_maze';
  enemyGuides: EnemyGuide[];
  theme: {
    skyTop: string;
    skyBottom: string;
    hillColor: string;
    forestColor: string;
    grassColor: string;
    dirtColor: string;
    subsoilColor: string;
  };
  levelWidth: number;
  bossArenaX: number;
  platforms: Platform[];
  enemies: Enemy[];
  collectibles: Collectible[];
  boss: Boss;
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  isGrounded: boolean;
  isBurrowed: boolean;
  isClimbing: boolean;
  burrowDepth: number; // 0 to 1
  oxygen: number;      // 0 to 100
  maxOxygen: number;
  hp: number;
  maxHp: number;
  ammo: number;        // water drops
  megaAmmo: number;    // golden mega drops
  invulnerableTimer: number;
  speedBuffTimer: number;
  segments: { x: number; y: number; r: number }[];
  animTimer: number;
  blinkTimer: number;
  isBlinking: boolean;
  spitAnimTimer: number;
  ambushChargeTimer: number;
  // Squash & stretch animation
  squashX: number;
  squashY: number;
  // Juice timers
  coyoteTimer: number;
  jumpBufferTimer: number;
  wasGrounded: boolean;
}

export interface GameSettings {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  musicEnabled: boolean;
  bezelMode: boolean;
}
