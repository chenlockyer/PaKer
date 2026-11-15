/**
 * Card Siege battle engine self test.
 *
 *   npm run test:battle
 *
 * Exercises the pure turn machine: build order, round cycle, timers, core
 * detection, budgets, engineer limits, resign and the round-limit tie-break.
 */

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const directory = await mkdtemp(join(tmpdir(), 'paker-battle-test-'));

const bundle = async (entry, name) => {
  const outfile = join(directory, name);
  await build({ entryPoints: [entry], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  return import(`${pathToFileURL(outfile).href}?v=${Date.now()}-${name}`);
};

const UPRIGHT = [Math.SQRT1_2, 0, 0, Math.SQRT1_2];
const FLAT = [0, 0, 0, 1];

try {
  const engine = await bundle('battle/engine.ts', 'engine.mjs');
  const arenaModule = await bundle('battle/arena.ts', 'arena.mjs');
  const arena = arenaModule.getArena('standard');

  /* --- arena rules ------------------------------------------------- */
  assert.equal(arenaModule.isInsideZone(arena, 'A', [0, 1, 5]), true);
  assert.equal(arenaModule.isInsideZone(arena, 'A', [0, 1, -5]), false);
  assert.equal(arenaModule.isInsideZone(arena, 'B', [0, 1, -5]), true);
  assert.equal(arenaModule.isCoreLegal(arena, 'A', [0, 1.4, 7]), true);
  assert.equal(arenaModule.isCoreLegal(arena, 'A', [0, 1.4, 3]), false, 'core area is at the back');
  assert.equal(arenaModule.isCoreLegal(arena, 'B', [0, 1.4, -7]), true);

  /* --- build order and round cycle --------------------------------- */
  let state = engine.createBattleState({ rounds: 2, buildSeconds: 10 });
  assert.equal(state.phase, 'idle');
  state = engine.startBattle(state, 0);
  assert.equal(state.phase, 'build');
  assert.equal(state.activeSide, 'A');
  assert.equal(state.timeLeftMs, 10_000);
  state = engine.markCorePlaced(state, 'A', 'core-a', [0, 2.41, 7], UPRIGHT);

  state = engine.skipPhase(state, 'A', 1000);
  assert.equal(state.activeSide, 'B', 'side A hands the build phase to side B');
  state = engine.markCorePlaced(state, 'B', 'core-b', [0, 2.41, -7], UPRIGHT);
  state = engine.skipPhase(state, 'B', 2000);
  assert.equal(state.phase, 'settle', 'both builds end in the settle check');

  state = engine.advancePhase(state, 3000);
  assert.equal(state.phase, 'inspect');
  assert.equal(state.round, 1);
  assert.equal(state.activeSide, 'A');

  state = engine.advancePhase(state, 4000);
  assert.equal(state.phase, 'engineer');
  state = engine.advancePhase(state, 5000);
  assert.equal(state.phase, 'fire');

  const shot = {
    round: 1,
    side: 'A',
    ammoCardId: 'ammo-a-1',
    preset: 'short-edge',
    meterPower: 0.6,
    targetSpeed: 12,
    launchPosition: [0, 1.4, 6],
    contactPointWorld: [0, 1.4, 6],
    direction: [0, 0, -1],
    knockedCards: 3,
    coreDisplacementBefore: { A: 0, B: 0 },
    coreDisplacementAfter: { A: 0, B: 0.4 },
    at: 6000,
  };
  state = engine.recordShot(state, shot, 6000);
  assert.equal(state.phase, 'resolve', 'launching moves straight to resolve');
  assert.equal(state.shots.length, 1);
  assert.equal(state.sides.A.fireUsedThisTurn, true);

  state = engine.advancePhase(state, 7000);
  assert.equal(state.phase, 'inspect');
  assert.equal(state.activeSide, 'B', 'turn order alternates');
  assert.equal(state.round, 1);

  state = engine.advancePhase(state, 8000);
  state = engine.advancePhase(state, 9000);
  state = engine.advancePhase(state, 10_000);
  assert.equal(state.phase, 'resolve');
  assert.equal(state.shots.length, 1, 'skipping the fire phase records no shot');
  state = engine.advancePhase(state, 11_000);
  assert.equal(state.round, 2);
  assert.equal(state.activeSide, 'A');

  /* --- timers ------------------------------------------------------ */
  let timed = engine.createBattleState({ rounds: 4, inspectSeconds: 1, engineerSeconds: 1, fireSeconds: 1, resolveSeconds: 1 });
  timed = engine.startBattle(timed, 0);
  timed = engine.markCorePlaced(timed, 'A', 'core-a', [0, 2.41, 7], UPRIGHT);
  timed = engine.skipPhase(timed, 'A', 100);
  timed = engine.markCorePlaced(timed, 'B', 'core-b', [0, 2.41, -7], UPRIGHT);
  timed = engine.skipPhase(timed, 'B', 200);
  timed = engine.advancePhase(timed, 300);
  assert.equal(timed.phase, 'inspect');
  timed = engine.tick(timed, 1000, 400, { arena });
  assert.equal(timed.phase, 'engineer', 'inspect expires into engineer');
  timed = engine.tick(timed, 1000, 500, { arena });
  assert.equal(timed.phase, 'fire', 'engineer expires into fire');
  timed = engine.tick(timed, 1000, 600, { arena });
  assert.equal(timed.phase, 'resolve', 'fire expires into resolve');
  timed = engine.tick(timed, 1000, 700, { arena });
  assert.equal(timed.activeSide, 'B', 'resolve expires into the next turn');

  /* --- no core at the end of the build is an immediate loss -------- */
  let noCore = engine.createBattleState({ rounds: 4 });
  noCore = engine.startBattle(noCore, 0);
  noCore = engine.skipPhase(noCore, 'A', 100);
  noCore = engine.markCorePlaced(noCore, 'B', 'core-b', [0, 2.41, -7], UPRIGHT);
  noCore = engine.skipPhase(noCore, 'B', 200);
  noCore = engine.advancePhase(noCore, 300);
  assert.equal(noCore.phase, 'finished', 'finishing the build without a core loses');
  assert.equal(noCore.outcome.winner, 'B');
  assert.equal(noCore.outcome.detail, '蓝方没有放置核心');

  /* --- core placement ---------------------------------------------- */
  let cores = engine.createBattleState({ rounds: 4 });
  cores = engine.startBattle(cores, 0);
  cores = engine.markCorePlaced(cores, 'A', 'core-a', [0, 2.41, 7], UPRIGHT);
  assert.equal(cores.sides.A.core.placed, true);
  assert.ok(
    Math.abs(cores.sides.A.core.clearance - 1.01) < 0.02,
    'an upright core on a one card platform clears the floor by one card length',
  );

  /* --- core destruction: flat on the floor ------------------------- */
  let flat = engine.createBattleState({ rounds: 4 });
  flat = engine.startBattle(flat, 0);
  flat = engine.markCorePlaced(flat, 'A', 'core-a', [0, 2.41, 7], UPRIGHT);
  flat = engine.markCorePlaced(flat, 'B', 'core-b', [0, 2.41, -7], UPRIGHT);
  flat = engine.skipPhase(flat, 'A', 100);
  flat = engine.skipPhase(flat, 'B', 200);
  flat = engine.advancePhase(flat, 300);
  const samples = {
    A: { position: [0, 2.41, 7], quaternion: UPRIGHT },
    B: { position: [0, 2.41, -7], quaternion: UPRIGHT },
  };
  let after = engine.tick(flat, 500, 400, { arena, samples });
  assert.equal(after.phase, 'inspect');
  assert.equal(after.sides.A.core.broken, false, 'a standing core is safe');
  // Core A falls flat, core B stays up.
  after = engine.tick(after, 500, 900, {
    arena,
    samples: {
      A: { position: [0, 0.05, 7], quaternion: FLAT },
      B: { position: [0, 2.41, -7], quaternion: UPRIGHT },
    },
  });
  assert.equal(after.sides.A.core.broken, false, 'breaking needs the 0.75 s grace window');
  after = engine.tick(after, 500, 1400, {
    arena,
    samples: {
      A: { position: [0, 0.05, 7], quaternion: FLAT },
      B: { position: [0, 2.41, -7], quaternion: UPRIGHT },
    },
  });
  assert.equal(after.phase, 'finished');
  assert.equal(after.outcome.winner, 'B');
  assert.equal(after.outcome.reason, 'core-flat');

  /* --- core destruction: pushed out of its region ------------------ */
  let pushed = engine.createBattleState({ rounds: 4 });
  pushed = engine.startBattle(pushed, 0);
  pushed = engine.markCorePlaced(pushed, 'A', 'core-a', [0, 2.41, 7], UPRIGHT);
  pushed = engine.markCorePlaced(pushed, 'B', 'core-b', [0, 2.41, -7], UPRIGHT);
  pushed = engine.skipPhase(pushed, 'A', 100);
  pushed = engine.skipPhase(pushed, 'B', 200);
  pushed = engine.advancePhase(pushed, 300);
  pushed = engine.tick(pushed, 1000, 400, {
    arena,
    samples: {
      A: { position: [0, 2.41, 2.0], quaternion: UPRIGHT },
      B: { position: [0, 2.41, -7], quaternion: UPRIGHT },
    },
  });
  assert.equal(pushed.phase, 'finished');
  assert.equal(pushed.outcome.winner, 'B');
  assert.equal(pushed.outcome.reason, 'core-outside');

  /* --- budgets ----------------------------------------------------- */
  let budget = engine.createBattleState({ structureCards: 2, ammoCards: 1, rounds: 4 });
  budget = engine.startBattle(budget, 0);
  assert.equal(engine.canPlace(budget, 'A', 'structure', { structure: 0, ammo: 0 }).ok, true);
  assert.equal(engine.canPlace(budget, 'A', 'structure', { structure: 2, ammo: 0 }).reason, 'budget');
  assert.equal(engine.canPlace(budget, 'B', 'structure', { structure: 0, ammo: 0 }).reason, 'not-your-turn');
  assert.equal(engine.canPlace(budget, 'A', 'core', { structure: 0, ammo: 0 }).ok, true);
  budget = engine.markCorePlaced(budget, 'A', 'core-a', [0, 2.41, 7], UPRIGHT);
  assert.equal(engine.canPlace(budget, 'A', 'core', { structure: 0, ammo: 0 }).reason, 'core-already-placed');
  assert.equal(engine.needsCore(budget), false);

  /* --- engineer: one action per turn ------------------------------- */
  let engineer = engine.createBattleState({ rounds: 4 });
  engineer = engine.startBattle(engineer, 0);
  engineer = engine.markCorePlaced(engineer, 'A', 'core-a', [0, 2.41, 7], UPRIGHT);
  engineer = engine.skipPhase(engineer, 'A', 100);
  engineer = engine.markCorePlaced(engineer, 'B', 'core-b', [0, 2.41, -7], UPRIGHT);
  engineer = engine.skipPhase(engineer, 'B', 200);
  engineer = engine.advancePhase(engineer, 300);
  engineer = engine.advancePhase(engineer, 400);
  assert.equal(engineer.phase, 'engineer');
  assert.equal(engine.canPlace(engineer, 'A', 'structure', { structure: 0, ammo: 0 }).ok, true);
  engineer = engine.markEngineerActionUsed(engineer, 'A');
  assert.equal(
    engine.canPlace(engineer, 'A', 'structure', { structure: 0, ammo: 0 }).reason,
    'action-already-used',
  );
  const limited = { ...engineer, config: { ...engineer.config, reserveCards: 1 }, sides: { ...engineer.sides, A: { ...engineer.sides.A, engineerUsedThisTurn: false } } };
  assert.equal(engine.canPlace(limited, 'A', 'structure', { structure: 0, ammo: 0 }).reason, 'budget');

  /* --- resign and round limit -------------------------------------- */
  let resigned = engine.createBattleState({ rounds: 4 });
  resigned = engine.startBattle(resigned, 0);
  resigned = engine.resign(resigned, 'A', 500);
  assert.equal(resigned.phase, 'finished');
  assert.equal(resigned.outcome.winner, 'B');
  assert.equal(resigned.outcome.reason, 'resign');

  let limit = engine.createBattleState({ rounds: 1, inspectSeconds: 0.1, engineerSeconds: 0.1, fireSeconds: 0.1, resolveSeconds: 0.1 });
  limit = engine.startBattle(limit, 0);
  limit = engine.markCorePlaced(limit, 'A', 'core-a', [0, 2.41, 7], UPRIGHT);
  limit = engine.markCorePlaced(limit, 'B', 'core-b', [0, 2.41, -7], UPRIGHT);
  limit = engine.skipPhase(limit, 'A', 10);
  limit = engine.skipPhase(limit, 'B', 20);
  limit = engine.advancePhase(limit, 30);
  const steady = {
    A: { position: [0, 2.41, 7], quaternion: UPRIGHT },
    B: { position: [0, 2.41, -7], quaternion: UPRIGHT },
  };
  let guard = 0;
  while (limit.phase !== 'finished' && guard < 200) {
    limit = engine.tick(limit, 200, 100 + guard * 200, { arena, samples: steady });
    if (limit.phase === 'resolve') limit = engine.advancePhase(limit, 150 + guard * 200);
    guard += 1;
  }
  assert.equal(limit.phase, 'finished', 'round limit ends the match');
  assert.equal(limit.outcome.reason, 'round-limit');
  assert.equal(limit.outcome.winner, 'draw', 'identical untouched cores end in a draw');

  /* --- settle check ends resolve early ----------------------------- */
  let quiet = engine.createBattleState({ rounds: 4 });
  quiet = engine.startBattle(quiet, 0);
  quiet = engine.markCorePlaced(quiet, 'A', 'core-a', [0, 2.41, 7], UPRIGHT);
  quiet = engine.skipPhase(quiet, 'A', 10);
  quiet = engine.markCorePlaced(quiet, 'B', 'core-b', [0, 2.41, -7], UPRIGHT);
  quiet = engine.skipPhase(quiet, 'B', 20);
  quiet = engine.advancePhase(quiet, 30);
  quiet = engine.advancePhase(quiet, 40);
  quiet = engine.advancePhase(quiet, 50);
  assert.equal(quiet.phase, 'fire');
  quiet = engine.advancePhase(quiet, 60);
  assert.equal(quiet.phase, 'resolve');
  quiet = engine.tick(quiet, 100, 70, { arena, settled: true });
  assert.equal(quiet.activeSide, 'B', 'a quiet table ends the resolve early');

  console.log('Battle self-test passed: arena rules, build order, round cycle, timers, core detection, budgets, engineer limit, resign, round limit.');
} finally {
  await rm(directory, { recursive: true, force: true });
}
