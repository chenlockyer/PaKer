import {
  LevelDefinition,
  LevelTutorial,
  LevelTutorialCue,
  LevelTutorialCueKind,
  LevelTutorialHighlight,
  LevelTutorialTarget,
  PointerMode,
} from '../types';

const COMPLETION_STORAGE_KEY = 'hoc_level_tutorial_completion_v1';

export const DEFAULT_TUTORIAL_HINTS: LevelTutorialCue['hints'] = [
  { delayMs: 3000, highlight: 'pulse', text: { zh: '', en: '' } },
  { delayMs: 8000, highlight: 'arrow', text: { zh: '', en: '' } },
  { delayMs: 15000, highlight: 'spotlight', text: { zh: '', en: '' } },
];

const defaultTargetForKind = (kind: LevelTutorialCueKind): LevelTutorialTarget => {
  if (kind === 'preset') return { type: 'preset', presetId: '' };
  if (kind === 'tool') return { type: 'tool', tool: PointerMode.PLACE };
  if (kind === 'blueprint-step') return { type: 'blueprint-step', stepIndex: 0 };
  if (kind === 'input') return { type: 'control', control: 'height-lock' };
  if (kind === 'test-start') {
    return { type: 'control', control: 'test' };
  }
  return { type: 'none' };
};

const defaultHighlightForKind = (kind: LevelTutorialCueKind): LevelTutorialHighlight => {
  if (kind === 'input') return 'key-badge';
  if (kind === 'blueprint-step') return 'blueprint-glow';
  return kind === 'message' ? 'pulse' : 'arrow';
};

export const createTutorialCue = (
  kind: LevelTutorialCueKind = 'message',
  id = `cue_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
): LevelTutorialCue => ({
  id,
  kind,
  enabled: true,
  text: { zh: '', en: '' },
  target: defaultTargetForKind(kind),
  highlight: defaultHighlightForKind(kind),
  hints: DEFAULT_TUTORIAL_HINTS.map(hint => ({ ...hint, text: { ...hint.text } })),
  feedback: { flash: true, sound: true },
  ...(kind === 'preset' ? { presetId: '' } : {}),
  ...(kind === 'tool' ? { tool: PointerMode.PLACE } : {}),
  ...(kind === 'card-place' ? { cardCount: 1 } : {}),
  ...(kind === 'blueprint-step' ? { blueprintStepIndex: 0 } : {}),
  ...(kind === 'height' ? { targetHeight: 1 } : {}),
});

export const createDefaultTutorial = (): LevelTutorial => ({
  enabled: false,
  displayMode: 'first-time',
  skippable: true,
  entryDurationMs: 0,
  entryTitle: { zh: '', en: '' },
  entrySubtitle: { zh: '', en: '' },
  cues: [],
});

export const normalizeTutorialCue = (value: Partial<LevelTutorialCue>): LevelTutorialCue => {
  const base = createTutorialCue(value.kind ?? 'message', value.id || undefined);
  const presetId = value.presetId ?? (value.target?.type === 'preset' ? value.target.presetId : '');
  const tool = value.tool ?? (value.target?.type === 'tool' ? value.target.tool : PointerMode.PLACE);
  const blueprintStepIndex = value.blueprintStepIndex
    ?? (value.target?.type === 'blueprint-step' ? value.target.stepIndex : 0);
  let target = value.target ?? base.target;
  if (value.kind === 'preset') target = { type: 'preset', presetId };
  if (value.kind === 'tool') target = { type: 'tool', tool };
  if (value.kind === 'blueprint-step') target = { type: 'blueprint-step', stepIndex: blueprintStepIndex };

  return {
    ...base,
    ...value,
    id: value.id || base.id,
    enabled: value.enabled ?? true,
    text: {
      zh: value.text?.zh ?? '',
      en: value.text?.en ?? value.text?.zh ?? '',
    },
    presetId,
    tool,
    blueprintStepIndex,
    target,
    hints: (value.hints?.length ? value.hints : base.hints)
      .map(hint => ({
        delayMs: Math.max(0, Number(hint.delayMs) || 0),
        highlight: hint.highlight,
        text: { zh: hint.text?.zh ?? '', en: hint.text?.en ?? hint.text?.zh ?? '' },
      }))
      .sort((left, right) => left.delayMs - right.delayMs),
    feedback: {
      flash: value.feedback?.flash ?? true,
      sound: value.feedback?.sound ?? true,
    },
  };
};

export const normalizeTutorial = (value?: Partial<LevelTutorial>): LevelTutorial => {
  const base = createDefaultTutorial();
  return {
    ...base,
    ...value,
    entryTitle: { zh: value?.entryTitle?.zh ?? '', en: value?.entryTitle?.en ?? value?.entryTitle?.zh ?? '' },
    entrySubtitle: { zh: value?.entrySubtitle?.zh ?? '', en: value?.entrySubtitle?.en ?? value?.entrySubtitle?.zh ?? '' },
    cues: (value?.cues ?? []).map(cue => normalizeTutorialCue(cue)),
  };
};

const completionKey = (level: Pick<LevelDefinition, 'id' | 'publishRevision'>) =>
  `${level.id}@${level.publishRevision}`;

const loadCompletions = (storage: Storage): Set<string> => {
  try {
    const values = JSON.parse(storage.getItem(COMPLETION_STORAGE_KEY) ?? '[]');
    return new Set(Array.isArray(values) ? values.filter(value => typeof value === 'string') : []);
  } catch {
    return new Set();
  }
};

export const hasCompletedLevelTutorial = (storage: Storage, level: LevelDefinition) =>
  loadCompletions(storage).has(completionKey(level));

export const markLevelTutorialCompleted = (storage: Storage, level: LevelDefinition) => {
  const completions = loadCompletions(storage);
  completions.add(completionKey(level));
  storage.setItem(COMPLETION_STORAGE_KEY, JSON.stringify([...completions].slice(-200)));
};
