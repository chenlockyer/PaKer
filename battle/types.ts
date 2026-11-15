/**
 * Card Siege — 1v1 turn based card siege battle.
 *
 * Data model for the battle layer. Everything in `battle/` is free of React and
 * three.js so the whole turn machine can be simulated in a node self-test.
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
  schemaVersion: 1;
  arenaId: string;
  /** Rounds per player. The design doc caps this at 8. */
  rounds: number;
  /** Build time per side. */
  buildSeconds: number;
  inspectSeconds: number;
  engineerSeconds: number;
  fireSeconds: number;
  resolveSeconds: number;
  /** Card budgets. Core cards are free and live outside these budgets. */
  structureCards: number;
  reserveCards: number;
  ammoCards: number;
}

export interface BattleCoreStatus {
  cardId: string | null;
  placed: boolean;
  initialPosition: [number, number, number] | null;
  position: [number, number, number] | null;
  /** Lowest corner of the core card, in world units above the floor. */
  clearance: number;
  height: number;
  displacement: number;
  /** Milliseconds the core has been resting on the floor. */
  flatForMs: number;
  /** Milliseconds the core has been outside its legal region. */
  outsideForMs: number;
  danger: boolean;
  broken: boolean;
  brokenReason: 'flat' | 'outside' | null;
}

export interface BattleSideState {
  side: BattleSide;
  core: BattleCoreStatus;
  /** Reserve cards spent with the engineer action. */
  reserveUsed: number;
  ammoLaunched: number;
  /** One engineering action and one shot per turn. */
  engineerUsedThisTurn: boolean;
  fireUsedThisTurn: boolean;
}

export type BattleEndReason =
  | 'core-flat'
  | 'core-outside'
  | 'resign'
  | 'round-limit';

export interface BattleOutcome {
  winner: BattleSide | 'draw';
  reason: BattleEndReason;
  /** Machine readable detail, e.g. which core fell. */
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
  coreDisplacementBefore: Record<BattleSide, number>;
  coreDisplacementAfter: Record<BattleSide, number>;
  at: number;
}

export interface BattleLogEntry {
  at: number;
  phase: BattlePhase;
  side: BattleSide;
  message: string;
}

export interface BattleState {
  schemaVersion: 1;
  config: BattleConfig;
  phase: BattlePhase;
  activeSide: BattleSide;
  /** 1-based round index. */
  round: number;
  timeLeftMs: number;
  startedAtMs: number;
  endedAtMs: number | null;
  sides: Record<BattleSide, BattleSideState>;
  shots: BattleShotRecord[];
  lastShot: BattleShotRecord | null;
  outcome: BattleOutcome | null;
  log: BattleLogEntry[];
}

/** Live transform of a core card, sampled from the physics scene. */
export interface BattleCoreSample {
  position: [number, number, number];
  quaternion: [number, number, number, number];
}

export type BattleCoreSamples = Partial<Record<BattleSide, BattleCoreSample>>;

export interface BattleArenaRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface BattleArena {
  id: string;
  name: Record<'zh' | 'en', string>;
  /** Build zone of each side, in world XZ. */
  zones: Record<BattleSide, BattleArenaRect>;
  /** Legal core area inside each build zone. */
  coreAreas: Record<BattleSide, BattleArenaRect>;
  /** Central buffer no structure card may enter. */
  buffer: BattleArenaRect;
  camera: {
    position: [number, number, number];
    target: [number, number, number];
  };
  /** Direction each side fires towards, used for defaults and the AI-free HUD. */
  facing: Record<BattleSide, 'neg-z' | 'pos-z'>;
}

/** A one-shot camera move requested by the battle controller. */
export interface BattleCameraRequest {
  token: number;
  position: [number, number, number];
  target: [number, number, number];
}

export const DEFAULT_BATTLE_CONFIG: BattleConfig = {
  schemaVersion: 1,
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
  structureCards: { min: 8, max: 30 },
  reserveCards: { min: 0, max: 10 },
  ammoCards: { min: 2, max: 12 },
} as const;

/** Core is considered destroyed after resting on the floor this long. */
export const CORE_FLAT_GRACE_MS = 750;
/** Core is considered destroyed after leaving its legal region this long. */
export const CORE_OUTSIDE_GRACE_MS = 750;
/** Core clearance below which the HUD warns the owner. */
export const CORE_DANGER_CLEARANCE = 0.55;
/** Minimum clearance allowed when the core is placed. */
export const CORE_MIN_PLACEMENT_CLEARANCE = 0.9;

export const otherSide = (side: BattleSide): BattleSide => (side === 'A' ? 'B' : 'A');
