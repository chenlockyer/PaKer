
/// <reference lib="dom" />
import React, { useState, useCallback, useEffect, useRef } from 'react';
import GameScene from './components/GameScene';
import UIOverlay from './components/UIOverlay';
import MainMenu from './components/MainMenu';
import SettingsModal from './components/SettingsModal';
import {
  CardData,
  RotationPreset,
  InteractionMode,
  PointerMode,
  AppState,
  GameMode,
  ChallengePhase,
  ChallengeLevel,
  ChallengeTestType,
  CardSize,
  AppTheme,
  CARD_DIMENSIONS
} from './types';
import { translations } from './utils/translations';
import {
  playCountdownSound,
  playFailureSound,
  playSuccessSound
} from './services/audioService';

const DEG_10 = Math.PI / 18;
const CHALLENGE_LEVELS: ChallengeLevel[] = [
  {
    id: 'a-frame',
    name: { zh: 'A 字架入门', en: 'A-Frame Basics' },
    description: {
      zh: '只使用 2 张牌搭建一个能够独立站立的 A 字架',
      en: 'Build a freestanding A-frame using only 2 cards'
    },
    maxCards: 2,
    minCards: 2,
    heightMultiplier: 1,
    testDuration: 3,
    testType: ChallengeTestType.STABILITY
  },
  {
    id: 'roof-house',
    name: { zh: '一层纸牌屋', en: 'One-Story House' },
    description: {
      zh: '使用不超过 10 张牌搭建有屋顶的一层房子',
      en: 'Build a roofed one-story house with no more than 10 cards'
    },
    maxCards: 10,
    minCards: 10,
    heightMultiplier: 1,
    testDuration: 5,
    testType: ChallengeTestType.WIND,
    windStrength: 0.018
  },
  {
    id: 'weight-drop',
    name: { zh: '落物冲击', en: 'Drop Impact' },
    description: {
      zh: '搭建一层结构，承受从上方落下的重物冲击',
      en: 'Build one story and survive a weight dropped from above'
    },
    maxCards: 12,
    minCards: 6,
    heightMultiplier: 1,
    testDuration: 6,
    testType: ChallengeTestType.WEIGHT_DROP,
    weightMass: 0.45,
    weightDropOffset: 4
  },
  {
    id: 'two-story-wind',
    name: { zh: '两层风力挑战', en: 'Two-Story Wind Trial' },
    description: {
      zh: '搭建两层纸牌屋，并承受 10 秒轻风',
      en: 'Build two stories and survive 10 seconds of light wind'
    },
    maxCards: 20,
    minCards: 8,
    heightMultiplier: 2,
    testDuration: 10,
    testType: ChallengeTestType.WIND,
    windStrength: 0.07
  }
];
const PRESET_SCHEMA_VERSION = '5';
const BUILT_IN_PRESET_IDS = new Set([
  'flat',
  'stand_x',
  'stand_y',
  'stand_z',
  'lean_fwd',
  'lean_back',
  'lean_left',
  'lean_right',
  'roof_fwd',
  'roof_back',
  'flat_portrait',
  'flat_landscape',
  'short_edge_upright_portrait',
  'short_edge_upright_landscape',
  'long_edge_upright_portrait',
  'long_edge_upright_landscape',
  'short_edge_left_10',
  'short_edge_right_10',
  'short_edge_forward_10',
  'short_edge_backward_10',
  'long_edge_left_10',
  'long_edge_right_10',
  'long_edge_forward_10',
  'long_edge_backward_10',
]);

