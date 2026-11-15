/**
 * Card Siege battle engine self test.
 *
 *   npm run test:battle
 *
 * Exercises the pure turn machine: arena cells, build order, the round cycle,
 * timers, the collapse rule (the v1 win condition), the minimum standing house,
 * budgets, the engineer limit, resign, blueprint fitting and the round-limit
 * tie-break.
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

/** A card standing on its short edge (portal 90° about X). */
const UPRIGHT_EULER = [Math.PI / 2, 0, 0];
/** A card lying face up. */
const FLAT_EULER = [0, 0, 0];
const UPRIGHT_QUAT = [Math.SQRT1_2, 0, 0, Math.SQRT1_2];
const FLAT_QUAT = [0, 0, 0, 1];

const makeCard = (id, owner, position, rotation) => ({
  id,
  owner,
  role: 'structure',
  position,
  rotation,
  suit: 'spades',
  rank: 'A',
  color: 'black',
  locked: false,
});

const STANDING = (id, owner, position) => makeCard(id, owner, position, UPRIGHT_EULER);

const basePosition = (side, index) => [index * 1.2 - 2, 1.4, side === 'A' ? 10 : -10];

/** Sample for card index on a side; `flat` cards lie on the floor. */
const cardAt = (side, index, { flat = false } = {}) => ({
  position: [index * 1.2 - 2, flat ? 0.05 : 1.4, side === 'A' ? 10 : -10],
  quaternion: flat ? FLAT_QUAT : UPRIGHT_QUAT,
});

const seedSide = (engine, state, side, count) => {
  let next = state;
  for (let index = 0; index < count; index += 1) {
    next = engine.registerCard(next, STANDING(`${side.toLowerCase()}${index}`, side, basePosition(side, index)));
  }
  return next;
};

/** Samples for both sides; only `flatSide` gets its listed cards flattened. */
const samplesFor = (count, flatSide = null, flatIndices = []) => {
  const samples = {};
  for (let index = 0; index < count; index += 1) {
    samples[`a${index}`] = cardAt('A', index, {
      flat: flatSide === 'A' && flatIndices.includes(index),
    });
    samples[`b${index}`] = cardAt('B', index, {
      flat: flatSide === 'B' && flatIndices.includes(index),
    });
  }
  return samples;
};

/** A state where both sides finished building with `count` standing cards. */
const readyState = (engine, { rounds = 4, count = 4 } = {}) => {
  let state = engine.createBattleState({ rounds });
  state = engine.startBattle(state, 0);
  state = seedSide(engine, state, 'A', count);
  state = engine.skipPhase(state, 'A', 100);
  state = seedSide(engine, state, 'B', count);
  state = engine.skipPhase(state, 'B', 200);
  return state;
};

