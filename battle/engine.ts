/**
 * Card Siege turn engine.
 *
 * Pure state machine: give it a config, tick it with a delta and the current
 * core transforms, and it returns the next state. No timers, no React, no
 * three.js — the browser controller calls `tick` from an interval and the node
 * self-test calls it in a loop.
 *
 * Phase order for one round:
 *   inspect (3s) → engineer (15s) → fire (20s) → resolve (≤6s) → next player
 * Before the rounds there is one build phase per side and a settle check.
 */

import {
  CORE_DANGER_CLEARANCE,
  CORE_FLAT_GRACE_MS,
  CORE_OUTSIDE_GRACE_MS,
  DEFAULT_BATTLE_CONFIG,
  type BattleArena,
  type BattleConfig,
  type BattleCoreSamples,
  type BattleCoreStatus,
  type BattleOutcome,
  type BattlePhase,
  type BattleShotRecord,
  type BattleSide,
  type BattleSideState,
  type BattleState,
  otherSide,
} from './types';
import { isCoreLegal } from './arena';
import { distance3, lowestCardCorner } from './geometry';
import { CardSize } from '../types';

const LOG_LIMIT = 40;

const emptyCore = (): BattleCoreStatus => ({
  cardId: null,
  placed: false,
  initialPosition: null,
  position: null,
  clearance: 0,
  height: 0,
  displacement: 0,
  flatForMs: 0,
  outsideForMs: 0,
  danger: false,
  broken: false,
  brokenReason: null,
});

const emptySide = (side: BattleSide): BattleSideState => ({
  side,
  core: emptyCore(),
  reserveUsed: 0,
  ammoLaunched: 0,
  engineerUsedThisTurn: false,
  fireUsedThisTurn: false,
});

export const createBattleState = (
  config: Partial<BattleConfig> = {},
  nowMs = 0,
): BattleState => ({
  schemaVersion: 1,
  config: { ...DEFAULT_BATTLE_CONFIG, ...config, schemaVersion: 1 },
  phase: 'idle',
  activeSide: 'A',
  round: 1,
  timeLeftMs: 0,
  startedAtMs: nowMs,
  endedAtMs: null,
  sides: { A: emptySide('A'), B: emptySide('B') },
  shots: [],
  lastShot: null,
  outcome: null,
  log: [],
});

export const phaseDurationMs = (state: BattleState, phase: BattlePhase = state.phase): number => {
  switch (phase) {
    case 'build': return state.config.buildSeconds * 1000;
    case 'settle': return 4000;
    case 'inspect': return state.config.inspectSeconds * 1000;
    case 'engineer': return state.config.engineerSeconds * 1000;
    case 'fire': return state.config.fireSeconds * 1000;
    case 'resolve': return state.config.resolveSeconds * 1000;
    default: return 0;
  }
};

const PHASE_LABEL: Record<BattlePhase, string> = {
  idle: '待开始',
  build: '建造',
  settle: '稳定检查',
  inspect: '检查战场',
  engineer: '工程行动',
  fire: '发射',
  resolve: '结算',
  finished: '结束',
};

export const phaseLabel = (phase: BattlePhase) => PHASE_LABEL[phase];

const log = (state: BattleState, nowMs: number, message: string): BattleState => ({
  ...state,
  log: [
    ...state.log.slice(-(LOG_LIMIT - 1)),
    { at: nowMs, phase: state.phase, side: state.activeSide, message },
  ],
});

const withPhase = (state: BattleState, phase: BattlePhase, nowMs: number): BattleState => log(
  { ...state, phase, timeLeftMs: phaseDurationMs(state, phase) },
  nowMs,
  PHASE_LABEL[phase],
);

/** Begin the match: side A builds first. */
export const startBattle = (state: BattleState, nowMs = 0): BattleState => {
  if (state.phase !== 'idle') return state;
  return withPhase({
    ...state,
    activeSide: 'A',
    round: 1,
    startedAtMs: nowMs,
  }, 'build', nowMs);
};

/** Turn order alternates: A, B, A, B … one turn each per round. */
const sideForTurn = (turnIndex: number): BattleSide => (turnIndex % 2 === 0 ? 'A' : 'B');
const roundForTurn = (turnIndex: number): number => Math.floor(turnIndex / 2) + 1;

/** 0-based turn index of the current state. */
export const turnIndexOf = (state: BattleState): number =>
  (state.round - 1) * 2 + (state.activeSide === 'A' ? 0 : 1);

export const totalTurns = (state: BattleState) => state.config.rounds * 2;

