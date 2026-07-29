import {
  Blueprint,
  ChallengeTestType,
  LevelDefinition,
  LevelOrigin,
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
}

export const createLevel = (input: CreateLevelInput): LevelDefinition => {
  const now = new Date().toISOString();
  const levelId = `level_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const embeddedBlueprint = clone(input.blueprint);
  embeddedBlueprint.id = `${levelId}_blueprint`;
  embeddedBlueprint.updatedAt = now;
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
    testDuration: Math.max(1, input.testDuration),
    testType: input.testType,
    windStrength: input.testType === ChallengeTestType.WIND ? Math.max(0, input.windStrength ?? 0.02) : undefined,
    weightMass: input.testType === ChallengeTestType.WEIGHT_DROP ? Math.max(0.05, input.weightMass ?? 0.45) : undefined,
    weightDropOffset: input.testType === ChallengeTestType.WEIGHT_DROP ? Math.max(0.5, input.weightDropOffset ?? 4) : undefined,
    scoring: input.scoring ?? { baseScore: 500, unusedCardBonus: 50, heightBonus: 100 },
  };
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
  return clone(level);
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
