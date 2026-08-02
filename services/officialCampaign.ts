import { CampaignDefinition } from '../types';
import { OFFICIAL_LEVELS } from './officialLevels';
import { makeCampaignLevelEntry, validateCampaign } from './campaignService';

const CREATED_AT = '2026-08-02T00:00:00.000Z';

export const DEFAULT_OFFICIAL_CAMPAIGN: CampaignDefinition = {
  schemaVersion: 1,
  id: 'official-campaign',
  name: { zh: '纸牌建筑师', en: 'PaKer Campaign' },
  description: { zh: '从两张牌开始，逐步掌握稳定、高层与抗冲击结构。', en: 'Learn stable, tall and impact-resistant card structures.' },
  status: 'published',
  publishRevision: 1,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
  chapters: [
    {
      id: 'chapter-foundations',
      name: { zh: '第一章 · 搭建基础', en: 'Chapter 1 · Foundations' },
      description: { zh: '学会支撑、屋顶和基本稳定结构', en: 'Learn supports, roofs and basic stability.' },
      enabled: true,
      levels: OFFICIAL_LEVELS.slice(0, 2).map((level, index) => ({ ...makeCampaignLevelEntry(level), id: `official-foundations-${index + 1}` })),
    },
    {
      id: 'chapter-trials',
      name: { zh: '第二章 · 结构考验', en: 'Chapter 2 · Structural Trials' },
      description: { zh: '抵御落物冲击，并挑战两层高楼', en: 'Survive impacts and build two stories.' },
      enabled: true,
      levels: OFFICIAL_LEVELS.slice(2).map((level, index) => ({ ...makeCampaignLevelEntry(level), id: `official-trials-${index + 1}` })),
    },
  ],
};

export const loadBundledOfficialCampaign = async (): Promise<CampaignDefinition> => {
  try {
    const response = await fetch('./official-campaign.json', { cache: 'no-store' });
    if (response.ok) return validateCampaign(await response.json());
  } catch { /* project resource is optional until the first developer write */ }
  return DEFAULT_OFFICIAL_CAMPAIGN;
};
