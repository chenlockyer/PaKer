import {
  CampaignDefinition,
  CampaignLevelEntry,
  CampaignProgress,
  CampaignSession,
  LevelDefinition,
} from '../types';
import { getLevelPublishBlockingIssues, validateLevel } from './levelService';

const DRAFT_KEY = 'paker_campaign_draft_v1';
const ACTIVE_KEY = 'paker_active_campaign_v1';
const PROGRESS_KEY = 'paker_campaign_progress_v1';
const SESSION_KEY = 'paker_campaign_session_v1';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const makeId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export interface CampaignValidationIssue {
  code: 'missing-name' | 'empty-chapter' | 'duplicate-level' | 'invalid-level-snapshot' | 'unverified-level' | 'no-playable-levels';
  chapterId?: string;
  levelEntryId?: string;
}

export const makeCampaignLevelEntry = (level: LevelDefinition): CampaignLevelEntry => ({
  id: makeId('entry'),
  enabled: true,
  sourceLevelId: level.id,
  sourcePublishRevision: level.publishRevision,
  level: clone(level),
});

export const createCampaign = (name = '新的挑战流程'): CampaignDefinition => {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: makeId('campaign'),
    name: { zh: name, en: name },
    description: { zh: '', en: '' },
    status: 'draft',
    publishRevision: 0,
    createdAt: now,
    updatedAt: now,
    chapters: [{
      id: makeId('chapter'),
      name: { zh: '第一章', en: 'Chapter 1' },
      description: { zh: '', en: '' },
      enabled: true,
      levels: [],
    }],
  };
};

export const validateCampaign = (value: unknown): CampaignDefinition => {
  if (!value || typeof value !== 'object') throw new Error('Invalid campaign');
  const source = value as CampaignDefinition;
  if (source.schemaVersion !== 1 || !source.id || !source.name?.zh || !Array.isArray(source.chapters)) {
    throw new Error('Invalid campaign schema');
  }
  const campaign = clone(source);
  campaign.chapters.forEach(chapter => {
    if (!chapter.id || !chapter.name?.zh || !Array.isArray(chapter.levels)) throw new Error('Invalid campaign chapter');
    chapter.levels = chapter.levels.map(entry => ({ ...entry, level: validateLevel(entry.level) }));
  });
  return campaign;
};

export const getCampaignValidationIssues = (campaign: CampaignDefinition): CampaignValidationIssue[] => {
  const issues: CampaignValidationIssue[] = [];
  if (!campaign.name.zh.trim()) issues.push({ code: 'missing-name' });
  const sourceIds = new Set<string>();
  let playable = 0;
  campaign.chapters.filter(chapter => chapter.enabled).forEach(chapter => {
    const enabledEntries = chapter.levels.filter(entry => entry.enabled);
    if (enabledEntries.length === 0) issues.push({ code: 'empty-chapter', chapterId: chapter.id });
    enabledEntries.forEach(entry => {
      playable += 1;
      if (sourceIds.has(entry.sourceLevelId)) issues.push({ code: 'duplicate-level', chapterId: chapter.id, levelEntryId: entry.id });
      sourceIds.add(entry.sourceLevelId);
      try { validateLevel(entry.level); } catch { issues.push({ code: 'invalid-level-snapshot', chapterId: chapter.id, levelEntryId: entry.id }); }
      if (entry.sourceLevelId !== entry.level.id || entry.sourcePublishRevision !== entry.level.publishRevision) {
        issues.push({ code: 'invalid-level-snapshot', chapterId: chapter.id, levelEntryId: entry.id });
      }
      if (entry.level.status !== 'published' || getLevelPublishBlockingIssues(entry.level).length > 0) {
        issues.push({ code: 'unverified-level', chapterId: chapter.id, levelEntryId: entry.id });
      }
    });
  });
  if (playable === 0) issues.push({ code: 'no-playable-levels' });
  return issues;
};

export const publishCampaign = (campaign: CampaignDefinition): CampaignDefinition => {
  const issues = getCampaignValidationIssues(campaign);
  if (issues.length) throw new Error(issues.map(issue => issue.code).join(','));
  return {
    ...clone(campaign),
    status: 'published',
    publishRevision: campaign.publishRevision + 1,
    updatedAt: new Date().toISOString(),
  };
};

export const flattenCampaign = (campaign: CampaignDefinition) => campaign.chapters
  .filter(chapter => chapter.enabled)
  .flatMap(chapter => chapter.levels.filter(entry => entry.enabled).map(entry => ({ chapter, entry })));

export const levelProgressKey = (level: LevelDefinition) => `${level.id}@${level.publishRevision}`;

export const loadCampaignDraft = () => {
  try { return validateCampaign(JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null')); } catch { return null; }
};
export const saveCampaignDraft = (campaign: CampaignDefinition) => localStorage.setItem(DRAFT_KEY, JSON.stringify(campaign));
export const loadActiveCampaign = () => {
  try { return validateCampaign(JSON.parse(localStorage.getItem(ACTIVE_KEY) ?? 'null')); } catch { return null; }
};
export const saveActiveCampaign = (campaign: CampaignDefinition) => localStorage.setItem(ACTIVE_KEY, JSON.stringify(campaign));
export const clearActiveCampaign = () => localStorage.removeItem(ACTIVE_KEY);

export const loadCampaignProgress = (campaignId: string): CampaignProgress => {
  try {
    const value = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? 'null') as CampaignProgress;
    if (value?.schemaVersion === 1 && value.campaignId === campaignId && value.results) return value;
  } catch { /* use empty progress */ }
  return { schemaVersion: 1, campaignId, results: {} };
};

export const saveCampaignResult = (campaignId: string, level: LevelDefinition, score: number, stars: number) => {
  const progress = loadCampaignProgress(campaignId);
  const key = levelProgressKey(level);
  const previous = progress.results[key];
  progress.results[key] = {
    completedAt: new Date().toISOString(),
    bestScore: Math.max(previous?.bestScore ?? 0, Math.round(score)),
    bestStars: Math.max(previous?.bestStars ?? 0, Math.max(1, Math.min(3, Math.round(stars)))),
  };
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  return progress;
};

export const isCampaignEntryUnlocked = (campaign: CampaignDefinition, progress: CampaignProgress, entryId: string) => {
  const entries = flattenCampaign(campaign);
  const index = entries.findIndex(item => item.entry.id === entryId);
  if (index <= 0) return index === 0;
  return Boolean(progress.results[levelProgressKey(entries[index - 1].entry.level)]);
};

export const loadCampaignSession = (): CampaignSession | null => {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as CampaignSession;
    return value?.schemaVersion === 1 ? value : null;
  } catch { return null; }
};
export const saveCampaignSession = (session: CampaignSession) => localStorage.setItem(SESSION_KEY, JSON.stringify(session));
export const clearCampaignSession = () => localStorage.removeItem(SESSION_KEY);
export const isCampaignSessionValid = (session: CampaignSession, campaign: CampaignDefinition) => {
  if (session.campaignId !== campaign.id || session.campaignPublishRevision !== campaign.publishRevision) return false;
  const match = flattenCampaign(campaign).find(item => item.entry.id === session.levelEntryId);
  return Boolean(match && match.entry.level.id === session.levelId && match.entry.level.publishRevision === session.levelPublishRevision);
};

export const downloadCampaign = (campaign: CampaignDefinition) => {
  const blob = new Blob([JSON.stringify(campaign, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${campaign.name.zh.replace(/[^\w\u4e00-\u9fa5-]+/g, '-') || 'campaign'}.paker-campaign.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const parseCampaignFile = (content: string) => validateCampaign(JSON.parse(content));
