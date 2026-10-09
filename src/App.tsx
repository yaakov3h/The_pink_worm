import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  Smartphone,
  SmartphoneNfc,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  Droplet,
  Sparkles,
  Heart,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  Shovel,
  Info,
  Maximize2,
  Minimize2,
  Zap,
} from 'lucide-react';
import { GameEngine } from './gameEngine';
import { GameScreen } from './types';
import { STAGE_CONFIGS } from './stages';
import { soundEngine, triggerHaptic } from './audio';

// ==============================================================
// RETRO PIXEL ART UI ICONS & MASCOT
// ==============================================================
const PixelHeart = ({ filled }: { filled: boolean }) => (
  <svg width="15" height="13" viewBox="0 0 14 12" className="shrink-0" style={{ shapeRendering: 'crispEdges' }}>
    {filled ? (
      <>
        <rect x="2" y="0" width="4" height="2" fill="#000" />
        <rect x="8" y="0" width="4" height="2" fill="#000" />
        <rect x="0" y="2" width="2" height="4" fill="#000" />
        <rect x="6" y="2" width="2" height="2" fill="#000" />
        <rect x="12" y="2" width="2" height="4" fill="#000" />
        <rect x="0" y="6" width="2" height="2" fill="#000" />
        <rect x="12" y="6" width="2" height="2" fill="#000" />
        <rect x="2" y="8" width="2" height="2" fill="#000" />
        <rect x="10" y="8" width="2" height="2" fill="#000" />
        <rect x="4" y="10" width="6" height="2" fill="#000" />
        <rect x="2" y="2" width="4" height="6" fill="#f43f5e" />
        <rect x="8" y="2" width="4" height="6" fill="#f43f5e" />
        <rect x="4" y="8" width="6" height="2" fill="#f43f5e" />
        <rect x="6" y="4" width="2" height="4" fill="#f43f5e" />
        <rect x="3" y="2" width="2" height="2" fill="#ffffff" />
      </>
    ) : (
      <>
        <rect x="2" y="0" width="4" height="2" fill="#000" />
        <rect x="8" y="0" width="4" height="2" fill="#000" />
        <rect x="0" y="2" width="2" height="4" fill="#000" />
        <rect x="6" y="2" width="2" height="2" fill="#000" />
        <rect x="12" y="2" width="2" height="4" fill="#000" />
        <rect x="0" y="6" width="2" height="2" fill="#000" />
        <rect x="12" y="6" width="2" height="2" fill="#000" />
        <rect x="2" y="8" width="2" height="2" fill="#000" />
        <rect x="10" y="8" width="2" height="2" fill="#000" />
        <rect x="4" y="10" width="6" height="2" fill="#000" />
        <rect x="2" y="2" width="4" height="6" fill="#334155" />
        <rect x="8" y="2" width="4" height="6" fill="#334155" />
        <rect x="4" y="8" width="6" height="2" fill="#334155" />
        <rect x="6" y="4" width="2" height="4" fill="#334155" />
      </>
    )}
  </svg>
);

const PixelDrop = () => (
  <svg width="12" height="14" viewBox="0 0 12 13" className="shrink-0" style={{ shapeRendering: 'crispEdges' }}>
    <rect x="5" y="0" width="2" height="2" fill="#000" />
    <rect x="3" y="2" width="2" height="2" fill="#000" />
    <rect x="7" y="2" width="2" height="2" fill="#000" />
    <rect x="1" y="4" width="2" height="6" fill="#000" />
    <rect x="9" y="4" width="2" height="6" fill="#000" />
    <rect x="3" y="10" width="6" height="2" fill="#000" />
    <rect x="3" y="4" width="6" height="6" fill="#00e5ff" />
    <rect x="5" y="2" width="2" height="2" fill="#00e5ff" />
    <rect x="3" y="4" width="2" height="2" fill="#ffffff" />
  </svg>
);

const PixelShroom = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" className="shrink-0" style={{ shapeRendering: 'crispEdges' }}>
    <rect x="3" y="0" width="7" height="2" fill="#000" />
    <rect x="1" y="2" width="11" height="5" fill="#000" />
    <rect x="2" y="2" width="9" height="5" fill="#facc15" />
    <rect x="2" y="3" width="2" height="2" fill="#ffffff" />
    <rect x="6" y="2" width="2" height="2" fill="#ffffff" />
    <rect x="9" y="4" width="2" height="2" fill="#ffffff" />
    <rect x="4" y="7" width="5" height="5" fill="#000" />
    <rect x="5" y="7" width="3" height="4" fill="#fef08a" />
  </svg>
);