const DEFAULT_PRESETS: RotationPreset[] = [
  { id: 'flat_portrait', name: 'flatPortrait', icon: '▯', shortcut: '1', rotation: [0, 0, 0] },
  { id: 'flat_landscape', name: 'flatLandscape', icon: '▭', shortcut: '2', rotation: [0, Math.PI / 2, 0] },

  // Zero-tilt upright placements: both grounded-edge choices are available
  // in portrait and landscape world orientations.
  { id: 'short_edge_upright_portrait', name: 'shortEdgeUprightPortrait', icon: '▯', shortcut: '', rotation: [Math.PI / 2, 0, -Math.PI / 2] },
  { id: 'short_edge_upright_landscape', name: 'shortEdgeUprightLandscape', icon: '▭', shortcut: '', rotation: [Math.PI / 2, 0, 0] },
  { id: 'long_edge_upright_portrait', name: 'longEdgeUprightPortrait', icon: '▯', shortcut: '', rotation: [0, 0, Math.PI / 2] },
  { id: 'long_edge_upright_landscape', name: 'longEdgeUprightLandscape', icon: '▭', shortcut: '', rotation: [Math.PI / 2, Math.PI / 2, 0] },

  // Short edge on the floor. Left/right presets include a 90° yaw so the
  // lean direction also implies the requested portrait-facing placement.
  { id: 'short_edge_left_10', name: 'shortEdgeLeft10', icon: '◤', shortcut: '3', rotation: [Math.PI / 2, DEG_10, -Math.PI / 2] },
  { id: 'short_edge_right_10', name: 'shortEdgeRight10', icon: '◥', shortcut: '4', rotation: [Math.PI / 2, -DEG_10, -Math.PI / 2] },
  { id: 'short_edge_forward_10', name: 'shortEdgeForward10', icon: '◢', shortcut: '5', rotation: [Math.PI / 2 - DEG_10, 0, 0] },
  { id: 'short_edge_backward_10', name: 'shortEdgeBackward10', icon: '◣', shortcut: '6', rotation: [Math.PI / 2 + DEG_10, 0, 0] },

  // Long edge on the floor. Forward/back presets include a 90° yaw so the
  // lean direction also implies the requested landscape-facing placement.
  { id: 'long_edge_left_10', name: 'longEdgeLeft10', icon: '◤', shortcut: '7', rotation: [0, 0, Math.PI / 2 + DEG_10] },
  { id: 'long_edge_right_10', name: 'longEdgeRight10', icon: '◥', shortcut: '8', rotation: [0, 0, Math.PI / 2 - DEG_10] },
  { id: 'long_edge_forward_10', name: 'longEdgeForward10', icon: '◢', shortcut: '9', rotation: [Math.PI / 2 - DEG_10, Math.PI / 2, 0] },
  { id: 'long_edge_backward_10', name: 'longEdgeBackward10', icon: '◣', shortcut: '0', rotation: [Math.PI / 2 + DEG_10, Math.PI / 2, 0] },
];