const startTurn = (state: BattleState, activeSide: BattleSide, round: number, nowMs: number): BattleState => ({
  ...state,
  activeSide,
  round,
  sides: {
    A: { ...state.sides.A, engineerUsedThisTurn: false, fireUsedThisTurn: false },
    B: { ...state.sides.B, engineerUsedThisTurn: false, fireUsedThisTurn: false },
  },
  phase: 'inspect',
  timeLeftMs: phaseDurationMs(state, 'inspect'),
});

const evaluateOutcome = (state: BattleState): BattleOutcome | null => {
  const { A, B } = state.sides;
  if (A.core.broken && B.core.broken) {
    return { winner: 'draw', reason: 'core-flat', detail: '双方核心同时失效' };
  }
  if (A.core.broken) {
    return {
      winner: 'B',
      reason: A.core.brokenReason === 'outside' ? 'core-outside' : 'core-flat',
      detail: 'A 的核心失效',
    };
  }
  if (B.core.broken) {
    return {
      winner: 'A',
      reason: B.core.brokenReason === 'outside' ? 'core-outside' : 'core-flat',
      detail: 'B 的核心失效',
    };
  }
  return null;
};

const finish = (state: BattleState, outcome: BattleOutcome, nowMs: number): BattleState => log(
  { ...state, phase: 'finished', timeLeftMs: 0, endedAtMs: nowMs, outcome },
  nowMs,
  `对局结束：${outcome.winner === 'draw' ? '平局' : `${outcome.winner} 获胜`}（${outcome.detail}）`,
);

/** Round limit tie-break: higher core wins, then the less displaced core. */
export const resolveRoundLimit = (state: BattleState, nowMs: number): BattleState => {
  const { A, B } = state.sides;
  if (!A.core.placed && !B.core.placed) {
    return finish(state, { winner: 'draw', reason: 'round-limit', detail: '双方都没有放置核心' }, nowMs);
  }
  if (!A.core.placed) return finish(state, { winner: 'B', reason: 'round-limit', detail: 'A 没有核心' }, nowMs);
  if (!B.core.placed) return finish(state, { winner: 'A', reason: 'round-limit', detail: 'B 没有核心' }, nowMs);
  const heightDelta = A.core.height - B.core.height;
  if (Math.abs(heightDelta) > 0.25) {
    return finish(state, {
      winner: heightDelta > 0 ? 'A' : 'B',
      reason: 'round-limit',
      detail: `核心高度 ${A.core.height.toFixed(2)} : ${B.core.height.toFixed(2)}`,
    }, nowMs);
  }
  const displacementDelta = A.core.displacement - B.core.displacement;
  if (Math.abs(displacementDelta) > 0.1) {
    return finish(state, {
      winner: displacementDelta < 0 ? 'A' : 'B',
      reason: 'round-limit',
      detail: `核心位移 ${A.core.displacement.toFixed(2)} : ${B.core.displacement.toFixed(2)}`,
    }, nowMs);
  }
  return finish(state, { winner: 'draw', reason: 'round-limit', detail: '核心高度与位移都接近' }, nowMs);
};

/**
 * Move to the next phase, honouring the build order and the per-round turn
 * cycle. Returns the same state object when nothing changes.
 */
export const advancePhase = (state: BattleState, nowMs = 0): BattleState => {
  switch (state.phase) {
    case 'build':
      if (state.activeSide === 'A') {
        return withPhase({ ...state, activeSide: 'B' }, 'build', nowMs);
      }
      return withPhase(state, 'settle', nowMs);
    case 'settle': {
      // The rules are explicit: a side that finishes building without a core
      // has already lost. This is checked once the settle window is over so a
      // structure collapsing on top of the core still counts as a loss.
      const missingA = !state.sides.A.core.placed;
      const missingB = !state.sides.B.core.placed;
      if (missingA && missingB) {
        return finish(state, { winner: 'draw', reason: 'core-flat', detail: '双方都没有放置核心' }, nowMs);
      }
      if (missingA) return finish(state, { winner: 'B', reason: 'core-flat', detail: '蓝方没有放置核心' }, nowMs);
      if (missingB) return finish(state, { winner: 'A', reason: 'core-flat', detail: '红方没有放置核心' }, nowMs);
      return startTurn({ ...state }, 'A', 1, nowMs);
    }
    case 'inspect':
      return withPhase(state, 'engineer', nowMs);
    case 'engineer':
      return withPhase(state, 'fire', nowMs);
    case 'fire':
      return withPhase(state, 'resolve', nowMs);
    case 'resolve': {
      const nextTurn = turnIndexOf(state) + 1;
      if (nextTurn >= totalTurns(state)) return resolveRoundLimit(state, nowMs);
      return startTurn(state, sideForTurn(nextTurn), roundForTurn(nextTurn), nowMs);
    }
    default:
      return state;
  }
};

