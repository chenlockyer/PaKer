/**
 * Card Siege — 1v1 turn based card siege battle.
 *
 * Data model for the battle layer. Everything in `battle/` is free of React and
 * three.js so the whole turn machine can be simulated in a node self-test.
 *
 * Win condition (v1, no core card): once the settle check is over, every card
 * that was placed *standing on an edge* is counted. A side whose standing cards
 * have half or more fallen flat loses — a house of cards that collapses, falls.
 */

import type { LaunchPreset } from '../types';

export type BattleSide = 'A' | 'B';

/**
 * Match phases. Build runs once per side, then every round cycles through
 * inspect → engineer → fire → resolve.
 */
export type BattlePhase =
  | 'idle'
  | 'build'
  | 'settle'
  | 'inspect'
  | 'engineer'
  | 'fire'
  | 'resolve'
  | 'finished';

export interface BattleConfig {
  schemaVersion: 2;
  arenaId: string;
  /** Rounds per player. The design doc caps this at 8. */
  rounds: number;
  /** Build time per side. */
  buildSeconds: number;
  inspectSeconds: number;
  engineerSeconds: number;
  fireSeconds: number;
  resolveSeconds: number;
  /** Card budgets. */
  structureCards: number;
  reserveCards: number;
  ammoCards: number;
}

/** One card tracked by the battle, recorded when it is placed. */
export interface BattleCardRecord {
  id: string;
  side: BattleSide;
  role: 'structure' | 'ammo';
  /** True when the card was placed on an edge rather than lying flat. */
  standing: boolean;
  basePosition: [number, number, number];
  baseHeight: number;
}

/** Live pose of a card, sampled from the physics scene. */
export interface BattleCardSample {
  position: [number, number, number];
  quaternion: [number, number, number, number];
}

export interface BattleCollapseState {
  /** Cards this side placed on an edge. */
  standing: number;
  /** How many of those are flat, dropped or knocked away now. */
  fallen: number;
  /** fallen / standing, 0 when the side placed no standing cards. */
  rate: number;
  broken: boolean;
  lastFallenId: string | null;
}

export interface BattleSideState {
  side: BattleSide;
  collapse: BattleCollapseState;
  /** Reserve cards spent with the engineer action. */
  reserveUsed: number;
  ammoLaunched: number;
  /** One engineering action and one shot per turn. */
  engineerUsedThisTurn: boolean;
  fireUsedThisTurn: boolean;
}

export type BattleEndReason = 'collapse' | 'resign' | 'round-limit';

export interface BattleOutcome {
  winner: BattleSide | 'draw';
  reason: BattleEndReason;
  /** Machine readable detail. */
  detail: string;
}

export interface BattleShotRecord {
  round: number;
  side: BattleSide;
  ammoCardId: string;
  preset: LaunchPreset;
  meterPower: number;
  targetSpeed: number;
  launchPosition: [number, number, number];
  contactPointWorld: [number, number, number];
  direction: [number, number, number];
  /** Cards of either side that ended up displaced by more than 0.15 units. */
  knockedCards: number;
  collapseBefore: Record<BattleSide, number>;
  collapseAfter: Record<BattleSide, number>;
  at: number;
}

export interface BattleLogEntry {
  at: number;
  phase: BattlePhase;
  side: BattleSide;
  message: string;
}

export interface BattleState {
  schemaVersion: 2;
  config: BattleConfig;
  phase: BattlePhase;
  activeSide: BattleSide;
  /** 1-based round index. */
  round: number;
  timeLeftMs: number;
  startedAtMs: number;
  endedAtMs: number | null;
  sides: Record<BattleSide, BattleSideState>;
  /** Every card placed this match, used for the collapse rule. */
  cards: BattleCardRecord[];
  shots: BattleShotRecord[];
  lastShot: BattleShotRecord | null;
  outcome: BattleOutcome | null;
  log: BattleLogEntry[];
}

export interface BattleArenaRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface BattleArena {
  id: string;
  name: Record<'zh' | 'en', string>;
  /** Ground grid cell, matching the floor grid in the scene. */
  cell: number;
  /** Build zone of each side, in world XZ. */
  zones: Record<BattleSide, BattleArenaRect>;
  /** Neutral no-build zone between both sides. */
  buffer: BattleArenaRect;
  camera: {
    position: [number, number, number];
    target: [number, number, number];
  };
  /** Direction each side fires towards, used for camera framing. */
  facing: Record<BattleSide, 'neg-z' | 'pos-z'>;
}

/** A one-shot camera move requested by the battle controller. */
export interface BattleCameraRequest {
  token: number;
  position: [number, number, number];
  target: [number, number, number];
}

export const DEFAULT_BATTLE_CONFIG: BattleConfig = {
  schemaVersion: 2,
  arenaId: 'standard',
  rounds: 6,
  buildSeconds: 150,
  inspectSeconds: 3,
  engineerSeconds: 15,
  fireSeconds: 20,
  resolveSeconds: 6,
  structureCards: 30,
  reserveCards: 10,
  ammoCards: 12,
};

export const BATTLE_LIMITS = {
  rounds: { min: 2, max: 8 },
  buildSeconds: { min: 60, max: 240, step: 15 },
  structureCards: { min: 8, max: 40 },
  reserveCards: { min: 0, max: 10 },
  ammoCards: { min: 2, max: 12 },
} as const;

/** A side loses once this share of its standing cards has fallen. */
export const COLLAPSE_THRESHOLD = 0.5;
/** A build must leave at least this many cards standing on an edge. */
export const MIN_STANDING_CARDS = 4;
/** Cards placed with |up·y| below this count as "standing on an edge". */
export const STANDING_NORMAL_LIMIT = 0.6;
/** A standing card is fallen once its face normal tips past this. */
export const FALLEN_NORMAL_LIMIT = 0.8;
/** A standing card counts as fallen if it drops this far below its placement. */
export const FALLEN_DROP = 1;
/** …or gets knocked this far from where it was placed. */
export const FALLEN_DISPLACEMENT = 3;

export const otherSide = (side: BattleSide): BattleSide => (side === 'A' ? 'B' : 'A');
