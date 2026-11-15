import {
  Blueprint,
  CARD_DIMENSIONS,
  LevelDefinition,
} from '../types';
import { checksumBlueprint } from './levelService';
import {
  GENERATED_OFFICIAL_LEVELS,
  GeneratedOfficialLevel,
} from './officialLevelData.generated';

/**
 * The official campaign levels are data, not hand written geometry.
 *
 * `services/officialLevelData.generated.ts` is produced by
 * `npm run level:build` from `scripts/level-factory/`, where every reference
 * structure is simulated with Rapier before it is written out. This module only
 * turns that data back into the blueprint + level shape the runtime expects and
 * computes the integrity checksum, so a level can never drift from its
 * blueprint.
 */

const CREATED_AT = '2026-11-15T00:00:00.000Z';

const makeBlueprint = (level: GeneratedOfficialLevel): Blueprint => {
  const dimensions = CARD_DIMENSIONS[level.cardSize];
  return {
    schemaVersion: 2,
    id: `${level.id}_blueprint`,
    name: level.name.zh,
    description: level.description.zh,
    author: 'PaKer',
    category: level.category,
    tags: level.tags,
    createdAt: level.capturedAt,
    updatedAt: level.capturedAt,
    cardSize: level.cardSize,
    cardDimensions: {
      width: dimensions.width,
      height: dimensions.height,
      thickness: dimensions.thickness,
    },
    cardCount: level.cards.length,
    coordinateSpace: 'structure-local',
    status: 'published',
    tolerances: level.tolerances,
    steps: level.steps,
    snapshot: {
      capturedAt: level.capturedAt,
      source: 'live-physics',
      originWorld: level.originWorld,
      bounds: level.bounds,
      cards: level.cards,
    },
  };
};

const makeOfficialLevel = (level: GeneratedOfficialLevel): LevelDefinition => {
  const embeddedBlueprint = makeBlueprint(level);
  const blueprintChecksum = checksumBlueprint(embeddedBlueprint);
  const firstStage = level.testStages[0];
  return {
    schemaVersion: 2,
    publishRevision: 1,
    id: level.id,
    name: level.name,
    description: level.description,
    origin: 'official',
    requiresBlueprintMatch: level.requiresBlueprintMatch,
    author: 'PaKer',
    tags: level.tags,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    status: 'published',
    sourceBlueprintId: embeddedBlueprint.id,
    embeddedBlueprint,
    blueprintChecksum,
    maxCards: level.maxCards,
    minCards: level.minCards,
    heightMultiplier: level.heightMultiplier,
    testDuration: firstStage.duration,
    testType: firstStage.testType,
    windStrength: firstStage.testType === 'WIND' ? firstStage.windStrength : undefined,
    weightMass: firstStage.testType === 'WEIGHT_DROP' ? firstStage.weightMass : undefined,
    weightDropOffset: firstStage.testType === 'WEIGHT_DROP' ? firstStage.weightDropOffset : undefined,
    testStages: level.testStages,
    tutorial: level.tutorial,
    scoring: level.scoring,
    verification: {
      passed: true,
      playtestedAt: CREATED_AT,
      blueprintChecksum,
    },
  };
};

export const OFFICIAL_LEVELS: LevelDefinition[] = GENERATED_OFFICIAL_LEVELS.map(makeOfficialLevel);

export const OFFICIAL_LEVEL_IDS = new Set(OFFICIAL_LEVELS.map(level => level.id));