/** Player pressed "ready" / "skip" in the current phase. */
export const skipPhase = (state: BattleState, side: BattleSide, nowMs = 0): BattleState => {
  if (side !== state.activeSide) return state;
  if (state.phase === 'build' || state.phase === 'engineer' || state.phase === 'fire') {
    return advancePhase(state, nowMs);
  }
  return state;
};

/** Resolve can end early once the table has gone quiet. */
export const finishResolveEarly = (state: BattleState, nowMs = 0): BattleState => (
  state.phase === 'resolve' ? advancePhase(state, nowMs) : state
);

/* ------------------------------------------------------------------ */
/* Core evaluation                                                     */
/* ------------------------------------------------------------------ */

const evaluateCore = (
  core: BattleCoreStatus,
  sample: { position: [number, number, number]; quaternion: [number, number, number, number] },
  legal: boolean,
  cardSize: CardSize,
  dtMs: number,
  allowBreak: boolean,
): BattleCoreStatus => {
  const clearance = lowestCardCorner(sample.position, sample.quaternion, cardSize);
  const displacement = core.initialPosition
    ? distance3(sample.position, core.initialPosition)
    : 0;
  // A core is only "on the floor" once it is both touching the ground and has
  // lost height since it was placed — a core standing on its edge at the end of
  // a support is not a lost core.
  const placedHeight = core.initialPosition?.[1] ?? sample.position[1];
  const grounded = clearance <= 0.08 && placedHeight - sample.position[1] >= 0.3;
  const flatForMs = allowBreak && grounded ? core.flatForMs + dtMs : 0;
  const outsideForMs = allowBreak && !legal ? core.outsideForMs + dtMs : 0;
  const broken = allowBreak && (
    flatForMs >= CORE_FLAT_GRACE_MS || outsideForMs >= CORE_OUTSIDE_GRACE_MS
  );
  return {
    ...core,
    position: sample.position,
    clearance,
    height: clearance,
    displacement,
    flatForMs,
    outsideForMs,
    danger: !core.broken && (clearance <= CORE_DANGER_CLEARANCE || displacement >= 1.5),
    broken,
    brokenReason: broken
      ? (outsideForMs >= CORE_OUTSIDE_GRACE_MS ? 'outside' : 'flat')
      : null,
  };
};

export interface TickOptions {
  arena: BattleArena;
  /** Core transforms sampled from the physics scene. */
  samples?: BattleCoreSamples;
  cardSize?: CardSize;
  /** True once the table is quiet enough to end the resolve phase early. */
  settled?: boolean;
}

export const tick = (
  state: BattleState,
  dtMs: number,
  nowMs = 0,
  options: TickOptions,
): BattleState => {
  if (state.phase === 'idle' || state.phase === 'finished') return state;
  const dt = Math.max(0, dtMs);
  const cardSize = options.cardSize ?? CardSize.BRIDGE;
  const allowBreak = state.phase !== 'build';
  const samples = options.samples ?? {};

  let next = state;
  const sides = { ...next.sides };
  (['A', 'B'] as BattleSide[]).forEach(side => {
    const core = sides[side].core;
    if (!core.placed) return;
    const sample = samples[side];
    if (!sample) return;
    sides[side] = {
      ...sides[side],
      core: evaluateCore(
        core,
        sample,
        isCoreLegal(options.arena, side, sample.position),
        cardSize,
        dt,
        allowBreak,
      ),
    };
  });
  next = { ...next, sides };

  const outcome = evaluateOutcome(next);
  if (outcome) return finish(next, outcome, nowMs);

  const timeLeftMs = Math.max(0, next.timeLeftMs - dt);
  next = { ...next, timeLeftMs };

  if (next.phase === 'resolve' && (options.settled || timeLeftMs <= 0)) {
    return advancePhase(next, nowMs);
  }
  if (timeLeftMs <= 0) return advancePhase(next, nowMs);
  return next;
};

/* ------------------------------------------------------------------ */
/* Core placement and resources                                        */
/* ------------------------------------------------------------------ */

export const markCorePlaced = (
  state: BattleState,
  side: BattleSide,
  cardId: string,
  position: [number, number, number],
  quaternion: [number, number, number, number],
  cardSize: CardSize = CardSize.BRIDGE,
): BattleState => {
  const clearance = lowestCardCorner(position, quaternion, cardSize);
  return {
    ...state,
    sides: {
      ...state.sides,
      [side]: {
        ...state.sides[side],
        core: {
          ...emptyCore(),
          cardId,
          placed: true,
          initialPosition: [...position],
          position: [...position],
          clearance,
          height: clearance,
          displacement: 0,
        },
      },
    },
  };
};

