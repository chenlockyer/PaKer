import {
  Blueprint,
  ChallengeTestType,
  LevelDefinition,
  LevelOrigin,
  LevelTestStage,
  LevelTutorial,
} from '../types';

const LEVEL_STORAGE_KEY = 'hoc_custom_levels_v1';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const checksumBlueprint = (blueprint: Blueprint) => {
  const content = JSON.stringify(blueprint);
  let hash = 2166136261;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

export interface CreateLevelInput {
  name: string;
  description: string;
  author: string;
  origin: LevelOrigin;
  tags: string[];
  blueprint: Blueprint;
  maxCards: number;
  minCards: number;
  heightMultiplier: number;
  testDuration: number;
  testType: ChallengeTestType;
  windStrength?: number;
  weightMass?: number;
  weightDropOffset?: number;
  status?: LevelDefinition['status'];
  scoring?: LevelDefinition['scoring'];
  testStages?: LevelTestStage[];
  tutorial?: LevelTutorial;
}

export const createLevel = (input: CreateLevelInput): LevelDefinition => {
  const now = new Date().toISOString();
  const levelId = `level_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const embeddedBlueprint = clone(input.blueprint);
  embeddedBlueprint.id = `${levelId}_blueprint`;
  embeddedBlueprint.updatedAt = now;
  const defaultStage: LevelTestStage = {
    id: `stage_${Math.random().toString(36).slice(2, 8)}`,
    name: input.testType === ChallengeTestType.WIND
      ? '风力测试'
      : input.testType === ChallengeTestType.WEIGHT_DROP ? '落物冲击' : '稳定性测试',
    testType: input.testType,
    duration: Math.max(1, input.testDuration),
    windStrength: input.windStrength,
    weightMass: input.weightMass,
    weightDropOffset: input.weightDropOffset,
  };
  const testStages = (input.testStages?.length ? input.testStages : [defaultStage]).map((stage, index) => ({
    ...stage,
    id: stage.id || `stage_${index + 1}_${Math.random().toString(36).slice(2, 7)}`,
    duration: Math.max(1, stage.duration),
  }));
  const firstStage = testStages[0];
  return {
    schemaVersion: 1,
    id: levelId,
    name: { zh: input.name.trim(), en: input.name.trim() },
    description: { zh: input.description.trim(), en: input.description.trim() },
    origin: input.origin,
    author: input.author.trim(),
    tags: input.tags.map(tag => tag.trim()).filter(Boolean).slice(0, 8),
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'draft',
    sourceBlueprintId: input.blueprint.id,
    embeddedBlueprint,
    blueprintChecksum: checksumBlueprint(embeddedBlueprint),
    maxCards: Math.max(1, Math.round(input.maxCards)),
    minCards: Math.max(0, Math.min(Math.round(input.minCards), Math.round(input.maxCards))),
    heightMultiplier: Math.max(0.1, input.heightMultiplier),
    testDuration: firstStage.duration,
    testType: firstStage.testType,
    windStrength: firstStage.testType === ChallengeTestType.WIND ? Math.max(0, firstStage.windStrength ?? 0.02) : undefined,
    weightMass: firstStage.testType === ChallengeTestType.WEIGHT_DROP ? Math.max(0.05, firstStage.weightMass ?? 0.45) : undefined,
    weightDropOffset: firstStage.testType === ChallengeTestType.WEIGHT_DROP ? Math.max(0.5, firstStage.weightDropOffset ?? 4) : undefined,
    testStages,
    tutorial: input.tutorial ? clone(input.tutorial) : {
      enabled: false,
      entryTitle: { zh: '', en: '' },
      entrySubtitle: { zh: '', en: '' },
      cues: [],
    },
    scoring: input.scoring ?? { baseScore: 500, unusedCardBonus: 50, heightBonus: 100 },
    verification: {
      passed: false,
      playtestedAt: null,
      blueprintChecksum: checksumBlueprint(embeddedBlueprint),
    },
  };
};

export const updateLevel = (
  existing: LevelDefinition,
  input: CreateLevelInput,
): LevelDefinition => {
  const updated = createLevel(input);
  const embeddedBlueprint = {
    ...updated.embeddedBlueprint,
    id: `${existing.id}_blueprint`,
  };
  const blueprintChecksum = checksumBlueprint(embeddedBlueprint);
  return {
    ...updated,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
    embeddedBlueprint,
    blueprintChecksum,
    sourceBlueprintId: input.blueprint.id === existing.embeddedBlueprint.id
      ? existing.sourceBlueprintId
      : input.blueprint.id,
    verification: {
      passed: false,
      playtestedAt: null,
      blueprintChecksum,
    },
    status: existing.status === 'published' ? 'draft' : input.status ?? 'draft',
  };
};

export const duplicateLevel = (source: LevelDefinition): LevelDefinition => {
  const copy = createLevel({
    name: `${source.name.zh} - 副本`,
    description: source.description.zh,
    author: source.author,
    origin: source.origin,
    tags: source.tags,
    blueprint: source.embeddedBlueprint,
    maxCards: source.maxCards,
    minCards: source.minCards,
    heightMultiplier: source.heightMultiplier,
    testDuration: source.testDuration,
    testType: source.testType,
    windStrength: source.windStrength,
    weightMass: source.weightMass,
    weightDropOffset: source.weightDropOffset,
    scoring: source.scoring,
    testStages: source.testStages,
    tutorial: source.tutorial,
  });
  return { ...copy, sourceBlueprintId: source.sourceBlueprintId };
};

export const getLevelValidationIssues = (level: LevelDefinition): string[] => {
  const issues: string[] = [];
  if (!level.name.zh.trim()) issues.push('missing-name');
  if (level.minCards > level.maxCards) issues.push('invalid-card-limit');
  if (level.embeddedBlueprint.cardCount > level.maxCards) issues.push('blueprint-exceeds-card-limit');
  if (!level.testStages?.length || level.testStages.some(stage => stage.duration < 1)) issues.push('invalid-test-stages');
  if (
    level.tutorial?.enabled &&
    level.tutorial.cues.some(cue =>
      !cue.text.zh.trim() ||
      (cue.kind === 'preset' && !cue.presetId) ||
      (cue.kind === 'input' && !cue.inputAction) ||
      (cue.kind === 'blueprint-step' && !Number.isInteger(cue.blueprintStepIndex))
    )
  ) issues.push('invalid-tutorial-cues');
  if (level.blueprintChecksum !== checksumBlueprint(level.embeddedBlueprint)) issues.push('blueprint-checksum');
  const assigned = new Set(level.embeddedBlueprint.steps.flatMap(step => step.cardIds));
  if (
    level.embeddedBlueprint.steps.length === 0 ||
    level.embeddedBlueprint.steps.some(step => step.cardIds.length === 0) ||
    level.embeddedBlueprint.snapshot.cards.some(card => !assigned.has(card.id))
  ) issues.push('incomplete-blueprint-steps');
  if (
    !level.verification?.passed ||
    level.verification.blueprintChecksum !== level.blueprintChecksum
  ) issues.push('playtest-required');
  return issues;
};

export const markLevelPlaytested = (level: LevelDefinition): LevelDefinition => ({
  ...level,
  updatedAt: new Date().toISOString(),
  verification: {
    passed: true,
    playtestedAt: new Date().toISOString(),
    blueprintChecksum: level.blueprintChecksum,
  },
});

export const publishLevel = (level: LevelDefinition): LevelDefinition => {
  const issues = getLevelValidationIssues(level);
  if (issues.length > 0) throw new Error(issues.join(','));
  return { ...level, status: 'published', updatedAt: new Date().toISOString() };
};

export const validateLevel = (value: unknown): LevelDefinition => {
  if (!value || typeof value !== 'object') throw new Error('Invalid level file');
  const level = value as LevelDefinition;
  if (
    level.schemaVersion !== 1 ||
    typeof level.id !== 'string' ||
    !level.name?.zh ||
    !level.embeddedBlueprint ||
    level.embeddedBlueprint.schemaVersion !== 2 ||
    level.blueprintChecksum !== checksumBlueprint(level.embeddedBlueprint)
  ) throw new Error('Invalid or damaged level file');
  const migrated = clone(level);
  migrated.verification ??= {
    passed: false,
    playtestedAt: null,
    blueprintChecksum: migrated.blueprintChecksum,
  };
  migrated.testStages ??= [{
    id: 'stage_legacy',
    name: '测试',
    testType: migrated.testType,
    duration: migrated.testDuration,
    windStrength: migrated.windStrength,
    weightMass: migrated.weightMass,
    weightDropOffset: migrated.weightDropOffset,
  }];
  migrated.tutorial ??= {
    enabled: false,
    entryTitle: { zh: '', en: '' },
    entrySubtitle: { zh: '', en: '' },
    cues: [],
  };
  return migrated;
};

export const loadLevels = (): LevelDefinition[] => {
  try {
    const values = JSON.parse(localStorage.getItem(LEVEL_STORAGE_KEY) ?? '[]');
    if (!Array.isArray(values)) return [];
    return values.flatMap(value => {
      try { return [validateLevel(value)]; } catch { return []; }
    });
  } catch {
    return [];
  }
};

export const persistLevels = (levels: LevelDefinition[]) => {
  localStorage.setItem(LEVEL_STORAGE_KEY, JSON.stringify(levels));
};

export const parseLevelFile = (content: string) => validateLevel(JSON.parse(content));

export const downloadLevel = (level: LevelDefinition) => {
  const blob = new Blob([JSON.stringify(level, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${level.name.zh.replace(/[^\w\u4e00-\u9fa5-]+/g, '-') || 'level'}.paker-level.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};
