/**
 * Level factory self test.
 *
 *   npm run test:level-factory
 *
 * Verifies the generated official content through the real runtime services:
 * every level must be publishable as-is, every blueprint checksum must match,
 * the campaign must validate, and the exported .paker-level.json files must be
 * identical to what the game builds at runtime.
 */

import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const directory = await mkdtemp(join(tmpdir(), 'paker-level-factory-test-'));
const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key),
};

const bundle = async (entry, name) => {
  const outfile = join(directory, name);
  await build({ entryPoints: [entry], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  return import(`${pathToFileURL(outfile).href}?v=${Date.now()}-${name}`);
};

try {
  const levelsModule = await bundle('services/officialLevels.ts', 'official-levels.mjs');
  const campaignModule = await bundle('services/officialCampaign.ts', 'official-campaign.mjs');
  const service = await bundle('services/levelService.ts', 'level-service.mjs');
  const campaignService = await bundle('services/campaignService.ts', 'campaign-service.mjs');

  const levels = levelsModule.OFFICIAL_LEVELS;
  assert.equal(levels.length, 12, 'the campaign ships twelve official levels');
  assert.deepEqual(levels.map(level => level.id), [
    'a-frame', 'roof-house', 'tripod', 'gate',
    'weight-drop', 'two-story-wind', 'wind-corridor', 'three-story',
    'twin-bridge', 'palace', 'storm', 'finale',
  ], 'level order follows the catalogue');
  assert.equal(new Set(levels.map(level => level.id)).size, levels.length, 'level ids are unique');

  for (const level of levels) {
    const issues = service.getLevelPublishBlockingIssues(level);
    assert.deepEqual(issues, [], `${level.id} must be publishable: ${JSON.stringify(issues)}`);
    assert.equal(level.status, 'published', `${level.id} is published`);
    assert.equal(level.origin, 'official', `${level.id} is an official level`);
    assert.equal(level.blueprintChecksum, service.checksumBlueprint(level.embeddedBlueprint), `${level.id} checksum`);
    assert.equal(level.embeddedBlueprint.cardCount, level.embeddedBlueprint.snapshot.cards.length, `${level.id} card count`);
    assert.ok(level.maxCards >= level.embeddedBlueprint.cardCount, `${level.id} maxCards fits the reference build`);
    assert.ok(level.minCards <= level.maxCards, `${level.id} card limits are ordered`);
    assert.ok(level.testStages.length >= 1, `${level.id} has at least one test stage`);
    assert.ok(level.testDuration >= 1, `${level.id} test duration is playable`);
    assert.equal(level.verification.passed, true, `${level.id} is play-tested`);
    assert.equal(level.tutorial.enabled, true, `${level.id} ships its tutorial`);
    assert.ok(level.tutorial.cues.length >= 3, `${level.id} has a real cue sequence`);

    const target = Math.floor(1.8 * Math.cos(10 * Math.PI / 180) * level.heightMultiplier * 10) / 10;
    const height = level.embeddedBlueprint.snapshot.bounds.size[1];
    assert.ok(
      height >= target,
      `${level.id} reference build (${height.toFixed(2)}) reaches its target height (${target})`,
    );

    const steps = [...level.embeddedBlueprint.steps].sort((left, right) => left.order - right.order);
    const assigned = new Set(steps.flatMap(step => step.cardIds));
    assert.equal(assigned.size, level.embeddedBlueprint.snapshot.cards.length, `${level.id} steps cover every card`);
    assert.equal(
      steps.flatMap(step => step.cardIds).length,
      level.embeddedBlueprint.snapshot.cards.length,
      `${level.id} cards are not assigned twice`,
    );

    for (const card of level.embeddedBlueprint.snapshot.cards) {
      const magnitude = Math.hypot(...card.quaternion);
      assert.ok(Math.abs(magnitude - 1) < 1e-4, `${level.id}/${card.id} quaternion is unit length`);
      assert.ok(card.position.every(Number.isFinite), `${level.id}/${card.id} position is finite`);
      assert.ok(card.position[1] >= 0, `${level.id}/${card.id} sits above the floor`);
    }

    const exported = JSON.parse(await readFile(`public/levels/${level.id}.paker-level.json`, 'utf8'));
    const parsed = service.parseLevelFile(JSON.stringify(exported));
    assert.equal(parsed.id, level.id, `${level.id} export file id`);
    assert.equal(parsed.blueprintChecksum, level.blueprintChecksum, `${level.id} export file checksum`);
    assert.equal(
      JSON.stringify(parsed.embeddedBlueprint),
      JSON.stringify(level.embeddedBlueprint),
      `${level.id} export file blueprint matches the runtime`,
    );
  }

  const campaign = campaignModule.DEFAULT_OFFICIAL_CAMPAIGN;
  assert.deepEqual(campaignService.getCampaignValidationIssues(campaign), [], 'campaign validates');
  assert.equal(campaign.chapters.length, 3, 'campaign ships three chapters');
  assert.equal(campaign.chapters.length, campaignModule.DEFAULT_OFFICIAL_CAMPAIGN.chapters.length);
  const entries = campaign.chapters.flatMap(chapter => chapter.levels);
  assert.equal(entries.length, levels.length, 'every official level is in the campaign');
  assert.equal(new Set(entries.map(entry => entry.id)).size, entries.length, 'campaign entry ids are unique');

  const unlocked = campaignService.isCampaignEntryUnlocked(
    campaign,
    campaignService.loadCampaignProgress(campaign.id),
    entries[0].id,
  );
  assert.equal(unlocked, true, 'the first campaign entry is unlocked');

  const exportedCampaign = JSON.parse(await readFile('public/official-campaign.json', 'utf8'));
  assert.equal(campaignService.validateCampaign(exportedCampaign).id, campaign.id, 'exported campaign loads');
  assert.deepEqual(
    exportedCampaign.chapters.map(chapter => chapter.levels.length),
    [4, 4, 4],
    'exported campaign ships three chapters of four levels',
  );

  console.log(`Level factory self-test passed (${levels.length} levels, ${entries.length} campaign entries).`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
