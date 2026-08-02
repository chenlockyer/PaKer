import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BlueprintGuideProgress,
  BlueprintGuideState,
  ChallengePhase,
  LevelDefinition,
  LevelTutorialCue,
  PointerMode,
} from '../types';
import { InputAction, InputActionEvent } from '../input/InputContext';
import { playSuccessSound } from '../services/audioService';
import {
  hasCompletedLevelTutorial,
  markLevelTutorialCompleted,
} from '../services/tutorialService';

interface TutorialDirectorOptions {
  lang: 'zh' | 'en';
  currentPresetId: string;
  pointerMode: PointerMode;
  cardCount: number;
  liveHeight: number;
  challengePhase: ChallengePhase;
  blueprintGuide: BlueprintGuideState | null;
  blueprintProgress: BlueprintGuideProgress;
  subscribeInput: (action: InputAction, listener: (event: InputActionEvent) => void) => () => void;
}

interface TutorialStartOptions {
  startCueId?: string;
  playtest?: boolean;
  force?: boolean;
}

export const useTutorialDirector = ({
  lang,
  currentPresetId,
  pointerMode,
  cardCount,
  liveHeight,
  challengePhase,
  blueprintGuide,
  blueprintProgress,
  subscribeInput,
}: TutorialDirectorOptions) => {
  const [level, setLevel] = useState<LevelDefinition | null>(null);
  const [cueIndex, setCueIndex] = useState(0);
  const [entryVisible, setEntryVisible] = useState(false);
  const [hintIndex, setHintIndex] = useState(-1);
  const [feedbackCueId, setFeedbackCueId] = useState<string | null>(null);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const playtestRef = useRef(false);
  const cueStartedAtRef = useRef(performance.now());
  const cueBaselineCardCountRef = useRef(cardCount);
  const lastBlueprintStepRef = useRef(0);
  const feedbackTimerRef = useRef<number | null>(null);
  const advancingRef = useRef(false);
  const debugLevelIdRef = useRef<string | null>(null);

  const cues = useMemo(
    () => level?.tutorial.enabled ? level.tutorial.cues.filter(cue => cue.enabled) : [],
    [level],
  );
  const cue: LevelTutorialCue | null = cues[cueIndex] ?? null;

  const logEvent = useCallback((message: string) => {
    setEventLog(previous => [message, ...previous].slice(0, 12));
    const entry = { levelId: debugLevelIdRef.current, message, at: new Date().toISOString() };
    try {
      const previous = JSON.parse(localStorage.getItem('hoc_tutorial_debug_events_v1') ?? '[]');
      const events = Array.isArray(previous) ? previous : [];
      localStorage.setItem('hoc_tutorial_debug_events_v1', JSON.stringify([entry, ...events].slice(0, 30)));
      window.dispatchEvent(new CustomEvent('paker-tutorial-debug', { detail: entry }));
    } catch {
      // Debug telemetry must never interrupt the tutorial.
    }
  }, []);

  const markFinished = useCallback((targetLevel: LevelDefinition | null) => {
    if (!targetLevel || playtestRef.current || targetLevel.tutorial.displayMode !== 'first-time') return;
    markLevelTutorialCompleted(localStorage, targetLevel);
  }, []);

  const advance = useCallback(() => {
    if (advancingRef.current) return;
    const completedCue = cues[cueIndex];
    if (!completedCue) return;
    advancingRef.current = true;
    logEvent(`complete:${completedCue.kind}:${completedCue.id}`);
    if (completedCue.feedback.sound) playSuccessSound();
    const finish = () => {
      setFeedbackCueId(null);
      setCueIndex(index => index === cueIndex ? index + 1 : index);
      if (cueIndex + 1 >= cues.length) markFinished(level);
      advancingRef.current = false;
    };
    if (completedCue.feedback.flash) {
      setFeedbackCueId(completedCue.id);
      if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = window.setTimeout(finish, 420);
    } else {
      finish();
    }
  }, [cueIndex, cues, level, logEvent, markFinished]);

  const start = useCallback((nextLevel: LevelDefinition | null, options: TutorialStartOptions = {}) => {
    setLevel(nextLevel);
    debugLevelIdRef.current = nextLevel?.id ?? null;
    playtestRef.current = Boolean(options.playtest);
    setFeedbackCueId(null);
    advancingRef.current = false;
    setHintIndex(-1);
    setEventLog([]);
    cueStartedAtRef.current = performance.now();
    cueBaselineCardCountRef.current = 0;
    lastBlueprintStepRef.current = 0;
    if (!nextLevel?.tutorial.enabled) {
      setCueIndex(0);
      setEntryVisible(false);
      return;
    }
    const enabledCues = nextLevel.tutorial.cues.filter(item => item.enabled);
    const requestedIndex = options.startCueId
      ? enabledCues.findIndex(item => item.id === options.startCueId)
      : 0;
    const alreadySeen = !options.force && !options.playtest &&
      nextLevel.tutorial.displayMode === 'first-time' &&
      hasCompletedLevelTutorial(localStorage, nextLevel);
    setCueIndex(alreadySeen ? enabledCues.length : Math.max(0, requestedIndex));
    setEntryVisible(!alreadySeen && !options.startCueId && Boolean(
      nextLevel.tutorial.entryTitle[lang] || nextLevel.tutorial.entrySubtitle[lang],
    ));
    logEvent(options.startCueId ? `start:${options.startCueId}` : 'start:first');
  }, [lang, logEvent]);

  const skip = useCallback(() => {
    if (!level) return;
    setEntryVisible(false);
    setCueIndex(cues.length);
    markFinished(level);
    logEvent('skip');
  }, [cues.length, level, logEvent, markFinished]);

  const restart = useCallback(() => {
    if (level) start(level, { playtest: playtestRef.current, force: true });
  }, [level, start]);

  const dismissEntry = useCallback(() => {
    setEntryVisible(false);
    if (level && cues.length === 0) markFinished(level);
  }, [cues.length, level, markFinished]);

  useEffect(() => {
    if (!entryVisible || !level || level.tutorial.entryDurationMs <= 0) return;
    const timer = window.setTimeout(() => setEntryVisible(false), level.tutorial.entryDurationMs);
    return () => window.clearTimeout(timer);
  }, [entryVisible, level]);

  useEffect(() => {
    cueStartedAtRef.current = performance.now();
    cueBaselineCardCountRef.current = cardCount;
    setHintIndex(-1);
  }, [cue?.id]);

  useEffect(() => {
    if (entryVisible || !cue || cue.hints.length === 0) return;
    const update = () => {
      const elapsed = performance.now() - cueStartedAtRef.current;
      let next = -1;
      cue.hints.forEach((hint, index) => { if (elapsed >= hint.delayMs) next = index; });
      setHintIndex(previous => previous === next ? previous : next);
    };
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [cue, entryVisible]);

  useEffect(() => {
    if (!cue || entryVisible) return;
    cueStartedAtRef.current = performance.now();
    setHintIndex(-1);
  }, [currentPresetId, pointerMode, cardCount, liveHeight, challengePhase, blueprintGuide?.currentStepIndex, cue?.id, entryVisible]);

  useEffect(() => {
    if (!cue || entryVisible) return;
    if (cue.kind === 'preset' && cue.presetId === currentPresetId) advance();
    else if (cue.kind === 'tool' && cue.tool === pointerMode) advance();
    else if (cue.kind === 'card-place' && cardCount - cueBaselineCardCountRef.current >= (cue.cardCount ?? 1)) advance();
    else if (cue.kind === 'height' && liveHeight >= (cue.targetHeight ?? Number.POSITIVE_INFINITY)) advance();
    else if (cue.kind === 'test-start' && (challengePhase === ChallengePhase.COUNTDOWN || challengePhase === ChallengePhase.TESTING)) advance();
    else if (cue.kind === 'test-success' && challengePhase === ChallengePhase.SUCCESS) advance();
    else if (cue.kind === 'test-failure' && challengePhase === ChallengePhase.FAILED) advance();
  }, [advance, cardCount, challengePhase, cue, currentPresetId, entryVisible, liveHeight, pointerMode]);

  useEffect(() => {
    if (!cue || entryVisible || cue.kind !== 'input' || !cue.inputAction) return;
    return subscribeInput(cue.inputAction as InputAction, event => {
      if (event.phase !== 'down') return;
      logEvent(`input:${event.action}`);
      advance();
    });
  }, [advance, cue, entryVisible, logEvent, subscribeInput]);

  useEffect(() => {
    if (!cue || entryVisible || cue.kind !== 'blueprint-step' || cue.blueprintStepIndex === undefined || !blueprintGuide) return;
    const targetIndex = cue.blueprintStepIndex;
    const targetIsComplete = blueprintGuide.currentStepIndex > targetIndex ||
      (blueprintGuide.currentStepIndex === targetIndex && blueprintProgress.complete);
    if (targetIsComplete) advance();
  }, [advance, blueprintGuide, blueprintProgress.complete, cue, entryVisible]);

  useEffect(() => {
    const currentStep = blueprintGuide?.currentStepIndex ?? 0;
    if (currentStep < lastBlueprintStepRef.current) {
      const regressionIndex = cues.findIndex(item =>
        item.kind === 'blueprint-step' && (item.blueprintStepIndex ?? 0) >= currentStep,
      );
      if (regressionIndex >= 0 && regressionIndex < cueIndex) {
        setCueIndex(regressionIndex);
        logEvent(`regress:blueprint-step:${currentStep}`);
      }
    }
    lastBlueprintStepRef.current = currentStep;
  }, [blueprintGuide?.currentStepIndex, cueIndex, cues, logEvent]);

  useEffect(() => () => {
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
  }, []);

  return {
    level,
    cue,
    cueIndex,
    cueCount: cues.length,
    entryVisible,
    hint: hintIndex >= 0 ? cue?.hints[hintIndex] ?? null : null,
    feedbackActive: Boolean(feedbackCueId),
    eventLog,
    start,
    advance,
    skip,
    restart,
    dismissEntry,
  };
};
