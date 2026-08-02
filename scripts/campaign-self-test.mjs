import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const directory = await mkdtemp(join(tmpdir(), 'paker-campaign-test-'));
const bundle = join(directory, 'campaign-service.mjs');
const values = new Map();
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };

try {
  await build({ entryPoints: ['services/campaignService.ts'], outfile: bundle, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  const service = await import(`${pathToFileURL(bundle).href}?v=${Date.now()}`);
  const makeLevel = (id, revision = 1) => {
    const blueprint = { schemaVersion: 2, id: `${id}-bp`, name: id, description: '', author: '', category: 'tutorial', tags: [], createdAt: '', updatedAt: '', cardSize: 'BRIDGE', cardDimensions: { width: 1.8, height: 2.5, thickness: .02 }, cardCount: 1, coordinateSpace: 'structure-local', status: 'published', tolerances: { horizontal: .1, height: .1, rotationDegrees: 5, nearHorizontal: .2, nearHeight: .2, nearRotationDegrees: 10 }, steps: [{ id: 'step', order: 0, title: '', description: '', cardIds: ['card'], freezeDuringBuild: false, releasePhysicsAfterStep: false }], snapshot: { capturedAt: '', source: 'live-physics', originWorld: [0,0,0], bounds: { min: [0,0,0], max: [0,0,0], size: [0,0,0] }, cards: [{ id: 'card', order: 0, position: [0,0,0], quaternion: [0,0,0,1], suit: 'spades', rank: 'A', color: 'black' }] } };
    let hash = 2166136261; const content = JSON.stringify(blueprint); for (let index = 0; index < content.length; index += 1) { hash ^= content.charCodeAt(index); hash = Math.imul(hash, 16777619); } const checksum = `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
    return { schemaVersion: 2, publishRevision: revision, id, name: { zh: id, en: id }, description: { zh: '', en: '' }, origin: 'player', requiresBlueprintMatch: true, author: '', tags: [], createdAt: '', updatedAt: '', status: 'published', sourceBlueprintId: blueprint.id, embeddedBlueprint: blueprint, blueprintChecksum: checksum, maxCards: 2, minCards: 1, heightMultiplier: 1, testDuration: 3, testType: 'STABILITY', testStages: [{ id: 's', name: '', testType: 'STABILITY', duration: 3 }], tutorial: { enabled: false, displayMode: 'first-time', skippable: true, entryDurationMs: 0, entryTitle: { zh: '', en: '' }, entrySubtitle: { zh: '', en: '' }, cues: [] }, scoring: { baseScore: 1, unusedCardBonus: 1, heightBonus: 1 }, verification: { passed: true, playtestedAt: '', blueprintChecksum: checksum } };
  };
  const one = makeLevel('one'); const two = makeLevel('two');
  const campaign = service.createCampaign('Fixture');
  campaign.chapters[0].levels = [service.makeCampaignLevelEntry(one), service.makeCampaignLevelEntry(two)];
  assert.deepEqual(service.getCampaignValidationIssues(campaign), []);
  const published = service.publishCampaign(campaign);
  assert.equal(published.publishRevision, 1);
  const progress = service.loadCampaignProgress(published.id);
  assert.equal(service.isCampaignEntryUnlocked(published, progress, published.chapters[0].levels[0].id), true);
  assert.equal(service.isCampaignEntryUnlocked(published, progress, published.chapters[0].levels[1].id), false);
  service.saveCampaignResult(published.id, one, 100, 2);
  assert.equal(service.isCampaignEntryUnlocked(published, service.loadCampaignProgress(published.id), published.chapters[0].levels[1].id), true);
  const duplicate = structuredClone(published); duplicate.chapters[0].levels.push(service.makeCampaignLevelEntry(one));
  assert.ok(service.getCampaignValidationIssues(duplicate).some(issue => issue.code === 'duplicate-level'));
  console.log('campaign self-test passed');
} finally { await rm(directory, { recursive: true, force: true }); }