try {
  const engine = await bundle('battle/engine.ts', 'engine.mjs');
  const arenaModule = await bundle('battle/arena.ts', 'arena.mjs');
  const arena = arenaModule.getArena('standard');

  /* --- arena: 15 × 15 cells per side, 15 cells of neutral ground ------- */
  assert.ok(Math.abs(arena.cell - 0.9) < 1e-9, 'a cell is one ground grid square');
  const zoneA = arena.zones.A;
  const zoneB = arena.zones.B;
  assert.ok(Math.abs((zoneA.maxX - zoneA.minX) - 13.5) < 1e-9, 'build zone is 15 cells wide');
  assert.ok(Math.abs((zoneA.maxZ - zoneA.minZ) - 13.5) < 1e-9, 'build zone is 15 cells deep');
  assert.ok(Math.abs((arena.buffer.maxZ - arena.buffer.minZ) - 13.5) < 1e-9, 'neutral band is 15 cells deep');
  assert.ok(Math.abs(zoneA.minZ - arena.buffer.maxZ) < 1e-9, 'zones touch the neutral band');
  assert.ok(Math.abs(arena.buffer.minZ - zoneB.maxZ) < 1e-9);
  assert.equal(arenaModule.isInsideZone(arena, 'A', [0, 1, 10]), true);
  assert.equal(arenaModule.isInsideZone(arena, 'A', [0, 1, 0]), false, 'the middle band is neutral');
  assert.equal(arenaModule.isInsideZone(arena, 'B', [0, 1, -10]), true);
  assert.equal(arenaModule.isInsideZone(arena, 'B', [0, 1, 10]), false, 'you cannot build in the enemy zone');
  assert.equal(arenaModule.isInsideZone(arena, 'A', [7.5, 1, 10]), false, 'outside the square');

  /* --- build order and round cycle --------------------------------- */
  let state = engine.createBattleState({ rounds: 2, buildSeconds: 10 });
  assert.equal(state.phase, 'idle');
  state = engine.startBattle(state, 0);
  assert.equal(state.phase, 'build');
  assert.equal(state.activeSide, 'A');
  assert.equal(state.timeLeftMs, 10_000);
  state = engine.registerCard(state, STANDING('probe-upright', 'A', [0, 1.4, 10]));
  assert.equal(state.cards.length, 1);
  assert.equal(state.cards[0].standing, true, 'an upright card counts as standing');
  assert.equal(state.sides.A.collapse.standing, 0, 'collapse is scored by the tick, not at placement');
  state = engine.registerCard(state, makeCard('probe-flat', 'A', [2, 0.01, 10], FLAT_EULER));
  assert.equal(state.cards[1].standing, false, 'a flat deck is not a standing card');

  state = seedSide(engine, state, 'A', 4);
  state = engine.skipPhase(state, 'A', 1000);
  assert.equal(state.activeSide, 'B', 'side A hands the build phase to side B');
  state = seedSide(engine, state, 'B', 4);
  state = engine.skipPhase(state, 'B', 2000);
  assert.equal(state.phase, 'settle', 'both builds end in the settle check');
  assert.equal(engine.canFinishBuild(state), false, 'the build phase is over');

  state = engine.tick(state, 500, 2500, { arena, samples: samplesFor(4) });
  assert.equal(state.phase, 'settle');
  assert.equal(state.sides.A.collapse.standing, 5, 'records include the one deck-free card and four standing ones');
  assert.equal(state.sides.A.collapse.fallen, 0);

  state = engine.tick(state, 4000, 6500, { arena, samples: samplesFor(4) });
  assert.equal(state.phase, 'inspect', 'settle expires into the first turn');
  assert.equal(state.round, 1);
  assert.equal(state.activeSide, 'A');

  state = engine.advancePhase(state, 7000);
  assert.equal(state.phase, 'engineer');
  state = engine.advancePhase(state, 8000);
  assert.equal(state.phase, 'fire');

  const shot = {
    round: 1,
    side: 'A',
    ammoCardId: 'ammo-a-1',
    preset: 'short-edge',
    meterPower: 0.6,
    targetSpeed: 12,
    launchPosition: [0, 1.4, 10],
    contactPointWorld: [0, 1.4, 10],
    direction: [0, 0, -1],
    knockedCards: 1,
    collapseBefore: { A: 0, B: 0 },
    collapseAfter: { A: 0, B: 0 },
    at: 9000,
  };
  state = engine.recordShot(state, shot, 9000);
  assert.equal(state.phase, 'resolve', 'launching moves straight to resolve');
  assert.equal(state.shots.length, 1);
  state = engine.advancePhase(state, 10_000);
  assert.equal(state.phase, 'inspect');
  assert.equal(state.activeSide, 'B', 'turn order alternates');

  /* --- collapse rule ------------------------------------------------ */
  let collapse = readyState(engine, { count: 4 });
  collapse = engine.tick(collapse, 500, 300, { arena, samples: samplesFor(4) });
  assert.equal(collapse.sides.A.collapse.standing, 4);
  assert.equal(collapse.sides.A.collapse.fallen, 0);
  assert.equal(collapse.sides.A.collapse.rate, 0);

  // One card falls over: 25%, still standing strong.
  collapse = engine.tick(collapse, 500, 800, { arena, samples: samplesFor(4, 'A', [0]) });
  assert.equal(collapse.sides.A.collapse.fallen, 1);
  assert.ok(Math.abs(collapse.sides.A.collapse.rate - 0.25) < 1e-9);
  assert.equal(collapse.sides.A.collapse.broken, false);

  // Half the standing cards down: the house collapsed.
  collapse = engine.tick(collapse, 500, 1300, { arena, samples: samplesFor(4, 'A', [0, 1]) });
  assert.equal(collapse.phase, 'finished', '50% collapsed ends the match');
  assert.equal(collapse.outcome.winner, 'B');
  assert.equal(collapse.outcome.reason, 'collapse');

  /* --- collapse is frozen during the build phase ------------------- */
  let building = readyState(engine, { count: 2 });
  building = { ...building, phase: 'build', activeSide: 'A' };
  building = engine.tick(building, 500, 300, {
    arena,
    samples: { a0: cardAt('A', 0, { flat: true }), a1: cardAt('A', 1, { flat: true }) },
  });
  assert.equal(building.phase, 'build', 'a half collapsed house does not lose while still building');
  assert.equal(building.sides.A.collapse.rate, 1, 'but the rate is reported to the HUD');

  /* --- a pile that never stood up loses at the settle check -------- */
  let pile = engine.createBattleState({ rounds: 4 });
  pile = engine.startBattle(pile, 0);
  pile = engine.registerCard(pile, makeCard('a0', 'A', [0, 0.01, 10], FLAT_EULER));
  pile = engine.skipPhase(pile, 'A', 100);
  pile = seedSide(engine, pile, 'B', 4);
  pile = engine.skipPhase(pile, 'B', 200);
  pile = engine.advancePhase(pile, 300);
  assert.equal(pile.phase, 'finished');
  assert.equal(pile.outcome.winner, 'B');
  assert.equal(pile.outcome.reason, 'collapse');
  assert.match(pile.outcome.detail, /蓝方只立起 0 张站牌/);

  /* --- the build cannot be finished without a standing house ------- */
  let thin = engine.createBattleState({ rounds: 4 });
  thin = engine.startBattle(thin, 0);
  thin = seedSide(engine, thin, 'A', 2);
  assert.equal(engine.canFinishBuild(thin), false, 'two standing cards are not a house');
  thin = seedSide(engine, thin, 'A', 4);
  assert.equal(engine.canFinishBuild(thin), true, 'four standing cards can be finished');

  /* --- deletions drop the record ----------------------------------- */
  let removed = readyState(engine, { count: 4 });
  removed = engine.reconcileCards(removed, new Set(['a0', 'a1', 'a2', 'b0', 'b1', 'b2', 'b3']));
  assert.equal(removed.cards.filter(card => card.side === 'A').length, 3, 'a deleted card is no longer tracked');

  /* --- budgets ----------------------------------------------------- */
  let budget = engine.createBattleState({ structureCards: 2, ammoCards: 1, rounds: 4 });
  budget = engine.startBattle(budget, 0);
  assert.equal(engine.canPlace(budget, 'A', 'structure', { structure: 0, ammo: 0 }).ok, true);
  assert.equal(engine.canPlace(budget, 'A', 'structure', { structure: 2, ammo: 0 }).reason, 'budget');
  assert.equal(engine.canPlace(budget, 'B', 'structure', { structure: 0, ammo: 0 }).reason, 'not-your-turn');

  /* --- blueprints have to fit -------------------------------------- */
  assert.equal(engine.blueprintFits(arena, 'A', [[0, 1, 10], [2, 1, 12]]), true, 'a blueprint inside the square fits');
  assert.equal(engine.blueprintFits(arena, 'A', [[0, 1, 10], [0, 1, 0]]), false, 'a blueprint reaching into the neutral band does not fit');

  /* --- engineer: one action per turn ------------------------------- */
  let engineer = readyState(engine, { count: 4 });
  engineer = engine.advancePhase(engineer, 300);
  engineer = engine.advancePhase(engineer, 400);
  assert.equal(engineer.phase, 'engineer');
  assert.equal(engine.canPlace(engineer, 'A', 'structure', { structure: 0, ammo: 0 }).ok, true);
  engineer = engine.markEngineerActionUsed(engineer, 'A');
  assert.equal(engine.canPlace(engineer, 'A', 'structure', { structure: 0, ammo: 0 }).reason, 'action-already-used');

  /* --- resign and round limit -------------------------------------- */
  let resigned = engine.createBattleState({ rounds: 4 });
  resigned = engine.startBattle(resigned, 0);
  resigned = engine.resign(resigned, 'A', 500);
  assert.equal(resigned.phase, 'finished');
  assert.equal(resigned.outcome.winner, 'B');
  assert.equal(resigned.outcome.reason, 'resign');

  const runToLimit = (engine_, seed, flatA = []) => {
    let limit = engine_.createBattleState({ rounds: 1, inspectSeconds: 0.1, engineerSeconds: 0.1, fireSeconds: 0.1, resolveSeconds: 0.1 });
    limit = engine_.startBattle(limit, 0);
    limit = seedSide(engine_, limit, 'A', seed);
    limit = engine_.skipPhase(limit, 'A', 10);
    limit = seedSide(engine_, limit, 'B', seed);
    limit = engine_.skipPhase(limit, 'B', 20);
    limit = engine_.advancePhase(limit, 30);
    let guard = 0;
    while (limit.phase !== 'finished' && guard < 200) {
      limit = engine_.tick(limit, 200, 100 + guard * 200, { arena, samples: samplesFor(seed, 'A', flatA) });
      if (limit.phase === 'resolve') limit = engine_.advancePhase(limit, 150 + guard * 200);
      guard += 1;
    }
    return limit;
  };

  const draw = runToLimit(engine, 4);
  assert.equal(draw.phase, 'finished', 'round limit ends the match');
  assert.equal(draw.outcome.reason, 'round-limit');
  assert.equal(draw.outcome.winner, 'draw', 'two untouched houses end in a draw');

  const tiebreak = runToLimit(engine, 4, [0]);
  assert.equal(tiebreak.outcome.winner, 'B', 'the steadier house wins the tie-break');
  assert.equal(tiebreak.outcome.reason, 'round-limit');

  /* --- settle check ends resolve early ----------------------------- */
  let quiet = readyState(engine, { count: 4 });
  quiet = engine.advancePhase(quiet, 30);
  quiet = engine.advancePhase(quiet, 40);
  quiet = engine.advancePhase(quiet, 50);
  assert.equal(quiet.phase, 'fire');
  quiet = engine.advancePhase(quiet, 60);
  assert.equal(quiet.phase, 'resolve');
  quiet = engine.tick(quiet, 100, 70, { arena, settled: true });
  assert.equal(quiet.activeSide, 'B', 'a quiet table ends the resolve early');

  console.log('Battle self-test passed: arena cells, build order, round cycle, timers, collapse rule, standing minimum, deletions, budgets, blueprint fit, engineer limit, resign, round limit.');
} finally {
  await rm(directory, { recursive: true, force: true });
}
