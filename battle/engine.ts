/**
 * Card Siege turn engine.
 *
 * Pure state machine: give it a config, tick it with a delta and the current
 * card poses, and it returns the next state. No timers, no React, no three.js —
 * the browser controller calls `tick` from an interval and the node self-test
 * calls it in a loop.
 *
 * Phase order for one round:
 *   inspect (3s) → engineer (15s) → fire (20s) → resolve (≤6s) → next player
 * Before the rounds there is one build phase per side and a settle check.
 *
 * Win condition: every card placed standing on an edge is tracked. A side whose
 * standing cards have half or more fallen flat — because they were shot, or
 * because the house collapsed on its own — loses.
 */

import {
  COLLAPSE_THRESHOLD,
  DEFAULT_BATTLE_CONFIG,
  FALLEN_DISPLACEMENT,
  FALLEN_DROP,
  FALLEN_NORMAL_LIMIT,
  MIN_STANDING_CARDS,
  STANDING_NORMAL_LIMIT,
  type BattleArena,
  type BattleCardRecord,
  type BattleCardSample,
  type BattleCollapseState,
  type BattleConfig,
  type BattleOutcome,
  type BattlePhase,
  type BattleShotRecord,
  type BattleSide,
  type BattleSideState,
  type BattleState,
  otherSide,
} from './types';
import { isInsideZone } from './arena';
import { distance3, rotateVector } from './geometry';
import type { CardData } from '../types';

const LOG_LIMIT = 40;

const emptyCollapse = (): BattleCollapseState => ({
  standing: 0,
  fallen: 0,
  rate: 0,
  broken: false,
  lastFallenId: null,
});

const emptySide = (side: BattleSide): BattleSideState => ({
  side,
  collapse: emptyCollapse(),
  reserveUsed: 0,
  ammoLaunched: 0,
  engineerUsedThisTurn: false,
  fireUsedThisTurn: false,
});

