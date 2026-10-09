import { STAGE_CONFIGS } from './stages';
import {
  Boss,
  Collectible,
  DigTrack,
  Enemy,
  FloatingText,
  GameScreen,
  Particle,
  Platform,
  Player,
  Projectile,
  StageConfig,
} from './types';
import { soundEngine, triggerHaptic } from './audio';

export class GameEngine {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;

  public screenWidth: number = 800;
  public screenHeight: number = 600;

  public currentStageIndex: number = 0;
  public currentStage: StageConfig;

  public currentScreen: GameScreen = 'TITLE';
  public score: number = 0;
  public mushroomsCollected: number = 0;
  public highScore: number = 0;

  // Player state
  public player!: Player;

  // Combo system
  public comboCount: number = 0;
  public comboTimer: number = 0;

  // Persistent dig tracks
  public digTracks: DigTrack[] = [];

  // Weather particles (rain, pollen, sparks)
  public weatherParticles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number }[] = [];

  // Camera & Visual FX
  public cameraX: number = 0;
  public cameraY: number = 0;
  public screenShake: number = 0;
  public bossWarningTimer: number = 0;

  // Entities
  public platforms: Platform[] = [];
  public enemies: Enemy[] = [];
  public collectibles: Collectible[] = [];
  public projectiles: Projectile[] = [];
  public particles: Particle[] = [];
  public floatingTexts: FloatingText[] = [];
  public boss!: Boss;

  // Input states
  public keys: {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    spit: boolean;
  } = {
    left: false,
    right: false,
    up: false,
    down: false,
    spit: false,
  };

  // Settings
  public soundEnabled: boolean = true;
  public hapticsEnabled: boolean = true;

  // Timers
  private lastTime: number = 0;
  private animationFrameId: number | null = null;
  private nextTextId: number = 1;
  private nextProjId: number = 1;
  private cloudTimer: number = 0;
  private oxygenWarningCooldown: number = 0;

  // Callbacks for React state sync
  public onStateChange?: (state: {
    screen: GameScreen;
    hp: number;
    ammo: number;
    megaAmmo: number;
    oxygen: number;
    isBurrowed: boolean;
    score: number;
    mushrooms: number;
    combo: number;
    stageIndex: number;
    totalStages: number;
    bossActive: boolean;
    bossHp: number;
    bossMaxHp: number;
    bossName: string;
  }) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    (this.ctx as any).mozImageSmoothingEnabled = false;
    (this.ctx as any).webkitImageSmoothingEnabled = false;
    this.currentStage = JSON.parse(JSON.stringify(STAGE_CONFIGS[0]));

    try {
      const saved = localStorage.getItem('pink_worm_highscore');
      if (saved) this.highScore = parseInt(saved, 10) || 0;
    } catch {}

    this.resetPlayer();
    this.loadStage(0);
  }

  public init() {
    this.lastTime = performance.now();
    this.gameLoop(this.lastTime);
  }

  public destroy() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  // CRITICAL FIX: Reset all input states to prevent residual lock across screen changes
  public resetInputStates() {
    this.keys = {
      left: false,
      right: false,
      up: false,
      down: false,
      spit: false,
    };
    if (this.player) {
      this.player.vx = 0;
      this.player.vy = 0;
      this.player.coyoteTimer = 0;
      this.player.jumpBufferTimer = 0;
    }
  }

  public setScreen(screen: GameScreen) {
    this.currentScreen = screen;
    this.resetInputStates();

    if (screen === 'PLAYING') {
      soundEngine.startMusic();
    } else if (screen === 'PAUSED' || screen === 'GAME_OVER' || screen === 'VICTORY') {
      soundEngine.stopMusic();
    }
    this.notifyState();
  }

  public toggleMute(): boolean {
    this.soundEnabled = !this.soundEnabled;
    soundEngine.setMuted(!this.soundEnabled);
    return this.soundEnabled;
  }

  public toggleHaptics(): boolean {
    this.hapticsEnabled = !this.hapticsEnabled;
    return this.hapticsEnabled;
  }

  public startStage() {
    this.resetInputStates();
    this.setScreen('PLAYING');
    this.resetInputStates();
  }

  public retryStage() {
    this.resetPlayer();
    this.loadStage(this.currentStageIndex);
    this.setScreen('PLAYING');
    this.resetInputStates();
  }

  public restartGame() {
    this.score = 0;
    this.mushroomsCollected = 0;
    this.currentStageIndex = 0;
    this.resetPlayer();
    this.resetInputStates();
    this.loadStage(0);
    this.setScreen('INTERMISSION');
  }

  public loadStage(index: number) {
    this.currentStageIndex = index;
    const template = STAGE_CONFIGS[index % STAGE_CONFIGS.length];
    this.currentStage = JSON.parse(JSON.stringify(template));

    this.platforms = this.currentStage.platforms;
    this.enemies = this.currentStage.enemies;
    this.collectibles = this.currentStage.collectibles;
    this.boss = this.currentStage.boss;
    this.projectiles = [];
    this.particles = [];
    this.floatingTexts = [];
    this.digTracks = [];
    this.comboCount = 0;
    this.comboTimer = 0;
    this.bossWarningTimer = 0;

    this.resetInputStates();

    // Reset weather particles
    this.weatherParticles = [];
    for (let i = 0; i < 40; i++) {
      this.weatherParticles.push({
        x: Math.random() * 800,
        y: Math.random() * 600,
        vx: this.currentStage.weather === 'sunset_rain' ? -1.5 : (Math.random() - 0.5) * 1,
        vy: this.currentStage.weather === 'sunset_rain' ? 8 : (Math.random() * 1 + 0.5),
        size: this.currentStage.weather === 'sunset_rain' ? 12 : 3,
        alpha: Math.random() * 0.6 + 0.3,
      });
    }

    // Position player at start
    this.player.x = 100;
    this.player.y = 400;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.isBurrowed = false;
    this.player.burrowDepth = 0;
    this.player.oxygen = 100;
    this.player.isClimbing = false;
    this.player.squashX = 1;
    this.player.squashY = 1;
    this.player.coyoteTimer = 0;
    this.player.jumpBufferTimer = 0;
    this.player.wasGrounded = true;
    this.cameraX = 0;

    // Reset segments horizontally along ground
    for (let i = 0; i < this.player.segments.length; i++) {
      this.player.segments[i].x = this.player.x - i * 11;
      this.player.segments[i].y = this.player.y;
    }

    this.notifyState();
  }

  public resetPlayer() {
    this.player = {
      x: 100,
      y: 400,
      vx: 0,
      vy: 0,
      facing: 1,
      isGrounded: false,
      isBurrowed: false,
      isClimbing: false,
      burrowDepth: 0,
      oxygen: 100,
      maxOxygen: 100,
      hp: 3,
      maxHp: 3,
      ammo: 5,
      megaAmmo: 1,
      invulnerableTimer: 0,
      speedBuffTimer: 0,
      segments: Array.from({ length: 8 }, (_, i) => ({
        x: 100 - i * 11,
        y: 400,
        r: Math.max(7, 14 - i * 0.9),
      })),
      animTimer: 0,
      blinkTimer: 0,
      isBlinking: false,
      spitAnimTimer: 0,
      ambushChargeTimer: 0,
      squashX: 1,
      squashY: 1,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      wasGrounded: true,
    };
  }

  public notifyState() {
    if (this.onStateChange) {
      this.onStateChange({
        screen: this.currentScreen,
        hp: this.player ? this.player.hp : 3,
        ammo: this.player ? this.player.ammo : 5,
        megaAmmo: this.player ? this.player.megaAmmo : 0,
        oxygen: this.player ? Math.round(this.player.oxygen) : 100,
        isBurrowed: this.player ? this.player.isBurrowed : false,
        score: this.score,
        mushrooms: this.mushroomsCollected,
        combo: this.comboCount,
        stageIndex: this.currentStageIndex,
        totalStages: STAGE_CONFIGS.length,
        bossActive: this.boss ? this.boss.active : false,
        bossHp: this.boss ? this.boss.hp : 0,
        bossMaxHp: this.boss ? this.boss.maxHp : 1,
        bossName: this.boss ? this.boss.name : '',
      });
    }
  }

  public setKey(action: 'left' | 'right' | 'up' | 'down' | 'spit', isPressed: boolean) {
    if (!isPressed) {
      this.keys[action] = false;
      return;
    }

    if (this.currentScreen !== 'PLAYING') return;

    if (action === 'spit' && !this.keys.spit) {
      this.triggerSpit();
    }

    if (action === 'down' && !this.keys.down) {
      this.toggleBurrow();
    }

    if (action === 'up' && !this.keys.up) {
      this.player.jumpBufferTimer = 6;
      this.triggerJumpOrAmbush();
    }

    this.keys[action] = true;
  }

  public toggleBurrow() {
    if (!this.player) return;

    if (this.player.isGrounded && this.player.y >= 380) {
      this.player.isBurrowed = !this.player.isBurrowed;
      if (this.player.isBurrowed) {
        soundEngine.playDig();
        triggerHaptic('tap', this.hapticsEnabled);
        this.player.squashX = 1.35;
        this.player.squashY = 0.75;
        this.spawnSandMound(this.player.x, 420, 18);
        this.addFloatingText(this.player.x, 390, 'BURROWED!', '#ffb74d');
      } else {
        this.player.burrowDepth = 0;
        this.spawnSandMound(this.player.x, 420, 12);
      }
      this.notifyState();
    }
  }

  public triggerJumpOrAmbush() {
    if (!this.player) return;

    if (this.player.isBurrowed) {
      this.player.isBurrowed = false;
      this.player.burrowDepth = 0;
      this.player.vy = -14.5;
      this.player.isGrounded = false;
      this.player.squashX = 0.75;
      this.player.squashY = 1.35;

      soundEngine.playAmbush();
      triggerHaptic('ambush', this.hapticsEnabled);
      this.screenShake = 12;

      this.spawnSandMound(this.player.x, 420, 30);
      for (let i = 0; i < 24; i++) {
        this.particles.push({
          x: this.player.x + (Math.random() - 0.5) * 20,
          y: 420,
          vx: (Math.random() - 0.5) * 8,
          vy: -Math.random() * 9 - 4,
          color: Math.random() > 0.4 ? '#8d6e63' : '#d7ccc8',
          size: Math.random() * 5 + 3,
          alpha: 1,
          decay: 0.025,
          gravity: 0.35,
          shape: 'dirt',
        });
      }

      this.addFloatingText(this.player.x, 370, '!AMBUSH BURST!', '#ff4081', 1.25);

      const ambushRadius = 70;
      for (const enemy of this.enemies) {
        if (!enemy.isAlive) continue;
        const dist = Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y);
        if (dist < ambushRadius + 25) {
          enemy.hp -= 3;
          enemy.vy = -11;
          enemy.vx = this.player.facing * 5;
          soundEngine.playEnemyDefeat();
          this.handleEnemyDefeat(enemy, 'AMBUSH');
        }
      }

      if (this.boss && this.boss.active && !this.boss.defeated) {
        const bDist = Math.hypot(this.boss.x - this.player.x, this.boss.y - this.player.y);
        if (bDist < ambushRadius + 45) {
          this.hitBoss(2, true);
        }
      }
      this.notifyState();
      return;
    }

    const canJump = this.player.isGrounded || this.player.isClimbing || this.player.coyoteTimer > 0;
    if (canJump) {
      const jumpPower = this.player.speedBuffTimer > 0 ? -13.5 : -11.8;
      this.player.vy = jumpPower;
      this.player.isGrounded = false;
      this.player.isClimbing = false;
      this.player.coyoteTimer = 0;
      this.player.jumpBufferTimer = 0;

      this.player.squashX = 0.82;
      this.player.squashY = 1.25;

      soundEngine.playJump();
      triggerHaptic('tap', this.hapticsEnabled);

      for (let i = 0; i < 6; i++) {
        this.particles.push({
          x: this.player.x + (Math.random() - 0.5) * 15,
          y: this.player.y + 12,
          vx: (Math.random() - 0.5) * 3,
          vy: -Math.random() * 2 - 0.5,
          color: '#a1887f',
          size: Math.random() * 3 + 2,
          alpha: 0.8,
          decay: 0.04,
          gravity: 0.1,
        });
      }
    }
  }

  public triggerSpit() {
    if (!this.player || this.player.isBurrowed) return;

    const useMega = this.player.megaAmmo > 0;

    if (!useMega && this.player.ammo <= 0) {
      this.addFloatingText(this.player.x, this.player.y - 30, 'NO WATER!', '#90caf9');
      return;
    }

    if (useMega) {
      this.player.megaAmmo--;
      soundEngine.playMegaSpit();
      triggerHaptic('ambush', this.hapticsEnabled);
      this.screenShake = 6;
      this.addFloatingText(this.player.x, this.player.y - 35, '!MEGA SPIT!', '#ffd700', 1.2);
    } else {
      this.player.ammo--;
      soundEngine.playSpit();
      triggerHaptic('tap', this.hapticsEnabled);
    }

    this.player.spitAnimTimer = 16;

    const bulletSpeed = (useMega ? 15 : 12) * this.player.facing;
    this.projectiles.push({
      id: this.nextProjId++,
      x: this.player.x + this.player.facing * (useMega ? 22 : 18),
      y: this.player.y - 4,
      vx: bulletSpeed,
      vy: useMega ? -0.5 : -1.2,
      radius: useMega ? 11 : 6,
      isPlayer: true,
      color: useMega ? '#ffd700' : '#4fc3f7',
      lifetime: 90,
      isMega: useMega,
      penetrations: useMega ? 3 : 1,
    });

    for (let i = 0; i < (useMega ? 10 : 5); i++) {
      this.particles.push({
        x: this.player.x + this.player.facing * 16,
        y: this.player.y - 4,
        vx: this.player.facing * (Math.random() * 5 + 2),
        vy: (Math.random() - 0.5) * 3,
        color: useMega ? '#fff59d' : '#b3e5fc',
        size: Math.random() * 4 + 2,
        alpha: 0.9,
        decay: 0.05,
        gravity: 0.1,
      });
    }

    this.notifyState();
  }

  private handleEnemyDefeat(enemy: Enemy, reason: 'AMBUSH' | 'WATER' | 'STOMP' | 'MEGA' | 'HEADBUTT') {
    if (enemy.hp <= 0) {
      enemy.isAlive = false;
      this.spawnEnemyDefeatFX(enemy.x, enemy.y);
    }

    this.comboCount++;
    this.comboTimer = 150;
    const multiplier = Math.min(4, this.comboCount);

    const baseScore = reason === 'AMBUSH' ? 250 : reason === 'HEADBUTT' ? 220 : 150;
    const gained = baseScore * multiplier;
    this.score += gained;

    if (this.comboCount >= 2) {
      soundEngine.playCombo(multiplier);
      triggerHaptic('combo', this.hapticsEnabled);
      this.addFloatingText(enemy.x, enemy.y - 25, `!COMBO x${multiplier}! +${gained}`, '#ffd54f', 1.2);
    } else {
      this.addFloatingText(enemy.x, enemy.y - 20, `+${gained}`, '#ffd54f');
    }

    this.notifyState();
  }

  private gameLoop = (currentTime: number) => {
    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    if (this.currentScreen === 'PLAYING') {
      this.update(dt);
    }

    this.render();
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  };

  private update(_dt: number) {
    if (!this.player) return;

    this.cloudTimer += 0.01;

    if (this.bossWarningTimer > 0) {
      this.bossWarningTimer--;
      // Punchy screen rumble during the fast 1-second alert
      if (this.bossWarningTimer > 35) {
        this.screenShake = Math.max(this.screenShake, 14);
      }
    }

    if (this.screenShake > 0) {
      this.screenShake *= 0.88;
      if (this.screenShake < 0.2) this.screenShake = 0;
    }

    if (this.comboTimer > 0) {
      this.comboTimer--;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
        this.notifyState();
      }
    }

    this.player.squashX += (1.0 - this.player.squashX) * 0.18;
    this.player.squashY += (1.0 - this.player.squashY) * 0.18;

    if (this.player.coyoteTimer > 0) this.player.coyoteTimer--;
    if (this.player.jumpBufferTimer > 0) this.player.jumpBufferTimer--;

    if (this.player.invulnerableTimer > 0) this.player.invulnerableTimer--;
    if (this.player.speedBuffTimer > 0) {
      this.player.speedBuffTimer -= 1 / 60;
      if (Math.random() < 0.3) {
        this.particles.push({
          x: this.player.x + (Math.random() - 0.5) * 20,
          y: this.player.y + (Math.random() - 0.5) * 15,
          vx: (Math.random() - 0.5) * 2,
          vy: -Math.random() * 2 - 1,
          color: ['#ff80ab', '#b388ff', '#82b1ff', '#ffff8d'][Math.floor(Math.random() * 4)],
          size: 3,
          alpha: 1,
          decay: 0.04,
          shape: 'sparkle',
        });
      }
    }
    if (this.player.spitAnimTimer > 0) this.player.spitAnimTimer--;

    this.player.blinkTimer++;
    if (this.player.blinkTimer > 180) {
      this.player.isBlinking = true;
      if (this.player.blinkTimer > 192) {
        this.player.isBlinking = false;
        this.player.blinkTimer = 0;
      }
    }

    if (this.player.isBurrowed) {
      this.player.oxygen = Math.max(0, this.player.oxygen - 0.2);
      if (this.player.oxygen <= 25) {
        this.oxygenWarningCooldown--;
        if (this.oxygenWarningCooldown <= 0) {
          soundEngine.playOxygenWarning();
          this.oxygenWarningCooldown = 30;
        }
      }
      if (this.player.oxygen <= 0) {
        this.addFloatingText(this.player.x, 370, 'OUT OF AIR!', '#ff1744');
        this.hurtPlayer();
        this.triggerJumpOrAmbush();
      }
    } else {
      this.player.oxygen = Math.min(100, this.player.oxygen + 1.5);
    }

    let onDigTrack = false;
    if (this.player.isBurrowed) {
      for (const dt of this.digTracks) {
        if (Math.hypot(dt.x - this.player.x, dt.y - this.player.y) < dt.r) {
          onDigTrack = true;
          break;
        }
      }
      if (Math.abs(this.player.vx) > 0.5) {
        if (this.digTracks.length === 0 || Math.hypot(this.digTracks[this.digTracks.length - 1].x - this.player.x, this.digTracks[this.digTracks.length - 1].y - this.player.y) > 12) {
          this.digTracks.push({ x: this.player.x, y: this.player.y, r: 16 });
          if (this.digTracks.length > 200) this.digTracks.shift();
        }
      }
    }

    const lerpFactor = this.player.isBurrowed ? 0.14 : 0.32;
    const baseSpeed = this.player.isBurrowed ? (onDigTrack ? 3.8 : 3.0) : (this.player.speedBuffTimer > 0 ? 5.2 : 3.8);

    let targetVx = 0;
    if (this.keys.left) {
      targetVx = -baseSpeed;
      this.player.facing = -1;
    } else if (this.keys.right) {
      targetVx = baseSpeed;
      this.player.facing = 1;
    }

    this.player.vx += (targetVx - this.player.vx) * lerpFactor;
    this.player.x += this.player.vx;

    this.checkClimbing();

    if (this.player.isBurrowed) {
      this.player.burrowDepth = Math.min(1, this.player.burrowDepth + 0.1);
      this.player.y = 420 + this.player.burrowDepth * 35;
      this.player.vy = 0;
      this.player.isGrounded = true;

      if (Math.abs(this.player.vx) > 0.5 && Math.random() < 0.35) {
        this.particles.push({
          x: this.player.x,
          y: 420,
          vx: -this.player.facing * (Math.random() * 2),
          vy: -Math.random() * 2 - 0.5,
          color: '#8d6e63',
          size: Math.random() * 3 + 2,
          alpha: 0.8,
          decay: 0.03,
          shape: 'dirt',
        });
      }
    } else if (this.player.isClimbing) {
      if (this.keys.up) {
        this.player.vy = -3.2;
      } else if (this.keys.down) {
        this.player.vy = 3.2;
      } else {
        this.player.vy = 0;
      }
      this.player.y += this.player.vy;
    } else {
      this.player.vy += 0.55;
      if (this.player.vy > 12) this.player.vy = 12;
      this.player.y += this.player.vy;
      this.player.burrowDepth = 0;

      if (this.player.vy < -2) {
        this.player.squashX = 0.82;
        this.player.squashY = 1.25;
      } else if (this.player.vy > 3) {
        this.player.squashX = 0.9;
        this.player.squashY = 1.15;
      }

      this.checkPlatformCollisions();
    }

    if (this.player.x < 20) this.player.x = 20;
    if (this.player.x > this.currentStage.levelWidth - 40) {
      this.player.x = this.currentStage.levelWidth - 40;
    }

    // WORM TAIL LANDING & CRAWLING RESET
    this.player.animTimer += Math.abs(this.player.vx) * 0.15 + 0.05;
    const segments = this.player.segments;
    segments[0].x = this.player.x;
    segments[0].y = this.player.y;

    const groundLineY = this.player.isBurrowed ? 455 : 418;

    for (let i = 1; i < segments.length; i++) {
      const prev = segments[i - 1];
      const cur = segments[i];
      const targetDist = 11;
      const wave = Math.sin(this.player.animTimer - i * 0.6) * (this.player.isBurrowed ? 2 : 3.5);

      if (this.player.isGrounded && !this.player.isClimbing) {
        const idealX = prev.x - this.player.facing * targetDist;
        cur.x += (idealX - cur.x) * 0.55;
        const idealY = Math.min(groundLineY, prev.y) - Math.abs(wave) * 0.2;
        cur.y += (idealY - cur.y) * 0.55;
      } else {
        const dx = cur.x - prev.x;
        const dy = cur.y - prev.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.001) {
          cur.x = prev.x + (dx / dist) * targetDist;
          cur.y = prev.y + (dy / dist) * targetDist;
        }
      }
    }

    // Update Camera
    const targetCamX = this.player.x - this.screenWidth * 0.42;
    this.cameraX += (targetCamX - this.cameraX) * 0.1;
    if (this.cameraX < 0) this.cameraX = 0;
    const maxCamX = this.currentStage.levelWidth - this.screenWidth;
    if (this.cameraX > maxCamX) this.cameraX = maxCamX;

    this.updateWeather();
    this.updateEnemies();
    this.updateBoss();
    this.updateProjectiles();
    this.updateCollectibles();
    this.updateParticles();
    this.updateFloatingText();

    if (this.player.x >= this.currentStage.bossArenaX && !this.boss.active && !this.boss.defeated) {
      this.boss.active = true;
      this.bossWarningTimer = 60; // 60 frames = exactly 1.0 second fast compact alert
      this.screenShake = 18; // Punchy screen shake
      soundEngine.playPhaseTransition();
      soundEngine.playBossHit();
      triggerHaptic('boss_defeat', this.hapticsEnabled);
      this.addFloatingText(this.boss.x, 180, `! ${this.boss.name.toUpperCase()} !`, '#ff1744', 1.2);
      this.notifyState();
    }
  }

  private updateWeather() {
    for (const p of this.weatherParticles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y > 600) {
        p.y = 0;
        p.x = Math.random() * 800;
      }
      if (p.x < 0) p.x = 800;
      if (p.x > 800) p.x = 0;
    }
  }

  private checkClimbing() {
    let nearTrunk = false;
    for (const p of this.platforms) {
      if (p.type === 'trunk') {
        if (
          this.player.x >= p.x - 15 &&
          this.player.x <= p.x + p.w + 15 &&
          this.player.y >= p.y - 10 &&
          this.player.y <= p.y + p.h + 20
        ) {
          nearTrunk = true;
          break;
        }
      }
    }

    if (nearTrunk && (this.keys.up || this.player.isClimbing)) {
      this.player.isClimbing = true;
      this.player.isGrounded = false;
    } else {
      this.player.isClimbing = false;
    }
  }

  private checkPlatformCollisions() {
    const wasGrounded = this.player.isGrounded;
    this.player.isGrounded = false;

    for (const plat of this.platforms) {
      if (plat.type === 'trunk') continue;

      if (
        this.player.x >= plat.x - 10 &&
        this.player.x <= plat.x + plat.w + 10 &&
        this.player.vy >= 0 &&
        this.player.y >= plat.y - 12 &&
        this.player.y <= plat.y + 14
      ) {
        if (plat.type === 'thorns' && !this.player.isBurrowed) {
          this.hurtPlayer();
        }

        this.player.y = plat.y - 12;
        this.player.vy = 0;
        this.player.isGrounded = true;
        break;
      }
    }

    if (this.player.y >= 418 && !this.player.isBurrowed) {
      this.player.y = 418;
      this.player.vy = 0;
      this.player.isGrounded = true;
    }

    if (!wasGrounded && this.player.isGrounded) {
      this.player.squashX = 1.35;
      this.player.squashY = 0.72;
      soundEngine.playLand();

      if (this.player.jumpBufferTimer > 0) {
        this.triggerJumpOrAmbush();
      }
    } else if (wasGrounded && !this.player.isGrounded && this.player.vy >= 0) {
      this.player.coyoteTimer = 6;
    }

    if (this.boss && this.boss.barrierActive) {
      if (this.player.x >= this.boss.barrierX - 12 && this.player.x <= this.boss.barrierX + 24) {
        this.player.x = this.boss.barrierX - 12;
        this.player.vx = 0;
      }
    }
  }

  // FORGIVING ENEMY STOMP HITBOXES (+25-30% extended stomp detection)
  private updateEnemies() {
    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;

      enemy.animTimer += 0.1;
      enemy.x += enemy.vx;

      if (enemy.x <= enemy.patrolMin) {
        enemy.x = enemy.patrolMin;
        enemy.vx = Math.abs(enemy.vx);
        enemy.facing = 1;
      } else if (enemy.x >= enemy.patrolMax) {
        enemy.x = enemy.patrolMax;
        enemy.vx = -Math.abs(enemy.vx);
        enemy.facing = -1;
      }

      if (enemy.type === 'bird') {
        enemy.y += Math.sin(enemy.animTimer * 2) * 1.2;
      }

      if (this.player.invulnerableTimer <= 0) {
        if (this.player.isBurrowed) continue;

        // FULL VISUAL BOUNDING RECTANGLE (explicitly includes legs, head, and tail span)
        const enemyHalfWidth = enemy.width / 2;
        const enemyHalfHeight = enemy.height / 2;
        const enemyLeft = enemy.x - enemyHalfWidth;
        const enemyRight = enemy.x + enemyHalfWidth;
        const enemyTop = enemy.y - enemyHalfHeight;
        const enemyBottom = enemy.y + enemyHalfHeight;

        // Worm full body frame (head & contact segments)
        const wormRadius = 12;
        const wormLeft = this.player.x - wormRadius;
        const wormRight = this.player.x + wormRadius;
        const wormTop = this.player.y - 10;
        const wormBottom = this.player.y + 10;

        // 1. HORIZONTAL LANDING COVERAGE:
        // Allow stomp to succeed if worm's horizontal bounds overlap ANY part of enemy's total width (front legs to back legs)
        const isHorizontalOverlap = wormRight >= enemyLeft && wormLeft <= enemyRight;

        // 2. VERTICAL STOMP ZONE:
        // Register successful stomp if worm is moving downwards (vy >= 0)
        // and its bottom touches or overlaps the top 40% height zone of the enemy's bounding box
        const isMovingDownwards = this.player.vy >= 0;
        const top40Boundary = enemyTop + enemy.height * 0.40;
        const isTouchingTop40Zone = wormBottom >= enemyTop - 6 &&
                                   wormBottom <= top40Boundary + Math.max(0, this.player.vy);

        if (isMovingDownwards && isHorizontalOverlap && isTouchingTop40Zone) {
          // Stomp attack landed successfully!
          enemy.hp--;
          this.player.vy = -11.0; // Clean, high bounce
          this.player.squashX = 0.82;
          this.player.squashY = 1.28;
          soundEngine.playEnemyDefeat();
          triggerHaptic('tap', this.hapticsEnabled);
          this.handleEnemyDefeat(enemy, 'STOMP');
          continue;
        }

        // 3. BOTTOM HEADBUTT ATTACK (FOR AIRBORNE / ELEVATED ENEMIES: BIRDS & SPIDERS):
        // If worm is jumping upwards (vy < 0) and hits the bottom edge/underside of the enemy bounding box
        const isJumpingUpwards = this.player.vy < 0;
        const isHeadbuttableEnemy = enemy.type === 'bird' || enemy.type === 'spider';
        const bottom40Boundary = enemyBottom - enemy.height * 0.40;
        const isTouchingBottomZone = wormTop <= enemyBottom + 6 &&
                                    wormTop >= bottom40Boundary + Math.min(0, this.player.vy);

        if (isHeadbuttableEnemy && isJumpingUpwards && isHorizontalOverlap && isTouchingBottomZone) {
          // Headbutt attack executed from below!
          enemy.hp--;
          this.player.vy = 4.0; // Downward rebound
          this.player.squashX = 1.35;
          this.player.squashY = 0.75;
          soundEngine.playEnemyDefeat();
          triggerHaptic('tap', this.hapticsEnabled);
          this.addFloatingText(enemy.x, enemy.y + 10, '!HEADBUTT!', '#00e5ff', 1.3);
          this.handleEnemyDefeat(enemy, 'HEADBUTT');
          continue;
        }

        // 4. FULL BOUNDING RECTANGLE BODY/SIDE COLLISION:
        // Horizontal contact from left or right sides strictly inflicts damage on the worm
        const isVerticalOverlap = wormBottom >= enemyTop && wormTop <= enemyBottom;
        if (isHorizontalOverlap && isVerticalOverlap) {
          this.hurtPlayer();
        }
      }
    }
  }

  private updateBoss() {
    if (!this.boss || !this.boss.active || this.boss.defeated) return;

    this.boss.animTimer += 0.05;
    if (this.boss.hitFlash > 0) this.boss.hitFlash--;

    const boss = this.boss;
    boss.stateTimer++;

    switch (this.currentStage.id) {
      case 1:
        boss.x += boss.vx;
        boss.facing = boss.vx > 0 ? 1 : -1;
        if (boss.x < this.currentStage.bossArenaX + 80) boss.vx = 2.65;
        else if (boss.x > boss.barrierX - 80) boss.vx = -2.65;
        boss.y = 390;
        break;

      case 2:
        boss.x += boss.vx;
        boss.y = 230 + Math.sin(boss.animTimer * 2.2) * 55;
        if (boss.x < this.currentStage.bossArenaX + 80) { boss.vx = 3.3; boss.facing = 1; }
        else if (boss.x > boss.barrierX - 80) { boss.vx = -3.3; boss.facing = -1; }
        if (boss.stateTimer % 108 === 0) {
          this.projectiles.push({
            id: this.nextProjId++,
            x: boss.x,
            y: boss.y + 20,
            vx: 0,
            vy: 5.3,
            radius: 5,
            isPlayer: false,
            color: '#fbc02d',
            lifetime: 80,
          });
        }
        break;

      case 3:
        if (boss.stateTimer % 210 < 95) {
          boss.y = 445;
          boss.x += boss.vx * 1.65;
          if (Math.random() < 0.25) this.spawnSandMound(boss.x, 420, 8);
        } else {
          boss.y = 395;
          boss.x += boss.vx * 0.9;
        }
        if (boss.x < this.currentStage.bossArenaX + 80) boss.vx = 2.0;
        if (boss.x > boss.barrierX - 80) boss.vx = -2.0;
        break;

      case 4:
        boss.x += boss.vx;
        boss.y = 260 + Math.cos(boss.animTimer * 2.2) * 75;
        if (boss.x < this.currentStage.bossArenaX + 80) boss.vx = 2.2;
        if (boss.x > boss.barrierX - 80) boss.vx = -2.2;
        if (boss.stateTimer % 115 === 0) {
          const dir = this.player.x < boss.x ? -1 : 1;
          this.projectiles.push({
            id: this.nextProjId++,
            x: boss.x,
            y: boss.y + 10,
            vx: dir * 5.0,
            vy: 2.6,
            radius: 8,
            isPlayer: false,
            color: '#e0e0e0',
            lifetime: 90,
          });
        }
        break;

      case 5:
        if (boss.stateTimer % 170 < 110) {
          boss.x += boss.vx * 1.55;
          boss.y = 220 + Math.sin(boss.animTimer * 3.0) * 65;
        } else {
          boss.y = 390;
          boss.x += boss.vx * 0.35;
        }
        if (boss.x < this.currentStage.bossArenaX + 90) boss.vx = 3.2;
        if (boss.x > boss.barrierX - 90) boss.vx = -3.2;
        break;

      case 6:
        if (boss.phase === 1) {
          boss.y = 385;
          boss.x += boss.vx;
          if (boss.x < this.currentStage.bossArenaX + 80) boss.vx = 3.85;
          if (boss.x > boss.barrierX - 80) boss.vx = -3.85;
        } else {
          boss.y = 240 + Math.sin(boss.animTimer * 2.4) * 55;
          boss.x += boss.vx;
          if (boss.x < this.currentStage.bossArenaX + 80) boss.vx = 3.65;
          if (boss.x > boss.barrierX - 80) boss.vx = -3.65;

          if (boss.stateTimer % 90 === 0) {
            this.projectiles.push({
              id: this.nextProjId++,
              x: boss.x,
              y: boss.y + 10,
              vx: (this.player.x < boss.x ? -1 : 1) * 6.0,
              vy: 3.0,
              radius: 6,
              isPlayer: false,
              color: '#d500f9',
              lifetime: 90,
            });
          }
        }
        break;
    }

    if (this.player.invulnerableTimer <= 0) {
      if (!this.player.isBurrowed) {
        const bossHalfW = boss.width / 2;
        const bossHalfH = boss.height / 2;
        const bossLeft = boss.x - bossHalfW;
        const bossRight = boss.x + bossHalfW;
        const bossTop = boss.y - bossHalfH;
        const bossBottom = boss.y + bossHalfH;

        const wormRadius = 14;
        const wormLeft = this.player.x - wormRadius;
        const wormRight = this.player.x + wormRadius;
        const wormTop = this.player.y - 12;
        const wormBottom = this.player.y + 12;

        const isHorizontalOverlap = wormRight >= bossLeft && wormLeft <= bossRight;

        // 1. STOMP ATTACK FROM ABOVE (vy >= 0 landing on top 40% height zone)
        const isMovingDownwards = this.player.vy >= 0;
        const top40Boundary = bossTop + boss.height * 0.40;
        const isTouchingTop40 = wormBottom >= bossTop - 8 &&
                                wormBottom <= top40Boundary + Math.max(0, this.player.vy);

        if (isMovingDownwards && isHorizontalOverlap && isTouchingTop40) {
          this.player.vy = -12.0; // Clean high bounce
          this.player.squashX = 0.82;
          this.player.squashY = 1.28;
          soundEngine.playEnemyDefeat();
          triggerHaptic('tap', this.hapticsEnabled);
          this.addFloatingText(boss.x, boss.y - 30, '!STOMP HIT!', '#ffd700', 1.3);
          this.hitBoss(1, false);
          return;
        }

        // 2. BOTTOM HEADBUTT ATTACK (FOR AIR/ELEVATED BOSSES: GIANT SPIDER, WASP, CROW)
        const isHeadbuttableBoss = boss.name.includes('Spider') || this.currentStage.id === 4 || this.currentStage.id === 2 || this.currentStage.id === 5;
        const isJumpingUpwards = this.player.vy < 0;
        const bottom40Boundary = bossBottom - boss.height * 0.40;
        const isTouchingBottom40 = wormTop <= bossBottom + 8 &&
                                  wormTop >= bottom40Boundary + Math.min(0, this.player.vy);

        if (isHeadbuttableBoss && isJumpingUpwards && isHorizontalOverlap && isTouchingBottom40) {
          this.player.vy = 4.5; // Downward rebound
          this.player.squashX = 1.35;
          this.player.squashY = 0.75;
          soundEngine.playEnemyDefeat();
          triggerHaptic('tap', this.hapticsEnabled);
          this.addFloatingText(boss.x, boss.y + 20, '!HEADBUTT HIT!', '#00e5ff', 1.4);
          this.hitBoss(1, false);
          return;
        }

        // 3. SIDE / BODY COLLISION:
        // Horizontal contact without stomp or headbutt inflicts damage on the worm
        const isVerticalOverlap = wormBottom >= bossTop && wormTop <= bossBottom;
        if (isHorizontalOverlap && isVerticalOverlap) {
          this.hurtPlayer();
        }
      } else {
        // Subterranean boss check while burrowed
        if (boss.y > 420) {
          const bRad = boss.width * 0.45;
          const dist = Math.hypot(boss.x - this.player.x, boss.y - this.player.y);
          if (dist < 15 + bRad) {
            this.hurtPlayer();
          }
        }
      }
    }
  }

  public hitBoss(damage: number, isAmbush: boolean = false) {
    if (!this.boss || !this.boss.active || this.boss.defeated) return;

    if (this.currentStage.id === 1 && !isAmbush) {
      const isHittingFront = (this.player.facing === 1 && this.boss.facing === -1) ||
                             (this.player.facing === -1 && this.boss.facing === 1);
      if (isHittingFront) {
        soundEngine.playArmorClink();
        this.addFloatingText(this.boss.x, this.boss.y - 20, 'BLOCKED! AMBUSH FROM BELOW!', '#e0e0e0');
        return;
      }
    }

    this.boss.hp -= damage;
    this.boss.hitFlash = 12;
    soundEngine.playBossHit();
    triggerHaptic('ambush', this.hapticsEnabled);
    this.screenShake = 10;
    this.score += 200 * damage;
    this.addFloatingText(this.boss.x, this.boss.y - 25, `-${damage} HP!`, '#ff1744', 1.2);

    if (this.currentStage.id === 6 && this.boss.hp <= 4 && this.boss.phase === 1) {
      this.boss.phase = 2;
      this.boss.hitFlash = 25;
      this.addFloatingText(this.boss.x, 200, 'PHASE 2: JET WINGS UNFOLD!', '#d500f9', 1.3);
      this.screenShake = 16;
      soundEngine.playPhaseTransition();
    }

    if (this.boss.hp <= 0) {
      this.boss.hp = 0;
      this.boss.defeated = true;
      this.boss.active = false;
      this.boss.barrierActive = false;
      soundEngine.playBossDefeat();
      triggerHaptic('boss_defeat', this.hapticsEnabled);
      this.screenShake = 22;
      this.score += 2000;
      this.addFloatingText(this.boss.x, 240, 'BOSS DEFEATED! +2000', '#ffd700', 1.4);

      for (let i = 0; i < 60; i++) {
        this.particles.push({
          x: this.boss.x + (Math.random() - 0.5) * 40,
          y: this.boss.y + (Math.random() - 0.5) * 30,
          vx: (Math.random() - 0.5) * 12,
          vy: (Math.random() - 0.5) * 12 - 3,
          color: ['#ff1744', '#ffea00', '#ff9100', '#76ff03', '#00e5ff'][Math.floor(Math.random() * 5)],
          size: Math.random() * 7 + 4,
          alpha: 1,
          decay: 0.02,
          gravity: 0.2,
          shape: 'sparkle',
        });
      }

      for (let i = 0; i < 30; i++) {
        this.particles.push({
          x: this.boss.barrierX + (Math.random() - 0.5) * 20,
          y: 350 + Math.random() * 80,
          vx: (Math.random() - 0.5) * 6,
          vy: -Math.random() * 5 - 1,
          color: '#558b2f',
          size: Math.random() * 4 + 3,
          alpha: 1,
          decay: 0.03,
          shape: 'leaf',
        });
      }
    }

    this.notifyState();
  }

  private updateProjectiles() {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.isMega ? 0.03 : 0.08;
      p.lifetime--;

      if (Math.random() < (p.isMega ? 0.7 : 0.4)) {
        this.particles.push({
          x: p.x,
          y: p.y,
          vx: -p.vx * 0.15,
          vy: (Math.random() - 0.5) * 2,
          color: p.color,
          size: p.radius * 0.5,
          alpha: 0.7,
          decay: 0.06,
        });
      }

      if (p.y >= 430) {
        this.spawnWaterSplash(p.x, 425);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.lifetime <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.isPlayer) {
        let destroyed = false;
        for (const enemy of this.enemies) {
          if (!enemy.isAlive) continue;
          const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
          if (dist < p.radius + enemy.width * 0.45) {
            enemy.hp -= p.isMega ? 3 : 1;
            soundEngine.playEnemyDefeat();
            triggerHaptic('tap', this.hapticsEnabled);
            this.spawnWaterSplash(p.x, p.y);
            this.handleEnemyDefeat(enemy, p.isMega ? 'MEGA' : 'WATER');

            if (p.penetrations !== undefined) {
              p.penetrations--;
              if (p.penetrations <= 0) destroyed = true;
            } else {
              destroyed = true;
            }
            if (destroyed) break;
          }
        }

        if (!destroyed && this.boss && this.boss.active && !this.boss.defeated) {
          const bDist = Math.hypot(this.boss.x - p.x, this.boss.y - p.y);
          if (bDist < p.radius + this.boss.width * 0.45) {
            this.hitBoss(p.isMega ? 2 : 1, false);
            this.spawnWaterSplash(p.x, p.y);
            destroyed = true;
          }
        }

        if (destroyed) {
          this.projectiles.splice(i, 1);
          continue;
        }
      } else {
        if (this.player.invulnerableTimer <= 0 && !this.player.isBurrowed) {
          const dist = Math.hypot(this.player.x - p.x, this.player.y - p.y);
          if (dist < p.radius + 14) {
            this.hurtPlayer();
            this.projectiles.splice(i, 1);
            continue;
          }
        }
      }
    }
  }

  private updateCollectibles() {
    for (const c of this.collectibles) {
      if (c.collected) continue;

      c.wobble += 0.05;
      const dist = Math.hypot(c.x - this.player.x, c.y - this.player.y);

      if (dist < 26) {
        c.collected = true;

        switch (c.type) {
          case 'yellow_shroom':
            this.score += 100;
            this.mushroomsCollected++;
            soundEngine.playPickupMushroom();
            triggerHaptic('pickup', this.hapticsEnabled);
            this.addFloatingText(c.x, c.y - 15, '+100', '#ffd54f');
            this.spawnCollectFX(c.x, c.y, '#ffd54f');
            break;

          case 'purple_shroom':
            this.score += 300;
            this.mushroomsCollected++;
            this.player.speedBuffTimer = 8;
            soundEngine.playSuperMushroom();
            triggerHaptic('pickup', this.hapticsEnabled);
            this.addFloatingText(c.x, c.y - 15, 'SPEED AURA! +300', '#e040fb');
            this.spawnCollectFX(c.x, c.y, '#e040fb');
            break;

          case 'water_drop':
            this.player.ammo = Math.min(12, this.player.ammo + 3);
            soundEngine.playWaterPickup();
            triggerHaptic('pickup', this.hapticsEnabled);
            this.addFloatingText(c.x, c.y - 15, '+3 WATER 💧', '#40c4ff');
            this.spawnCollectFX(c.x, c.y, '#40c4ff');
            break;

          case 'mega_drop':
            this.player.megaAmmo = Math.min(3, this.player.megaAmmo + 1);
            soundEngine.playMegaDropPickup();
            triggerHaptic('pickup', this.hapticsEnabled);
            this.addFloatingText(c.x, c.y - 20, '!GOLDEN MEGA DROP! 🌟', '#ffd700', 1.2);
            this.spawnCollectFX(c.x, c.y, '#ffd700');
            break;

          case 'golden_shroom':
            this.score += 1000;
            this.mushroomsCollected++;
            this.spawnCollectFX(c.x, c.y, '#ffd700');
            soundEngine.playStageClear();
            triggerHaptic('boss_defeat', this.hapticsEnabled);

            if (this.currentStageIndex >= STAGE_CONFIGS.length - 1) {
              if (this.score > this.highScore) {
                this.highScore = this.score;
                try {
                  localStorage.setItem('pink_worm_highscore', this.highScore.toString());
                } catch {}
              }
              this.setScreen('VICTORY');
            } else {
              this.currentStageIndex++;
              this.loadStage(this.currentStageIndex);
              this.setScreen('INTERMISSION');
            }
            break;
        }

        this.notifyState();
      }
    }
  }

  public hurtPlayer() {
    if (this.player.invulnerableTimer > 0) return;

    this.player.hp--;
    this.player.invulnerableTimer = 75;
    this.screenShake = 14;
    soundEngine.playHurt();
    triggerHaptic('hurt', this.hapticsEnabled);

    for (let i = 0; i < 12; i++) {
      this.particles.push({
        x: this.player.x,
        y: this.player.y,
        vx: (Math.random() - 0.5) * 6,
        vy: -Math.random() * 5 - 2,
        color: '#ff1744',
        size: Math.random() * 4 + 2,
        alpha: 1,
        decay: 0.04,
      });
    }

    if (this.player.hp <= 0) {
      this.player.hp = 0;
      soundEngine.playGameOver();
      if (this.score > this.highScore) {
        this.highScore = this.score;
        try {
          localStorage.setItem('pink_worm_highscore', this.highScore.toString());
        } catch {}
      }
      this.setScreen('GAME_OVER');
    }

    this.notifyState();
  }

  private updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.gravity) p.vy += p.gravity;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  private updateFloatingText() {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy;
      ft.alpha -= 0.02;
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  private addFloatingText(x: number, y: number, text: string, color: string, scale: number = 1.0) {
    this.floatingTexts.push({
      id: this.nextTextId++,
      x,
      y,
      text,
      color,
      alpha: 1,
      vy: -1.2,
      scale,
    });
  }

  private spawnSandMound(x: number, y: number, count: number = 10) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 24,
        y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 4,
        vy: -Math.random() * 3 - 0.5,
        color: Math.random() > 0.5 ? '#8d6e63' : '#bcaaa4',
        size: Math.random() * 4 + 2,
        alpha: 0.85,
        decay: 0.02,
        shape: 'dirt',
      });
    }
  }

  private spawnWaterSplash(x: number, y: number) {
    for (let i = 0; i < 14; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 7,
        vy: -Math.random() * 6 - 1,
        color: '#81d4fa',
        size: Math.random() * 3 + 2,
        alpha: 0.9,
        decay: 0.04,
        gravity: 0.2,
      });
    }
  }

  private spawnEnemyDefeatFX(x: number, y: number) {
    for (let i = 0; i < 20; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8 - 2,
        color: ['#ffca28', '#ff7043', '#ffffff'][Math.floor(Math.random() * 3)],
        size: Math.random() * 5 + 2,
        alpha: 1,
        decay: 0.035,
        gravity: 0.2,
        shape: 'sparkle',
      });
    }
  }

  private spawnCollectFX(x: number, y: number, color: string) {
    for (let i = 0; i < 16; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5 - 1.5,
        color,
        size: Math.random() * 4 + 2,
        alpha: 1,
        decay: 0.035,
        shape: 'sparkle',
      });
    }
  }

  // ==============================================================
  // RENDERING ENGINE (2.5D Volumetric Shading & Dynamic Shadows)
  // ==============================================================
  public render() {
    const ctx = this.ctx;
    const w = this.screenWidth;
    const h = this.screenHeight;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    (ctx as any).mozImageSmoothingEnabled = false;
    (ctx as any).webkitImageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);

    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // 1. SKY & CLOUDS
    this.renderSky(ctx, w, h);

    // 2. PARALLAX DISTANT HILLS
    this.renderDistantMountains(ctx, w, h);

    // Camera transform for world objects
    ctx.save();
    ctx.translate(-Math.round(this.cameraX), 0);

    // 3. TERRAIN: UNDERGROUND SOIL LAYER
    this.renderUndergroundLayer(ctx);

    // 4. PLATFORMS & TREE CANOPIES
    this.renderPlatformsAndTrees(ctx);

    // 5. BOSS BARRIER
    this.renderBossBarrier(ctx);

    // 6. COLLECTIBLES WITH DYNAMIC SHADOWS
    this.renderCollectibles(ctx);

    // 7. ENEMIES & BOSS WITH DYNAMIC SHADOWS & 2.5D SHADING
    this.renderEnemies(ctx);
    this.renderBoss(ctx);

    // 8. PLAYER (CUTE PINK WORM with 2.5D volumetric shading)
    this.renderPlayer(ctx);

    // 9. PROJECTILES
    this.renderProjectiles(ctx);

    // 10. PARTICLES & FLOATING TEXTS
    this.renderParticles(ctx);
    this.renderFloatingTexts(ctx);

    ctx.restore(); // Restore world camera

    // 11. WEATHER OVERLAYS & VIGNETTES
    this.renderWeatherOverlay(ctx, w, h);

    // 12. CANVAS-BASED PROMINENT BOSS HEALTH BAR
    this.renderCanvasBossBar(ctx, w);

    // 13. DRAMATIC 'BOSS APPEARING' SCREEN WARNING & ANIMATION
    this.renderBossAppearingWarning(ctx, w, h);

    ctx.restore(); // Restore screen shake
  }

  // COMPACT & FAST 1-SECOND RETRO PIXEL BOSS WARNING BANNER
  private renderBossAppearingWarning(ctx: CanvasRenderingContext2D, w: number, _h: number) {
    if (this.bossWarningTimer <= 0 || !this.boss) return;

    ctx.save();
    // 60 frames max duration (1 second total)
    const timer = this.bossWarningTimer;
    const fade = timer < 10 ? timer / 10 : 1;

    // 2-flash high-contrast punchy strobe (frames 60-30 = flash 1, 30-10 = flash 2)
    const isFlashRed = (Math.floor(timer / 15) % 2 === 0);
    const bgColor = isFlashRed ? '#ef4444' : '#facc15';
    const textColor = isFlashRed ? '#ffffff' : '#000000';
    const borderColor = '#000000';

    // Compact dimensions: only 44px height (7.3% of 600px canvas height, safely above play area)
    const bannerW = Math.min(460, w * 0.88);
    const bannerH = 44;
    const bannerX = Math.floor((w - bannerW) / 2);
    const bannerY = 56;

    ctx.globalAlpha = fade;

    // Pixel box shadow (4px 4px 0px #000)
    ctx.fillStyle = '#000000';
    ctx.fillRect(bannerX + 4, bannerY + 4, bannerW, bannerH);

    // Thick chunky 4px black pixel border
    ctx.fillStyle = borderColor;
    ctx.fillRect(bannerX, bannerY, bannerW, bannerH);

    // Flashing inner background
    ctx.fillStyle = bgColor;
    ctx.fillRect(bannerX + 4, bannerY + 4, bannerW - 8, bannerH - 8);

    // Pixelated Hazard Corners
    ctx.fillStyle = isFlashRed ? '#fde047' : '#b91c1c';
    ctx.fillRect(bannerX + 6, bannerY + 6, 8, 8);
    ctx.fillRect(bannerX + bannerW - 14, bannerY + 6, 8, 8);
    ctx.fillRect(bannerX + 6, bannerY + bannerH - 14, 8, 8);
    ctx.fillRect(bannerX + bannerW - 14, bannerY + bannerH - 14, 8, 8);

    // Sharp Retro Pixel Text (Press Start 2P / monospace)
    ctx.font = 'bold 13px "Press Start 2P", monospace';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`! WARNING: ${this.boss.name.toUpperCase()} !`, w / 2, bannerY + bannerH / 2);

    ctx.restore();
  }

  // 16-BIT RETRO PIXEL CANVAS BOSS HEALTH BAR
  private renderCanvasBossBar(ctx: CanvasRenderingContext2D, w: number) {
    if (!this.boss || !this.boss.active || this.boss.defeated) return;

    ctx.save();
    const barW = Math.min(460, w * 0.82);
    const barH = 22;
    const barX = Math.floor((w - barW) / 2);
    const barY = 20;

    // 4px 4px pixel drop shadow
    ctx.fillStyle = '#000000';
    ctx.fillRect(barX - 4 + 4, barY - 14 + 4, barW + 8, barH + 26);

    // Black pixel container with thick 3px border
    ctx.fillStyle = '#000000';
    ctx.fillRect(barX - 4, barY - 14, barW + 8, barH + 26);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(barX - 1, barY - 11, barW + 2, barH + 20);

    // Boss Name & HP text in pixel font
    ctx.font = 'bold 10px "Press Start 2P", monospace';
    ctx.fillStyle = '#f87171';
    ctx.textAlign = 'left';
    ctx.fillText(`BOSS: ${this.boss.name.toUpperCase()}`, barX + 4, barY - 2);

    ctx.fillStyle = '#fde047';
    ctx.textAlign = 'right';
    ctx.fillText(`${this.boss.hp}/${this.boss.maxHp}`, barX + barW - 4, barY - 2);

    // Health track with pixel borders
    ctx.fillStyle = '#000000';
    ctx.fillRect(barX, barY + 4, barW, barH);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(barX + 2, barY + 6, barW - 4, barH - 4);

    // Blocky health gradient fill
    const fillPercent = Math.max(0, this.boss.hp / this.boss.maxHp);
    const fillW = Math.floor((barW - 4) * fillPercent);

    if (fillW > 0) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(barX + 2, barY + 6, fillW, barH - 4);
      // Top 16-bit highlight line
      ctx.fillStyle = '#fca5a5';
      ctx.fillRect(barX + 2, barY + 6, fillW, 3);
    }

    ctx.restore();
  }

  // ==============================================================
  // RETRO 16-BIT PIXEL ART RENDERING ENGINE
  // ==============================================================

  // Pixel Art Primitives (Integer-aligned 16-bit arcade rendering)
  private pRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string) {
    ctx.fillStyle = col;
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  }

  // Dithered checkerboard shading for 2.5D retro depth
  private pDither(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, colA: string, colB: string, pSize: number = 2) {
    const rx = Math.floor(x);
    const ry = Math.floor(y);
    const rw = Math.floor(w);
    const rh = Math.floor(h);
    ctx.fillStyle = colA;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.fillStyle = colB;
    for (let py = ry; py < ry + rh; py += pSize) {
      const offset = (Math.floor((py - ry) / pSize) % 2) * pSize;
      for (let px = rx + offset; px < rx + rw; px += pSize * 2) {
        ctx.fillRect(px, py, pSize, Math.min(pSize, ry + rh - py));
      }
    }
  }

  private renderSky(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const theme = this.currentStage.theme;
    
    // 16-bit stepped sky bands with dither transitions
    const bands = 6;
    const bandH = Math.ceil((h * 0.72) / bands);
    for (let b = 0; b < bands; b++) {
      const y = b * bandH;
      const isTop = b < bands / 2;
      const col = isTop ? theme.skyTop : theme.skyBottom;
      this.pRect(ctx, 0, y, w, bandH, col);
      // Dither seam between bands
      if (b > 0) {
        this.pDither(ctx, 0, y - 4, w, 8, isTop ? theme.skyTop : theme.skyBottom, isTop ? theme.skyBottom : theme.skyTop, 2);
      }
    }

    // 16-bit arcade clouds with dark outline and dithered underbelly
    if (this.currentStage.weather !== 'dark_maze') {
      for (let i = 0; i < 5; i++) {
        const cloudBaseX = Math.floor(((i * 220 + this.cloudTimer * 20 - this.cameraX * 0.08) % (w + 200)) - 100);
        const cloudY = Math.floor(45 + (i % 3) * 35);
        this.drawPixelCloud(ctx, cloudBaseX, cloudY, 44 + (i % 2) * 16);
      }
    }
  }

  private drawPixelCloud(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
    const h = Math.floor(w * 0.42);
    // Dark pixel outline
    this.pRect(ctx, x + 4, y, w - 8, h, '#334155');
    this.pRect(ctx, x, y + 4, w, h - 8, '#334155');
    this.pRect(ctx, x + 8, y - 6, w * 0.6, h, '#334155');
    // White cloud body
    this.pRect(ctx, x + 6, y + 2, w - 12, h - 4, '#ffffff');
    this.pRect(ctx, x + 2, y + 6, w - 4, h - 12, '#ffffff');
    this.pRect(ctx, x + 10, y - 4, w * 0.6 - 4, h - 4, '#ffffff');
    // Dithered grey underside shadow
    this.pDither(ctx, x + 4, y + h - 8, w - 8, 6, '#ffffff', '#cbd5e1', 2);
  }

  private renderDistantMountains(ctx: CanvasRenderingContext2D, w: number, _h: number) {
    const theme = this.currentStage.theme;

    // Distant mountain ridge (far)
    ctx.fillStyle = theme.forestColor;
    const step = 6;
    for (let x = 0; x <= w; x += step) {
      const worldX = x + this.cameraX * 0.15;
      const mH = Math.floor(Math.sin(worldX * 0.005) * 50 + Math.cos(worldX * 0.012) * 30);
      const topY = 340 - mH;
      ctx.fillRect(x, topY, step, 420 - topY);
    }

    // Near mountain ridge (midground)
    ctx.fillStyle = theme.hillColor;
    for (let x = 0; x <= w; x += step) {
      const worldX = x + this.cameraX * 0.35;
      const mH = Math.floor(Math.sin(worldX * 0.008 + 1) * 28 + Math.cos(worldX * 0.02) * 18);
      const topY = 380 - mH;
      ctx.fillRect(x, topY, step, 420 - topY);
    }
  }

  private renderUndergroundLayer(ctx: CanvasRenderingContext2D) {
    const theme = this.currentStage.theme;
    const lvlW = this.currentStage.levelWidth;

    // Layer 1: Top soil
    this.pRect(ctx, 0, 420, lvlW, 70, theme.dirtColor);
    // Dither transition
    this.pDither(ctx, 0, 480, lvlW, 16, theme.dirtColor, theme.subsoilColor, 2);
    // Layer 2: Deep subsoil
    this.pRect(ctx, 0, 496, lvlW, 110, theme.subsoilColor);

    // Persistent player dig tracks (pixel excavation)
    if (this.digTracks.length > 0) {
      ctx.fillStyle = '#0f0a06';
      for (const dt of this.digTracks) {
        const rad = Math.floor(dt.r);
        for (let dy = -rad; dy <= rad; dy += 2) {
          const rowW = Math.floor(Math.sqrt(Math.max(0, rad * rad - dy * dy)));
          ctx.fillRect(Math.floor(dt.x - rowW), Math.floor(dt.y + dy), rowW * 2, 2);
        }
      }
    }

    // Embedded 16-bit rock nuggets & root minerals
    for (let x = 30; x < lvlW; x += 80) {
      const ny = 450 + ((x * 17) % 110);
      const nSize = 4 + ((x * 7) % 6);
      this.pRect(ctx, x, ny, nSize, nSize, '#1b120c'); // Rock shadow
      this.pRect(ctx, x + 1, ny + 1, nSize - 2, nSize - 2, '#4e342e'); // Rock body
      this.pRect(ctx, x + 1, ny + 1, 2, 2, '#8d6e63'); // Rock highlight
    }

    // 16-bit pixel grass surface boundary
    this.pRect(ctx, 0, 416, lvlW, 4, theme.grassColor);
    this.pRect(ctx, 0, 420, lvlW, 2, '#1b5e20');

    // Animated swaying pixel grass blades (3 distinct blade heights)
    const bladeStep = 6;
    for (let x = 0; x < lvlW; x += bladeStep) {
      const sway = Math.floor(Math.sin(this.cloudTimer * 4 + x * 0.1) * 2);
      const hType = (x / bladeStep) % 3;
      const bH = hType === 0 ? 9 : hType === 1 ? 13 : 7;
      const col = hType === 1 ? '#8bc34a' : '#4caf50';
      // Grass blade
      this.pRect(ctx, x, 416 - bH, 2, bH, col);
      this.pRect(ctx, x + sway, 416 - bH, 2, 3, '#c5e1a5'); // Tip highlight
    }
  }

  private renderPlatformsAndTrees(ctx: CanvasRenderingContext2D) {
    for (const plat of this.platforms) {
      if (plat.type === 'trunk') {
        // 16-bit Pixel Tree Trunk
        this.pRect(ctx, plat.x - 2, plat.y, plat.w + 4, plat.h, '#1b120c'); // Outline
        this.pRect(ctx, plat.x, plat.y, plat.w, plat.h, '#4e342e'); // Bark body
        this.pRect(ctx, plat.x, plat.y, 4, plat.h, '#6d4c41'); // Left highlight strip
        this.pRect(ctx, plat.x + plat.w - 4, plat.y, 4, plat.h, '#271c19'); // Right shadow strip
        // Vertical bark grooves
        for (let y = plat.y + 6; y < plat.y + plat.h - 6; y += 14) {
          this.pRect(ctx, plat.x + 8, y, plat.w - 16, 3, '#271c19');
        }
      } else if (plat.type === 'branch') {
        // 16-bit Pixel Branch
        this.pRect(ctx, plat.x - 2, plat.y - 2, plat.w + 4, plat.h + 4, '#1b120c'); // Outline
        this.pRect(ctx, plat.x, plat.y, plat.w, plat.h, '#5d4037'); // Wood core
        this.pRect(ctx, plat.x, plat.y, plat.w, 3, '#8d6e63'); // Top highlight
        this.pRect(ctx, plat.x, plat.y + plat.h - 3, plat.w, 3, '#3e2723'); // Bottom shade

        // Pixel leaf foliage tufts on top of branch
        for (let lx = plat.x; lx < plat.x + plat.w; lx += 12) {
          this.pRect(ctx, lx, plat.y - 6, 10, 6, '#1b5e20'); // Leaf outline
          this.pRect(ctx, lx + 2, plat.y - 5, 6, 4, '#4caf50'); // Leaf body
          this.pRect(ctx, lx + 3, plat.y - 5, 3, 2, '#81c784'); // Leaf highlight
        }
      } else if (plat.type === 'rock') {
        // 16-bit Chiseled Stone Platform
        this.pRect(ctx, plat.x - 2, plat.y - 2, plat.w + 4, plat.h + 4, '#1b120c'); // Outline
        this.pRect(ctx, plat.x, plat.y, plat.w, plat.h, '#546e7a'); // Stone core
        this.pRect(ctx, plat.x, plat.y, plat.w, 4, '#90a4ae'); // Chiseled top edge
        this.pRect(ctx, plat.x + plat.w - 4, plat.y, 4, plat.h, '#263238'); // Right shadow
        // Stone texture chips
        this.pRect(ctx, plat.x + 8, plat.y + 6, 6, 3, '#37474f');
        this.pRect(ctx, plat.x + plat.w - 14, plat.y + 8, 5, 3, '#37474f');
      } else if (plat.type === 'thorns') {
        // 16-bit Sharp Pixel Thorns
        this.pRect(ctx, plat.x, plat.y, plat.w, plat.h, '#1b120c');
        for (let tx = plat.x; tx < plat.x + plat.w; tx += 10) {
          // Sharp pixel spike
          this.pRect(ctx, tx + 4, plat.y - 8, 2, 8, '#b71c1c');
          this.pRect(ctx, tx + 3, plat.y - 6, 4, 6, '#d32f2f');
          this.pRect(ctx, tx + 2, plat.y - 3, 6, 3, '#ef5350');
          this.pRect(ctx, tx + 4, plat.y - 8, 1, 3, '#ffffff'); // Glint
        }
      }
    }
  }

  private renderBossBarrier(ctx: CanvasRenderingContext2D) {
    if (!this.boss || !this.boss.barrierActive) return;

    const x = Math.floor(this.boss.barrierX);
    // 16-bit thorny vine barrier
    this.pRect(ctx, x - 6, 260, 12, 165, '#0d2810'); // Dark vine stalk outline
    this.pRect(ctx, x - 4, 260, 8, 165, '#2e7d32'); // Vine stalk
    this.pRect(ctx, x - 2, 260, 3, 165, '#4caf50'); // Stalk highlight

    // Jagged crimson barbs on vine
    for (let y = 270; y < 420; y += 18) {
      // Left barb
      this.pRect(ctx, x - 14, y, 8, 3, '#b71c1c');
      this.pRect(ctx, x - 12, y - 2, 4, 2, '#ef5350');
      // Right barb
      this.pRect(ctx, x + 6, y + 8, 8, 3, '#b71c1c');
      this.pRect(ctx, x + 8, y + 6, 4, 2, '#ef5350');
    }
  }

  // DYNAMIC GROUND SHADOW HELPER (computes nearest platform or ground beneath entity)
  private getSurfaceY(x: number, y: number): number {
    let surfaceY = 422;
    for (const plat of this.platforms) {
      if (plat.type === 'trunk') continue;
      if (x >= plat.x - 12 && x <= plat.x + plat.w + 12) {
        if (plat.y >= y - 5 && plat.y < surfaceY) {
          surfaceY = plat.y - 2;
        }
      }
    }
    return surfaceY;
  }

  // DYNAMIC 16-BIT RETRO DITHERED GROUND SHADOW
  private renderEntityShadow(ctx: CanvasRenderingContext2D, entityX: number, entityY: number, _defaultGroundY: number, baseRadius: number) {
    const surfaceY = this.getSurfaceY(entityX, entityY);
    const height = Math.max(0, surfaceY - entityY);
    const scale = Math.max(0.25, 1 - height / 220);
    const rW = Math.max(4, Math.floor(baseRadius * scale));
    const rH = Math.max(2, Math.floor(baseRadius * 0.32 * scale));
    const centerX = Math.floor(entityX);
    const centerY = Math.floor(surfaceY);

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    const pSize = 2;
    for (let dy = -rH; dy <= rH; dy += pSize) {
      const rowW = Math.floor(rW * Math.sqrt(Math.max(0, 1 - (dy * dy) / (rH * rH))));
      const isAlt = Math.floor(dy / pSize) % 2 === 0;
      for (let dx = -rowW; dx <= rowW; dx += pSize * 2) {
        ctx.fillRect(centerX + dx + (isAlt ? 0 : pSize), centerY + dy, pSize, pSize);
      }
    }
    ctx.restore();
  }

  // 16-BIT RETRO PIXEL COLLECTIBLES
  private renderCollectibles(ctx: CanvasRenderingContext2D) {
    for (const c of this.collectibles) {
      if (c.collected) continue;

      const bobY = Math.floor(Math.sin(c.wobble) * 4);
      this.renderEntityShadow(ctx, c.x, c.y + bobY, 422, c.type === 'golden_shroom' ? 22 : 10);

      if (c.type === 'yellow_shroom') {
        this.drawPixelMushroom(ctx, c.x, c.y + bobY, '#fbc02d', '#fff9c4');
      } else if (c.type === 'purple_shroom') {
        this.drawPixelMushroom(ctx, c.x, c.y + bobY, '#ab47bc', '#f3e5f5');
      } else if (c.type === 'water_drop') {
        this.drawPixelWaterDrop(ctx, c.x, c.y + bobY, '#00e5ff', '#0288d1');
      } else if (c.type === 'mega_drop') {
        this.drawPixelWaterDrop(ctx, c.x, c.y + bobY, '#ffd700', '#f57f17', 1.35);
      } else if (c.type === 'golden_shroom') {
        this.drawPixelGoldenMushroom(ctx, c.x, c.y + bobY * 1.4);
      }
    }
  }

  private drawPixelMushroom(ctx: CanvasRenderingContext2D, cx: number, cy: number, capColor: string, dotColor: string) {
    const x = Math.floor(cx);
    const y = Math.floor(cy);

    // Stem: 8x10 pixels with dark outline
    this.pRect(ctx, x - 5, y + 2, 10, 11, '#211003'); // Outline
    this.pRect(ctx, x - 3, y + 2, 6, 9, '#fff8e1'); // Core
    this.pRect(ctx, x + 1, y + 2, 2, 9, '#d7ccc8'); // Dither side shade

    // Cap: 22x13 pixels domed cap with dark outline
    this.pRect(ctx, x - 11, y - 6, 22, 10, '#211003');
    this.pRect(ctx, x - 8, y - 10, 16, 5, '#211003');
    this.pRect(ctx, x - 9, y - 4, 18, 7, capColor); // Cap fill
    this.pRect(ctx, x - 6, y - 8, 12, 4, capColor);
    this.pRect(ctx, x - 6, y - 8, 12, 2, '#ffffff'); // Highlight sheen

    // 3 Distinct Pixel Dots
    this.pRect(ctx, x - 1, y - 7, 3, 3, dotColor);
    this.pRect(ctx, x - 7, y - 3, 3, 3, dotColor);
    this.pRect(ctx, x + 5, y - 3, 3, 3, dotColor);
  }

  private drawPixelWaterDrop(ctx: CanvasRenderingContext2D, cx: number, cy: number, mainColor: string, shadeColor: string, scale: number = 1.0) {
    const x = Math.floor(cx);
    const y = Math.floor(cy);
    const s = scale;

    // Dark pixel outline
    this.pRect(ctx, x - 1 * s, y - 9 * s, 3 * s, 3 * s, '#012a4a');
    this.pRect(ctx, x - 4 * s, y - 6 * s, 9 * s, 6 * s, '#012a4a');
    this.pRect(ctx, x - 6 * s, y - 1 * s, 13 * s, 8 * s, '#012a4a');
    this.pRect(ctx, x - 4 * s, y + 6 * s, 9 * s, 3 * s, '#012a4a');

    // Vibrant core
    this.pRect(ctx, x - 4 * s, y - 1 * s, 9 * s, 6 * s, mainColor);
    this.pRect(ctx, x - 2 * s, y - 5 * s, 5 * s, 4 * s, mainColor);

    // Specular highlight pixel
    this.pRect(ctx, x - 3 * s, y - 2 * s, 2 * s, 3 * s, '#ffffff');

    // Bottom dithered shade
    this.pRect(ctx, x - 3 * s, y + 4 * s, 7 * s, 2 * s, shadeColor);
  }

  private drawPixelGoldenMushroom(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    const x = Math.floor(cx);
    const y = Math.floor(cy);

    // Golden Sparkle pixel cross
    const spOff = Math.floor(Math.sin(this.cloudTimer * 8) * 3);
    this.pRect(ctx, x + 16, y - 14 + spOff, 3, 7, '#ffff8d');
    this.pRect(ctx, x + 14, y - 12 + spOff, 7, 3, '#ffff8d');
    this.pRect(ctx, x - 18, y - 6 - spOff, 3, 5, '#ffff8d');
    this.pRect(ctx, x - 19, y - 5 - spOff, 5, 3, '#ffff8d');

    // Stem: 14x16 pixels
    this.pRect(ctx, x - 8, y + 4, 16, 16, '#3e2723'); // Outline
    this.pRect(ctx, x - 6, y + 4, 12, 14, '#fff9c4');
    this.pRect(ctx, x + 2, y + 4, 4, 14, '#ffe082');

    // Giant Golden Cap: 34x18 pixels
    this.pRect(ctx, x - 17, y - 10, 34, 16, '#3e2723');
    this.pRect(ctx, x - 12, y - 16, 24, 7, '#3e2723');
    this.pRect(ctx, x - 15, y - 8, 30, 13, '#ffd700'); // Gold fill
    this.pRect(ctx, x - 10, y - 14, 20, 7, '#ffd700');
    this.pRect(ctx, x - 10, y - 14, 20, 3, '#ffffff'); // Specular rim
    this.pRect(ctx, x - 15, y + 3, 30, 3, '#ff8f00'); // Gold shadow

    // White polka dots
    this.pRect(ctx, x - 2, y - 12, 5, 5, '#ffffff');
    this.pRect(ctx, x - 11, y - 5, 4, 4, '#ffffff');
    this.pRect(ctx, x + 8, y - 5, 4, 4, '#ffffff');
  }

  // 16-BIT RETRO PIXEL ENEMIES
  private renderEnemies(ctx: CanvasRenderingContext2D) {
    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;

      this.renderEntityShadow(ctx, enemy.x, enemy.y, 422, enemy.width * 0.6);

      ctx.save();
      ctx.translate(Math.floor(enemy.x), Math.floor(enemy.y));
      if (enemy.facing === -1) ctx.scale(-1, 1);

      switch (enemy.type) {
        case 'ant':
          this.drawAnt(ctx, enemy);
          break;
        case 'caterpillar':
          this.drawCaterpillar(ctx, enemy);
          break;
        case 'beetle':
          this.drawBeetle(ctx, enemy);
          break;
        case 'bird':
          this.drawBird(ctx, enemy);
          break;
        case 'spider':
          this.drawSpider(ctx, enemy);
          break;
      }

      ctx.restore();
    }
  }

  // 16-Bit Pixel Red Ant
  private drawAnt(ctx: CanvasRenderingContext2D, enemy: Enemy) {
    const legWalk = Math.floor(Math.sin(enemy.animTimer * 12) * 3);

    // 6 Jointed Pixel Legs
    ctx.fillStyle = '#3a0202';
    // Back legs
    this.pRect(ctx, -8, 2, 2, 6, '#3a0202');
    this.pRect(ctx, -10 + legWalk, 7, 4, 2, '#3a0202');
    // Middle legs
    this.pRect(ctx, 0, 2, 2, 6, '#3a0202');
    this.pRect(ctx, -2 - legWalk, 7, 4, 2, '#3a0202');
    // Front legs
    this.pRect(ctx, 8, 2, 2, 6, '#3a0202');
    this.pRect(ctx, 8 + legWalk, 7, 4, 2, '#3a0202');

    // Abdomen: 14x10 pixel oval with dark outline
    this.pRect(ctx, -16, -5, 14, 10, '#3a0202');
    this.pRect(ctx, -14, -4, 10, 8, '#c62828');
    this.pRect(ctx, -14, -4, 10, 2, '#ef5350'); // Ruby highlight
    this.pRect(ctx, -14, 2, 10, 2, '#5b0000'); // Shade

    // Thorax: 8x6 pixels
    this.pRect(ctx, -3, -4, 8, 8, '#3a0202');
    this.pRect(ctx, -2, -3, 6, 6, '#b71c1c');

    // Head: 10x8 pixels
    this.pRect(ctx, 4, -6, 10, 10, '#3a0202');
    this.pRect(ctx, 5, -5, 8, 8, '#c62828');
    this.pRect(ctx, 5, -5, 8, 2, '#ef5350');

    // Expressive Pixel Eye: 2x2 white with 1x1 black pupil
    this.pRect(ctx, 9, -5, 3, 3, '#ffffff');
    this.pRect(ctx, 10, -5, 2, 2, '#000000');

    // Antennae
    this.pRect(ctx, 11, -8, 2, 3, '#3a0202');
    this.pRect(ctx, 13, -11, 2, 3, '#3a0202');
    this.pRect(ctx, 15, -13, 2, 2, '#ef5350');
  }

  // 16-Bit Pixel Caterpillar
  private drawCaterpillar(ctx: CanvasRenderingContext2D, enemy: Enemy) {
    for (let i = 0; i < 5; i++) {
      const segX = Math.floor(12 - i * 6);
      const segY = Math.floor(Math.sin(enemy.animTimer * 6 + i) * 2);

      // Segment ball (8x8 pixels)
      this.pRect(ctx, segX - 5, segY - 5, 10, 10, '#0d3311'); // Outline
      const col = i % 2 === 0 ? '#43a047' : '#66bb6a';
      this.pRect(ctx, segX - 4, segY - 4, 8, 8, col);
      this.pRect(ctx, segX - 4, segY - 4, 8, 2, '#76ff03'); // Highlight
      this.pRect(ctx, segX - 4, segY + 2, 8, 2, '#1b5e20'); // Shade
    }

    // Head eyes on front segment (seg 0 at x=12)
    const headY = Math.floor(Math.sin(enemy.animTimer * 6) * 2);
    this.pRect(ctx, 13, headY - 4, 3, 3, '#ffffff');
    this.pRect(ctx, 14, headY - 4, 2, 2, '#000000');
  }

  // 16-Bit Pixel Armored Beetle
  private drawBeetle(ctx: CanvasRenderingContext2D, _enemy: Enemy) {
    // Crawling legs
    this.pRect(ctx, -10, 4, 3, 6, '#102027');
    this.pRect(ctx, 0, 4, 3, 6, '#102027');
    this.pRect(ctx, 8, 4, 3, 6, '#102027');

    // Metallic Carapace: 24x14 pixels with dark outline
    this.pRect(ctx, -14, -8, 26, 15, '#102027'); // Outline
    this.pRect(ctx, -12, -7, 22, 13, '#37474f'); // Body
    this.pRect(ctx, -12, -7, 22, 3, '#90a4ae'); // Metallic highlight
    this.pRect(ctx, -12, 3, 22, 3, '#1c2833'); // Shade

    // Central wing divider seam
    this.pRect(ctx, -12, -1, 20, 2, '#102027');

    // Fierce curved horn
    this.pRect(ctx, 10, -5, 4, 4, '#102027');
    this.pRect(ctx, 13, -8, 3, 4, '#102027');
    this.pRect(ctx, 15, -12, 3, 5, '#102027');
    this.pRect(ctx, 14, -11, 2, 3, '#cfd8dc'); // Horn tip glint

    // Eye
    this.pRect(ctx, 8, -6, 2, 2, '#ff1744');
  }

  // 16-Bit Pixel Arcade Bird
  private drawBird(ctx: CanvasRenderingContext2D, enemy: Enemy) {
    const isFlapUp = Math.sin(enemy.animTimer * 8) > 0;

    // Body: 22x14 pixels
    this.pRect(ctx, -10, -7, 22, 14, '#271c19'); // Outline
    this.pRect(ctx, -8, -6, 18, 12, '#6d4c41'); // Feather body
    this.pRect(ctx, -8, -6, 18, 3, '#8d6e63'); // Top highlight
    this.pRect(ctx, -8, 3, 18, 3, '#3e2723'); // Underbelly shade

    // 2-Frame Pixel Flapping Wings
    if (isFlapUp) {
      this.pRect(ctx, -4, -16, 10, 10, '#271c19');
      this.pRect(ctx, -3, -15, 8, 8, '#a1887f');
      this.pRect(ctx, -3, -15, 8, 2, '#d7ccc8');
    } else {
      this.pRect(ctx, -4, -3, 12, 8, '#271c19');
      this.pRect(ctx, -3, -2, 10, 6, '#8d6e63');
    }

    // Golden Beak
    this.pRect(ctx, 10, -3, 8, 5, '#271c19');
    this.pRect(ctx, 11, -2, 6, 3, '#ffb300');
    this.pRect(ctx, 11, -2, 4, 1, '#fff59d');

    // Pixel Eye
    this.pRect(ctx, 6, -5, 3, 3, '#ffffff');
    this.pRect(ctx, 7, -5, 2, 2, '#000000');

    // Tail Feathers
    this.pRect(ctx, -14, -4, 5, 4, '#3e2723');
  }

  // 16-Bit Pixel Spider (Elevated / Ceiling Lurker with Headbutt Vulnerability)
  private drawSpider(ctx: CanvasRenderingContext2D, enemy: Enemy) {
    const legTwitch = Math.floor(Math.sin(enemy.animTimer * 10) * 3);

    // Dotted silk thread dangling from top
    ctx.fillStyle = '#ffffff';
    for (let sy = -50; sy < -8; sy += 4) {
      ctx.fillRect(0, sy, 1, 2);
    }

    // 8 Jointed Pixel Legs (4 on each side)
    ctx.fillStyle = '#1e1e1e';
    for (let i = -1; i <= 1; i += 0.65) {
      const legY = Math.floor(i * 5);
      // Left legs
      this.pRect(ctx, -14, legY, 8, 2, '#1e1e1e');
      this.pRect(ctx, -20 - legTwitch, legY + 4, 7, 2, '#1e1e1e');
      // Right legs
      this.pRect(ctx, 6, legY, 8, 2, '#1e1e1e');
      this.pRect(ctx, 13 + legTwitch, legY + 4, 7, 2, '#1e1e1e');
    }

    // Abdomen: 16x14 pixels with dark outline
    this.pRect(ctx, -9, -8, 18, 15, '#111111');
    this.pRect(ctx, -7, -7, 14, 13, '#262626');
    this.pRect(ctx, -7, -7, 14, 3, '#404040'); // Highlight

    // Crimson Hourglass marking
    this.pRect(ctx, -3, -5, 6, 3, '#ff1744');
    this.pRect(ctx, -1, -2, 2, 2, '#ff1744');
    this.pRect(ctx, -3, 0, 6, 3, '#ff1744');

    // 4 Glowing Red Multi-Eyes
    this.pRect(ctx, -4, -6, 2, 2, '#ff1744');
    this.pRect(ctx, 2, -6, 2, 2, '#ff1744');
    this.pRect(ctx, -2, -4, 2, 2, '#ff5252');
    this.pRect(ctx, 0, -4, 2, 2, '#ff5252');

    // Venomous Fangs
    this.pRect(ctx, -3, 6, 2, 3, '#f50057');
    this.pRect(ctx, 1, 6, 2, 3, '#f50057');
  }

  // 16-BIT RETRO PIXEL BOSSES (All 6 Stages)
  private renderBoss(ctx: CanvasRenderingContext2D) {
    if (!this.boss || !this.boss.active || this.boss.defeated) return;

    this.renderEntityShadow(ctx, this.boss.x, this.boss.y, 422, this.boss.width * 0.7);

    ctx.save();
    ctx.translate(Math.floor(this.boss.x), Math.floor(this.boss.y));
    if (this.boss.facing === -1) ctx.scale(-1, 1);

    if (this.boss.hitFlash > 0) {
      ctx.filter = 'brightness(2.4)';
    }

    switch (this.currentStage.id) {
      case 1:
        this.drawBossBeetle(ctx);
        break;
      case 2:
        this.drawBossWasp(ctx);
        break;
      case 3:
        this.drawBossMole(ctx);
        break;
      case 4:
        this.drawBossSpider(ctx);
        break;
      case 5:
        this.drawBossCrow(ctx);
        break;
      case 6:
        this.drawBossMecha(ctx);
        break;
    }

    ctx.restore();
  }

  // Stage 1 Boss: Armored Goliath Beetle (16-bit pixel tank)
  private drawBossBeetle(ctx: CanvasRenderingContext2D) {
    // Legs
    this.pRect(ctx, -22, 12, 6, 12, '#0e3a13');
    this.pRect(ctx, -4, 12, 6, 12, '#0e3a13');
    this.pRect(ctx, 14, 12, 6, 12, '#0e3a13');

    // Massive Carapace: 54x34 pixels
    this.pRect(ctx, -28, -18, 54, 34, '#0e3a13'); // Outline
    this.pRect(ctx, -25, -16, 48, 30, '#2e7d32'); // Shell
    this.pRect(ctx, -25, -16, 48, 6, '#66bb6a'); // Top highlight
    this.pRect(ctx, -25, 8, 48, 6, '#1b5e20'); // Bottom shade

    // Metallic Front Armor Plate (18x26 pixels)
    this.pRect(ctx, 12, -14, 18, 26, '#1c2833');
    this.pRect(ctx, 14, -12, 14, 22, '#607d8b');
    this.pRect(ctx, 14, -12, 6, 22, '#cfd8dc'); // Metallic sheen
    // Rivet studs
    this.pRect(ctx, 22, -8, 3, 3, '#eceff1');
    this.pRect(ctx, 22, 3, 3, 3, '#eceff1');

    // Giant Serrated Rhino Horn
    this.pRect(ctx, 24, -6, 16, 8, '#102027');
    this.pRect(ctx, 32, -18, 10, 14, '#102027');
    this.pRect(ctx, 38, -26, 8, 10, '#102027');
    this.pRect(ctx, 38, -26, 3, 8, '#eceff1'); // Horn glint

    // Glowing Crimson Battle Visor
    this.pRect(ctx, 16, -6, 8, 4, '#ff1744');
    this.pRect(ctx, 18, -5, 4, 2, '#ffffff');
  }

  // Stage 2 Boss: Queen Wasp (Hornet Queen)
  private drawBossWasp(ctx: CanvasRenderingContext2D) {
    const wingFlap = Math.floor(Math.sin(this.boss.animTimer * 16) * 10);

    // Striped Abdomen (4 yellow & black segments with stinger)
    for (let i = 0; i < 4; i++) {
      const segX = -24 + i * 8;
      const isYellow = i % 2 === 0;
      this.pRect(ctx, segX, -4, 8, 16, '#111111'); // Outline
      this.pRect(ctx, segX + 1, -3, 6, 14, isYellow ? '#fbc02d' : '#263238');
      this.pRect(ctx, segX + 1, -3, 6, 3, isYellow ? '#fff59d' : '#455a64');
    }
    // Deadly Stinger Needle
    this.pRect(ctx, -32, 4, 8, 3, '#111111');
    this.pRect(ctx, -30, 5, 6, 1, '#ff1744');

    // Thorax & Head
    this.pRect(ctx, 8, -6, 14, 18, '#111111');
    this.pRect(ctx, 10, -4, 10, 14, '#e65100');
    this.pRect(ctx, 16, -2, 6, 6, '#00e5ff'); // Compound eyes

    // Translucent Pixel Flutter Wings
    this.pRect(ctx, 2, -24 + wingFlap, 22, 10, 'rgba(255, 255, 255, 0.4)');
    this.pRect(ctx, 4, -22 + wingFlap, 18, 6, 'rgba(255, 255, 255, 0.8)');
  }

  // Stage 3 Boss: Drill Mole
  private drawBossMole(ctx: CanvasRenderingContext2D) {
    // Furry Body: 52x34 pixels
    this.pRect(ctx, -26, -16, 52, 34, '#1b120c');
    this.pRect(ctx, -23, -14, 46, 30, '#4e342e');
    this.pRect(ctx, -23, -14, 46, 6, '#8d6e63');

    // Miner Goggles with Glass Glint
    this.pRect(ctx, 6, -10, 14, 10, '#212121');
    this.pRect(ctx, 8, -8, 10, 6, '#4fc3f7');
    this.pRect(ctx, 9, -7, 3, 2, '#ffffff');

    // Massive Spinning Spiral Metal Drill on Snout
    const drillAngle = (this.boss.stateTimer * 0.4) % 12;
    this.pRect(ctx, 22, -10, 22, 20, '#263238');
    this.pRect(ctx, 36, -6, 14, 12, '#37474f');
    this.pRect(ctx, 46, -3, 10, 6, '#90a4ae');
    // Spiral grooves
    this.pRect(ctx, 24 + drillAngle, -9, 4, 18, '#cfd8dc');

    // Big Digging Claws
    this.pRect(ctx, 10, 14, 16, 8, '#d7ccc8');
    this.pRect(ctx, 12, 20, 4, 4, '#8d6e63');
    this.pRect(ctx, 18, 20, 4, 4, '#8d6e63');
  }

  // Stage 4 Boss: Giant Spider (Weaver of the Brambles - Headbutt Target)
  private drawBossSpider(ctx: CanvasRenderingContext2D) {
    const legTwitch = Math.floor(Math.sin(this.boss.animTimer * 8) * 4);

    // Thick Shimmering Silk Line
    ctx.fillStyle = '#ffffff';
    for (let sy = -80; sy < -14; sy += 3) {
      ctx.fillRect(-1, sy, 2, 2);
    }

    // 8 Huge Jointed Barbed Legs
    ctx.fillStyle = '#111111';
    for (let i = -1; i <= 1; i += 0.65) {
      const ly = Math.floor(i * 10);
      // Left massive legs
      this.pRect(ctx, -28, ly - 4, 16, 4, '#111111');
      this.pRect(ctx, -42 - legTwitch, ly + 8, 16, 4, '#1b1b1b');
      this.pRect(ctx, -40, ly + 6, 3, 3, '#ff1744'); // Barb
      // Right massive legs
      this.pRect(ctx, 12, ly - 4, 16, 4, '#111111');
      this.pRect(ctx, 26 + legTwitch, ly + 8, 16, 4, '#1b1b1b');
      this.pRect(ctx, 36, ly + 6, 3, 3, '#ff1744'); // Barb
    }

    // Massive Dark Abdomen: 36x30 pixels with crimson markings
    this.pRect(ctx, -20, -18, 40, 34, '#0a0a0a'); // Outline
    this.pRect(ctx, -17, -15, 34, 28, '#212121'); // Shell
    this.pRect(ctx, -17, -15, 34, 5, '#424242'); // Highlight

    // Red Hourglass / Arachnid Web Emblem
    this.pRect(ctx, -8, -10, 16, 6, '#ff1744');
    this.pRect(ctx, -4, -4, 8, 4, '#ff1744');
    this.pRect(ctx, -10, 0, 20, 6, '#ff1744');

    // Cephalothorax & Cluster of 6 Glowing Eyes
    this.pRect(ctx, 4, -8, 16, 18, '#111111');
    this.pRect(ctx, 8, -6, 4, 4, '#ff1744');
    this.pRect(ctx, 14, -6, 4, 4, '#ff1744');
    this.pRect(ctx, 10, -1, 3, 3, '#ff5252');
    this.pRect(ctx, 15, -1, 3, 3, '#ff5252');

    // Dripping Venom Fangs
    this.pRect(ctx, 8, 8, 4, 8, '#f50057');
    this.pRect(ctx, 14, 8, 4, 8, '#f50057');
    this.pRect(ctx, 10, 14, 2, 3, '#76ff03'); // Toxic drip
  }

  // Stage 5 Boss: Hungry Crow (Shadow Talon)
  private drawBossCrow(ctx: CanvasRenderingContext2D) {
    const flap = Math.floor(Math.sin(this.boss.animTimer * 10) * 16);

    // Giant Body: 58x32 pixels
    this.pRect(ctx, -28, -14, 58, 30, '#111827');
    this.pRect(ctx, -24, -12, 50, 26, '#263238');
    this.pRect(ctx, -24, -12, 50, 6, '#455a64'); // Feather sheen

    // Massive Wingspan (up / down flap)
    this.pRect(ctx, -14, -36 + flap, 36, 18, '#111827');
    this.pRect(ctx, -12, -34 + flap, 32, 14, '#37474f');
    this.pRect(ctx, -8, -34 + flap, 24, 3, '#78909c');

    // Razor-Sharp Hooked Yellow Beak
    this.pRect(ctx, 26, -6, 22, 10, '#111827');
    this.pRect(ctx, 28, -4, 18, 6, '#ffa000');
    this.pRect(ctx, 36, 2, 8, 4, '#ffa000'); // Curved tip

    // Piercing Crimson Eye
    this.pRect(ctx, 20, -8, 6, 6, '#ffffff');
    this.pRect(ctx, 22, -8, 4, 4, '#d50000');

    // Talons
    this.pRect(ctx, -4, 14, 12, 8, '#ffa000');
  }

  // Stage 6 Boss: Mecha Bug (Phase 1 Tank / Phase 2 Cyber-Hornet)
  private drawBossMecha(ctx: CanvasRenderingContext2D) {
    if (this.boss.phase === 1) {
      // Tank Caterpillar Treads
      this.pRect(ctx, -32, 14, 64, 12, '#111827');
      this.pRect(ctx, -30, 16, 60, 8, '#37474f');
      for (let tx = -26; tx < 26; tx += 10) {
        this.pRect(ctx, tx, 17, 6, 6, '#78909c');
      }

      // Heavy Armored Chasis
      this.pRect(ctx, -28, -16, 56, 32, '#111827');
      this.pRect(ctx, -25, -14, 50, 28, '#455a64');
      this.pRect(ctx, -25, -14, 50, 5, '#90a4ae');

      // Hazard warning stripes
      this.pRect(ctx, -16, -6, 32, 8, '#f59e0b');
      this.pRect(ctx, -8, -6, 8, 8, '#111827');
      this.pRect(ctx, 8, -6, 8, 8, '#111827');

      // Front Plasma Cannon Barrel
      this.pRect(ctx, 24, -8, 22, 12, '#212121');
      this.pRect(ctx, 42, -6, 6, 8, '#ff1744'); // Glowing muzzle
    } else {
      // Phase 2: Transformed Jet Cyber-Hornet
      // Jet Body
      this.pRect(ctx, -26, -16, 52, 32, '#1a0933');
      this.pRect(ctx, -23, -14, 46, 28, '#4a148c');
      this.pRect(ctx, -23, -14, 46, 5, '#7b1fa2');

      // Unfolded Cybernetic Laser Wings
      this.pRect(ctx, -12, -44, 34, 18, '#00e5ff');
      this.pRect(ctx, -8, -42, 26, 14, '#ffffff');

      // Pulsing Engine Plasma Thrusters
      const pulseP = Math.floor(Math.sin(this.boss.stateTimer * 0.4) * 4);
      this.pRect(ctx, -38 - pulseP, -4, 14 + pulseP, 12, '#00e5ff');
      this.pRect(ctx, -34 - pulseP, -2, 10 + pulseP, 8, '#ffffff');

      // Glowing Neon Sensor
      this.pRect(ctx, 18, -6, 12, 10, '#00e5ff');
      this.pRect(ctx, 22, -4, 6, 6, '#ffffff');
    }
  }

  // 16-BIT RETRO PIXEL PINK WORM (With Dynamic Squash & Stretch and Crawling Physics)
  private renderPlayer(ctx: CanvasRenderingContext2D) {
    const p = this.player;

    if (p.invulnerableTimer > 0 && Math.floor(p.invulnerableTimer / 4) % 2 === 0) {
      return;
    }

    if (!p.isBurrowed) {
      this.renderEntityShadow(ctx, p.x, p.y, 422, 18);
    }

    ctx.save();

    // 1. Draw Body Segments from Tail to Neck (16-bit rounded pixel capsules)
    for (let i = p.segments.length - 1; i >= 1; i--) {
      const seg = p.segments[i];
      const r = seg.r;
      const sW = Math.max(3, Math.floor(r * p.squashX));
      const sH = Math.max(3, Math.floor(r * p.squashY));
      const sx = Math.floor(seg.x);
      const sy = Math.floor(seg.y);

      // Dark Magenta Outline
      this.pRect(ctx, sx - sW - 1, sy - sH - 1, (sW + 1) * 2, (sH + 1) * 2, '#4a0028');
      // Bright Pink Body
      this.pRect(ctx, sx - sW, sy - sH, sW * 2, sH * 2, '#ff4081');
      // Top Highlight Strip
      this.pRect(ctx, sx - sW + 1, sy - sH, (sW - 1) * 2, Math.max(1, Math.floor(sH * 0.45)), '#ff80ab');
      this.pRect(ctx, sx - sW + 2, sy - sH, (sW - 2) * 2, 1, '#ffffff'); // Gloss line
      // Bottom Dither Shade
      this.pRect(ctx, sx - sW + 1, sy + Math.floor(sH * 0.5), (sW - 1) * 2, Math.max(1, Math.floor(sH * 0.5)), '#ad1457');
    }

    // 2. Head with Expressive 16-Bit Pixel Face
    const head = p.segments[0];
    const headRadius = 14;

    ctx.save();
    ctx.translate(Math.floor(head.x), Math.floor(head.y));
    if (p.facing === -1) ctx.scale(-1, 1);
    ctx.scale(p.squashX, p.squashY);

    const hW = headRadius;
    const hH = headRadius;

    // Head Outline & Body
    this.pRect(ctx, -hW - 1, -hH - 1, (hW + 1) * 2, (hH + 1) * 2, '#4a0028');
    this.pRect(ctx, -hW, -hH, hW * 2, hH * 2, '#ff4081');
    // Top Highlight & Rim
    this.pRect(ctx, -hW + 1, -hH, (hW - 1) * 2, 5, '#ff80ab');
    this.pRect(ctx, -hW + 2, -hH, (hW - 2) * 2, 2, '#ffffff');
    // Bottom Depth Shadow
    this.pRect(ctx, -hW + 1, hH - 4, (hW - 1) * 2, 4, '#ad1457');

    // Rosy Blushing Cheek (3x2 pixels)
    this.pRect(ctx, 3, 3, 4, 3, '#ff1744');

    // Expressive Pixel Eyes
    if (p.isBlinking) {
      this.pRect(ctx, 4, -4, 6, 2, '#212121');
    } else {
      // White 5x6 sclera
      this.pRect(ctx, 4, -6, 6, 6, '#ffffff');
      // Black 3x4 pupil
      this.pRect(ctx, 6, -5, 4, 4, '#111111');
      // White 1x1 glint pixel
      this.pRect(ctx, 7, -5, 2, 2, '#ffffff');
    }

    // Animated Pixel Mouth
    if (p.spitAnimTimer > 0) {
      // Puckered open mouth firing water
      this.pRect(ctx, 8, 2, 5, 5, '#4a0028');
      this.pRect(ctx, 9, 3, 3, 3, '#00e5ff'); // Water glint in mouth
    } else if (p.vy < -2) {
      // Excited open mouth while leaping
      this.pRect(ctx, 7, 2, 5, 4, '#4a0028');
      this.pRect(ctx, 8, 3, 3, 2, '#ff1744');
    } else {
      // Cute smile
      this.pRect(ctx, 6, 3, 4, 2, '#880e4f');
      this.pRect(ctx, 9, 2, 2, 2, '#880e4f');
    }

    // Antennae (Cute wiggling pixel antennas)
    this.pRect(ctx, 2, -16, 2, 4, '#4a0028');
    this.pRect(ctx, 2, -18, 3, 3, '#ff4081');
    this.pRect(ctx, 3, -18, 1, 1, '#ffffff');

    ctx.restore();

    // 3. Burrow Mound (Chunky 16-bit soil crust)
    if (p.isBurrowed) {
      this.pRect(ctx, p.x - 14, 418, 28, 6, '#3e2723');
      this.pRect(ctx, p.x - 10, 416, 20, 4, '#5d4037');
      this.pRect(ctx, p.x - 6, 414, 12, 3, '#8d6e63');
    }

    ctx.restore();
  }

  // 16-BIT RETRO PROJECTILES
  private renderProjectiles(ctx: CanvasRenderingContext2D) {
    for (const p of this.projectiles) {
      const px = Math.floor(p.x);
      const py = Math.floor(p.y);
      const r = Math.floor(p.radius);

      // Dark rim
      this.pRect(ctx, px - r - 1, py - r - 1, (r + 1) * 2, (r + 1) * 2, '#012a4a');
      // Bright core
      this.pRect(ctx, px - r, py - r, r * 2, r * 2, p.color);
      // Glint
      this.pRect(ctx, px - r + 1, py - r + 1, Math.max(1, Math.floor(r * 0.6)), Math.max(1, Math.floor(r * 0.6)), '#ffffff');
    }
  }

  // 16-BIT RETRO PARTICLES
  private renderParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      const px = Math.floor(p.x);
      const py = Math.floor(p.y);
      const sz = Math.max(2, Math.floor(p.size));

      if (p.shape === 'sparkle') {
        // Cross pixel star
        this.pRect(ctx, px - 1, py - sz, 2, sz * 2, p.color);
        this.pRect(ctx, px - sz, py - 1, sz * 2, 2, p.color);
        this.pRect(ctx, px - 1, py - 1, 2, 2, '#ffffff');
      } else {
        // Square pixel block
        this.pRect(ctx, px - sz / 2, py - sz / 2, sz, sz, p.color);
      }

      ctx.restore();
    }
  }

  // RETRO 16-BIT ARCADE FLOATING TEXT
  private renderFloatingTexts(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.textAlign = 'center';

    for (const ft of this.floatingTexts) {
      ctx.globalAlpha = Math.max(0, ft.alpha);
      const fontSize = Math.round(14 * (ft.scale || 1));
      ctx.font = `900 ${fontSize}px "Courier New", monospace`;

      const fx = Math.floor(ft.x);
      const fy = Math.floor(ft.y);

      // Heavy 16-bit black outline
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.strokeText(ft.text, fx, fy);

      // Vivid fill
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, fx, fy);
    }

    ctx.restore();
  }

  private renderWeatherOverlay(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (this.currentStage.weather === 'vignette') {
      const screenX = Math.floor(this.player.x - this.cameraX);
      const screenY = Math.floor(this.player.y);
      const vigGrad = ctx.createRadialGradient(screenX, screenY, 60, screenX, screenY, 280);
      vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vigGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.45)');
      vigGrad.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, w, h);
    }

    if (this.currentStage.weather === 'sunset_rain') {
      ctx.fillStyle = 'rgba(129, 212, 250, 0.65)';
      for (const p of this.weatherParticles) {
        // 16-bit pixel rain streak
        this.pRect(ctx, p.x, p.y, 2, 8, '#81d4fa');
      }
    }

    if (this.currentStage.weather === 'dark_maze') {
      ctx.save();
      ctx.fillStyle = 'rgba(76, 29, 149, 0.12)';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }
}
