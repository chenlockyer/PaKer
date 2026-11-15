
/// <reference lib="dom" />
import React, { useState, useCallback, useEffect, useRef } from 'react';
import GameScene from './components/GameScene';
import UIOverlay from './components/UIOverlay';
import MainMenu from './components/MainMenu';
import PhysicsLab from './components/PhysicsLab';
import SettingsModal from './components/SettingsModal';
import BlueprintStudio from './components/BlueprintStudio';
import LevelStudio from './components/LevelStudio';
import CampaignSelect from './components/CampaignSelect';
import CampaignResumeModal from './components/CampaignResumeModal';
import SaveLibraryModal, { SaveLibraryMode } from './components/SaveLibraryModal';
import {
  Blueprint,
  BlueprintAssistance,
  BlueprintCameraHint,
  BlueprintGuideProgress,
  BlueprintGuideState,
  BlueprintRecordingState,
  BlueprintSnapshot,
  CardData,
  CardRole,
  RotationPreset,
  InteractionMode,
  PointerMode,
  AppState,
  GameMode,
  ChallengePhase,
  ChallengeTestType,
  CardSize,
  AppTheme,
  UiScaleSetting,
  CARD_DIMENSIONS,
  LiveCardTransform,
  LevelDefinition,
  LaunchPreset,
  LaunchRecord,
  PhysicsSettings,
  CampaignDefinition,
  CampaignProgress,
  CampaignSession,
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
  getBlueprintWorldCards,
  instantiateBlueprintCards,
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
  getLevelPublishBlockingIssues,
  loadLevels,
  markLevelPlaytested,
  persistLevels,
  publishLevel,
  updateLevel,
} from './services/levelService';
import {
  OFFICIAL_LEVEL_IDS,
  OFFICIAL_LEVELS,
} from './services/officialLevels';
import {
  DisplayMetrics,
  getBrowserDisplayMetrics,
  loadUiScaleSetting,
  resolveUiScale,
  UI_SCALE_STORAGE_KEY,
} from './services/uiScaleService';
import {
  createGameSave,
  captureLiveCards,
  deleteManualGameSave,
  findGameSave,
  GameSaveData,
  GameSaveSource,
  loadGameSaveLibrary,
  loadLatestGameSave,
  persistGameSave,
  renameManualGameSave,
} from './services/gameSaveService';
import {
  loadPhysicsSettings,
  persistPhysicsSettings,
} from './services/physicsSettingsService';
import { useTutorialDirector } from './hooks/useTutorialDirector';
import {
  clearActiveCampaign,
  clearCampaignSession,
  flattenCampaign,
  isCampaignEntryUnlocked,
  isCampaignSessionValid,
  loadActiveCampaign,
  loadCampaignProgress,
  loadCampaignSession,
  saveActiveCampaign,
  saveCampaignResult,
  saveCampaignSession,
} from './services/campaignService';
import { DEFAULT_OFFICIAL_CAMPAIGN, loadBundledOfficialCampaign } from './services/officialCampaign';