const PixelWormMascot = () => (
  <svg width="96" height="64" viewBox="0 0 96 64" className="shrink-0" style={{ shapeRendering: 'crispEdges' }}>
    {/* Tail Segment 3 */}
    <rect x="8" y="32" width="12" height="12" fill="#000" />
    <rect x="10" y="34" width="8" height="8" fill="#ad1457" />
    <rect x="10" y="34" width="8" height="4" fill="#f43f5e" />
    <rect x="10" y="34" width="4" height="2" fill="#ffffff" />

    {/* Segment 2 */}
    <rect x="18" y="28" width="16" height="16" fill="#000" />
    <rect x="20" y="30" width="12" height="12" fill="#ad1457" />
    <rect x="20" y="30" width="12" height="6" fill="#f43f5e" />
    <rect x="20" y="30" width="6" height="2" fill="#ffffff" />

    {/* Segment 1 */}
    <rect x="32" y="24" width="18" height="18" fill="#000" />
    <rect x="34" y="26" width="14" height="14" fill="#ad1457" />
    <rect x="34" y="26" width="14" height="7" fill="#f43f5e" />
    <rect x="34" y="26" width="7" height="2" fill="#ffffff" />

    {/* Neck */}
    <rect x="48" y="20" width="20" height="20" fill="#000" />
    <rect x="50" y="22" width="16" height="16" fill="#ad1457" />
    <rect x="50" y="22" width="16" height="8" fill="#f43f5e" />
    <rect x="50" y="22" width="8" height="2" fill="#ffffff" />

    {/* Head */}
    <rect x="66" y="14" width="26" height="26" fill="#000" />
    <rect x="68" y="16" width="22" height="22" fill="#ad1457" />
    <rect x="68" y="16" width="22" height="12" fill="#ff4081" />
    <rect x="70" y="18" width="12" height="4" fill="#ffffff" />

    {/* Cheek Blush */}
    <rect x="72" y="30" width="4" height="3" fill="#ff1744" />

    {/* Pixel Eye */}
    <rect x="78" y="20" width="8" height="8" fill="#ffffff" />
    <rect x="80" y="22" width="4" height="5" fill="#000000" />
    <rect x="82" y="22" width="2" height="2" fill="#ffffff" />

    {/* Cute Mouth */}
    <rect x="82" y="32" width="6" height="3" fill="#880e4f" />
    <rect x="84" y="33" width="4" height="2" fill="#ff4081" />

    {/* Antennae */}
    <rect x="74" y="8" width="3" height="6" fill="#000" />
    <rect x="73" y="6" width="5" height="4" fill="#ff4081" />
    <rect x="74" y="6" width="2" height="2" fill="#ffffff" />
  </svg>
);

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // Active touch tracking by touch identifier
  const touchMapRef = useRef<Map<number, 'left' | 'right' | 'up' | 'down' | 'spit'>>(new Map());

  // Synced HUD state
  const [hudState, setHudState] = useState<{
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
  }>({
    screen: 'TITLE',
    hp: 3,
    ammo: 5,
    megaAmmo: 1,
    oxygen: 100,
    isBurrowed: false,
    score: 0,
    mushrooms: 0,
    combo: 0,
    stageIndex: 0,
    totalStages: 6,
    bossActive: false,
    bossHp: 0,
    bossMaxHp: 1,
    bossName: '',
  });

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [highScore, setHighScore] = useState(0);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [arcadeBezel, setArcadeBezel] = useState(true);

  // Active gamepad pressed states for visual feedback
  const [activeButtons, setActiveButtons] = useState<{
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    spit: boolean;
  }>({
    left: false,
    right: false,
    up: false,
    down: false,
    spit: false,
  });

  // Handle High-DPI / Retina Canvas Resizing
  const handleResize = useCallback(() => {
    if (!canvasRef.current || !containerRef.current || !engineRef.current) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      (ctx as any).mozImageSmoothingEnabled = false;
      (ctx as any).webkitImageSmoothingEnabled = false;
      ctx.resetTransform?.();
      ctx.scale(dpr * (width / 800), dpr * (height / 600));
    }

    engineRef.current.screenWidth = 800;
    engineRef.current.screenHeight = 600;
  }, []);

  // Initialize Game Engine
  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new GameEngine(canvasRef.current);
    engineRef.current = engine;

    setHighScore(engine.highScore);

    const prevScreen = { current: engine.currentScreen };

    engine.onStateChange = (state) => {
      // If screen transitions, purge all residual input and touch states
      if (state.screen !== prevScreen.current) {
        prevScreen.current = state.screen;
        touchMapRef.current.clear();
        setActiveButtons({ left: false, right: false, up: false, down: false, spit: false });
        engine.resetInputStates();
      }

      setHudState({ ...state });
      if (engine.highScore > highScore) {
        setHighScore(engine.highScore);
      }
    };

    handleResize();
    engine.init();

    window.addEventListener('resize', handleResize);

    // Global touch and mouse cleanups so releasing finger anywhere clears inputs
    const handleGlobalRelease = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        touchMapRef.current.clear();
        setActiveButtons({ left: false, right: false, up: false, down: false, spit: false });
        engineRef.current?.resetInputStates();
      }
    };
    const handleGlobalMouseUp = () => {
      setActiveButtons({ left: false, right: false, up: false, down: false, spit: false });
      engineRef.current?.resetInputStates();
    };

    window.addEventListener('touchend', handleGlobalRelease, { passive: true });
    window.addEventListener('touchcancel', handleGlobalRelease, { passive: true });
    window.addEventListener('mouseup', handleGlobalMouseUp);

    // Auto-pause when user switches tabs or apps (Visibility Change)
    const handleVisibilityChange = () => {
      if (document.hidden && engineRef.current?.currentScreen === 'PLAYING') {
        engineRef.current.setScreen('PAUSED');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('touchend', handleGlobalRelease);
      window.removeEventListener('touchcancel', handleGlobalRelease);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      engine.destroy();
    };
  }, [handleResize]);

  // Keyboard Event Listeners for Desktop testing
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!engineRef.current) return;
      const key = e.code;

      if (key === 'ArrowLeft' || key === 'KeyA') {
        engineRef.current.setKey('left', true);
        setActiveButtons((prev) => ({ ...prev, left: true }));
      } else if (key === 'ArrowRight' || key === 'KeyD') {
        engineRef.current.setKey('right', true);
        setActiveButtons((prev) => ({ ...prev, right: true }));
      } else if (key === 'ArrowUp' || key === 'KeyW' || key === 'Space') {
        engineRef.current.setKey('up', true);
        setActiveButtons((prev) => ({ ...prev, up: true }));
      } else if (key === 'ArrowDown' || key === 'KeyS') {
        engineRef.current.setKey('down', true);
        setActiveButtons((prev) => ({ ...prev, down: true }));
      } else if (key === 'KeyJ' || key === 'KeyZ' || key === 'KeyF' || key === 'Enter') {
        engineRef.current.setKey('spit', true);
        setActiveButtons((prev) => ({ ...prev, spit: true }));
      } else if (key === 'KeyP' || key === 'Escape') {
        togglePause();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (!engineRef.current) return;
      const key = e.code;

      if (key === 'ArrowLeft' || key === 'KeyA') {
        engineRef.current.setKey('left', false);
        setActiveButtons((prev) => ({ ...prev, left: false }));
      } else if (key === 'ArrowRight' || key === 'KeyD') {
        engineRef.current.setKey('right', false);
        setActiveButtons((prev) => ({ ...prev, right: false }));
      } else if (key === 'ArrowUp' || key === 'KeyW' || key === 'Space') {
        engineRef.current.setKey('up', false);
        setActiveButtons((prev) => ({ ...prev, up: false }));
      } else if (key === 'ArrowDown' || key === 'KeyS') {
        engineRef.current.setKey('down', false);
        setActiveButtons((prev) => ({ ...prev, down: false }));
      } else if (key === 'KeyJ' || key === 'KeyZ' || key === 'KeyF' || key === 'Enter') {
        engineRef.current.setKey('spit', false);
        setActiveButtons((prev) => ({ ...prev, spit: false }));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Release all inputs on window blur
    const onWindowBlur = () => {
      touchMapRef.current.clear();
      setActiveButtons({ left: false, right: false, up: false, down: false, spit: false });
      engineRef.current?.resetInputStates();
    };
    window.addEventListener('blur', onWindowBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, []);

  // Multi-Touch Handlers (independent touch IDs for left thumb and right thumb)
  const handleTouchStart = (action: 'left' | 'right' | 'up' | 'down' | 'spit', e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!engineRef.current) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      touchMapRef.current.set(touch.identifier, action);
    }

    setActiveButtons((prev) => ({ ...prev, [action]: true }));
    engineRef.current.setKey(action, true);
  };

  const handleTouchEnd = (action: 'left' | 'right' | 'up' | 'down' | 'spit', e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!engineRef.current) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      touchMapRef.current.delete(touch.identifier);
    }

    // Check if any other touch is still on this action
    let stillPressed = false;
    for (const act of touchMapRef.current.values()) {
      if (act === action) {
        stillPressed = true;
        break;
      }
    }

    if (!stillPressed) {
      setActiveButtons((prev) => ({ ...prev, [action]: false }));
      engineRef.current.setKey(action, false);
    }
  };

  // Mouse Handlers for Desktop clicking
  const handleMouseDown = (action: 'left' | 'right' | 'up' | 'down' | 'spit', e: React.MouseEvent) => {
    e.preventDefault();
    if (!engineRef.current) return;
    setActiveButtons((prev) => ({ ...prev, [action]: true }));
    engineRef.current.setKey(action, true);
  };

  const handleMouseUp = (action: 'left' | 'right' | 'up' | 'down' | 'spit', e: React.MouseEvent) => {
    e.preventDefault();
    if (!engineRef.current) return;
    setActiveButtons((prev) => ({ ...prev, [action]: false }));
    engineRef.current.setKey(action, false);
  };

  // Toggle Mute
  const handleToggleMute = () => {
    if (!engineRef.current) return;
    const active = engineRef.current.toggleMute();
    setSoundEnabled(active);
  };

  // Toggle Haptics
  const handleToggleHaptics = () => {
    if (!engineRef.current) return;
    const active = engineRef.current.toggleHaptics();
    setHapticsEnabled(active);
  };

  // Clear all button states and engine keys
  const clearAllInputs = () => {
    touchMapRef.current.clear();
    setActiveButtons({ left: false, right: false, up: false, down: false, spit: false });
    engineRef.current?.resetInputStates();
  };

  // Toggle Pause
  const togglePause = () => {
    if (!engineRef.current) return;
    clearAllInputs();
    if (hudState.screen === 'PLAYING') {
      engineRef.current.setScreen('PAUSED');
    } else if (hudState.screen === 'PAUSED') {
      engineRef.current.setScreen('PLAYING');
    }
  };

  // Title -> Stage 1 Intermission
  const handleStartTitle = () => {
    if (!engineRef.current) return;
    clearAllInputs();
    soundEngine.playJump();
    triggerHaptic('tap', hapticsEnabled);
    engineRef.current.loadStage(0);
    engineRef.current.setScreen('INTERMISSION');
  };

  // Start Stage
  const handleStartStage = () => {
    if (!engineRef.current) return;
    clearAllInputs();
    soundEngine.playJump();
    triggerHaptic('tap', hapticsEnabled);
    engineRef.current.startStage();
  };

  // Retry Current Stage
  const handleRetryStage = () => {
    if (!engineRef.current) return;
    clearAllInputs();
    soundEngine.playJump();
    triggerHaptic('tap', hapticsEnabled);
    engineRef.current.retryStage();
  };

  // Restart From Stage 1
  const handleRestartGame = () => {
    if (!engineRef.current) return;
    clearAllInputs();
    soundEngine.playJump();
    triggerHaptic('tap', hapticsEnabled);
    engineRef.current.restartGame();
  };

  const currentStageInfo = STAGE_CONFIGS[hudState.stageIndex] || STAGE_CONFIGS[0];

  return (
    <div className="w-full h-full min-h-screen bg-[#070b12] text-slate-100 flex items-center justify-center select-none overflow-hidden touch-none p-0 md:p-3">
      <div
        className={`w-full h-full flex flex-col justify-between overflow-hidden relative ${
          arcadeBezel
            ? 'max-w-[480px] max-h-[960px] md:shadow-[0_0_50px_rgba(240,98,146,0.3)] md:border-4 md:border-[#000] bg-[#0f172a]'
            : 'w-screen h-screen'
        }`}
      >
        {/* CRT Scanline Overlay for authentic 80s/90s arcade cabinet feel */}
        <div className="absolute inset-0 crt-scanlines pointer-events-none z-50 opacity-35" />

        {/* ============================================================== */}
        {/* ZONE 1: TOP HUD & SETTINGS BAR (Pixel Art Arcade Styling)       */}
        {/* ============================================================== */}
        <header className="h-16 shrink-0 bg-[#0a0f1d] border-b-4 border-black px-3 py-2 flex items-center justify-between z-30 select-none">
          {/* Left HUD: Health & Stage */}
          <div className="flex items-center gap-2">
            {/* Pixel Hearts */}
            <div className="flex items-center gap-1.5 bg-[#000000] px-2 py-1.5 border-2 border-black shadow-[2px_2px_0px_#000]">
              {[0, 1, 2].map((i) => (
                <PixelHeart key={i} filled={i < hudState.hp} />
              ))}
            </div>

            {/* Stage badge */}
            <div className="text-[9px] font-bold px-2 py-1 bg-[#831843] text-[#fbcfe8] border-2 border-black shadow-[2px_2px_0px_#000]">
              STAGE {hudState.stageIndex + 1}/{hudState.totalStages}
            </div>

            {/* Combo Multiplier badge */}
            {hudState.combo >= 2 && (
              <div className="text-[9px] font-black px-1.5 py-0.5 bg-[#facc15] text-black border-2 border-black shadow-[2px_2px_0px_#000] animate-bounce flex items-center gap-1">
                <Zap size={10} className="fill-black" />
                x{Math.min(4, hudState.combo)}
              </div>
            )}
          </div>

          {/* Center HUD: Score & Ammo */}
          <div className="flex items-center gap-2 text-[9px] font-bold">
            <div className="flex items-center gap-1 bg-[#451a03] text-[#fde047] px-2 py-1 border-2 border-black shadow-[2px_2px_0px_#000]">
              <PixelShroom />
              <span>{hudState.score.toLocaleString()}</span>
            </div>

            <div className="flex items-center gap-1 bg-[#082f49] text-[#7dd3fc] px-2 py-1 border-2 border-black shadow-[2px_2px_0px_#000]">
              <PixelDrop />
              <span>x{hudState.ammo}</span>
              {hudState.megaAmmo > 0 && (
                <span className="text-amber-300 font-black ml-0.5" title="Golden Mega Spit">
                  🌟{hudState.megaAmmo}
                </span>
              )}
            </div>
          </div>

          {/* Right Controls: Minimalist Pixel Toggles */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleToggleMute}
              className="w-7 h-7 pixel-btn bg-[#1e293b] hover:bg-[#334155] flex items-center justify-center text-slate-200 border-2 border-black shadow-[2px_2px_0px_#000]"
              title={soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
              aria-label="Toggle Sound"
            >
              {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} className="text-rose-400" />}
            </button>

            <button
              onClick={handleToggleHaptics}
              className="w-7 h-7 pixel-btn bg-[#1e293b] hover:bg-[#334155] items-center justify-center text-slate-200 border-2 border-black shadow-[2px_2px_0px_#000] hidden sm:flex"
              title={hapticsEnabled ? 'Disable Haptics' : 'Enable Haptics'}
              aria-label="Toggle Haptics"
            >
              {hapticsEnabled ? <SmartphoneNfc size={13} className="text-pink-400" /> : <Smartphone size={13} className="text-slate-500" />}
            </button>

            <button
              onClick={togglePause}
              disabled={hudState.screen !== 'PLAYING' && hudState.screen !== 'PAUSED'}
              className="w-7 h-7 pixel-btn bg-[#1e293b] hover:bg-[#334155] flex items-center justify-center text-slate-200 border-2 border-black shadow-[2px_2px_0px_#000] disabled:opacity-40"
              title="Pause Game"
              aria-label="Pause Game"
            >
              {hudState.screen === 'PAUSED' ? <Play size={12} className="text-emerald-400 fill-emerald-400" /> : <Pause size={12} />}
            </button>

            <button
              onClick={() => setArcadeBezel(!arcadeBezel)}
              className="w-7 h-7 pixel-btn bg-[#1e293b] hover:bg-[#334155] items-center justify-center text-slate-400 hover:text-white border-2 border-black shadow-[2px_2px_0px_#000] hidden md:flex"
              title="Toggle Cabinet Frame"
            >
              {arcadeBezel ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
            </button>
          </div>
        </header>

        {/* PROMINENT PIXEL BOSS HP BAR AT TOP */}
        {hudState.bossActive && (
          <div className="absolute top-16 left-2 right-2 z-20 px-3 py-2 bg-[#450a0a] border-4 border-black shadow-[4px_4px_0px_#000]">
            <div className="flex items-center justify-between text-[9px] font-black text-red-200 mb-1.5 tracking-wider">
              <span>⚠️ BOSS: {hudState.bossName.toUpperCase()}</span>
              <span className="text-[#fde047]">
                {hudState.bossHp}/{hudState.bossMaxHp} HP
              </span>
            </div>
            <div className="w-full h-3 bg-black border-2 border-black p-0.5">
              <div
                className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-400 transition-all duration-200"
                style={{
                  width: `${Math.max(0, (hudState.bossHp / hudState.bossMaxHp) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* UNDERGROUND OXYGEN GAUGE */}
        {hudState.isBurrowed && (
          <div className="absolute top-20 right-3 z-20 flex items-center gap-1.5 bg-[#451a03] border-2 border-black px-2.5 py-1 text-[9px] font-bold text-[#fde047] shadow-[2px_2px_0px_#000]">
            <span>🫧 AIR</span>
            <span>{Math.round(hudState.oxygen)}%</span>
            <div className="w-12 h-2 bg-black border border-black p-0.5">
              <div
                className={`h-full ${hudState.oxygen > 30 ? 'bg-sky-400' : 'bg-red-500'}`}
                style={{ width: `${hudState.oxygen}%` }}
              />
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* ZONE 2: GAMEPLAY CANVAS ZONE                                   */}
        {/* ============================================================== */}
        <div
          ref={containerRef}
          className="flex-1 w-full relative overflow-hidden bg-[#182338] touch-none select-none flex items-center justify-center"
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full block touch-none cursor-crosshair"
            onContextMenu={(e) => e.preventDefault()}
          />

          {/* ------------------------------------------------------------ */}
          {/* SCREEN: TITLE SCREEN (Pixel Art Arcade)                      */}
          {/* ------------------------------------------------------------ */}
          {hudState.screen === 'TITLE' && (
            <div className="absolute inset-0 bg-slate-950/92 flex flex-col items-center justify-between p-5 z-40 text-center animate-fadeIn">
              <div className="pt-2 flex flex-col items-center">
                <div className="text-[9px] uppercase tracking-widest text-[#f472b6] font-bold mb-1">
                  16-BIT ARCADE ACTION
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-pink-400 drop-shadow-[3px_3px_0px_#000] tracking-tight leading-tight">
                  SUPER PINK WORM
                </h1>
                <div className="text-[10px] font-bold text-amber-300 drop-shadow-[2px_2px_0px_#000] tracking-wider mt-1">
                  ARCADE ADVENTURE
                </div>
              </div>

              {/* 16-Bit Pixel Mascot */}
              <div className="py-2 flex flex-col items-center">
                <div className="p-3 pixel-box bg-[#1e293b] flex items-center justify-center animate-bounce">
                  <PixelWormMascot />
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[9px] text-amber-300 bg-[#451a03] px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_#000]">
                  <Trophy size={13} className="text-amber-400" />
                  <span>HIGH SCORE: {highScore.toLocaleString()}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="w-full max-w-xs flex flex-col gap-2.5 pb-2">
                <button
                  onClick={handleStartTitle}
                  className="w-full py-3.5 pixel-btn bg-[#f43f5e] hover:bg-[#fb7185] text-white font-black text-xs tracking-wider flex items-center justify-center gap-2 animate-pulse"
                >
                  <Play size={16} className="fill-white" />
                  TAP TO START
                </button>

                <button
                  onClick={() => setShowHowToPlay(!showHowToPlay)}
                  className="w-full py-2.5 pixel-btn bg-[#1e293b] hover:bg-[#334155] text-slate-200 font-bold text-[9px] flex items-center justify-center gap-1.5"
                >
                  <Info size={13} />
                  HOW TO PLAY & CONTROLS
                </button>
              </div>

              {/* Instructions Modal (Pixel Box) */}
              {showHowToPlay && (
                <div className="absolute inset-3 bg-[#0a0f1d] border-4 border-black p-4 flex flex-col justify-between z-50 text-left text-[9px] shadow-[6px_6px_0px_#000] overflow-y-auto">
                  <div>
                    <h3 className="text-xs font-black text-pink-300 mb-3 flex items-center gap-1.5 border-b-2 border-black pb-1.5">
                      <Sparkles size={14} /> HOW TO PLAY
                    </h3>
                    <ul className="space-y-2.5 text-slate-200 leading-relaxed">
                      <li>
                        <strong className="text-amber-300">⛏️ DIG (BURROW):</strong> Submerge safely beneath the soil to bypass hazards and frontal armor!
                      </li>
                      <li>
                        <strong className="text-pink-400">💥 AMBUSH POP-UP:</strong> While burrowed under enemies, press <span className="text-white font-black">JUMP</span> to burst out and launch them!
                      </li>
                      <li>
                        <strong className="text-sky-300">🎯 HEADBUTT:</strong> Leap upwards (<span className="text-white">vy &lt; 0</span>) into Birds or Spiders from below to defeat them!
                      </li>
                      <li>
                        <strong className="text-emerald-300">🪜 CLIMBING:</strong> Touch tree trunks and hold <span className="text-white font-black">UP</span> to scale branches.
                      </li>
                      <li>
                        <strong className="text-yellow-300">⚡ COMBOS:</strong> Chain quick defeats for up to <span className="text-amber-400 font-black">x4 MULTIPLIERS</span>!
                      </li>
                    </ul>

                    <div className="mt-3 pt-2.5 border-t-2 border-black flex items-center justify-between">
                      <span className="text-[8px] text-slate-400">Offline Single-File:</span>
                      <a
                        href="/super-pink-worm-standalone.html"
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 bg-[#831843] text-pink-200 hover:bg-pink-800 border-2 border-black text-[8px] font-bold"
                      >
                        STANDALONE HTML ↗
                      </a>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowHowToPlay(false)}
                    className="w-full mt-3 py-2 pixel-btn bg-[#f43f5e] text-white font-black text-[10px]"
                  >
                    CLOSE
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ------------------------------------------------------------ */}
          {/* SCREEN: STAGE INTERMISSION (Pixel Art Get Ready)             */}
          {/* ------------------------------------------------------------ */}
          {hudState.screen === 'INTERMISSION' && (
            <div className="absolute inset-0 bg-slate-950/94 flex flex-col items-center justify-between p-4 z-40 text-center animate-fadeIn overflow-y-auto">
              <div className="pt-1">
                <div className="text-[9px] uppercase tracking-widest text-pink-400 font-black mb-1">
                  GET READY!
                </div>
                <h2 className="text-base sm:text-lg font-black text-white drop-shadow-[2px_2px_0px_#000]">
                  {currentStageInfo.name}
                </h2>
                <div className="text-[9px] text-slate-400 mt-0.5">
                  {currentStageInfo.subtitle}
                </div>
              </div>

              {/* ENEMY GUIDE & COMBAT INSTRUCTIONS */}
              <div className="w-full max-w-sm flex flex-col gap-2 my-2">
                <div className="text-[8px] uppercase tracking-wider text-pink-400 font-black text-left px-1">
                  ENEMIES & WEAKNESSES:
                </div>
                {currentStageInfo.enemyGuides.map((guide, idx) => (
                  <div
                    key={idx}
                    className="bg-[#1e293b] border-2 border-black shadow-[2px_2px_0px_#000] p-2 text-left flex items-start gap-2.5"
                  >
                    <span className="text-xl shrink-0 mt-0.5">{guide.icon}</span>
                    <div>
                      <div className="text-[9px] font-black text-amber-300">{guide.name}</div>
                      <div className="text-[8px] text-slate-300 mt-0.5 leading-snug">
                        {guide.weakness}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Start Stage Button */}
              <div className="w-full max-w-xs pb-1">
                <button
                  onClick={handleStartStage}
                  className="w-full py-3 pixel-btn bg-[#10b981] hover:bg-[#34d399] text-white font-black text-xs tracking-wider flex items-center justify-center gap-2 animate-pulse"
                >
                  <Play size={14} className="fill-white" />
                  START STAGE
                </button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------ */}
          {/* SCREEN: PAUSED                                               */}
          {/* ------------------------------------------------------------ */}
          {hudState.screen === 'PAUSED' && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 z-40 text-center animate-fadeIn">
              <h2 className="text-lg font-black text-white drop-shadow-[3px_3px_0px_#000] mb-6">
                GAME PAUSED
              </h2>

              <div className="w-full max-w-xs flex flex-col gap-3">
                <button
                  onClick={togglePause}
                  className="w-full py-3 pixel-btn bg-[#f43f5e] hover:bg-[#fb7185] text-white font-black text-xs flex items-center justify-center gap-2"
                >
                  <Play size={14} className="fill-white" /> RESUME
                </button>

                <button
                  onClick={handleRetryStage}
                  className="w-full py-3 pixel-btn bg-[#2563eb] hover:bg-[#3b82f6] text-white font-black text-xs flex items-center justify-center gap-2"
                >
                  <RotateCcw size={14} /> RETRY STAGE
                </button>

                <button
                  onClick={handleRestartGame}
                  className="w-full py-2.5 pixel-btn bg-[#1e293b] hover:bg-[#334155] text-slate-300 font-black text-[9px]"
                >
                  EXIT TO TITLE
                </button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------ */}
          {/* SCREEN: GAME OVER                                            */}
          {/* ------------------------------------------------------------ */}
          {hudState.screen === 'GAME_OVER' && (
            <div className="absolute inset-0 bg-slate-950/94 flex flex-col items-center justify-between p-6 z-40 text-center animate-fadeIn">
              <div className="pt-4">
                <div className="text-2xl font-black text-rose-500 drop-shadow-[3px_3px_0px_#000] tracking-tight mb-1">
                  GAME OVER
                </div>
                <p className="text-[9px] text-slate-400">All hearts were lost!</p>
              </div>

              <div className="w-full max-w-xs bg-[#1e293b] border-4 border-black shadow-[4px_4px_0px_#000] p-3 flex flex-col gap-2">
                <div className="flex justify-between text-[9px] text-slate-400">
                  <span>FINAL SCORE</span>
                  <span className="font-bold text-amber-300">
                    {hudState.score.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-[9px] text-slate-400">
                  <span>MUSHROOMS</span>
                  <span className="font-bold text-pink-300">
                    {hudState.mushrooms} 🍄
                  </span>
                </div>
                <div className="flex justify-between text-[9px] text-slate-400">
                  <span>STAGE REACHED</span>
                  <span className="font-bold text-slate-200">
                    STAGE {hudState.stageIndex + 1}
                  </span>
                </div>
              </div>

              <div className="w-full max-w-xs flex flex-col gap-2.5 pb-2">
                <button
                  onClick={handleRetryStage}
                  className="w-full py-3 pixel-btn bg-[#f43f5e] text-white font-black text-xs flex items-center justify-center gap-2"
                >
                  <RotateCcw size={14} /> RETRY STAGE
                </button>
                <button
                  onClick={handleRestartGame}
                  className="w-full py-2.5 pixel-btn bg-[#1e293b] text-slate-300 font-black text-[9px]"
                >
                  RESTART STAGE 1
                </button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------ */}
          {/* SCREEN: VICTORY & CREDITS                                    */}
          {/* ------------------------------------------------------------ */}
          {hudState.screen === 'VICTORY' && (
            <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-between p-5 z-40 text-center animate-fadeIn overflow-y-auto">
              <div className="pt-2">
                <div className="text-[9px] uppercase tracking-widest text-amber-400 font-black mb-1">
                  STAGE 6 CLEARED!
                </div>
                <h2 className="text-lg sm:text-xl font-black text-amber-300 drop-shadow-[3px_3px_0px_#000] tracking-tight">
                  VICTORY CHAMPION!
                </h2>
                <p className="text-[9px] text-slate-300 mt-1">
                  You claimed the legendary Giant Golden Mushroom!
                </p>
              </div>

              <div className="w-full max-w-xs bg-[#1e293b] border-4 border-black shadow-[4px_4px_0px_#000] p-3 flex flex-col gap-2">
                <div className="flex justify-center gap-2 text-xl text-amber-400 mb-1">
                  <span>⭐</span>
                  <span>⭐</span>
                  <span>⭐</span>
                </div>
                <div className="flex justify-between text-[9px] text-slate-400">
                  <span>TOTAL SCORE:</span>
                  <span className="font-bold text-amber-300">
                    {hudState.score.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-[9px] text-slate-400">
                  <span>MUSHROOMS:</span>
                  <span className="font-bold text-pink-300">
                    {hudState.mushrooms} 🍄
                  </span>
                </div>
                <div className="flex justify-between text-[9px] text-slate-400">
                  <span>REMAINING HEARTS:</span>
                  <span className="font-bold text-rose-400">
                    {hudState.hp} / 3 ❤️
                  </span>
                </div>
              </div>

              {/* ARCADE CREDITS */}
              <div className="text-[8px] text-slate-400 py-2 border-t-2 border-b-2 border-black w-full max-w-xs leading-relaxed">
                <div className="font-bold text-pink-300 text-[9px]">SUPER PINK WORM ARCADE</div>
                <div className="mt-1 text-slate-300">Created with Love by Yaakov Hameiri</div>
                <div className="text-slate-500 mt-0.5">Thank you for playing!</div>
              </div>

              <div className="w-full max-w-xs pb-2">
                <button
                  onClick={handleRestartGame}
                  className="w-full py-3 pixel-btn bg-[#f59e0b] text-black font-black text-xs flex items-center justify-center gap-2"
                >
                  <RotateCcw size={14} /> PLAY AGAIN
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* ZONE 3: BOTTOM VIRTUAL GAMEPAD (Chunky Retro Arcade Buttons)   */}
        {/* ============================================================== */}
        <footer className="h-36 shrink-0 bg-[#090d16] border-t-4 border-black px-4 py-2.5 flex items-center justify-between z-30 select-none">
          {/* Left Controls: Directional D-Pad Buttons */}
          <div className="flex items-center gap-3">
            <button
              onMouseDown={(e) => handleMouseDown('left', e)}
              onMouseUp={(e) => handleMouseUp('left', e)}
              onMouseLeave={(e) => handleMouseUp('left', e)}
              onTouchStart={(e) => handleTouchStart('left', e)}
              onTouchEnd={(e) => handleTouchEnd('left', e)}
              onTouchCancel={(e) => handleTouchEnd('left', e)}
              className={`w-14 h-14 sm:w-16 sm:h-16 pixel-btn flex items-center justify-center border-4 border-black transition-all ${
                activeButtons.left
                  ? 'bg-[#ec4899] text-white translate-x-1 translate-y-1 shadow-none'
                  : 'bg-[#1e293b] text-slate-200 shadow-[4px_4px_0px_#000]'
              }`}
              aria-label="Move Left"
            >
              <ChevronLeft size={34} strokeWidth={3} />
            </button>

            <button
              onMouseDown={(e) => handleMouseDown('right', e)}
              onMouseUp={(e) => handleMouseUp('right', e)}
              onMouseLeave={(e) => handleMouseUp('right', e)}
              onTouchStart={(e) => handleTouchStart('right', e)}
              onTouchEnd={(e) => handleTouchEnd('right', e)}
              onTouchCancel={(e) => handleTouchEnd('right', e)}
              className={`w-14 h-14 sm:w-16 sm:h-16 pixel-btn flex items-center justify-center border-4 border-black transition-all ${
                activeButtons.right
                  ? 'bg-[#ec4899] text-white translate-x-1 translate-y-1 shadow-none'
                  : 'bg-[#1e293b] text-slate-200 shadow-[4px_4px_0px_#000]'
              }`}
              aria-label="Move Right"
            >
              <ChevronRight size={34} strokeWidth={3} />
            </button>
          </div>

          {/* Right Action Buttons: DIG, SPIT, JUMP */}
          <div className="flex items-center gap-2.5">
            <button
              onMouseDown={(e) => handleMouseDown('down', e)}
              onMouseUp={(e) => handleMouseUp('down', e)}
              onMouseLeave={(e) => handleMouseUp('down', e)}
              onTouchStart={(e) => handleTouchStart('down', e)}
              onTouchEnd={(e) => handleTouchEnd('down', e)}
              onTouchCancel={(e) => handleTouchEnd('down', e)}
              className={`w-13 h-13 sm:w-15 sm:h-15 pixel-btn flex flex-col items-center justify-center border-4 border-black transition-all ${
                activeButtons.down
                  ? 'bg-[#b45309] text-white translate-x-1 translate-y-1 shadow-none'
                  : 'bg-[#78350f] text-[#fef3c7] shadow-[4px_4px_0px_#000]'
              }`}
              aria-label="Burrow / Dig"
            >
              <Shovel size={18} strokeWidth={2.4} />
              <span className="text-[8px] font-black tracking-tight mt-0.5">DIG</span>
            </button>

            <button
              onMouseDown={(e) => handleMouseDown('spit', e)}
              onMouseUp={(e) => handleMouseUp('spit', e)}
              onMouseLeave={(e) => handleMouseUp('spit', e)}
              onTouchStart={(e) => handleTouchStart('spit', e)}
              onTouchEnd={(e) => handleTouchEnd('spit', e)}
              onTouchCancel={(e) => handleTouchEnd('spit', e)}
              className={`w-13 h-13 sm:w-15 sm:h-15 pixel-btn flex flex-col items-center justify-center border-4 border-black transition-all ${
                activeButtons.spit
                  ? 'bg-[#0284c7] text-white translate-x-1 translate-y-1 shadow-none'
                  : 'bg-[#0369a1] text-[#e0f2fe] shadow-[4px_4px_0px_#000]'
              }`}
              aria-label="Spit Water"
            >
              <Droplet size={18} className="fill-current" />
              <span className="text-[8px] font-black tracking-tight mt-0.5">SPIT</span>
            </button>

            <button
              onMouseDown={(e) => handleMouseDown('up', e)}
              onMouseUp={(e) => handleMouseUp('up', e)}
              onMouseLeave={(e) => handleMouseUp('up', e)}
              onTouchStart={(e) => handleTouchStart('up', e)}
              onTouchEnd={(e) => handleTouchEnd('up', e)}
              onTouchCancel={(e) => handleTouchEnd('up', e)}
              className={`w-14 h-14 sm:w-16 sm:h-16 pixel-btn flex flex-col items-center justify-center border-4 border-black transition-all ${
                activeButtons.up
                  ? 'bg-[#db2777] text-white translate-x-1 translate-y-1 shadow-none'
                  : 'bg-[#be185d] text-white shadow-[4px_4px_0px_#000]'
              }`}
              aria-label="Jump / Climb / Ambush"
            >
              <ArrowUp size={22} strokeWidth={3} />
              <span className="text-[8px] font-black tracking-tight mt-0.5">JUMP</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