const App: React.FC = () => {
  // --- STATE: GLOBAL ---
  const [appState, setAppState] = useState<AppState>(AppState.MENU);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.CHALLENGE);
  const [showSettings, setShowSettings] = useState(false);
  const [lang, setLang] = useState<'en' | 'zh'>('zh');
  const [theme, setTheme] = useState<AppTheme>(() => {
    const savedTheme = localStorage.getItem('hoc_theme');
    return savedTheme === 'warm' || savedTheme === 'dark' ? savedTheme : 'blue';
  });
  const [cardSize, setCardSize] = useState<CardSize>(() => {
    const savedSize = localStorage.getItem('hoc_card_size');
    return savedSize === CardSize.POKER ? CardSize.POKER : CardSize.BRIDGE;
  });

  // --- STATE: GAME DATA ---
  const [presets, setPresets] = useState<RotationPreset[]>(() => {
    try {
      const saved = localStorage.getItem('hoc_presets');
      if (!saved) return DEFAULT_PRESETS;

      const savedPresets = JSON.parse(saved) as RotationPreset[];
      const savedVersion = localStorage.getItem('hoc_presets_version');
      if (savedVersion === PRESET_SCHEMA_VERSION) return savedPresets;

      const customPresets = savedPresets.filter(
        preset => !BUILT_IN_PRESET_IDS.has(preset.id)
      );
      return [...DEFAULT_PRESETS, ...customPresets];
    } catch (e) {
      console.error("Failed to load presets", e);
      return DEFAULT_PRESETS;
    }
  });

  const [currentPresetId, setCurrentPresetId] = useState<string>(DEFAULT_PRESETS[0].id);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>(InteractionMode.QUICK);
  const [pointerMode, setPointerMode] = useState<PointerMode>(PointerMode.PLACE);
  const [isFreezeMode, setIsFreezeMode] = useState(false);
  const [cards, setCards] = useState<CardData[]>([]);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [challengePhase, setChallengePhase] = useState<ChallengePhase>(ChallengePhase.BUILDING);
  const [countdown, setCountdown] = useState(3);
  const [testTimeRemaining, setTestTimeRemaining] = useState(CHALLENGE_LEVELS[0].testDuration);
  const [liveHeight, setLiveHeight] = useState(0);
  const [challengeScore, setChallengeScore] = useState(0);
  const [challengeStars, setChallengeStars] = useState(0);
  const liveHeightRef = useRef(0);

  // Persistence for Presets
  useEffect(() => {
    localStorage.setItem('hoc_presets', JSON.stringify(presets));
    localStorage.setItem('hoc_presets_version', PRESET_SCHEMA_VERSION);
  }, [presets]);

  useEffect(() => {
    localStorage.setItem('hoc_card_size', cardSize);
  }, [cardSize]);

  useEffect(() => {
    localStorage.setItem('hoc_theme', theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const currentPreset = presets.find(p => p.id === currentPresetId) || presets[0];
  const currentLevel = CHALLENGE_LEVELS[currentLevelIndex];
  const challengeTargetHeight =
    Math.floor(
      CARD_DIMENSIONS[cardSize].width *
      Math.cos(DEG_10) *
      currentLevel.heightMultiplier *
      10
    ) / 10;

  // --- LOGIC: PRESETS ---
  const addPreset = useCallback(() => {
    const newPreset: RotationPreset = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'New Preset',
      icon: '★',
      shortcut: '',
      rotation: [0, 0, 0]
    };
    setPresets(prev => [...prev, newPreset]);
    setCurrentPresetId(newPreset.id);
  }, []);

  const updatePreset = useCallback((updated: RotationPreset) => {
    setPresets(prev => prev.map(p => p.id === updated.id ? updated : p));
  }, []);

  const deletePreset = useCallback((id: string) => {
    setPresets(prev => {
      const filtered = prev.filter(p => p.id !== id);
      if (currentPresetId === id && filtered.length > 0) {
        setCurrentPresetId(filtered[0].id);
      }
      return filtered;
    });
  }, [currentPresetId]);

  const resetPresets = useCallback(() => {
    if (confirm('Reset all presets to default?')) {
      setPresets(DEFAULT_PRESETS);
      setCurrentPresetId(DEFAULT_PRESETS[0].id);
    }
  }, []);

  // --- LOGIC: CARDS ---
  const addCard = useCallback((card: CardData) => {
    const newCard = { ...card, locked: isFreezeMode };
    setCards(prev => {
      if (
        gameMode === GameMode.CHALLENGE &&
        (challengePhase !== ChallengePhase.BUILDING || prev.length >= currentLevel.maxCards)
      ) {
        return prev;
      }
      return [...prev, newCard];
    });
  }, [isFreezeMode, gameMode, challengePhase, currentLevel.maxCards]);

  const removeCard = useCallback((id: string) => {
    setCards(prev => prev.filter(c => c.id !== id));
  }, []);

  const updateCard = useCallback((id: string, position: [number, number, number], rotation: [number, number, number]) => {
    setCards(prev => prev.map(c => 
      c.id === id 
        ? { ...c, position, rotation, locked: isFreezeMode }
        : c
    ));
  }, [isFreezeMode]);

  const clearCards = useCallback(() => {
    setCards([]);
    liveHeightRef.current = 0;
    setLiveHeight(0);
    if (gameMode === GameMode.CHALLENGE) {
      setChallengePhase(ChallengePhase.BUILDING);
      setChallengeScore(0);
      setChallengeStars(0);
    }
  }, [gameMode]);

  // --- LOGIC: SAVE/LOAD ---
  const saveGame = useCallback(() => {
    const saveData = {
      cards,
      isFreezeMode
    };
    localStorage.setItem('hoc_save', JSON.stringify(saveData));
    alert(lang === 'zh' ? '游戏已保存' : 'Game Saved');
  }, [cards, isFreezeMode, lang]);

  const loadGame = useCallback(() => {
    try {
      const saved = localStorage.getItem('hoc_save');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.cards) {
          setCards(data.cards);
          setIsFreezeMode(!!data.isFreezeMode);
          alert(lang === 'zh' ? '游戏已读取' : 'Game Loaded');
        }
      } else {
        alert(lang === 'zh' ? '没有找到存档' : 'No save found');
      }
    } catch (e) {
      console.error(e);
      alert(lang === 'zh' ? '读取存档失败' : 'Failed to load save');
    }
  }, [lang]);

  const toggleFreezeMode = useCallback((forceVal?: boolean) => {
    setIsFreezeMode(prev => {
      const newVal = forceVal !== undefined ? forceVal : !prev;
      setCards(currentCards => currentCards.map(c => ({ ...c, locked: newVal })));
      return newVal;
    });
  }, []);

  const handleHeightChange = useCallback((height: number) => {
    liveHeightRef.current = height;
    setLiveHeight(previous => Math.abs(previous - height) >= 0.025 ? height : previous);
  }, []);

  const resetChallengeState = useCallback((testDuration: number) => {
    setCards([]);
    setDraggingCardId(null);
    setPointerMode(PointerMode.PLACE);
    setIsFreezeMode(false);
    setChallengePhase(ChallengePhase.BUILDING);
    setCountdown(3);
    setTestTimeRemaining(testDuration);
    liveHeightRef.current = 0;
    setLiveHeight(0);
    setChallengeScore(0);
    setChallengeStars(0);
  }, []);

  const resetChallenge = useCallback(() => {
    resetChallengeState(currentLevel.testDuration);
  }, [currentLevel.testDuration, resetChallengeState]);

  const startChallenge = useCallback(() => {
    setGameMode(GameMode.CHALLENGE);
    setCurrentLevelIndex(0);
    resetChallengeState(CHALLENGE_LEVELS[0].testDuration);
    setAppState(AppState.GAME);
  }, [resetChallengeState]);

  const advanceChallenge = useCallback(() => {
    const nextLevelIndex = Math.min(currentLevelIndex + 1, CHALLENGE_LEVELS.length - 1);
    setCurrentLevelIndex(nextLevelIndex);
    resetChallengeState(CHALLENGE_LEVELS[nextLevelIndex].testDuration);
  }, [currentLevelIndex, resetChallengeState]);

  const startFreeBuild = useCallback(() => {
    setGameMode(GameMode.FREE);
    setCards([]);
    setIsFreezeMode(false);
    setPointerMode(PointerMode.PLACE);
    setAppState(AppState.GAME);
  }, []);

  const startWindTest = useCallback(() => {
    if (
      challengePhase !== ChallengePhase.BUILDING ||
      cards.length < currentLevel.minCards ||
      liveHeightRef.current < challengeTargetHeight
    ) {
      return;
    }

    toggleFreezeMode(false);
    setDraggingCardId(null);
    setPointerMode(PointerMode.PLACE);
    setCountdown(3);
    setTestTimeRemaining(currentLevel.testDuration);
    setChallengePhase(ChallengePhase.COUNTDOWN);
  }, [
    cards.length,
    challengePhase,
    challengeTargetHeight,
    currentLevel.minCards,
    currentLevel.testDuration,
    toggleFreezeMode
  ]);

  const undoLastCard = useCallback(() => {
    if (challengePhase !== ChallengePhase.BUILDING) return;
    setCards(previous => previous.slice(0, -1));
  }, [challengePhase]);

  useEffect(() => {
    if (challengePhase !== ChallengePhase.COUNTDOWN) return;
    if (countdown <= 0) {
      playCountdownSound(true);
      setChallengePhase(ChallengePhase.TESTING);
      return;
    }

    playCountdownSound();
    const timer = window.setTimeout(() => setCountdown(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [challengePhase, countdown]);

  useEffect(() => {
    if (challengePhase !== ChallengePhase.TESTING) return;

    const timer = window.setInterval(() => {
      setTestTimeRemaining(previous => {
        const next = Math.max(0, previous - 0.1);
        if (next > 0) return next;

        const survived = liveHeightRef.current >= challengeTargetHeight * 0.72;
        if (survived) {
          const unusedCards = currentLevel.maxCards - cards.length;
          const score = Math.round(
            liveHeightRef.current * 100 +
            unusedCards * 50 +
            currentLevel.testDuration * 50
          );
          const stars =
            1 +
            (unusedCards >= 2 ? 1 : 0) +
            (liveHeightRef.current >= challengeTargetHeight + 0.75 ? 1 : 0);
          setChallengeScore(score);
          setChallengeStars(stars);
          setChallengePhase(ChallengePhase.SUCCESS);
        } else {
          setChallengePhase(ChallengePhase.FAILED);
        }
        return 0;
      });
    }, 100);

    return () => window.clearInterval(timer);
  }, [
    challengePhase,
    cards.length,
    challengeTargetHeight,
    currentLevel.maxCards,
    currentLevel.testDuration
  ]);

  useEffect(() => {
    if (challengePhase === ChallengePhase.SUCCESS) {
      playSuccessSound();
    } else if (challengePhase === ChallengePhase.FAILED) {
      playFailureSound();
    }
  }, [challengePhase]);

  const interactionEnabled =
    gameMode === GameMode.FREE ||
    challengePhase === ChallengePhase.BUILDING;
  const windStrength =
    gameMode === GameMode.CHALLENGE &&
    challengePhase === ChallengePhase.TESTING &&
    currentLevel.testType === ChallengeTestType.WIND
      ? (currentLevel.windStrength ?? 0)
      : 0;
  const placementEnabled =
    interactionEnabled &&
    (gameMode === GameMode.FREE || cards.length < currentLevel.maxCards);

  // --- LOGIC: INPUT ---
  useEffect(() => {
    // Only handle global shortcuts in GAME mode
    if (appState !== AppState.GAME) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

      const key = e.key.toLowerCase();

      // Check presets first
      const matchedPreset = presets.find(p => p.shortcut.toLowerCase() === key);
      if (matchedPreset) {
        setCurrentPresetId(matchedPreset.id);
        return;
      }

      switch(key) {
        case 'l':
          if (interactionEnabled) toggleFreezeMode();
          break;
        case 'tab': 
            e.preventDefault();
            setInteractionMode(prev => prev === InteractionMode.QUICK ? InteractionMode.PRECISION : InteractionMode.QUICK);
            break;
        case 'delete':
        case 'backspace':
            setPointerMode(PointerMode.DELETE);
            break;
        case 'escape':
            setPointerMode(PointerMode.PLACE);
            break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFreezeMode, presets, appState, interactionEnabled]);

  // --- RENDER ---
  return (
    <div className="app-shell" data-theme={theme}>
      
      {appState === AppState.MENU && (
        <MainMenu 
           onStartChallenge={startChallenge}
           onStartFree={startFreeBuild}
           onLoad={() => {
              setGameMode(GameMode.FREE);
              loadGame();
              setAppState(AppState.GAME);
           }}
           onSettings={() => setShowSettings(true)}
           hasSave={!!localStorage.getItem('hoc_save')}
           lang={lang}
           theme={theme}
        />
      )}

      {appState === AppState.GAME && (
        <>
          <GameScene 
            rotationPreset={currentPreset}
            interactionMode={interactionMode} 
            pointerMode={pointerMode}
            isFreezeMode={isFreezeMode}
            cards={cards} 
            addCard={addCard} 
            removeCard={removeCard}
            updateCard={updateCard}
            draggingCardId={draggingCardId}
            setDraggingCardId={setDraggingCardId}
            interactionEnabled={interactionEnabled}
            placementEnabled={placementEnabled}
            windStrength={windStrength}
            onHeightChange={handleHeightChange}
            showTargetGuide={gameMode === GameMode.CHALLENGE}
            targetHeight={challengeTargetHeight}
            cardSize={cardSize}
            testType={gameMode === GameMode.CHALLENGE ? currentLevel.testType : ChallengeTestType.STABILITY}
            testActive={challengePhase === ChallengePhase.TESTING}
            weightMass={currentLevel.weightMass ?? 0.45}
            weightDropHeight={challengeTargetHeight + (currentLevel.weightDropOffset ?? 4)}
            theme={theme}
          />
          
          <UIOverlay 
            presets={presets}
            currentPresetId={currentPresetId}
            setPresetId={setCurrentPresetId}
            interactionMode={interactionMode}
            setInteractionMode={setInteractionMode}
            pointerMode={pointerMode}
            setPointerMode={setPointerMode}
            isFreezeMode={isFreezeMode}
            setIsFreezeMode={() => toggleFreezeMode()}
            onClear={clearCards}
            onSave={saveGame}
            onLoad={loadGame}
            cardCount={cards.length}
            lang={lang}
            onOpenSettings={() => setShowSettings(true)}
            onBackToMenu={() => setAppState(AppState.MENU)}
            gameMode={gameMode}
            challengePhase={challengePhase}
            maxCards={currentLevel.maxCards}
            minCards={currentLevel.minCards}
            levelIndex={currentLevelIndex}
            levelCount={CHALLENGE_LEVELS.length}
            levelName={currentLevel.name[lang]}
            levelDescription={currentLevel.description[lang]}
            testType={currentLevel.testType}
            targetHeight={challengeTargetHeight}
            liveHeight={liveHeight}
            countdown={countdown}
            testTimeRemaining={testTimeRemaining}
            score={challengeScore}
            stars={challengeStars}
            onStartTest={startWindTest}
            onRetryChallenge={resetChallenge}
            onUndo={undoLastCard}
            onNextChallenge={advanceChallenge}
            interactionEnabled={interactionEnabled}
            theme={theme}
          />
        </>
      )}

      {/* GLOBAL SETTINGS MODAL */}
      <SettingsModal 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        lang={lang}
        setLang={setLang}
        presets={presets}
        onAddPreset={addPreset}
        onUpdatePreset={updatePreset}
        onDeletePreset={deletePreset}
        onResetPresets={resetPresets}
        cardSize={cardSize}
        setCardSize={setCardSize}
        theme={theme}
        setTheme={setTheme}
      />
    </div>
  );
};

export default App;