const DEG_10 = Math.PI / 18;
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
const levelUsesBlueprintGuide = (level: LevelDefinition) =>
  level.requiresBlueprintMatch || level.tutorial.cues.some(cue => cue.enabled && cue.kind === 'blueprint-step');
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
  const [showCampaignSelect, setShowCampaignSelect] = useState(false);
  const [showCampaignResume, setShowCampaignResume] = useState(false);
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
  const [physicsSettings, setPhysicsSettings] = useState<PhysicsSettings>(() =>
    loadPhysicsSettings(localStorage)
  );
  const applyPhysicsSettings = useCallback((settings: PhysicsSettings) => {
    setPhysicsSettings(persistPhysicsSettings(localStorage, settings));
  }, []);

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
  const [launchPreset, setLaunchPreset] = useState<LaunchPreset>('short-edge');
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
  const [officialCampaign, setOfficialCampaign] = useState<CampaignDefinition>(DEFAULT_OFFICIAL_CAMPAIGN);
  const [activeCampaign, setActiveCampaign] = useState<CampaignDefinition>(() => loadActiveCampaign() ?? DEFAULT_OFFICIAL_CAMPAIGN);
  const [campaignProgress, setCampaignProgress] = useState<CampaignProgress>(() => loadCampaignProgress((loadActiveCampaign() ?? DEFAULT_OFFICIAL_CAMPAIGN).id));
  const [activeCampaignEntryId, setActiveCampaignEntryId] = useState<string | null>(null);
  const [completedTutorials, setCompletedTutorials] = useState<Set<string>>(loadTutorialProgress);
  const liveCardTransformsRef = useRef(new Map<string, LiveCardTransform>());
  const launchHistoryRef = useRef<LaunchRecord[]>([]);
  const blueprintCheckpointRef = useRef<CardData[]>([]);
  const blueprintCheckpointReadyRef = useRef(false);
  const campaignTestCheckpointRef = useRef<CampaignSession | null>(null);
  const levelPlaytestStartedFromCueRef = useRef(false);
  const cameraHintRef = useRef<BlueprintCameraHint>({
    position: [0, 8, 12],
    target: [0, 0, 0],
  });
  const undoHistoryRef = useRef<Array<{ cards: CardData[]; cardSize: CardSize }>>([]);
  const redoHistoryRef = useRef<Array<{ cards: CardData[]; cardSize: CardSize }>>([]);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [challengePhase, setChallengePhase] = useState<ChallengePhase>(ChallengePhase.BUILDING);
  const [countdown, setCountdown] = useState(3);
  const [testTimeRemaining, setTestTimeRemaining] = useState(OFFICIAL_LEVELS[0].testDuration);
  const [liveHeight, setLiveHeight] = useState(0);
  const [challengeScore, setChallengeScore] = useState(0);
  const [challengeStars, setChallengeStars] = useState(0);
  const [currentTestStageIndex, setCurrentTestStageIndex] = useState(0);
  const [tutorialWorldScreenPoint, setTutorialWorldScreenPoint] = useState<{
    x: number;
    y: number;
    visible: boolean;
  } | null>(null);
  const [saveLibrary, setSaveLibrary] = useState(() =>
    loadGameSaveLibrary(localStorage)
  );
  const [saveLibraryMode, setSaveLibraryMode] = useState<SaveLibraryMode | null>(null);
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

  const recordCardHistory = useCallback((snapshot: CardData[], snapshotCardSize = cardSize) => {
    undoHistoryRef.current = [
      ...undoHistoryRef.current.slice(-49),
      { cards: snapshot, cardSize: snapshotCardSize },
    ];
    redoHistoryRef.current = [];
  }, [cardSize]);

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
    let active = true;
    void loadBundledOfficialCampaign().then(campaign => {
      if (!active) return;
      setOfficialCampaign(campaign);
      const saved = loadActiveCampaign();
      // A saved copy of the built-in campaign from an older revision would hide
      // newly shipped chapters, so refresh it. Progress survives: results are
      // keyed by level id + publish revision, not by campaign instance.
      const stale = saved !== null && saved.id === campaign.id &&
        saved.publishRevision < campaign.publishRevision;
      if (!saved || stale) {
        if (stale) clearCampaignSession();
        setActiveCampaign(campaign);
        setCampaignProgress(loadCampaignProgress(campaign.id));
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const activeIds = new Set(cards.map(card => card.id));
    for (const id of liveCardTransformsRef.current.keys()) {
      if (!activeIds.has(id)) liveCardTransformsRef.current.delete(id);
    }
  }, [cards]);

  const officialLevelOverrides = new Map(
    customLevels
      .filter(level => OFFICIAL_LEVEL_IDS.has(level.id))
      .map(level => [level.id, level]),
  );
  const effectiveOfficialLevels = OFFICIAL_LEVELS.map(
    level => officialLevelOverrides.get(level.id) ?? level,
  );
  const playerLevels = customLevels.filter(level => !OFFICIAL_LEVEL_IDS.has(level.id));
  const levelLibrary = [...effectiveOfficialLevels, ...playerLevels];
  const campaignLevels = flattenCampaign(activeCampaign);
  const currentPreset = presets.find(p => p.id === currentPresetId) || presets[0];
  const currentLevel = activeCustomLevel ?? campaignLevels[currentLevelIndex]?.entry.level ?? effectiveOfficialLevels[0];
  const currentTestStage = currentLevel.testStages[currentTestStageIndex];
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
  const tutorialDirector = useTutorialDirector({
    lang,
    currentPresetId,
    pointerMode,
    cardCount: cards.length,
    liveHeight,
    challengePhase,
    blueprintGuide,
    blueprintProgress,
    subscribeInput,
  });
  const activeTutorial = tutorialDirector.level?.tutorial.enabled
    ? tutorialDirector.level.tutorial
    : null;
  const activeTutorialCue = tutorialDirector.cue;
  let tutorialWorldTarget: [number, number, number] | null = null;
  if (activeTutorialCue?.target.type === 'world') {
    tutorialWorldTarget = activeTutorialCue.target.position;
  } else if (activeTutorialCue?.target.type === 'blueprint-step' && blueprintGuide) {
    const orderedSteps = [...blueprintGuide.blueprint.steps].sort((left, right) => left.order - right.order);
    const targetStep = orderedSteps[activeTutorialCue.target.stepIndex];
    const targetCardId = targetStep?.cardIds[0];
    const targetCard = getBlueprintWorldCards(blueprintGuide).find(card => card.id === targetCardId);
    tutorialWorldTarget = targetCard?.position ?? null;
  }

  const restartLevelTutorial = useCallback((level: LevelDefinition | null) => {
    tutorialDirector.start(level);
  }, [tutorialDirector.start]);

  useEffect(() => {
    if (activeTutorial?.cues.some(cue => cue.enabled && cue.kind === 'preset')) return;
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

  const setCardRole = useCallback((id: string, role: CardRole) => {
    setCards(previous => previous.map(card => (
      card.id === id && card.role !== role ? { ...card, role } : card
    )));
  }, []);

  const handleCardLaunch = useCallback((record: LaunchRecord) => {
    launchHistoryRef.current = [...launchHistoryRef.current.slice(-199), record];
  }, []);

  const clearCards = useCallback(() => {
    setCards(previous => {
      if (previous.length > 0) recordCardHistory(previous);
      return [];
    });
    liveHeightRef.current = 0;
    launchHistoryRef.current = [];
    setLiveHeight(0);
    if (gameMode === GameMode.CHALLENGE) {
      setChallengePhase(ChallengePhase.BUILDING);
      setChallengeScore(0);
      setChallengeStars(0);
    }
  }, [gameMode, recordCardHistory]);

  // --- LOGIC: SAVE/LOAD ---
  const writeGameSave = useCallback((
    source: GameSaveSource,
    options?: { id?: string; name?: string },
  ) => {
    const state = saveStateRef.current;
    if (state.cards.length === 0 || state.draggingCardId) return null;

    const save = createGameSave({
      id: options?.id,
      name: options?.name ?? (lang === 'zh' ? '自动存档' : 'Autosave'),
      source,
      cards: state.cards,
      liveTransforms: liveCardTransformsRef.current,
      cardSize: state.cardSize,
      currentPresetId: state.currentPresetId,
      isFreezeMode: state.isFreezeMode,
    });
    setSaveLibrary(persistGameSave(localStorage, save));
    return save;
  }, [lang]);

  const openSaveLibrary = useCallback(() => {
    if (draggingCardId) {
      alert(lang === 'zh' ? '请先放下当前纸牌' : 'Place the current card before saving');
      return;
    }
    if (cards.length === 0) {
      alert(lang === 'zh' ? '场景中还没有纸牌' : 'There are no cards to save');
      return;
    }
    setSaveLibrary(loadGameSaveLibrary(localStorage));
    setSaveLibraryMode('save');
  }, [cards.length, draggingCardId, lang]);

  const restoreGameSave = useCallback((
    data: GameSaveData,
    recoveredFromBackup = false,
  ) => {
    try {
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
      setSaveLibraryMode(null);
      alert(
        recoveredFromBackup
          ? (lang === 'zh' ? '主存档损坏，已恢复备份' : 'Recovered the backup save')
          : (lang === 'zh' ? `已读取“${data.name}”` : `Loaded “${data.name}”`)
      );
    } catch (e) {
      console.error(e);
      alert(lang === 'zh' ? '读取存档失败' : 'Failed to load save');
    }
  }, [lang, presets, resetCardHistory]);

  const loadLatestGame = useCallback(() => {
    const loaded = loadLatestGameSave(localStorage);
    if (!loaded) {
      alert(lang === 'zh' ? '没有找到可用存档' : 'No valid save found');
      setSaveLibrary(loadGameSaveLibrary(localStorage));
      return;
    }
    restoreGameSave(loaded.save, loaded.recoveredFromBackup);
  }, [lang, restoreGameSave]);

  const loadGameById = useCallback((id: string) => {
    const library = loadGameSaveLibrary(localStorage);
    setSaveLibrary(library);
    const save = findGameSave(library, id);
    if (!save) {
      alert(lang === 'zh' ? '这个存档已经不存在' : 'This save no longer exists');
      return;
    }
    const recovered =
      save.source === 'autosave'
        ? library.recoveredAutosaveBackup
        : library.recoveredManualBackup;
    restoreGameSave(save, recovered);
  }, [lang, restoreGameSave]);

  const createManualSave = useCallback((name: string) => {
    try {
      const save = writeGameSave('manual', { name });
      if (!save) return;
      setSaveLibraryMode(null);
    } catch (error) {
      console.error('Failed to create save', error);
      alert(lang === 'zh' ? '保存失败，请检查存储空间' : 'Save failed. Check available storage');
    }
  }, [lang, writeGameSave]);

  const overwriteManualSave = useCallback((id: string) => {
    const existing = saveLibrary.manualSaves.find(save => save.id === id);
    if (!existing) return;
    try {
      const save = writeGameSave('manual', { id, name: existing.name });
      if (!save) return;
      setSaveLibraryMode(null);
    } catch (error) {
      console.error('Failed to overwrite save', error);
      alert(lang === 'zh' ? '覆盖存档失败' : 'Failed to overwrite save');
    }
  }, [lang, saveLibrary.manualSaves, writeGameSave]);

  useEffect(() => {
    if (appState !== AppState.GAME) return;

    const autosave = () => {
      try {
        writeGameSave('autosave', {
          id: 'autosave',
          name: lang === 'zh' ? '自动存档' : 'Autosave',
        });
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
  }, [appState, lang, writeGameSave]);

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
      placementAction: 'guide',
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
    recordCardHistory(cards.map(card => {
      const transform = liveCardTransformsRef.current.get(card.id);
      return transform
        ? {
            ...card,
            position: [...transform.position],
            rotation: [...transform.rotation],
          }
        : { ...card };
    }));
    setCards([]);
    liveCardTransformsRef.current.clear();
    setIsFreezeMode(false);
    startBlueprintGuide(blueprint);
  }, [cards, recordCardHistory, startBlueprintGuide]);

  const quickPlaceBlueprint = useCallback((blueprint: Blueprint) => {
    if (gameMode !== GameMode.FREE) return;
    if (cards.length > 0 && cardSize !== blueprint.cardSize) {
      alert(lang === 'zh'
        ? '当前桌面的卡牌尺寸与蓝图不同。请在同一尺寸的桌面中放置此蓝图。'
        : 'The cards on the table use a different size. Place this blueprint in a table with the same card size.');
      return;
    }
    setDraggingCardId(null);
    setPointerMode(PointerMode.PLACE);
    setBlueprintGuide({
      blueprint,
      origin: [0, 0, 0],
      yaw: 0,
      placing: true,
      placementAction: 'quick-place',
      visible: true,
      currentStepIndex: 0,
      assistance: 'full',
    });
    setBlueprintProgress({
      ...EMPTY_BLUEPRINT_PROGRESS,
      total: blueprint.cardCount,
      currentStepTotal: blueprint.cardCount,
      activeTargetId: blueprint.snapshot.cards[0]?.id ?? null,
    });
    setBlueprintRecording(null);
    blueprintCheckpointRef.current = [];
    blueprintCheckpointReadyRef.current = false;
    setShowBlueprintStudio(false);
  }, [cardSize, cards.length, gameMode, lang]);

  const placeBlueprintOrigin = useCallback((origin: [number, number, number]) => {
    if (blueprintGuide?.placementAction === 'quick-place') {
      const placedCards = instantiateBlueprintCards(blueprintGuide.blueprint, {
        origin,
        yaw: blueprintGuide.yaw,
        locked: isFreezeMode,
      });
      if (placedCards.length === 0) return;
      if (cards.length === 0) setCardSize(blueprintGuide.blueprint.cardSize);
      const currentCards: CardData[] = cards.map(card => {
        const transform = liveCardTransformsRef.current.get(card.id);
        return transform
          ? {
              ...card,
              position: [...transform.position] as [number, number, number],
              rotation: [...transform.rotation] as [number, number, number],
            }
          : { ...card };
      });
      recordCardHistory(currentCards);
      placedCards.forEach(card => {
        liveCardTransformsRef.current.set(card.id, {
          position: [...card.position],
          rotation: [...card.rotation],
        });
      });
      setCards([...currentCards, ...placedCards]);
      setBlueprintGuide(null);
      setBlueprintProgress(EMPTY_BLUEPRINT_PROGRESS);
      blueprintCheckpointRef.current = [];
      blueprintCheckpointReadyRef.current = false;
      return;
    }
    blueprintCheckpointRef.current = cards.map(card => {
      const transform = liveCardTransformsRef.current.get(card.id);
      return transform
        ? { ...card, position: [...transform.position], rotation: [...transform.rotation] }
        : { ...card };
    });
    blueprintCheckpointReadyRef.current = true;
    setBlueprintGuide(previous => previous ? { ...previous, origin, placing: false } : null);
  }, [blueprintGuide, cards, isFreezeMode, recordCardHistory]);

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
    if (levelUsesBlueprintGuide(currentLevel)) {
      startBlueprintGuide(currentLevel.embeddedBlueprint, true);
    } else {
      stopBlueprintGuide();
    }
    tutorialDirector.start(currentLevel, activeCustomLevel
      ? { playtest: true, force: true }
      : undefined);
  }, [
    activeCustomLevel,
    currentLevel,
    currentLevel.testDuration,
    resetChallengeState,
    tutorialDirector.start,
    startBlueprintGuide,
    stopBlueprintGuide,
  ]);

  const captureCampaignSession = useCallback((): CampaignSession | null => {
    if (!activeCampaignEntryId || activeCustomLevel || gameMode !== GameMode.CHALLENGE) return null;
    const located = campaignLevels.find(item => item.entry.id === activeCampaignEntryId);
    if (!located) return null;
    return {
      schemaVersion: 1,
      campaignId: activeCampaign.id,
      campaignPublishRevision: activeCampaign.publishRevision,
      chapterId: located.chapter.id,
      levelEntryId: located.entry.id,
      levelId: located.entry.level.id,
      levelPublishRevision: located.entry.level.publishRevision,
      cards: captureLiveCards(cards, liveCardTransformsRef.current),
      cardSize,
      currentPresetId,
      isFreezeMode,
      blueprint: blueprintGuide ? {
        origin: [...blueprintGuide.origin], yaw: blueprintGuide.yaw,
        currentStepIndex: blueprintGuide.currentStepIndex,
        visible: blueprintGuide.visible,
        assistance: blueprintGuide.assistance,
      } : null,
      tutorialCueId: activeTutorialCue?.id ?? null,
      savedAt: new Date().toISOString(),
    };
  }, [activeCampaign, activeCampaignEntryId, activeCustomLevel, activeTutorialCue?.id, blueprintGuide, campaignLevels, cardSize, cards, currentPresetId, gameMode, isFreezeMode]);

  const launchCampaignEntry = useCallback((entryId: string, session?: CampaignSession | null) => {
    const index = campaignLevels.findIndex(item => item.entry.id === entryId);
    if (index < 0) return;
    const level = campaignLevels[index].entry.level;
    setActiveCustomLevel(null);
    setActiveCampaignEntryId(entryId);
    setGameMode(GameMode.CHALLENGE);
    setCurrentLevelIndex(index);
    setCardSize(level.embeddedBlueprint.cardSize);
    resetChallengeState(level.testDuration);
    if (levelUsesBlueprintGuide(level)) {
      startBlueprintGuide(level.embeddedBlueprint, true);
      if (session?.blueprint) setBlueprintGuide(previous => previous ? { ...previous, ...session.blueprint!, placing: false } : previous);
    } else stopBlueprintGuide();
    if (session) {
      liveCardTransformsRef.current.clear();
      session.cards.forEach(card => liveCardTransformsRef.current.set(card.id, { position: [...card.position], rotation: [...card.rotation] }));
      setCards(session.cards.map(card => ({ ...card, position: [...card.position], rotation: [...card.rotation] })));
      setCardSize(session.cardSize);
      setCurrentPresetId(presets.some(preset => preset.id === session.currentPresetId) ? session.currentPresetId : DEFAULT_PRESETS[0].id);
      setIsFreezeMode(session.isFreezeMode);
      tutorialDirector.start(level, { startCueId: session.tutorialCueId ?? undefined, force: true });
    } else restartLevelTutorial(level);
    setShowCampaignSelect(false);
    setShowCampaignResume(false);
    setAppState(AppState.GAME);
  }, [campaignLevels, presets, resetChallengeState, restartLevelTutorial, startBlueprintGuide, stopBlueprintGuide, tutorialDirector.start]);

  const startChallenge = useCallback(() => {
    const session = loadCampaignSession();
    if (session && isCampaignSessionValid(session, activeCampaign)) setShowCampaignResume(true);
    else {
      if (session) {
        clearCampaignSession();
        alert(lang === 'zh' ? '挑战流程或关卡已经更新，旧的中断进度无法安全恢复，请重新开始。' : 'The campaign or level changed. The old session cannot be restored safely; please restart.');
      }
      setShowCampaignSelect(true);
    }
  }, [activeCampaign, lang]);

  useEffect(() => {
    if (appState !== AppState.GAME || gameMode !== GameMode.CHALLENGE || activeCustomLevel || !activeCampaignEntryId) return;
    const persistSession = () => {
      const session = challengePhase === ChallengePhase.BUILDING
        ? captureCampaignSession()
        : campaignTestCheckpointRef.current;
      if (session) saveCampaignSession(session);
    };
    const interval = window.setInterval(persistSession, 30_000);
    const onVisibility = () => { if (document.visibilityState === 'hidden') persistSession(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', persistSession);
    window.addEventListener('beforeunload', persistSession);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('blur', persistSession); window.removeEventListener('beforeunload', persistSession); };
  }, [activeCampaignEntryId, activeCustomLevel, appState, captureCampaignSession, challengePhase, gameMode]);

  const advanceChallenge = useCallback(() => {
    if (activeCustomLevel) return;
    const next = campaignLevels[currentLevelIndex + 1];
    if (next) launchCampaignEntry(next.entry.id);
    else setShowCampaignSelect(true);
  }, [activeCustomLevel, campaignLevels, currentLevelIndex, launchCampaignEntry]);

  const saveCustomLevel = useCallback((input: CreateLevelInput, editingId: string | null) => {
    setCustomLevels(previous => {
      if (!editingId) return [createLevel(input), ...previous];
      const existing = previous.find(level => level.id === editingId);
      if (existing) {
        return previous.map(level => level.id === editingId ? updateLevel(level, input) : level);
      }
      const official = OFFICIAL_LEVELS.find(level => level.id === editingId);
      return official ? [updateLevel(official, input), ...previous] : previous;
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

  const playtestCustomLevel = useCallback((level: LevelDefinition, startCueId?: string) => {
    levelPlaytestStartedFromCueRef.current = Boolean(startCueId);
    setActiveCustomLevel(level);
    setGameMode(GameMode.CHALLENGE);
    setCurrentLevelIndex(0);
    setCardSize(level.embeddedBlueprint.cardSize);
    resetChallengeState(level.testDuration);
    setShowLevelStudio(false);
    setAppState(AppState.GAME);
    if (levelUsesBlueprintGuide(level)) {
      startBlueprintGuide(level.embeddedBlueprint, true);
      if (startCueId) {
        const enabledCues = level.tutorial.cues.filter(cue => cue.enabled);
        const selectedCueIndex = enabledCues.findIndex(cue => cue.id === startCueId);
        const selectedCue = enabledCues[selectedCueIndex];
        const earlierCues = enabledCues.slice(0, Math.max(0, selectedCueIndex));
        const earlierStepIndexes = earlierCues
          .filter(cue => cue.kind === 'blueprint-step')
          .map(cue => cue.blueprintStepIndex ?? 0);
        const preparedStepCount = selectedCue?.kind === 'blueprint-step'
          ? Math.max(0, selectedCue.blueprintStepIndex ?? 0)
          : earlierStepIndexes.length > 0 ? Math.max(...earlierStepIndexes) + 1 : 0;
        const orderedSteps = [...level.embeddedBlueprint.steps].sort((left, right) => left.order - right.order);
        const preparedIds = new Set(
          orderedSteps.slice(0, preparedStepCount).flatMap(step => step.cardIds),
        );
        const preparedCards = instantiateBlueprintCards(level.embeddedBlueprint, {
          origin: [0, 0, 0],
          yaw: 0,
          locked: false,
          idFactory: sourceId => sourceId,
        }).filter(card => preparedIds.has(card.id)).map(card => ({
          ...card,
          id: `tutorial_pre_${card.id}`,
          locked: false,
        }));
        preparedCards.forEach(card => liveCardTransformsRef.current.set(card.id, {
          position: [...card.position],
          rotation: [...card.rotation],
        }));
        setCards(preparedCards);
        setBlueprintGuide(previous => previous ? {
          ...previous,
          currentStepIndex: Math.min(preparedStepCount, Math.max(0, orderedSteps.length - 1)),
        } : previous);
        blueprintCheckpointRef.current = preparedCards.map(card => ({ ...card }));
        blueprintCheckpointReadyRef.current = true;
      }
    } else {
      stopBlueprintGuide();
    }
    tutorialDirector.start(level, { startCueId, playtest: true, force: true });
  }, [resetChallengeState, startBlueprintGuide, stopBlueprintGuide, tutorialDirector.start]);

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
      (currentLevel.requiresBlueprintMatch && !blueprintProgress.complete)
    ) {
      return;
    }

    if (!activeCustomLevel && activeCampaignEntryId) {
      const checkpoint = captureCampaignSession();
      campaignTestCheckpointRef.current = checkpoint;
      if (checkpoint) saveCampaignSession(checkpoint);
    }

    toggleFreezeMode(false);
    setDraggingCardId(null);
    setPointerMode(PointerMode.PLACE);
    setCountdown(3);
    setTestTimeRemaining(activeTestDuration);
    setChallengePhase(ChallengePhase.COUNTDOWN);
  }, [
    cards.length,
    blueprintProgress.complete,
    challengePhase,
    challengeTargetHeight,
    currentLevel.minCards,
    currentLevel.requiresBlueprintMatch,
    activeTestDuration,
    toggleFreezeMode,
    activeCustomLevel,
    activeCampaignEntryId,
    captureCampaignSession,
  ]);

  const undoCards = useCallback(() => {
    if (gameMode === GameMode.CHALLENGE && challengePhase !== ChallengePhase.BUILDING) return;
    const previous = undoHistoryRef.current.pop();
    if (!previous) return;
    setCards(current => {
      redoHistoryRef.current = [
        ...redoHistoryRef.current.slice(-49),
        { cards: current, cardSize },
      ];
      return previous.cards;
    });
    setCardSize(previous.cardSize);
    setDraggingCardId(null);
  }, [cardSize, challengePhase, gameMode]);

  const redoCards = useCallback(() => {
    if (gameMode === GameMode.CHALLENGE && challengePhase !== ChallengePhase.BUILDING) return;
    const next = redoHistoryRef.current.pop();
    if (!next) return;
    setCards(current => {
      undoHistoryRef.current = [
        ...undoHistoryRef.current.slice(-49),
        { cards: current, cardSize },
      ];
      return next.cards;
    });
    setCardSize(next.cardSize);
    setDraggingCardId(null);
  }, [cardSize, challengePhase, gameMode]);

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
          const nextStage = currentLevel.testStages[nextStageIndex];
          if (nextStage) {
            setCurrentTestStageIndex(nextStageIndex);
            setCountdown(3);
            setChallengePhase(ChallengePhase.COUNTDOWN);
            return nextStage.duration;
          }
          const unusedCards = currentLevel.maxCards - cards.length;
          const scoring = currentLevel.scoring;
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
    currentTestStageIndex,
    currentLevel.maxCards,
    currentLevel.scoring,
    currentLevel.testStages,
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
    if (challengePhase !== ChallengePhase.SUCCESS || activeCustomLevel || !activeCampaignEntryId) return;
    setCampaignProgress(saveCampaignResult(activeCampaign.id, currentLevel, challengeScore, challengeStars));
    clearCampaignSession();
    campaignTestCheckpointRef.current = null;
  }, [activeCampaign.id, activeCampaignEntryId, activeCustomLevel, challengePhase, challengeScore, challengeStars, currentLevel]);

  useEffect(() => {
    if (
      challengePhase !== ChallengePhase.SUCCESS ||
      !activeCustomLevel ||
      activeCustomLevel.verification.passed ||
      levelPlaytestStartedFromCueRef.current
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
      saveLibraryMode !== null ||
      tutorialDirector.entryVisible ||
      appState !== AppState.GAME,
    );
  }, [appState, saveLibraryMode, setInputSuspended, showBlueprintStudio, showLevelStudio, showSettings, tutorialDirector.entryVisible]);

  const cyclePreset = useCallback((direction: -1 | 1) => {
    if (!interactionEnabled || presets.length === 0) return;
    const currentIndex = Math.max(0, presets.findIndex(preset => preset.id === currentPresetId));
    const nextIndex = (currentIndex + direction + presets.length) % presets.length;
    setCurrentPresetId(presets[nextIndex].id);
  }, [currentPresetId, interactionEnabled, presets]);

  useInputAction('tool.place', event => {
    if (event.phase === 'down' && interactionEnabled) setPointerMode(PointerMode.PLACE);
  });
  useInputAction('tool.push', event => {
    if (event.phase === 'down' && interactionEnabled) setPointerMode(PointerMode.PUSH);
  });
  useInputAction('tool.delete', event => {
    if (event.phase === 'down' && interactionEnabled) setPointerMode(PointerMode.DELETE);
  });
  useInputAction('tool.launch', event => {
    if (
      event.phase === 'down' &&
      interactionEnabled &&
      gameMode === GameMode.FREE
    ) setPointerMode(PointerMode.LAUNCH);
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
  const storedCampaignSession = loadCampaignSession();
  const storedSessionLevel = storedCampaignSession && isCampaignSessionValid(storedCampaignSession, activeCampaign)
    ? campaignLevels.find(item => item.entry.id === storedCampaignSession.levelEntryId)?.entry.level ?? null
    : null;
  return (
    <div className="app-shell" data-theme={theme}>
      
      {appState === AppState.MENU && (
        <MainMenu 
           onStartChallenge={startChallenge}
           onStartFree={startFreeBuild}
           onLoad={loadLatestGame}
           onSettings={() => setShowSettings(true)}
           onOpenLevelStudio={() => setShowLevelStudio(true)}
           onOpenPhysicsLab={() => setAppState(AppState.PHYSICS_LAB)}
           hasSave={saveLibrary.manualSaves.length > 0 || saveLibrary.autosave !== null}
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
             launchPreset={launchPreset}
            isFreezeMode={isFreezeMode}
            cards={cards} 
            addCard={addCard} 
            removeCard={removeCard}
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
            physicsSettings={physicsSettings}
            onCardTransformChange={handleCardTransformChange}
            onCardLaunch={handleCardLaunch}
            blueprintGuide={blueprintGuide}
            onBlueprintPlaceOrigin={placeBlueprintOrigin}
            onBlueprintProgress={handleBlueprintProgress}
            onBlueprintStepComplete={completeBlueprintStep}
            onBlueprintStepRegression={regressBlueprintStep}
            onCameraHintChange={handleCameraHintChange}
            tutorialWorldTarget={tutorialWorldTarget}
            onTutorialWorldScreenPoint={setTutorialWorldScreenPoint}
          />
          
          <UIOverlay 
            presets={presets}
            currentPresetId={currentPresetId}
            setPresetId={setCurrentPresetId}
            interactionMode={interactionMode}
            setInteractionMode={setInteractionMode}
             pointerMode={pointerMode}
             setPointerMode={setPointerMode}
             launchPreset={launchPreset}
             setLaunchPreset={setLaunchPreset}
            isFreezeMode={isFreezeMode}
            setIsFreezeMode={() => toggleFreezeMode()}
            onClear={clearCards}
            onSave={openSaveLibrary}
            onLoad={() => {
              setSaveLibrary(loadGameSaveLibrary(localStorage));
              setSaveLibraryMode('load');
            }}
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
              const campaignSession = challengePhase === ChallengePhase.BUILDING
                ? captureCampaignSession()
                : campaignTestCheckpointRef.current;
              if (campaignSession) saveCampaignSession(campaignSession);
              try {
                writeGameSave('autosave', {
                  id: 'autosave',
                  name: lang === 'zh' ? '自动存档' : 'Autosave',
                });
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
            levelCount={activeCustomLevel ? 1 : campaignLevels.length}
            levelName={currentLevel.name[lang]}
            levelDescription={`${currentLevel.description[lang]}${activeCustomLevel && activeCustomLevel.testStages.length > 1 ? ` · ${lang === 'zh' ? '测试阶段' : 'Test stage'} ${currentTestStageIndex + 1}/${activeCustomLevel.testStages.length}` : ''}`}
            testType={activeTestType}
            requiresBlueprintMatch={currentLevel.requiresBlueprintMatch}
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
            tutorialEntry={tutorialDirector.entryVisible && activeTutorial ? {
              title: activeTutorial.entryTitle[lang],
              subtitle: activeTutorial.entrySubtitle[lang],
            } : null}
            tutorialCue={tutorialDirector.entryVisible ? null : activeTutorialCue}
            tutorialCueIndex={tutorialDirector.cueIndex}
            tutorialCueCount={tutorialDirector.cueCount}
            tutorialHint={tutorialDirector.hint}
            tutorialFeedbackActive={tutorialDirector.feedbackActive}
            tutorialWorldScreenPoint={tutorialWorldScreenPoint}
            tutorialAvailable={Boolean(activeTutorial)}
            tutorialSkippable={activeTutorial?.skippable ?? false}
            onDismissTutorialEntry={tutorialDirector.dismissEntry}
            onAdvanceTutorialCue={tutorialDirector.advance}
            onSkipTutorial={tutorialDirector.skip}
            onRestartTutorial={tutorialDirector.restart}
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
        physicsSettings={physicsSettings}
        onApplyPhysicsSettings={applyPhysicsSettings}
      />

      {saveLibraryMode && (
        <SaveLibraryModal
          mode={saveLibraryMode}
          lang={lang}
          manualSaves={saveLibrary.manualSaves}
          autosave={saveLibrary.autosave}
          onClose={() => setSaveLibraryMode(null)}
          onCreate={createManualSave}
          onOverwrite={overwriteManualSave}
          onLoad={loadGameById}
          onRename={(id, name) => {
            try {
              setSaveLibrary(renameManualGameSave(localStorage, id, name));
            } catch (error) {
              console.error('Failed to rename save', error);
              alert(lang === 'zh' ? '存档改名失败' : 'Failed to rename save');
            }
          }}
          onDelete={id => {
            try {
              setSaveLibrary(deleteManualGameSave(localStorage, id));
            } catch (error) {
              console.error('Failed to delete save', error);
              alert(lang === 'zh' ? '删除存档失败' : 'Failed to delete save');
            }
          }}
        />
      )}
      {showCampaignSelect && <CampaignSelect campaign={activeCampaign} progress={campaignProgress} lang={lang} onClose={() => setShowCampaignSelect(false)} onSelect={entryId => {
        if (!isCampaignEntryUnlocked(activeCampaign, campaignProgress, entryId)) return;
        const session = loadCampaignSession();
        if (session && session.levelEntryId !== entryId && !confirm(lang === 'zh' ? '开始其他关卡会替换当前中断进度，是否继续？' : 'Starting another level replaces the unfinished session. Continue?')) return;
        clearCampaignSession();
        launchCampaignEntry(entryId);
      }} />}
      {showCampaignResume && storedCampaignSession && storedSessionLevel && <CampaignResumeModal level={storedSessionLevel} lang={lang} onContinue={() => launchCampaignEntry(storedCampaignSession.levelEntryId, storedCampaignSession)} onRestart={() => { clearCampaignSession(); launchCampaignEntry(storedCampaignSession.levelEntryId); }} onChapters={() => { setShowCampaignResume(false); setShowCampaignSelect(true); }} />}

      {import.meta.env.DEV && appState === AppState.PHYSICS_LAB && (
        <PhysicsLab
          lang={lang}
          cardSize={cardSize}
          onClose={() => setAppState(AppState.MENU)}
        />
      )}

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
        onQuickPlace={quickPlaceBlueprint}
        quickPlaceEnabled={gameMode === GameMode.FREE && interactionEnabled}
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
        levels={levelLibrary}
        officialLevelIds={[...OFFICIAL_LEVEL_IDS]}
        overriddenOfficialLevelIds={customLevels.filter(level => OFFICIAL_LEVEL_IDS.has(level.id)).map(level => level.id)}
        onSave={saveCustomLevel}
        onDelete={id => setCustomLevels(previous => previous.filter(level => level.id !== id))}
        onDuplicate={level => setCustomLevels(previous => [duplicateLevel(level), ...previous])}
        onPublish={level => {
          const issues = getLevelPublishBlockingIssues(level);
          if (issues.length > 0) return issues;
          setCustomLevels(previous => previous.map(item => item.id === level.id ? publishLevel(item) : item));
          return [];
        }}
        onImport={importCustomLevel}
        onPlay={playtestCustomLevel}
        campaign={activeCampaign}
        onApplyCampaign={campaign => {
          saveActiveCampaign(campaign);
          setActiveCampaign(campaign);
          setCampaignProgress(loadCampaignProgress(campaign.id));
        }}
        onRestoreCampaign={() => {
          clearActiveCampaign();
          clearCampaignSession();
          setActiveCampaign(officialCampaign);
          setCampaignProgress(loadCampaignProgress(officialCampaign.id));
          return officialCampaign;
        }}
        onPreviewCampaignLevel={(campaign, levelEntryId) => {
          const match = flattenCampaign(campaign).find(item => item.entry.id === levelEntryId);
          if (match) playtestCustomLevel(match.entry.level);
        }}
        onClose={() => setShowLevelStudio(false)}
      />
    </div>
  );
};

export default App;
