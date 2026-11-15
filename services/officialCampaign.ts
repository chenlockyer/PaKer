import {
  CampaignChapter,
  CampaignDefinition,
  CampaignLevelEntry,
  LevelDefinition,
} from '../types';
import { OFFICIAL_LEVELS } from './officialLevels';
import { validateCampaign } from './campaignService';

const CREATED_AT = '2026-11-15T00:00:00.000Z';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const levelById = (levelId: string): LevelDefinition => {
  const level = OFFICIAL_LEVELS.find(item => item.id === levelId);
  if (!level) throw new Error(`Unknown official level: ${levelId}`);
  return level;
};

const entry = (id: string, levelId: string): CampaignLevelEntry => {
  const level = levelById(levelId);
  return {
    id,
    enabled: true,
    sourceLevelId: level.id,
    sourcePublishRevision: level.publishRevision,
    level: clone(level),
  };
};

const chapter = (
  id: string,
  name: CampaignChapter['name'],
  description: CampaignChapter['description'],
  levelIds: string[],
): CampaignChapter => ({
  id,
  name,
  description,
  enabled: true,
  levels: levelIds.map((levelId, index) => entry(`${id.replace('chapter', 'official')}-${index + 1}`, levelId)),
});

/**
 * Entry ids are stable strings rather than generated ids: a saved campaign
 * session references them, and regenerating ids on every launch would invalidate
 * that save. Progress itself is keyed by level id + publish revision.
 */
export const DEFAULT_OFFICIAL_CAMPAIGN: CampaignDefinition = {
  schemaVersion: 1,
  id: 'official-campaign',
  name: { zh: '纸牌建筑师', en: 'PaKer Campaign' },
  description: {
    zh: '从两张牌开始，逐步掌握稳定、高层与抗冲击结构。',
    en: 'Learn stable, tall and impact-resistant card structures.',
  },
  status: 'published',
  publishRevision: 2,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
  chapters: [
    chapter(
      'chapter-foundations',
      { zh: '第一章 · 搭建基础', en: 'Chapter 1 · Foundations' },
      { zh: '学会支撑、屋顶和基本稳定结构', en: 'Learn supports, roofs and basic stability.' },
      ['a-frame', 'roof-house', 'tripod', 'gate'],
    ),
    chapter(
      'chapter-trials',
      { zh: '第二章 · 结构考验', en: 'Chapter 2 · Structural Trials' },
      { zh: '抵御冲击与侧风，把结构搭到两层高度', en: 'Survive impacts and side wind, then build above one storey.' },
      ['weight-drop', 'two-story-wind', 'wind-corridor', 'three-story'],
    ),
    chapter(
      'chapter-mastery',
      { zh: '第三章 · 极限工艺', en: 'Chapter 3 · Mastery' },
      { zh: '连桥、宫殿与三重考验', en: 'Bridges, palaces and the triple trial.' },
      ['twin-bridge', 'palace', 'storm', 'finale'],
    ),
  ],
};

export const loadBundledOfficialCampaign = async (): Promise<CampaignDefinition> => {
  try {
    const response = await fetch('./official-campaign.json', { cache: 'no-store' });
    if (response.ok) return validateCampaign(await response.json());
  } catch { /* project resource is optional until the first developer write */ }
  return DEFAULT_OFFICIAL_CAMPAIGN;
};