export const markCoreRemoved = (state: BattleState, side: BattleSide): BattleState => ({
  ...state,
  sides: { ...state.sides, [side]: { ...state.sides[side], core: emptyCore() } },
});

export type PlacementRole = 'structure' | 'ammo' | 'core';

export interface PlacementUsage {
  structure: number;
  ammo: number;
}

export type PlacementReason =
  | 'ok'
  | 'not-your-turn'
  | 'wrong-phase'
  | 'budget'
  | 'core-already-placed'
  | 'action-already-used';

export interface PlacementCheck {
  ok: boolean;
  reason: PlacementReason;
}

/**
 * Can `side` place a card of `role` right now?
 *
 * Build phases let a side place structure and ammo cards; the engineer phase
 * allows exactly one extra card (a reserve structure card or an ammo reload)
 * and then moves straight on to firing.
 */
export const canPlace = (
  state: BattleState,
  side: BattleSide,
  role: PlacementRole,
  usage: PlacementUsage = { structure: 0, ammo: 0 },
): PlacementCheck => {
  if (state.phase === 'finished' || state.phase === 'idle') return { ok: false, reason: 'wrong-phase' };
  if (state.phase === 'build') {
    if (side !== state.activeSide) return { ok: false, reason: 'not-your-turn' };
    if (role === 'core') {
      return state.sides[side].core.placed
        ? { ok: false, reason: 'core-already-placed' }
        : { ok: true, reason: 'ok' };
    }
    if (role === 'structure') {
      return usage.structure >= state.config.structureCards
        ? { ok: false, reason: 'budget' }
        : { ok: true, reason: 'ok' };
    }
    return usage.ammo >= state.config.ammoCards
      ? { ok: false, reason: 'budget' }
      : { ok: true, reason: 'ok' };
  }
  if (state.phase === 'engineer') {
    if (side !== state.activeSide) return { ok: false, reason: 'not-your-turn' };
    if (state.sides[side].engineerUsedThisTurn) return { ok: false, reason: 'action-already-used' };
    if (role === 'core') return { ok: false, reason: 'wrong-phase' };
    if (role === 'ammo') {
      return usage.ammo >= state.config.ammoCards
        ? { ok: false, reason: 'budget' }
        : { ok: true, reason: 'ok' };
    }
    return state.sides[side].reserveUsed >= state.config.reserveCards
      ? { ok: false, reason: 'budget' }
      : { ok: true, reason: 'ok' };
  }
  return { ok: false, reason: 'wrong-phase' };
};

export const markEngineerActionUsed = (state: BattleState, side: BattleSide): BattleState => ({
  ...state,
  sides: {
    ...state.sides,
    [side]: {
      ...state.sides[side],
      engineerUsedThisTurn: true,
      reserveUsed: state.sides[side].reserveUsed + 1,
    },
  },
});

/** A shot was launched: record it, spend the turn's fire action, go to resolve. */
export const recordShot = (
  state: BattleState,
  shot: BattleShotRecord,
  nowMs = 0,
): BattleState => {
  if (state.phase !== 'fire' || shot.side !== state.activeSide) return state;
  const next: BattleState = {
    ...state,
    shots: [...state.shots, shot],
    lastShot: shot,
    sides: {
      ...state.sides,
      [shot.side]: {
        ...state.sides[shot.side],
        fireUsedThisTurn: true,
        ammoLaunched: state.sides[shot.side].ammoLaunched + 1,
      },
    },
  };
  return withPhase(next, 'resolve', nowMs);
};

export const resign = (state: BattleState, side: BattleSide, nowMs = 0): BattleState => {
  if (state.phase === 'finished' || state.phase === 'idle') return state;
  return finish(state, { winner: otherSide(side), reason: 'resign', detail: `${side} 认输` }, nowMs);
};

/**
 * Fill in shot bookkeeping that is only known once the resolve phase ends
 * (how many cards actually moved, where both cores ended up).
 */
export const patchLastShot = (
  state: BattleState,
  patch: Partial<BattleShotRecord>,
): BattleState => {
  if (state.shots.length === 0) return state;
  const shots = state.shots.map((shot, index) => (
    index === state.shots.length - 1 ? { ...shot, ...patch } : shot
  ));
  return { ...state, shots, lastShot: shots[shots.length - 1] };
};

export const isFinished = (state: BattleState) => state.phase === 'finished';

/** True when the active side still has to place its core card. */
export const needsCore = (state: BattleState) => (
  state.phase === 'build' && !state.sides[state.activeSide].core.placed
);
