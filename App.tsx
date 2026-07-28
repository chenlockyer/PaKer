
/// <reference lib="dom" />
import React, { useState, useCallback, useEffect, useRef } from 'react';
import GameScene from './components/GameScene';
import UIOverlay from './components/UIOverlay';
import MainMenu from './components/MainMenu';
import SettingsModal from './components/SettingsModal';
import BlueprintStudio from './components/BlueprintStudio';
import {
  Blueprint,
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
  CARD_DIMENSIONS,
  LiveCardTransform,
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
  loadBlueprints,
  persistBlueprints,
} from './services/blueprintService';

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
  const [blueprints, setBlueprints] = useState<Blueprint[]>(loadBlueprints);
  const [blueprintSnapshot, setBlueprintSnapshot] = useState<BlueprintSnapshot | null>(null);
  const [blueprintGuide, setBlueprintGuide] = useState<BlueprintGuideState | null>(null);
  const [blueprintRecording, setBlueprintRecording] = useState<BlueprintRecordingState | null>(null);
  const [requestedBlueprintEditorId, setRequestedBlueprintEditorId] = useState<string | null>(null);
  const [blueprintProgress, setBlueprintProgress] = useState<BlueprintGuideProgress>(EMPTY_BLUEPRINT_PROGRESS);
  const liveCardTransformsRef = useRef(new Map<string, LiveCardTransform>());
  const blueprintCheckpointRef = useRef<CardData[]>([]);
  const blueprintCheckpointReadyRef = useRef(false);
  const blueprintFrozenCardIdsRef = useRef(new Set<string>());
  const blueprintCheckpointFrozenIdsRef = useRef(new Set<string>());
  const blueprintCheckpointReleasedStepIdsRef = useRef<string[]>([]);
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
  const liveHeightRef = useRef(0);
  const { profile: inputProfile, subscribe: subscribeInput, setSuspended: setInputSuspended } = useInput();

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
    persistBlueprints(blueprints);
  }, [blueprints]);

  useEffect(() => {
    const activeIds = new Set(cards.map(card => card.id));
    for (const id of liveCardTransformsRef.current.keys()) {
      if (!activeIds.has(id)) liveCardTransformsRef.current.delete(id);
    }
  }, [cards]);

  const currentPreset = presets.find(p => p.id === currentPresetId) || presets[0];
  const currentLevel = CHALLENGE_LEVELS[currentLevelIndex];
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

  useEffect(() => {
    const recommendedPresetId = currentBlueprintStep?.recommendedPresetId;
    if (recommendedPresetId && presets.some(preset => preset.id === recommendedPresetId)) {
      setCurrentPresetId(recommendedPresetId);
    }
  }, [currentBlueprintStep?.id, currentBlueprintStep?.recommendedPresetId, presets]);

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
    const lockedByBlueprint = !!currentBlueprintStep?.freezeDuringBuild;
    const newCard = { ...card, locked: isFreezeMode || lockedByBlueprint };
    if (lockedByBlueprint && !isFreezeMode) blueprintFrozenCardIdsRef.current.add(card.id);
    setBlueprintRecording(recording => recording
      ? { ...recording, recordedCardIds: [...recording.recordedCardIds, card.id] }
      : null
    );
    setCards(prev => {
      recordCardHistory(prev);
      return [...prev, newCard];
    });
  }, [
    challengePhase,
    cards.length,
    currentBlueprintStep?.freezeDuringBuild,
    currentLevel.maxCards,
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
    const lockedByBlueprint = !!currentBlueprintStep?.freezeDuringBuild;
    if (lockedByBlueprint && !isFreezeMode) blueprintFrozenCardIdsRef.current.add(id);
    setCards(prev => {
      if (!prev.some(card => card.id === id)) return prev;
      recordCardHistory(prev);
      return prev.map(c =>
        c.id === id
          ? { ...c, position, rotation, locked: isFreezeMode || lockedByBlueprint }
          : c
      );
    });
  }, [currentBlueprintStep?.freezeDuringBuild, isFreezeMode, recordCardHistory]);

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
          resetCardHistory();
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
  }, [lang, resetCardHistory]);

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
    const releaseIds = new Set(blueprintFrozenCardIdsRef.current);
    if (releaseIds.size > 0) {
      setCards(current => current.map(card =>
        releaseIds.has(card.id) ? { ...card, locked: false } : card
      ));
    }
    blueprintFrozenCardIdsRef.current.clear();
    setBlueprintGuide(null);
    setBlueprintProgress(EMPTY_BLUEPRINT_PROGRESS);
    setBlueprintRecording({
      startedAt: new Date().toISOString(),
      recordedCardIds: [],
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
    });
    setBlueprints(previous => [blueprint, ...previous]);
    setRequestedBlueprintEditorId(blueprint.id);
    setShowBlueprintStudio(true);
  }, [blueprintRecording, cardSize, cards, lang]);

  const handleCameraHintChange = useCallback((hint: BlueprintCameraHint) => {
    cameraHintRef.current = hint;
  }, []);

  const startBlueprintGuide = useCallback((blueprint: Blueprint) => {
    setCardSize(blueprint.cardSize);
    setPointerMode(PointerMode.PLACE);
    setDraggingCardId(null);
    setBlueprintGuide({
      blueprint,
      origin: [0, 0, 0],
      yaw: 0,
      placing: true,
      visible: true,
      currentStepIndex: 0,
      releasedStepIds: [],
    });
    setBlueprintProgress({
      ...EMPTY_BLUEPRINT_PROGRESS,
      total: blueprint.cardCount,
      currentStepTotal: blueprint.steps[0]?.cardIds.length ?? blueprint.cardCount,
      activeTargetId: blueprint.steps[0]?.cardIds[0] ?? blueprint.snapshot.cards[0]?.id ?? null,
    });
    blueprintFrozenCardIdsRef.current.clear();
    blueprintCheckpointReadyRef.current = false;
    blueprintCheckpointReleasedStepIdsRef.current = [];
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
    blueprintCheckpointFrozenIdsRef.current = new Set(blueprintFrozenCardIdsRef.current);
    blueprintCheckpointReleasedStepIdsRef.current = [...(blueprintGuide?.releasedStepIds ?? [])];
    setBlueprintGuide(previous => previous ? { ...previous, origin, placing: false } : null);
  }, [blueprintGuide?.releasedStepIds, cards]);

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
  }, []);

  const completeBlueprintStep = useCallback(() => {
    if (!blueprintGuide) return;
    const orderedSteps = [...blueprintGuide.blueprint.steps]
      .sort((left, right) => left.order - right.order);
    const step = orderedSteps[blueprintGuide.currentStepIndex];

    if (step?.releasePhysicsAfterStep && !blueprintGuide.releasedStepIds.includes(step.id)) {
      const releaseIds = new Set(blueprintFrozenCardIdsRef.current);
      setCards(current => current.map(card =>
        releaseIds.has(card.id) ? { ...card, locked: false } : card
      ));
      blueprintFrozenCardIdsRef.current.clear();
      setBlueprintGuide(previous => previous ? {
        ...previous,
        releasedStepIds: previous.releasedStepIds.includes(step.id)
          ? previous.releasedStepIds
          : [...previous.releasedStepIds, step.id],
      } : null);
      return;
    }

    if (blueprintGuide.currentStepIndex >= orderedSteps.length - 1) return;

    blueprintCheckpointRef.current = cards.map(card => {
      const transform = liveCardTransformsRef.current.get(card.id);
      return transform
        ? { ...card, position: [...transform.position], rotation: [...transform.rotation] }
        : { ...card };
    });
    blueprintCheckpointReadyRef.current = true;
    blueprintCheckpointFrozenIdsRef.current = new Set(blueprintFrozenCardIdsRef.current);
    blueprintCheckpointReleasedStepIdsRef.current = [...blueprintGuide.releasedStepIds];
    setBlueprintGuide(previous => previous ? {
      ...previous,
      currentStepIndex: Math.min(previous.currentStepIndex + 1, orderedSteps.length - 1),
    } : null);
  }, [blueprintGuide, cards]);

  const restoreBlueprintStep = useCallback(() => {
    if (!blueprintGuide || !blueprintCheckpointReadyRef.current) return;
    blueprintFrozenCardIdsRef.current = new Set(blueprintCheckpointFrozenIdsRef.current);
    setCards(current => {
      recordCardHistory(current);
      return blueprintCheckpointRef.current.map(card => ({ ...card }));
    });
    setBlueprintGuide(previous => previous ? {
      ...previous,
      releasedStepIds: [...blueprintCheckpointReleasedStepIdsRef.current],
    } : null);
    setDraggingCardId(null);
  }, [blueprintGuide, recordCardHistory]);

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
    const releaseIds = new Set(blueprintFrozenCardIdsRef.current);
    if (releaseIds.size > 0) {
      setCards(current => current.map(card =>
        releaseIds.has(card.id) ? { ...card, locked: false } : card
      ));
    }
    setBlueprintGuide(null);
    setBlueprintProgress(EMPTY_BLUEPRINT_PROGRESS);
    blueprintCheckpointRef.current = [];
    blueprintCheckpointReadyRef.current = false;
    blueprintCheckpointFrozenIdsRef.current.clear();
    blueprintCheckpointReleasedStepIdsRef.current = [];
    blueprintFrozenCardIdsRef.current.clear();
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
  }, [resetCardHistory]);

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
    resetCardHistory();
    setIsFreezeMode(false);
    setPointerMode(PointerMode.PLACE);
    setAppState(AppState.GAME);
  }, [resetCardHistory]);

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
    !blueprintGuide?.placing &&
    (gameMode === GameMode.FREE || cards.length < currentLevel.maxCards);

  // --- LOGIC: UNIFIED INPUT ---
  useEffect(() => {
    setInputSuspended(showSettings || showBlueprintStudio || appState !== AppState.GAME);
  }, [appState, setInputSuspended, showBlueprintStudio, showSettings]);

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
            testType={gameMode === GameMode.CHALLENGE ? currentLevel.testType : ChallengeTestType.STABILITY}
            testActive={challengePhase === ChallengePhase.TESTING}
            weightMass={currentLevel.weightMass ?? 0.45}
            weightDropHeight={challengeTargetHeight + (currentLevel.weightDropOffset ?? 4)}
            theme={theme}
            onCardTransformChange={handleCardTransformChange}
            blueprintGuide={blueprintGuide}
            onBlueprintPlaceOrigin={placeBlueprintOrigin}
            onBlueprintProgress={handleBlueprintProgress}
            onBlueprintStepComplete={completeBlueprintStep}
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
            blueprintRecording={blueprintRecording}
            onFinishBlueprintRecording={finishBlueprintRecording}
            onCancelBlueprintRecording={cancelBlueprintRecording}
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
            onUndo={undoCards}
            onRedo={redoCards}
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
    </div>
  );
};

export default App;
