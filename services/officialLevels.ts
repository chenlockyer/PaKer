import {
  Blueprint,
  ChallengeTestType,
  LevelDefinition,
} from '../types';
import { checksumBlueprint } from './levelService';
import { OFFICIAL_TUTORIAL_BLUEPRINTS } from './officialBlueprints';

const CREATED_AT = '2026-07-29T00:00:00.000Z';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const makeOfficialLevel = ({
  id,
  name,
  description,
  blueprint,
  maxCards,
  minCards,
  heightMultiplier,
  testDuration,
  testType,
  windStrength,
  weightMass,
  weightDropOffset,
}: {
  id: string;
  name: LevelDefinition['name'];
  description: LevelDefinition['description'];
  blueprint: Blueprint;
  maxCards: number;
  minCards: number;
  heightMultiplier: number;
  testDuration: number;
  testType: ChallengeTestType;
  windStrength?: number;
  weightMass?: number;
  weightDropOffset?: number;
}): LevelDefinition => {
  const embeddedBlueprint = clone(blueprint);
  embeddedBlueprint.id = `${id}_blueprint`;
  const blueprintChecksum = checksumBlueprint(embeddedBlueprint);
  return {
    schemaVersion: 1,
    id,
    name,
    description,
    origin: 'official',
    requiresBlueprintMatch: false,
    author: 'PaKer',
    tags: ['官方', '关卡'],
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    status: 'published',
    sourceBlueprintId: blueprint.id,
    embeddedBlueprint,
    blueprintChecksum,
    maxCards,
    minCards,
    heightMultiplier,
    testDuration,
    testType,
    windStrength,
    weightMass,
    weightDropOffset,
    testStages: [{
      id: `${id}_stage_1`,
      name: testType === ChallengeTestType.WIND
        ? '风力测试'
        : testType === ChallengeTestType.WEIGHT_DROP
          ? '落物冲击'
          : '稳定性测试',
      testType,
      duration: testDuration,
      windStrength,
      weightMass,
      weightDropOffset,
    }],
    tutorial: {
      enabled: false,
      entryTitle: { zh: '', en: '' },
      entrySubtitle: { zh: '', en: '' },
      cues: [],
    },
    scoring: {
      baseScore: testDuration * 50,
      unusedCardBonus: 50,
      heightBonus: 100,
    },
    verification: {
      passed: true,
      playtestedAt: CREATED_AT,
      blueprintChecksum,
    },
  };
};

export const OFFICIAL_LEVELS: LevelDefinition[] = [
  makeOfficialLevel({
    id: 'a-frame',
    name: { zh: 'A 字架入门', en: 'A-Frame Basics' },
    description: {
      zh: '只使用 2 张牌搭建一个能够独立站立的 A 字架',
      en: 'Build a freestanding A-frame using only 2 cards',
    },
    blueprint: OFFICIAL_TUTORIAL_BLUEPRINTS[0],
    maxCards: 2,
    minCards: 2,
    heightMultiplier: 1,
    testDuration: 3,
    testType: ChallengeTestType.STABILITY,
  }),
  makeOfficialLevel({
    id: 'roof-house',
    name: { zh: '一层纸牌屋', en: 'One-Story House' },
    description: {
      zh: '使用不超过 10 张牌搭建有屋顶的一层房子',
      en: 'Build a roofed one-story house with no more than 10 cards',
    },
    blueprint: OFFICIAL_TUTORIAL_BLUEPRINTS[3],
    maxCards: 10,
    minCards: 10,
    heightMultiplier: 1,
    testDuration: 5,
    testType: ChallengeTestType.WIND,
    windStrength: 0.018,
  }),
  makeOfficialLevel({
    id: 'weight-drop',
    name: { zh: '落物冲击', en: 'Drop Impact' },
    description: {
      zh: '搭建一层结构，承受从上方落下的重物冲击',
      en: 'Build one story and survive a weight dropped from above',
    },
    blueprint: OFFICIAL_TUTORIAL_BLUEPRINTS[3],
    maxCards: 12,
    minCards: 6,
    heightMultiplier: 1,
    testDuration: 6,
    testType: ChallengeTestType.WEIGHT_DROP,
    weightMass: 0.45,
    weightDropOffset: 4,
  }),
  makeOfficialLevel({
    id: 'two-story-wind',
    name: { zh: '两层风力挑战', en: 'Two-Story Wind Trial' },
    description: {
      zh: '搭建两层纸牌屋，并承受 10 秒轻风',
      en: 'Build two stories and survive 10 seconds of light wind',
    },
    blueprint: OFFICIAL_TUTORIAL_BLUEPRINTS[3],
    maxCards: 20,
    minCards: 8,
    heightMultiplier: 2,
    testDuration: 10,
    testType: ChallengeTestType.WIND,
    windStrength: 0.07,
  }),
];

export const OFFICIAL_LEVEL_IDS = new Set(OFFICIAL_LEVELS.map(level => level.id));
