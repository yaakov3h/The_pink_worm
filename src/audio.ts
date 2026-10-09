/**
 * Web Audio API synthesizer for retro arcade sound effects and chiptune background music.
 * Completely self-contained, lightweight, and reliable.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private musicInterval: number | null = null;
  private musicStep: number = 0;
  private isMusicPlaying: boolean = false;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && this.musicInterval) {
      this.stopMusic();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // Plays a simple synthesized tone
  public playTone(freq: number, type: OscillatorType, duration: number, gainVal: number = 0.15, freqGlide?: number) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      if (freqGlide !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(10, freqGlide), this.ctx.currentTime + duration);
      }

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Audio fallback catch
    }
  }

  // Jump boing
  public playJump() {
    this.playTone(220, 'sine', 0.22, 0.18, 580);
  }

  // Landing soft thud
  public playLand() {
    this.playTone(130, 'triangle', 0.08, 0.12, 60);
  }

  // Dig / burrow submerge
  public playDig() {
    this.playTone(180, 'triangle', 0.18, 0.2, 70);
  }

  // Water spit projectile shoot
  public playSpit() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1400, this.ctx.currentTime + 0.04);
      osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.13);
    } catch {}
  }

  // Golden Mega Drop shoot
  public playMegaSpit() {
    if (this.isMuted) return;
    this.playTone(350, 'sawtooth', 0.25, 0.25, 1200);
    setTimeout(() => this.playTone(600, 'sine', 0.18, 0.2, 1800), 50);
  }

  // Pop-up ambush explosion attack
  public playAmbush() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.35);

      setTimeout(() => {
        this.playTone(400, 'square', 0.15, 0.2, 100);
      }, 40);
    } catch {}
  }

  // Combo ascending pitch audio tone
  public playCombo(comboMultiplier: number) {
    if (this.isMuted) return;
    const baseFreq = 440 * Math.pow(1.15, Math.min(8, comboMultiplier));
    this.playTone(baseFreq, 'triangle', 0.12, 0.2, baseFreq * 1.3);
    setTimeout(() => {
      this.playTone(baseFreq * 1.25, 'sine', 0.14, 0.2);
    }, 60);
  }

  // Low oxygen warning beep
  public playOxygenWarning() {
    this.playTone(700, 'sawtooth', 0.08, 0.1);
  }

  // Mushroom pickup (+100)
  public playPickupMushroom() {
    if (this.isMuted) return;
    this.playTone(523.25, 'triangle', 0.1, 0.15); // C5
    setTimeout(() => this.playTone(659.25, 'triangle', 0.1, 0.15), 60); // E5
    setTimeout(() => this.playTone(783.99, 'triangle', 0.16, 0.18), 120); // G5
  }

  // Speed mushroom pickup (+300)
  public playSuperMushroom() {
    if (this.isMuted) return;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'sine', 0.12, 0.16), idx * 50);
    });
  }

  // Water droplet pickup
  public playWaterPickup() {
    if (this.isMuted) return;
    this.playTone(880, 'sine', 0.08, 0.15, 1200);
    setTimeout(() => this.playTone(1320, 'sine', 0.12, 0.18), 70);
  }

  // Mega drop pickup
  public playMegaDropPickup() {
    if (this.isMuted) return;
    [587, 880, 1174, 1760].forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'sine', 0.12, 0.2), idx * 60);
    });
  }

  // Armor clink
  public playArmorClink() {
    this.playTone(600, 'square', 0.1, 0.2);
  }

  // Phase transition
  public playPhaseTransition() {
    this.playTone(880, 'sawtooth', 0.4, 0.3);
  }

  // Player hurt
  public playHurt() {
    this.playTone(180, 'sawtooth', 0.25, 0.25, 60);
  }

  // Enemy hit / defeated
  public playEnemyDefeat() {
    this.playTone(320, 'square', 0.15, 0.18, 110);
  }

  // Boss hit
  public playBossHit() {
    this.playTone(280, 'sawtooth', 0.18, 0.22, 90);
  }

  // Boss defeated
  public playBossDefeat() {
    if (this.isMuted) return;
    const chords = [
      [220, 330],
      [261.63, 392],
      [329.63, 493.88],
      [440, 659.25]
    ];
    chords.forEach((chord, i) => {
      setTimeout(() => {
        chord.forEach(f => this.playTone(f, 'sawtooth', 0.25, 0.2));
      }, i * 160);
    });
  }

  // Stage clear fanfare
  public playStageClear() {
    if (this.isMuted) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.playTone(freq, 'triangle', 0.28, 0.22);
      }, i * 120);
    });
  }

  // Game over sound
  public playGameOver() {
    if (this.isMuted) return;
    const notes = [440, 415.3, 392, 349.23];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.playTone(freq, 'sawtooth', 0.35, 0.2, freq * 0.9);
      }, i * 220);
    });
  }

  // Background arcade chiptune groove
  public startMusic() {
    if (this.isMuted || this.isMusicPlaying) return;
    this.initContext();
    this.isMusicPlaying = true;
    this.musicStep = 0;

    const melody = [
      261.63, 0, 329.63, 392, 0, 523.25, 392, 0,
      293.66, 0, 349.23, 440, 0, 587.33, 440, 0,
      329.63, 0, 392, 523.25, 0, 659.25, 523.25, 0,
      392, 0, 440, 523.25, 587.33, 523.25, 440, 392
    ];
    const bass = [
      130.81, 130.81, 130.81, 130.81,
      146.83, 146.83, 146.83, 146.83,
      164.81, 164.81, 164.81, 164.81,
      196.00, 196.00, 174.61, 146.83
    ];

    const stepDuration = 220;

    this.musicInterval = window.setInterval(() => {
      if (this.isMuted || !this.isMusicPlaying) return;
      const note = melody[this.musicStep % melody.length];
      const bassNote = bass[Math.floor((this.musicStep / 2) % bass.length)];

      if (note > 0) {
        this.playTone(note, 'triangle', 0.14, 0.035);
      }
      if (this.musicStep % 2 === 0 && bassNote > 0) {
        this.playTone(bassNote, 'sine', 0.18, 0.045);
      }

      this.musicStep++;
    }, stepDuration);
  }

  public stopMusic() {
    this.isMusicPlaying = false;
    if (this.musicInterval !== null) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }
}

export const soundEngine = new SoundEngine();

// Haptic feedback utility
export function triggerHaptic(type: 'tap' | 'ambush' | 'hurt' | 'boss_defeat' | 'pickup' | 'combo', enabled: boolean = true) {
  if (!enabled || typeof navigator === 'undefined' || !navigator.vibrate) return;
  try {
    switch (type) {
      case 'tap':
        navigator.vibrate(25);
        break;
      case 'pickup':
        navigator.vibrate(35);
        break;
      case 'combo':
        navigator.vibrate([30, 30, 45]);
        break;
      case 'ambush':
        navigator.vibrate([60, 40, 100]);
        break;
      case 'hurt':
        navigator.vibrate([80, 50, 120]);
        break;
      case 'boss_defeat':
        navigator.vibrate([150, 80, 200, 80, 300]);
        break;
    }
  } catch {
    // Unsupported or blocked
  }
}