export const createBattleState = (
  config: Partial<BattleConfig> = {},
  nowMs = 0,
): BattleState => ({
  schemaVersion: 2,
  config: { ...DEFAULT_BATTLE_CONFIG, ...config, schemaVersion: 2 },
  phase: 'idle',
  activeSide: 'A',
  round: 1,
  timeLeftMs: 0,
  startedAtMs: nowMs,
  endedAtMs: null,
  sides: { A: emptySide('A'), B: emptySide('B') },
  cards: [],
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

const percent = (value: number) => `${Math.round(value * 100)}%`;

const evaluateOutcome = (state: BattleState): BattleOutcome | null => {
  const { A, B } = state.sides;
  if (A.collapse.broken && B.collapse.broken) {
    if (Math.abs(A.collapse.rate - B.collapse.rate) < 0.01) {
      return { winner: 'draw', reason: 'collapse', detail: '双方同时倒塌' };
    }
    return A.collapse.rate < B.collapse.rate
      ? { winner: 'A', reason: 'collapse', detail: `双方都倒塌，蓝方更完整（${percent(A.collapse.rate)} : ${percent(B.collapse.rate)}）` }
      : { winner: 'B', reason: 'collapse', detail: `双方都倒塌，红方更完整（${percent(A.collapse.rate)} : ${percent(B.collapse.rate)}）` };
  }
  if (A.collapse.broken) {
    return {
      winner: 'B',
      reason: 'collapse',
      detail: `蓝方倒塌 ${percent(A.collapse.rate)}（${A.collapse.fallen}/${A.collapse.standing} 张站牌倒下）`,
    };
  }
  if (B.collapse.broken) {
    return {
      winner: 'A',
      reason: 'collapse',
      detail: `红方倒塌 ${percent(B.collapse.rate)}（${B.collapse.fallen}/${B.collapse.standing} 张站牌倒下）`,
    };
  }
  return null;
};

const finish = (state: BattleState, outcome: BattleOutcome, nowMs: number): BattleState => log(
  { ...state, phase: 'finished', timeLeftMs: 0, endedAtMs: nowMs, outcome },
  nowMs,
  `对局结束：${outcome.winner === 'draw' ? '平局' : `${outcome.winner} 获胜`}（${outcome.detail}）`,
);

/** Round limit tie-break: the steadier house wins. */
export const resolveRoundLimit = (state: BattleState, nowMs: number): BattleState => {
  const { A, B } = state.sides;
  if (A.collapse.standing === 0 && B.collapse.standing === 0) {
    return finish(state, { winner: 'draw', reason: 'round-limit', detail: '双方都没有可倒塌的站牌' }, nowMs);
  }
  const rateDelta = A.collapse.rate - B.collapse.rate;
  if (Math.abs(rateDelta) > 0.01) {
    return finish(state, {
      winner: rateDelta < 0 ? 'A' : 'B',
      reason: 'round-limit',
      detail: `倒塌率 ${percent(A.collapse.rate)} : ${percent(B.collapse.rate)}`,
    }, nowMs);
  }
  if (A.collapse.standing !== B.collapse.standing) {
    return finish(state, {
      winner: A.collapse.standing > B.collapse.standing ? 'A' : 'B',
      reason: 'round-limit',
      detail: `站牌 ${A.collapse.standing} : ${B.collapse.standing}`,
    }, nowMs);
  }
  return finish(state, { winner: 'draw', reason: 'round-limit', detail: '倒塌率与站牌数都很接近' }, nowMs);
};

export const advancePhase = (state: BattleState, nowMs = 0): BattleState => {
  switch (state.phase) {
    case 'build':
      if (state.activeSide === 'A') {
        return withPhase({ ...state, activeSide: 'B' }, 'build', nowMs);
      }
      return withPhase(state, 'settle', nowMs);
    case 'settle': {
      // The collapse check is the opener: a house that fell on its own during
      // the build already loses here, and so does a pile that never stood up.
      const standingA = standingCountOf(state, 'A');
      const standingB = standingCountOf(state, 'B');
      if (standingA < MIN_STANDING_CARDS && standingB < MIN_STANDING_CARDS) {
        return finish(state, {
          winner: 'draw',
          reason: 'collapse',
          detail: `双方都没有立起 ${MIN_STANDING_CARDS} 张站牌`,
        }, nowMs);
      }
      if (standingA < MIN_STANDING_CARDS) {
        return finish(state, {
          winner: 'B',
          reason: 'collapse',
          detail: `蓝方只立起 ${standingA} 张站牌，少于 ${MIN_STANDING_CARDS} 张`,
        }, nowMs);
      }
      if (standingB < MIN_STANDING_CARDS) {
        return finish(state, {
          winner: 'A',
          reason: 'collapse',
          detail: `红方只立起 ${standingB} 张站牌，少于 ${MIN_STANDING_CARDS} 张`,
        }, nowMs);
      }
      const outcome = evaluateOutcome(state);
      if (outcome) return finish(state, outcome, nowMs);
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
/* Cards and collapse                                                  */
/* ------------------------------------------------------------------ */

/** Is this card standing on an edge (as opposed to lying flat)? */
export const isStandingQuaternion = (quaternion: [number, number, number, number]) => {
  const up = rotateVector(quaternion, [0, 1, 0]);
  return Math.abs(up[1]) <= STANDING_NORMAL_LIMIT;
};

/** Has a tracked standing card come down? */
export const isCardFallen = (
  record: BattleCardRecord,
  sample: BattleCardSample,
): boolean => {
  const up = rotateVector(sample.quaternion, [0, 1, 0]);
  if (Math.abs(up[1]) >= FALLEN_NORMAL_LIMIT) return true;
  const drop = record.baseHeight - sample.position[1];
  if (drop >= FALLEN_DROP) return true;
  return distance3(sample.position, record.basePosition) >= FALLEN_DISPLACEMENT;
};

/** Track a newly placed card so the collapse rule can score it later. */
export const registerCard = (state: BattleState, card: CardData): BattleState => {
  if (!card.owner || card.role === 'core') return state;
  if (state.cards.some(record => record.id === card.id)) return state;
  const quaternion = cardQuaternion(card);
  const record: BattleCardRecord = {
    id: card.id,
    side: card.owner,
    role: card.role === 'ammo' ? 'ammo' : 'structure',
    standing: isStandingQuaternion(quaternion),
    basePosition: [...card.position],
    baseHeight: card.position[1],
  };
  return { ...state, cards: [...state.cards, record] };
};

/** Drop records for cards that no longer exist (delete, undo, import). */
export const reconcileCards = (state: BattleState, liveCardIds: ReadonlySet<string>): BattleState => {
  if (state.cards.length === 0) return state;
  const cards = state.cards.filter(record => liveCardIds.has(record.id));
  if (cards.length === state.cards.length) return state;
  return recomputeCollapse({ ...state, cards });
};

const cardQuaternion = (card: CardData): [number, number, number, number] => {
  const [x, y, z] = card.rotation;
  const sx = Math.sin(x / 2);
  const cx = Math.cos(x / 2);
  const sy = Math.sin(y / 2);
  const cy = Math.cos(y / 2);
  const sz = Math.sin(z / 2);
  const cz = Math.cos(z / 2);
  return [
    sx * cy * cz + cx * sy * sz,
    cx * sy * cz - sx * cy * sz,
    cx * cy * sz + sx * sy * cz,
    cx * cy * cz - sx * sy * sz,
  ];
};

/** Recompute both sides' collapse state from the recorded cards. */
export const recomputeCollapse = (
  state: BattleState,
  samples: Partial<Record<string, BattleCardSample>> = {},
  allowBreak = false,
): BattleState => {
  const patch = (side: BattleSideState): BattleSideState => {
    const records = state.cards.filter(record => record.side === side.side && record.standing);
    let fallen = 0;
    let lastFallenId: string | null = null;
    for (const record of records) {
      const sample = samples[record.id];
      if (!sample) continue;
      if (isCardFallen(record, sample)) {
        fallen += 1;
        lastFallenId = record.id;
      }
    }
    const rate = records.length === 0 ? 0 : fallen / records.length;
    const broken = allowBreak && records.length > 0 && rate >= COLLAPSE_THRESHOLD;
    return {
      ...side,
      collapse: {
        standing: records.length,
        fallen,
        rate,
        broken: side.collapse.broken || broken,
        lastFallenId: lastFallenId ?? side.collapse.lastFallenId,
      },
    };
  };
  return {
    ...state,
    sides: { A: patch(state.sides.A), B: patch(state.sides.B) },
  };
};

export interface TickOptions {
  arena: BattleArena;
  /** Live poses of every tracked card, keyed by card id. */
  samples?: Partial<Record<string, BattleCardSample>>;
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
  const allowBreak = state.phase !== 'build';

  let next = recomputeCollapse(state, options.samples, allowBreak);
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
/* Placement and resources                                             */
/* ------------------------------------------------------------------ */

export type PlacementRole = 'structure' | 'ammo';

export interface PlacementUsage {
  structure: number;
  ammo: number;
}

export type PlacementReason =
  | 'ok'
  | 'not-your-turn'
  | 'wrong-phase'
  | 'budget'
  | 'action-already-used';

export interface PlacementCheck {
  ok: boolean;
  reason: PlacementReason;
}

/** Can `side` place a card of `role` right now? */
export const canPlace = (
  state: BattleState,
  side: BattleSide,
  role: PlacementRole,
  usage: PlacementUsage = { structure: 0, ammo: 0 },
): PlacementCheck => {
  if (state.phase === 'finished' || state.phase === 'idle') return { ok: false, reason: 'wrong-phase' };
  if (state.phase === 'build') {
    if (side !== state.activeSide) return { ok: false, reason: 'not-your-turn' };
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

/** Does a blueprint fit inside the side's build zone? */
export const blueprintFits = (
  arena: BattleArena,
  side: BattleSide,
  positions: [number, number, number][],
) => positions.every(position => isInsideZone(arena, side, position));

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

/** How many cards this side has standing on an edge right now. */
export const standingCountOf = (state: BattleState, side: BattleSide): number =>
  state.cards.filter(record => record.side === side && record.standing).length;

/** True when the active side has built enough to end its build phase. */
export const canFinishBuild = (state: BattleState): boolean =>
  state.phase === 'build' &&
  standingCountOf(state, state.activeSide) >= MIN_STANDING_CARDS;

/**
 * Fill in shot bookkeeping that is only known once the resolve phase ends
 * (how many cards actually moved, how far both sides have collapsed).
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

export const resign = (state: BattleState, side: BattleSide, nowMs = 0): BattleState => {
  if (state.phase === 'finished' || state.phase === 'idle') return state;
  return finish(state, { winner: otherSide(side), reason: 'resign', detail: `${side} 认输` }, nowMs);
};

export const isFinished = (state: BattleState) => state.phase === 'finished';
