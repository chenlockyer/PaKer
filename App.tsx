
/// <reference lib="dom" />
import React, { useState, useCallback, useEffect, useRef } from 'react';
import GameScene from './components/GameScene';
import UIOverlay from './components/UIOverlay';
import MainMenu from './components/MainMenu';
import SettingsModal from './components/SettingsModal';
import BlueprintStudio from './components/BlueprintStudio';
import LevelStudio from './components/LevelStudio';
import {
  Blueprint,
  BlueprintAssistance,
  BlueprintCameraHint,
  BlueprintGuideProgress,
  BlueprintGuideState,
  BlueprintRecordingState,
  BlueprintSnapshot,
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
  UiScaleSetting,
  CARD_DIMENSIONS,
  LiveCardTransform,
  LevelDefinition,
  LevelTutorialCue,
} from './types';
import { translations } from './utils/translations';
import {
  playCountdownSound,
  playFailureSound,
  playSuccessSound
} from './services/audioService';
import { InputAction, useInput, useInputAction } from './input/InputContext';
import {
  CreateBlueprintInput,
  createBlueprint,
  createBlueprintSnapshot,
  createRecordedBlueprintSteps,
  loadBlueprints,
  persistBlueprints,
} from './services/blueprintService';
import {
  isOfficialTutorial,
  loadTutorialProgress,
  OFFICIAL_TUTORIAL_BLUEPRINTS,
  saveTutorialProgress,
} from './services/officialBlueprints';
import {
  CreateLevelInput,
  createLevel,
  duplicateLevel,
  getLevelValidationIssues,
  loadLevels,
  markLevelPlaytested,
  persistLevels,
  publishLevel,
  updateLevel,
} from './services/levelService';
import {
  DisplayMetrics,
  getBrowserDisplayMetrics,
  loadUiScaleSetting,
  resolveUiScale,
  UI_SCALE_STORAGE_KEY,
} from './services/uiScaleService';
import {
  createGameSave,
  GameSaveSlot,
  getLatestGameSaveSummary,
  loadLatestGameSave,
  persistGameSave,
} from './services/gameSaveService';

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
const EMPTY_BLUEPRINT_PROGRESS: BlueprintGuideProgress = {
  matched: 0,
  near: 0,
  total: 0,
  activeTargetId: null,
  currentStepMatched: 0,
  currentStepTotal: 0,
  currentStepPlayerCardIds: [],
  feedback: 'missing',
  complete: false,
};
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
  const [showBlueprintStudio, setShowBlueprintStudio] = useState(false);
  const [showLevelStudio, setShowLevelStudio] = useState(false);
  const [lang, setLang] = useState<'en' | 'zh'>('zh');
  const [theme, setTheme] = useState<AppTheme>(() => {
    const savedTheme = localStorage.getItem('hoc_theme');
    return savedTheme === 'warm' || savedTheme === 'dark' ? savedTheme : 'blue';
  });
  const [uiScaleSetting, setUiScaleSetting] = useState<UiScaleSetting>(loadUiScaleSetting);
  const [displayMetrics, setDisplayMetrics] = useState<DisplayMetrics>(getBrowserDisplayMetrics);
  const resolvedUiScale = resolveUiScale(uiScaleSetting, displayMetrics);
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
  const [blueprints, setBlueprints] = useState<Blueprint[]>(loadBlueprints);
  const [blueprintSnapshot, setBlueprintSnapshot] = useState<BlueprintSnapshot | null>(null);
  const [blueprintGuide, setBlueprintGuide] = useState<BlueprintGuideState | null>(null);
  const [blueprintRecording, setBlueprintRecording] = useState<BlueprintRecordingState | null>(null);
  const [requestedBlueprintEditorId, setRequestedBlueprintEditorId] = useState<string | null>(null);
  const [blueprintProgress, setBlueprintProgress] = useState<BlueprintGuideProgress>(EMPTY_BLUEPRINT_PROGRESS);
  const [customLevels, setCustomLevels] = useState<LevelDefinition[]>(loadLevels);
  const [activeCustomLevel, setActiveCustomLevel] = useState<LevelDefinition | null>(null);
  const [completedTutorials, setCompletedTutorials] = useState<Set<string>>(loadTutorialProgress);
  const liveCardTransformsRef = useRef(new Map<string, LiveCardTransform>());
  const blueprintCheckpointRef = useRef<CardData[]>([]);
  const blueprintCheckpointReadyRef = useRef(false);
  const cameraHintRef = useRef<BlueprintCameraHint>({
    position: [0, 8, 12],
    target: [0, 0, 0],
  });
  const undoHistoryRef = useRef<CardData[][]>([]);
  const redoHistoryRef = useRef<CardData[][]>([]);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [challengePhase, setChallengePhase] = useState<ChallengePhase>(ChallengePhase.BUILDING);
  const [countdown, setCountdown] = useState(3);
  const [testTimeRemaining, setTestTimeRemaining] = useState(CHALLENGE_LEVELS[0].testDuration);
  const [liveHeight, setLiveHeight] = useState(0);
  const [challengeScore, setChallengeScore] = useState(0);
  const [challengeStars, setChallengeStars] = useState(0);
  const [currentTestStageIndex, setCurrentTestStageIndex] = useState(0);
  const [tutorialCueIndex, setTutorialCueIndex] = useState(0);
  const [tutorialEntryVisible, setTutorialEntryVisible] = useState(false);
  const [saveSummary, setSaveSummary] = useState(() =>
    getLatestGameSaveSummary(localStorage)
  );
  const liveHeightRef = useRef(0);
  const saveStateRef = useRef({
    cards: [] as CardData[],
    cardSize: CardSize.BRIDGE,
    currentPresetId: DEFAULT_PRESETS[0].id,
    isFreezeMode: false,
    draggingCardId: null as string | null,
  });
  const { profile: inputProfile, subscribe: subscribeInput, setSuspended: setInputSuspended } = useInput();

  saveStateRef.current = {
    cards,
    cardSize,
    currentPresetId,
    isFreezeMode,
    draggingCardId,
  };

  const recordCardHistory = useCallback((snapshot: CardData[]) => {
    undoHistoryRef.current = [...undoHistoryRef.current.slice(-49), snapshot];
    redoHistoryRef.current = [];
  }, []);

  const resetCardHistory = useCallback(() => {
    undoHistoryRef.current = [];
    redoHistoryRef.current = [];
  }, []);

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

  useEffect(() => {
    localStorage.setItem(UI_SCALE_STORAGE_KEY, uiScaleSetting);
  }, [uiScaleSetting]);

  useEffect(() => {
    let removeDesktopListener: (() => void) | undefined;
    const updateFromBrowser = () => setDisplayMetrics(getBrowserDisplayMetrics());

    if (window.desktopAPI) {
      void window.desktopAPI.getDisplayMetrics().then(setDisplayMetrics);
      removeDesktopListener = window.desktopAPI.onDisplayMetricsChanged(setDisplayMetrics);
    } else {
      window.addEventListener('resize', updateFromBrowser);
      window.addEventListener('focus', updateFromBrowser);
    }

    return () => {
      removeDesktopListener?.();
      window.removeEventListener('resize', updateFromBrowser);
      window.removeEventListener('focus', updateFromBrowser);
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--ui-scale', resolvedUiScale.toFixed(2));
  }, [resolvedUiScale]);

  useEffect(() => {
    persistBlueprints(blueprints);
  }, [blueprints]);

  useEffect(() => {
    persistLevels(customLevels);
  }, [customLevels]);

  useEffect(() => {
    const activeIds = new Set(cards.map(card => card.id));
    for (const id of liveCardTransformsRef.current.keys()) {
      if (!activeIds.has(id)) liveCardTransformsRef.current.delete(id);
    }
  }, [cards]);

  const currentPreset = presets.find(p => p.id === currentPresetId) || presets[0];
  const currentLevel = activeCustomLevel ?? CHALLENGE_LEVELS[currentLevelIndex];
  const currentTestStage = activeCustomLevel?.testStages[currentTestStageIndex];
  const activeTestType = currentTestStage?.testType ?? currentLevel.testType;
  const activeTestDuration = currentTestStage?.duration ?? currentLevel.testDuration;
  const challengeTargetHeight =
    Math.floor(
      CARD_DIMENSIONS[cardSize].width *
      Math.cos(DEG_10) *
      currentLevel.heightMultiplier *
      10
    ) / 10;
  const currentBlueprintStep = blueprintGuide
    ? [...blueprintGuide.blueprint.steps]
        .sort((left, right) => left.order - right.order)[blueprintGuide.currentStepIndex]
    : null;
  const activeTutorial = activeCustomLevel?.tutorial?.enabled
    ? activeCustomLevel.tutorial
    : null;
  const activeTutorialCue: LevelTutorialCue | null =
    activeTutorial?.cues[tutorialCueIndex] ?? null;

  const restartLevelTutorial = useCallback((level: LevelDefinition | null) => {
    const enabled = Boolean(level?.tutorial?.enabled);
    setTutorialCueIndex(0);
    setTutorialEntryVisible(
      enabled && Boolean(level?.tutorial.entryTitle[lang] || level?.tutorial.entrySubtitle[lang]),
    );
  }, [lang]);

  const advanceTutorialCue = useCallback(() => {
    setTutorialCueIndex(index => index + 1);
  }, []);

  useEffect(() => {
    if (tutorialEntryVisible || !activeTutorialCue) return;
    if (
      activeTutorialCue.kind === 'preset' &&
      activeTutorialCue.presetId === currentPresetId
    ) {
      advanceTutorialCue();
    }
  }, [activeTutorialCue, advanceTutorialCue, currentPresetId, tutorialEntryVisible]);

  useEffect(() => {
    if (
      tutorialEntryVisible ||
      activeTutorialCue?.kind !== 'input' ||
      !activeTutorialCue.inputAction
    ) return;
    return subscribeInput(activeTutorialCue.inputAction as InputAction, event => {
      if (event.phase === 'down') advanceTutorialCue();
    });
  }, [activeTutorialCue, advanceTutorialCue, subscribeInput, tutorialEntryVisible]);

  useEffect(() => {
    if (
      tutorialEntryVisible ||
      activeTutorialCue?.kind !== 'blueprint-step' ||
      activeTutorialCue.blueprintStepIndex === undefined ||
      !blueprintGuide
    ) return;
    const targetIndex = activeTutorialCue.blueprintStepIndex;
    const targetIsComplete =
      blueprintGuide.currentStepIndex > targetIndex ||
      (blueprintGuide.currentStepIndex === targetIndex && blueprintProgress.complete);
    if (targetIsComplete) advanceTutorialCue();
  }, [
    activeTutorialCue,
    advanceTutorialCue,
    blueprintGuide,
    blueprintProgress.complete,
    tutorialEntryVisible,
  ]);

  useEffect(() => {
    if (activeTutorial?.cues.some(cue => cue.kind === 'preset')) return;
    const recommendedPresetId = currentBlueprintStep?.recommendedPresetId;
    if (recommendedPresetId && presets.some(preset => preset.id === recommendedPresetId)) {
      setCurrentPresetId(recommendedPresetId);
    }
  }, [activeTutorial, currentBlueprintStep?.id, currentBlueprintStep?.recommendedPresetId, presets]);

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
    if (
      gameMode === GameMode.CHALLENGE &&
      (challengePhase !== ChallengePhase.BUILDING || cards.length >= currentLevel.maxCards)
    ) {
      return;
    }
    const newCard = { ...card, locked: isFreezeMode };
    setBlueprintRecording(recording => recording
      ? {
          ...recording,
          recordedCardIds: [...recording.recordedCardIds, card.id],
          presetIdsByCardId: {
            ...recording.presetIdsByCardId,
            [card.id]: currentPresetId,
          },
        }
      : null
    );
    setCards(prev => {
      recordCardHistory(prev);
      return [...prev, newCard];
    });
  }, [
    challengePhase,
    cards.length,
    currentLevel.maxCards,
    currentPresetId,
    gameMode,
    isFreezeMode,
    recordCardHistory,
  ]);

  const removeCard = useCallback((id: string) => {
    setCards(prev => {
      const next = prev.filter(c => c.id !== id);
      if (next.length === prev.length) return prev;
      recordCardHistory(prev);
      return next;
    });
  }, [recordCardHistory]);

  const updateCard = useCallback((id: string, position: [number, number, number], rotation: [number, number, number]) => {
    setCards(prev => {
      if (!prev.some(card => card.id === id)) return prev;
      recordCardHistory(prev);
      return prev.map(c =>
        c.id === id
          ? { ...c, position, rotation, locked: isFreezeMode }
          : c
      );
    });
  }, [isFreezeMode, recordCardHistory]);

  const clearCards = useCallback(() => {
    setCards(previous => {
      if (previous.length > 0) recordCardHistory(previous);
      return [];
    });
    liveHeightRef.current = 0;
    setLiveHeight(0);
    if (gameMode === GameMode.CHALLENGE) {
      setChallengePhase(ChallengePhase.BUILDING);
      setChallengeScore(0);
      setChallengeStars(0);
    }
  }, [gameMode, recordCardHistory]);

  // --- LOGIC: SAVE/LOAD ---
  const writeGameSave = useCallback((slot: GameSaveSlot) => {
    const state = saveStateRef.current;
    if (state.cards.length === 0 || state.draggingCardId) return null;

    const save = createGameSave({
      slot,
      cards: state.cards,
      liveTransforms: liveCardTransformsRef.current,
      cardSize: state.cardSize,
      currentPresetId: state.currentPresetId,
      isFreezeMode: state.isFreezeMode,
    });
    persistGameSave(localStorage, save);
    setSaveSummary({
      slot: save.slot,
      savedAt: save.savedAt,
      cardCount: save.cards.length,
    });
    return save;
  }, []);

  const saveGame = useCallback(() => {
    if (draggingCardId) {
      alert(lang === 'zh' ? '请先放下当前纸牌' : 'Place the current card before saving');
      return;
    }
    try {
      const save = writeGameSave('manual');
      if (!save) {
        alert(lang === 'zh' ? '场景中还没有纸牌' : 'There are no cards to save');
        return;
      }
      alert(
        lang === 'zh'
          ? `已保存 ${save.cards.length} 张牌的当前状态`
          : `Saved the current state of ${save.cards.length} cards`
      );
    } catch (error) {
      console.error('Failed to save build', error);
      alert(lang === 'zh' ? '保存失败，请检查存储空间' : 'Save failed. Check available storage');
    }
  }, [draggingCardId, lang, writeGameSave]);

  const loadGame = useCallback(() => {
    try {
      const loaded = loadLatestGameSave(localStorage);
      if (!loaded) {
        alert(lang === 'zh' ? '没有找到可用存档' : 'No valid save found');
        setSaveSummary(null);
        return;
      }

      const data = loaded.save;
      liveCardTransformsRef.current.clear();
      data.cards.forEach(card => {
        liveCardTransformsRef.current.set(card.id, {
          position: [...card.position],
          rotation: [...card.rotation],
        });
      });
      setDraggingCardId(null);
      setPointerMode(PointerMode.PLACE);
      setBlueprintGuide(null);
      setBlueprintRecording(null);
      setBlueprintProgress(EMPTY_BLUEPRINT_PROGRESS);
      setGameMode(GameMode.FREE);
      setActiveCustomLevel(null);
      setCardSize(data.cardSize);
      setCurrentPresetId(
        presets.some(preset => preset.id === data.currentPresetId)
          ? data.currentPresetId
          : DEFAULT_PRESETS[0].id
      );
      setIsFreezeMode(data.isFreezeMode);
      setCards(data.cards.map(card => ({
        ...card,
        position: [...card.position],
        rotation: [...card.rotation],
      })));
      resetCardHistory();
      setAppState(AppState.GAME);
      alert(
        loaded.recoveredFromBackup
          ? (lang === 'zh' ? '主存档损坏，已恢复备份' : 'Recovered the backup save')
          : (lang === 'zh' ? '已恢复上次搭建' : 'Build restored')
      );
    } catch (e) {
      console.error(e);
      alert(lang === 'zh' ? '读取存档失败' : 'Failed to load save');
    }
  }, [lang, presets, resetCardHistory]);

  useEffect(() => {
    if (appState !== AppState.GAME) return;

    const autosave = () => {
      try {
        writeGameSave('autosave');
      } catch (error) {
        console.warn('Autosave failed', error);
      }
    };
    const interval = window.setInterval(autosave, 30_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') autosave();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', autosave);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', autosave);
    };
  }, [appState, writeGameSave]);

  const handleCardTransformChange = useCallback((id: string, transform: LiveCardTransform) => {
    liveCardTransformsRef.current.set(id, {
      position: [...transform.position],
      rotation: [...transform.rotation],
    });
  }, []);

  const captureBlueprintSnapshot = useCallback(() => {
    setBlueprintSnapshot(createBlueprintSnapshot(cards, liveCardTransformsRef.current, cardSize));
  }, [cardSize, cards]);

  const openBlueprintStudio = useCallback(() => {
    setBlueprintSnapshot(createBlueprintSnapshot(cards, liveCardTransformsRef.current, cardSize));
    setRequestedBlueprintEditorId(null);
    setShowBlueprintStudio(true);
  }, [cardSize, cards]);

  const saveBlueprint = useCallback((input: CreateBlueprintInput) => {
    const blueprint = createBlueprint(input);
    setBlueprints(previous => [blueprint, ...previous]);
  }, []);

  const deleteBlueprint = useCallback((id: string) => {
    setBlueprints(previous => previous.filter(blueprint => blueprint.id !== id));
    setBlueprintGuide(previous => previous?.blueprint.id === id ? null : previous);
  }, []);

  const importBlueprint = useCallback((blueprint: Blueprint) => {
    setBlueprints(previous => {
      const hasSameId = previous.some(item => item.id === blueprint.id);
      const imported = hasSameId
        ? {
            ...blueprint,
            id: `bp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
            name: `${blueprint.name} (${lang === 'zh' ? '导入' : 'Imported'})`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        : blueprint;
      return [imported, ...previous];
    });
  }, [lang]);

  const updateBlueprint = useCallback((blueprint: Blueprint) => {
    setBlueprints(previous => previous.map(item => item.id === blueprint.id ? blueprint : item));
    setBlueprintGuide(previous =>
      previous?.blueprint.id === blueprint.id ? { ...previous, blueprint } : previous
    );
  }, []);

  const startBlueprintRecording = useCallback(() => {
    setBlueprintGuide(null);
    setBlueprintProgress(EMPTY_BLUEPRINT_PROGRESS);
    setBlueprintRecording({
      startedAt: new Date().toISOString(),
      recordedCardIds: [],
      presetIdsByCardId: {},
    });
    setPointerMode(PointerMode.PLACE);
    setShowBlueprintStudio(false);
  }, []);

  const cancelBlueprintRecording = useCallback(() => {
    setBlueprintRecording(null);
  }, []);

  const finishBlueprintRecording = useCallback(() => {
    if (!blueprintRecording) return;
    const recordedIds = new Set(blueprintRecording.recordedCardIds);
    const recordedCards = cards.filter(card => recordedIds.has(card.id));
    const snapshot = createBlueprintSnapshot(
      recordedCards,
      liveCardTransformsRef.current,
      cardSize,
    );
    setBlueprintRecording(null);
    setBlueprintSnapshot(snapshot);
    if (snapshot.cards.length === 0) {
      setRequestedBlueprintEditorId(null);
      setShowBlueprintStudio(true);
      return;
    }

    const blueprint = createBlueprint({
      name: lang === 'zh'
        ? `未命名录制 ${new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`
        : `Recorded build ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
      description: lang === 'zh' ? '由搭建过程录制生成的蓝图草稿' : 'Draft generated from a recorded build',
      author: localStorage.getItem('hoc_blueprint_author') ?? '',
      category: 'architecture',
      tags: [lang === 'zh' ? '录制' : 'recorded'],
      cardSize,
      snapshot,
      status: 'draft',
      steps: createRecordedBlueprintSteps(
        snapshot,
        blueprintRecording.presetIdsByCardId,
      ),
    });
    setBlueprints(previous => [blueprint, ...previous]);
    setRequestedBlueprintEditorId(blueprint.id);
    setShowBlueprintStudio(true);
  }, [blueprintRecording, cardSize, cards, lang]);

  const handleCameraHintChange = useCallback((hint: BlueprintCameraHint) => {
    cameraHintRef.current = hint;
  }, []);

  const startBlueprintGuide = useCallback((blueprint: Blueprint, autoPlaceAtCenter = false) => {
    setCardSize(blueprint.cardSize);
    setPointerMode(PointerMode.PLACE);
    setDraggingCardId(null);
    setBlueprintGuide({
      blueprint,
      origin: [0, 0, 0],
      yaw: 0,
      placing: !autoPlaceAtCenter,
      visible: true,
      currentStepIndex: 0,
      assistance: isOfficialTutorial(blueprint) ? 'full' : 'step',
    });
    setBlueprintProgress({
      ...EMPTY_BLUEPRINT_PROGRESS,
      total: blueprint.cardCount,
      currentStepTotal: blueprint.steps[0]?.cardIds.length ?? blueprint.cardCount,
      activeTargetId: blueprint.steps[0]?.cardIds[0] ?? blueprint.snapshot.cards[0]?.id ?? null,
    });
    blueprintCheckpointRef.current = [];
    blueprintCheckpointReadyRef.current = autoPlaceAtCenter;
    setShowBlueprintStudio(false);
  }, []);

  const testBlueprintFromStart = useCallback((blueprint: Blueprint) => {
    if (cards.length > 0) recordCardHistory(cards);
    setCards([]);
    liveCardTransformsRef.current.clear();
    setIsFreezeMode(false);
    startBlueprintGuide(blueprint);
  }, [cards, recordCardHistory, startBlueprintGuide]);

  const placeBlueprintOrigin = useCallback((origin: [number, number, number]) => {
    blueprintCheckpointRef.current = cards.map(card => {
      const transform = liveCardTransformsRef.current.get(card.id);
      return transform
        ? { ...card, position: [...transform.position], rotation: [...transform.rotation] }
        : { ...card };
    });
    blueprintCheckpointReadyRef.current = true;
    setBlueprintGuide(previous => previous ? { ...previous, origin, placing: false } : null);
  }, [cards]);

  const handleBlueprintProgress = useCallback((progress: BlueprintGuideProgress) => {
    setBlueprintProgress(previous => {
      const unchanged =
        previous.matched === progress.matched &&
        previous.near === progress.near &&
        previous.total === progress.total &&
        previous.activeTargetId === progress.activeTargetId &&
        previous.currentStepMatched === progress.currentStepMatched &&
        previous.currentStepTotal === progress.currentStepTotal &&
        previous.feedback === progress.feedback &&
        previous.complete === progress.complete &&
        previous.currentStepPlayerCardIds.join('|') === progress.currentStepPlayerCardIds.join('|');
      return unchanged ? previous : progress;
    });
    if (
      progress.complete &&
      blueprintGuide &&
      isOfficialTutorial(blueprintGuide.blueprint) &&
      !completedTutorials.has(blueprintGuide.blueprint.id)
    ) {
      const next = new Set(completedTutorials).add(blueprintGuide.blueprint.id);
      saveTutorialProgress(next);
      setCompletedTutorials(next);
      playSuccessSound();
    }
  }, [blueprintGuide, completedTutorials]);

  const setBlueprintAssistance = useCallback((assistance: BlueprintAssistance) => {
    setBlueprintGuide(previous => previous ? { ...previous, assistance } : null);
  }, []);

  const completeBlueprintStep = useCallback(() => {
    if (!blueprintGuide) return;
    const orderedSteps = [...blueprintGuide.blueprint.steps]
      .sort((left, right) => left.order - right.order);
    if (blueprintGuide.currentStepIndex >= orderedSteps.length - 1) return;

    blueprintCheckpointRef.current = cards.map(card => {
      const transform = liveCardTransformsRef.current.get(card.id);
      return transform
        ? { ...card, position: [...transform.position], rotation: [...transform.rotation] }
        : { ...card };
    });
    blueprintCheckpointReadyRef.current = true;
    setBlueprintGuide(previous => previous ? {
      ...previous,
      currentStepIndex: Math.min(previous.currentStepIndex + 1, orderedSteps.length - 1),
    } : null);
  }, [blueprintGuide, cards]);

  const regressBlueprintStep = useCallback((stepIndex: number) => {
    setBlueprintGuide(previous => {
      if (!previous || stepIndex >= previous.currentStepIndex) return previous;
      return {
        ...previous,
        currentStepIndex: Math.max(0, stepIndex),
        visible: true,
      };
    });
  }, []);

  const restoreBlueprintStep = useCallback(() => {
    if (!blueprintGuide || !blueprintCheckpointReadyRef.current) return;
    setCards(current => {
      recordCardHistory(current);
      return blueprintCheckpointRef.current.map(card => ({ ...card, locked: isFreezeMode }));
    });
    setDraggingCardId(null);
  }, [blueprintGuide, isFreezeMode, recordCardHistory]);

  const rotateBlueprintGuide = useCallback((direction: -1 | 1) => {
    setBlueprintGuide(previous => previous ? {
      ...previous,
      yaw: previous.yaw + direction * Math.PI / 2,
    } : null);
  }, []);

  const relocateBlueprintGuide = useCallback(() => {
    setPointerMode(PointerMode.PLACE);
    setDraggingCardId(null);
    setBlueprintGuide(previous => previous ? { ...previous, placing: true, visible: true } : null);
  }, []);

  const toggleBlueprintGuide = useCallback(() => {
    setBlueprintGuide(previous => previous ? { ...previous, visible: !previous.visible } : null);
  }, []);

  const stopBlueprintGuide = useCallback(() => {
    setBlueprintGuide(null);
    setBlueprintProgress(EMPTY_BLUEPRINT_PROGRESS);
    blueprintCheckpointRef.current = [];
    blueprintCheckpointReadyRef.current = false;
  }, []);

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
    resetCardHistory();
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
    setCurrentTestStageIndex(0);
  }, [resetCardHistory]);

  const resetChallenge = useCallback(() => {
    resetChallengeState(currentLevel.testDuration);
    if (activeCustomLevel) {
      startBlueprintGuide(activeCustomLevel.embeddedBlueprint, true);
    }
    restartLevelTutorial(activeCustomLevel);
  }, [
    activeCustomLevel,
    currentLevel.testDuration,
    resetChallengeState,
    restartLevelTutorial,
    startBlueprintGuide,
  ]);

  const startChallenge = useCallback(() => {
    setActiveCustomLevel(null);
    restartLevelTutorial(null);
    setGameMode(GameMode.CHALLENGE);
    setCurrentLevelIndex(0);
    resetChallengeState(CHALLENGE_LEVELS[0].testDuration);
    setAppState(AppState.GAME);
  }, [resetChallengeState, restartLevelTutorial]);

  const advanceChallenge = useCallback(() => {
    if (activeCustomLevel) return;
    const nextLevelIndex = Math.min(currentLevelIndex + 1, CHALLENGE_LEVELS.length - 1);
    setCurrentLevelIndex(nextLevelIndex);
    resetChallengeState(CHALLENGE_LEVELS[nextLevelIndex].testDuration);
  }, [activeCustomLevel, currentLevelIndex, resetChallengeState]);

  const saveCustomLevel = useCallback((input: CreateLevelInput, editingId: string | null) => {
    setCustomLevels(previous => {
      if (!editingId) return [createLevel(input), ...previous];
      return previous.map(level => level.id === editingId ? updateLevel(level, input) : level);
    });
  }, []);

  const importCustomLevel = useCallback((level: LevelDefinition) => {
    setCustomLevels(previous => {
      const imported = previous.some(item => item.id === level.id)
        ? { ...level, id: `level_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}` }
        : level;
      return [imported, ...previous];
    });
  }, []);

  const playtestCustomLevel = useCallback((level: LevelDefinition) => {
    setActiveCustomLevel(level);
    setGameMode(GameMode.CHALLENGE);
    setCurrentLevelIndex(0);
    setCardSize(level.embeddedBlueprint.cardSize);
    resetChallengeState(level.testDuration);
    setShowLevelStudio(false);
    setAppState(AppState.GAME);
    startBlueprintGuide(level.embeddedBlueprint, true);
    restartLevelTutorial(level);
  }, [resetChallengeState, restartLevelTutorial, startBlueprintGuide]);

  const startFreeBuild = useCallback(() => {
    setGameMode(GameMode.FREE);
    setCards([]);
    resetCardHistory();
    setIsFreezeMode(false);
    setPointerMode(PointerMode.PLACE);
    setAppState(AppState.GAME);
    restartLevelTutorial(null);
  }, [resetCardHistory, restartLevelTutorial]);

  const startWindTest = useCallback(() => {
    if (
      challengePhase !== ChallengePhase.BUILDING ||
      cards.length < currentLevel.minCards ||
      liveHeightRef.current < challengeTargetHeight ||
      (activeCustomLevel !== null && !blueprintProgress.complete)
    ) {
      return;
    }

    toggleFreezeMode(false);
    setDraggingCardId(null);
    setPointerMode(PointerMode.PLACE);
    setCountdown(3);
    setTestTimeRemaining(activeTestDuration);
    setChallengePhase(ChallengePhase.COUNTDOWN);
  }, [
    cards.length,
    activeCustomLevel,
    blueprintProgress.complete,
    challengePhase,
    challengeTargetHeight,
    currentLevel.minCards,
    activeTestDuration,
    toggleFreezeMode
  ]);

  const undoCards = useCallback(() => {
    if (gameMode === GameMode.CHALLENGE && challengePhase !== ChallengePhase.BUILDING) return;
    const previous = undoHistoryRef.current.pop();
    if (!previous) return;
    setCards(current => {
      redoHistoryRef.current = [...redoHistoryRef.current.slice(-49), current];
      return previous;
    });
    setDraggingCardId(null);
  }, [challengePhase, gameMode]);

  const redoCards = useCallback(() => {
    if (gameMode === GameMode.CHALLENGE && challengePhase !== ChallengePhase.BUILDING) return;
    const next = redoHistoryRef.current.pop();
    if (!next) return;
    setCards(current => {
      undoHistoryRef.current = [...undoHistoryRef.current.slice(-49), current];
      return next;
    });
    setDraggingCardId(null);
  }, [challengePhase, gameMode]);

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
          const nextStageIndex = currentTestStageIndex + 1;
          const nextStage = activeCustomLevel?.testStages[nextStageIndex];
          if (nextStage) {
            setCurrentTestStageIndex(nextStageIndex);
            setCountdown(3);
            setChallengePhase(ChallengePhase.COUNTDOWN);
            return nextStage.duration;
          }
          const unusedCards = currentLevel.maxCards - cards.length;
          const scoring = activeCustomLevel
            ? activeCustomLevel.scoring
            : { baseScore: currentLevel.testDuration * 50, unusedCardBonus: 50, heightBonus: 100 };
          const score = Math.round(
            scoring.baseScore +
            liveHeightRef.current * scoring.heightBonus +
            unusedCards * scoring.unusedCardBonus
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
    activeCustomLevel,
    currentTestStageIndex,
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

  useEffect(() => {
    if (
      challengePhase !== ChallengePhase.SUCCESS ||
      !activeCustomLevel ||
      activeCustomLevel.verification.passed
    ) return;
    const verified = markLevelPlaytested(activeCustomLevel);
    setActiveCustomLevel(verified);
    setCustomLevels(previous => previous.map(level => level.id === verified.id ? verified : level));
  }, [activeCustomLevel, challengePhase]);

  const interactionEnabled =
    gameMode === GameMode.FREE ||
    challengePhase === ChallengePhase.BUILDING;
  const windStrength =
    gameMode === GameMode.CHALLENGE &&
    challengePhase === ChallengePhase.TESTING &&
    activeTestType === ChallengeTestType.WIND
      ? (currentTestStage?.windStrength ?? currentLevel.windStrength ?? 0)
      : 0;
  const placementEnabled =
    interactionEnabled &&
    !blueprintGuide?.placing &&
    (gameMode === GameMode.FREE || cards.length < currentLevel.maxCards);

  // --- LOGIC: UNIFIED INPUT ---
  useEffect(() => {
    setInputSuspended(
      showSettings ||
      showBlueprintStudio ||
      showLevelStudio ||
      tutorialEntryVisible ||
      appState !== AppState.GAME,
    );
  }, [appState, setInputSuspended, showBlueprintStudio, showLevelStudio, showSettings, tutorialEntryVisible]);

  const cyclePreset = useCallback((direction: -1 | 1) => {
    if (!interactionEnabled || presets.length === 0) return;
    const currentIndex = Math.max(0, presets.findIndex(preset => preset.id === currentPresetId));
    const nextIndex = (currentIndex + direction + presets.length) % presets.length;
    setCurrentPresetId(presets[nextIndex].id);
  }, [currentPresetId, interactionEnabled, presets]);

  useInputAction('tool.place', event => {
    if (event.phase === 'down' && interactionEnabled) setPointerMode(PointerMode.PLACE);
  });
  useInputAction('tool.move', event => {
    if (event.phase === 'down' && interactionEnabled) setPointerMode(PointerMode.MOVE);
  });
  useInputAction('tool.delete', event => {
    if (event.phase === 'down' && interactionEnabled) setPointerMode(PointerMode.DELETE);
  });
  useInputAction('mode.togglePrecision', event => {
    if (event.phase !== 'down' || !interactionEnabled) return;
    setInteractionMode(previous =>
      previous === InteractionMode.QUICK ? InteractionMode.PRECISION : InteractionMode.QUICK,
    );
  });
  useInputAction('physics.toggle', event => {
    if (event.phase === 'down' && interactionEnabled) toggleFreezeMode();
  });
  useInputAction('preset.previous', event => {
    if (event.phase === 'down') cyclePreset(-1);
  });
  useInputAction('preset.next', event => {
    if (event.phase === 'down') cyclePreset(1);
  });
  useInputAction('history.undo', event => {
    if (event.phase === 'down') undoCards();
  });
  useInputAction('history.redo', event => {
    if (event.phase === 'down') redoCards();
  });
  useInputAction('action.cancel', event => {
    if (event.phase !== 'down') return;
    setDraggingCardId(null);
    setPointerMode(PointerMode.PLACE);
  });

  useEffect(() => {
    if (inputProfile !== 'legacy') return;
    const slotActions: InputAction[] = [
      'preset.slot1', 'preset.slot2', 'preset.slot3', 'preset.slot4', 'preset.slot5',
      'preset.slot6', 'preset.slot7', 'preset.slot8', 'preset.slot9', 'preset.slot0',
    ];
    const cleanups = slotActions.map((action, index) => {
      const shortcut = index === 9 ? '0' : String(index + 1);
      return subscribeInput(action, event => {
        if (event.phase !== 'down' || !interactionEnabled) return;
        const matchedPreset = presets.find(preset => preset.shortcut === shortcut);
        if (matchedPreset) setCurrentPresetId(matchedPreset.id);
      });
    });
    return () => cleanups.forEach(cleanup => cleanup());
  }, [inputProfile, interactionEnabled, presets, subscribeInput]);

  // --- RENDER ---
  return (
    <div className="app-shell" data-theme={theme}>
      
      {appState === AppState.MENU && (
        <MainMenu 
           onStartChallenge={startChallenge}
           onStartFree={startFreeBuild}
           onLoad={loadGame}
           onSettings={() => setShowSettings(true)}
           onOpenLevelStudio={() => setShowLevelStudio(true)}
           hasSave={saveSummary !== null}
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
            setPointerMode={setPointerMode}
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
            testType={gameMode === GameMode.CHALLENGE ? activeTestType : ChallengeTestType.STABILITY}
            testActive={challengePhase === ChallengePhase.TESTING}
            weightMass={currentTestStage?.weightMass ?? currentLevel.weightMass ?? 0.45}
            weightDropHeight={challengeTargetHeight + (currentTestStage?.weightDropOffset ?? currentLevel.weightDropOffset ?? 4)}
            theme={theme}
            onCardTransformChange={handleCardTransformChange}
            blueprintGuide={blueprintGuide}
            onBlueprintPlaceOrigin={placeBlueprintOrigin}
            onBlueprintProgress={handleBlueprintProgress}
            onBlueprintStepComplete={completeBlueprintStep}
            onBlueprintStepRegression={regressBlueprintStep}
            onCameraHintChange={handleCameraHintChange}
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
            onOpenBlueprint={openBlueprintStudio}
            blueprintGuide={blueprintGuide}
            blueprintProgress={blueprintProgress}
            onRotateBlueprint={rotateBlueprintGuide}
            onRelocateBlueprint={relocateBlueprintGuide}
            onToggleBlueprint={toggleBlueprintGuide}
            onStopBlueprint={stopBlueprintGuide}
            onRestoreBlueprintStep={restoreBlueprintStep}
            onSetBlueprintAssistance={setBlueprintAssistance}
            blueprintRecording={blueprintRecording}
            onFinishBlueprintRecording={finishBlueprintRecording}
            onCancelBlueprintRecording={cancelBlueprintRecording}
            cardCount={cards.length}
            lang={lang}
            onOpenSettings={() => setShowSettings(true)}
            onBackToMenu={() => {
              try {
                writeGameSave('autosave');
              } catch (error) {
                console.warn('Autosave before returning to menu failed', error);
              }
              setAppState(AppState.MENU);
            }}
            gameMode={gameMode}
            challengePhase={challengePhase}
            maxCards={currentLevel.maxCards}
            minCards={currentLevel.minCards}
            levelIndex={currentLevelIndex}
            levelCount={activeCustomLevel ? 1 : CHALLENGE_LEVELS.length}
            levelName={currentLevel.name[lang]}
            levelDescription={`${currentLevel.description[lang]}${activeCustomLevel && activeCustomLevel.testStages.length > 1 ? ` · ${lang === 'zh' ? '测试阶段' : 'Test stage'} ${currentTestStageIndex + 1}/${activeCustomLevel.testStages.length}` : ''}`}
            testType={activeTestType}
            requiresBlueprintMatch={activeCustomLevel !== null}
            targetHeight={challengeTargetHeight}
            liveHeight={liveHeight}
            countdown={countdown}
            testTimeRemaining={testTimeRemaining}
            score={challengeScore}
            stars={challengeStars}
            onStartTest={startWindTest}
            onRetryChallenge={resetChallenge}
            onUndo={undoCards}
            onRedo={redoCards}
            onNextChallenge={advanceChallenge}
            interactionEnabled={interactionEnabled}
            theme={theme}
            tutorialEntry={tutorialEntryVisible && activeTutorial ? {
              title: activeTutorial.entryTitle[lang],
              subtitle: activeTutorial.entrySubtitle[lang],
            } : null}
            tutorialCue={tutorialEntryVisible ? null : activeTutorialCue}
            tutorialCueIndex={tutorialCueIndex}
            tutorialCueCount={activeTutorial?.cues.length ?? 0}
            onDismissTutorialEntry={() => setTutorialEntryVisible(false)}
            onAdvanceTutorialCue={advanceTutorialCue}
            onSkipTutorial={() => {
              setTutorialEntryVisible(false);
              setTutorialCueIndex(activeTutorial?.cues.length ?? 0);
            }}
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
        uiScaleSetting={uiScaleSetting}
        setUiScaleSetting={setUiScaleSetting}
        resolvedUiScale={resolvedUiScale}
      />

      <BlueprintStudio
        isOpen={showBlueprintStudio}
        lang={lang}
        cardSize={cardSize}
        snapshot={blueprintSnapshot}
        blueprints={blueprints}
        presets={presets}
        currentCameraHint={cameraHintRef.current}
        onRefreshSnapshot={captureBlueprintSnapshot}
        onSave={saveBlueprint}
        onDelete={deleteBlueprint}
        onImport={importBlueprint}
        onUse={startBlueprintGuide}
        onTest={testBlueprintFromStart}
        onUpdate={updateBlueprint}
        onStartRecording={startBlueprintRecording}
        requestedEditorBlueprintId={requestedBlueprintEditorId}
        onEditorRequestHandled={() => setRequestedBlueprintEditorId(null)}
        onClose={() => setShowBlueprintStudio(false)}
      />
      <LevelStudio
        isOpen={showLevelStudio}
        lang={lang}
        blueprints={[...OFFICIAL_TUTORIAL_BLUEPRINTS, ...blueprints]}
        presets={presets}
        levels={customLevels}
        onSave={saveCustomLevel}
        onDelete={id => setCustomLevels(previous => previous.filter(level => level.id !== id))}
        onDuplicate={level => setCustomLevels(previous => [duplicateLevel(level), ...previous])}
        onPublish={level => {
          const issues = getLevelValidationIssues(level);
          if (issues.length > 0) return issues;
          setCustomLevels(previous => previous.map(item => item.id === level.id ? publishLevel(item) : item));
          return [];
        }}
        onImport={importCustomLevel}
        onPlay={playtestCustomLevel}
        onClose={() => setShowLevelStudio(false)}
      />
    </div>
  );
};

export default App;
