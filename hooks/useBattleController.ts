/**
 * React binding for the Card Siege battle engine.
 *
 * Owns the BattleState, drives it with a 100 ms tick, samples the live core
 * transforms out of the physics scene and exposes the small API the rest of the
 * app needs (placement rules, launch permission, skip/resign, camera framing).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import {
  CardData,
  CardSize,
  LaunchRecord,
  LiveCardTransform,
} from '../types';
import {
  CORE_MIN_PLACEMENT_CLEARANCE,
  type BattleArena,
  type BattleCameraRequest,
  type BattleConfig,
  type BattleCoreSamples,
  type BattleSide,
  type BattleShotRecord,
  type BattleState,
} from '../battle/types';
import {
  defaultCoreSpot,
  getArena,
  isCoreLegal,
  isInsideZone,
  sideCamera,
} from '../battle/arena';
import {
  advancePhase,
  canPlace,
  createBattleState,
  markCorePlaced,
  markCoreRemoved,
  markEngineerActionUsed,
  needsCore,
  patchLastShot,
  recordShot,
  resign as resignEngine,
  skipPhase,
  startBattle,
  tick,
  totalTurns,
  turnIndexOf,
  type PlacementRole,
  type PlacementUsage,
} from '../battle/engine';
import { distance3, lowestCardCorner, quatFromEulerXYZ } from '../battle/geometry';

const TICK_MS = 100;
const KNOCK_THRESHOLD = 0.15;
const QUIET_STEP = 0.012;
const QUIET_TICKS = 4;
const RESOLVE_MIN_MS = 1200;

export interface BattleBudgetView {
  structureLeft: number;
  reserveLeft: number;
  ammoLeft: number;
  structureUsed: number;
  ammoUsed: number;
  reserveUsed: number;
}

export interface PlacementVerdict {
  ok: boolean;
  reason?: 'not-your-turn' | 'wrong-phase' | 'budget' | 'outside-zone' | 'outside-core-area' | 'core-too-low';
}

export interface UseBattleControllerOptions {
  active: boolean;
  cards: CardData[];
  liveTransforms: MutableRefObject<Map<string, LiveCardTransform>>;
  cardSize: CardSize;
  onPhaseChange?: (next: BattleState, previous: BattleState) => void;
}

const emptyUsage = (): PlacementUsage => ({ structure: 0, ammo: 0 });

export const useBattleController = ({
  active,
  cards,
  liveTransforms,
  cardSize,
  onPhaseChange,
}: UseBattleControllerOptions) => {
  const [state, setState] = useState<BattleState>(() => createBattleState());
  const stateRef = useRef(state);
  stateRef.current = state;

  const cardsRef = useRef(cards);
  cardsRef.current = cards;

  const [pendingRole, setPendingRole] = useState<PlacementRole>('structure');
  const pendingRoleRef = useRef<PlacementRole>(pendingRole);
  pendingRoleRef.current = pendingRole;

  const [cameraRequest, setCameraRequest] = useState<BattleCameraRequest | null>(null);
  const cameraTokenRef = useRef(0);

  const phaseChangeRef = useRef(onPhaseChange);
  phaseChangeRef.current = onPhaseChange;

  const arena = useMemo<BattleArena>(() => getArena(state.config.arenaId), [state.config.arenaId]);

  const lastPositionsRef = useRef(new Map<string, [number, number, number]>());
  const lastTickAtRef = useRef(0);
  const quietTicksRef = useRef(0);
  const shotSnapshotRef = useRef<Map<string, [number, number, number]> | null>(null);
  const resolveElapsedRef = useRef(0);

  /** Counts of live cards per side, used for every budget decision. */
  const usage = useMemo(() => {
    const result: Record<BattleSide, PlacementUsage> = { A: emptyUsage(), B: emptyUsage() };
    for (const card of cards) {
      if (!card.owner) continue;
      if (card.role === 'ammo') result[card.owner].ammo += 1;
      else if (card.role !== 'core') result[card.owner].structure += 1;
    }
    return result;
  }, [cards]);
  const usageRef = useRef(usage);
  usageRef.current = usage;

  const budgets = useMemo<Record<BattleSide, BattleBudgetView>>(() => ({
    A: {
      structureUsed: usage.A.structure,
      ammoUsed: usage.A.ammo,
      reserveUsed: state.sides.A.reserveUsed,
      structureLeft: Math.max(0, state.config.structureCards - usage.A.structure),
      reserveLeft: Math.max(0, state.config.reserveCards - state.sides.A.reserveUsed),
      ammoLeft: Math.max(0, state.config.ammoCards - usage.A.ammo),
    },
    B: {
      structureUsed: usage.B.structure,
      ammoUsed: usage.B.ammo,
      reserveUsed: state.sides.B.reserveUsed,
      structureLeft: Math.max(0, state.config.structureCards - usage.B.structure),
      reserveLeft: Math.max(0, state.config.reserveCards - state.sides.B.reserveUsed),
      ammoLeft: Math.max(0, state.config.ammoCards - usage.B.ammo),
    },
  }), [state.config, state.sides.A.reserveUsed, state.sides.B.reserveUsed, usage]);

  const commit = useCallback((next: BattleState) => {
    const previous = stateRef.current;
    if (next === previous) return;
    stateRef.current = next;
    setState(next);
    if (next.phase !== previous.phase || next.activeSide !== previous.activeSide) {
      phaseChangeRef.current?.(next, previous);
    }
  }, []);

  /** Core transforms as seen by the physics scene right now. */
  const collectCoreSamples = useCallback((): BattleCoreSamples => {
    const samples: BattleCoreSamples = {};
    for (const card of cardsRef.current) {
      if (card.role !== 'core' || !card.owner) continue;
      const live = liveTransforms.current.get(card.id);
      const position = live ? live.position : card.position;
      const euler = live ? live.rotation : card.rotation;
      samples[card.owner] = {
        position: [...position] as [number, number, number],
        quaternion: quatFromEulerXYZ(euler[0], euler[1], euler[2]),
      };
    }
    return samples;
  }, [liveTransforms]);

  const snapshotPositions = useCallback(() => {
    const snapshot = new Map<string, [number, number, number]>();
    for (const card of cardsRef.current) {
      const live = liveTransforms.current.get(card.id);
      snapshot.set(card.id, [...(live ? live.position : card.position)] as [number, number, number]);
    }
    return snapshot;
  }, [liveTransforms]);

  const countKnocked = useCallback(() => {
    const before = shotSnapshotRef.current;
    if (!before) return 0;
    let knocked = 0;
    for (const [id, start] of before) {
      const live = liveTransforms.current.get(id);
      if (!live) continue;
      if (distance3(live.position, start) >= KNOCK_THRESHOLD) knocked += 1;
    }
    return knocked;
  }, [liveTransforms]);

  const finaliseShot = useCallback((next: BattleState) => {
    if (!shotSnapshotRef.current) return next;
    const knocked = countKnocked();
    const coreDisplacementAfter = {
      A: next.sides.A.core.displacement,
      B: next.sides.B.core.displacement,
    };
    shotSnapshotRef.current = null;
    return patchLastShot(next, { knockedCards: knocked, coreDisplacementAfter });
  }, [countKnocked]);

  /* ---------------- ticking ---------------- */
  useEffect(() => {
    if (!active) return;
    const interval = window.setInterval(() => {
      const current = stateRef.current;
      if (current.phase === 'idle' || current.phase === 'finished') return;

      // Undo/redo and the delete tool can remove a core card behind the
      // engine's back; keep the recorded core in sync with the scene.
      const liveIds = new Set(cardsRef.current.map(card => card.id));
      let reconciled = current;
      (['A', 'B'] as BattleSide[]).forEach(side => {
        const placedCore = reconciled.sides[side].core;
        if (!placedCore.placed || !placedCore.cardId) return;
        if (!liveIds.has(placedCore.cardId)) {
          reconciled = markCoreRemoved(reconciled, side);
        }
      });
      const now = Date.now();
      // Use the real elapsed time rather than a fixed step: background tabs
      // throttle timers, and a wall-clock delta keeps the match honest.
      const dt = lastTickAtRef.current > 0
        ? Math.min(600, Math.max(0, now - lastTickAtRef.current))
        : TICK_MS;
      lastTickAtRef.current = now;
      const samples = collectCoreSamples();

      // Quiet-table detection for the resolve phase: the whole table has to
      // stop moving for ~400 ms before the turn is allowed to close early.
      const previousPositions = lastPositionsRef.current;
      let maxStep = 0;
      for (const card of cardsRef.current) {
        const live = liveTransforms.current.get(card.id);
        if (!live) continue;
        const last = previousPositions.get(card.id);
        if (last) maxStep = Math.max(maxStep, distance3(live.position, last));
        previousPositions.set(card.id, [...live.position] as [number, number, number]);
      }
      quietTicksRef.current = maxStep <= QUIET_STEP ? quietTicksRef.current + 1 : 0;
      resolveElapsedRef.current = reconciled.phase === 'resolve'
        ? resolveElapsedRef.current + dt
        : 0;
      const settled = quietTicksRef.current >= QUIET_TICKS && resolveElapsedRef.current >= RESOLVE_MIN_MS;

      const next = tick(reconciled, dt, now, { arena, samples, cardSize, settled });
      if (next === current) return;
      if (reconciled.phase === 'resolve' && next.phase !== 'resolve') {
        commit(finaliseShot(next));
        return;
      }
      commit(next);
    }, TICK_MS);
    return () => window.clearInterval(interval);
  }, [active, arena, cardSize, collectCoreSamples, commit, finaliseShot, liveTransforms]);

  /* ---------------- camera ---------------- */
  const requestCamera = useCallback((view: 'global' | 'mine' | 'theirs' = 'global') => {
    const current = stateRef.current;
    const shot = sideCamera(arena, current.activeSide, view);
    cameraTokenRef.current += 1;
    setCameraRequest({
      token: cameraTokenRef.current,
      position: shot.position,
      target: shot.target,
    });
  }, [arena]);

  /* ---------------- match lifecycle ---------------- */
  const start = useCallback((config: Partial<BattleConfig>) => {
    const now = Date.now();
    const next = startBattle(createBattleState(config, now), now);
    lastPositionsRef.current = new Map();
    lastTickAtRef.current = 0;
    shotSnapshotRef.current = null;
    quietTicksRef.current = 0;
    resolveElapsedRef.current = 0;
    pendingRoleRef.current = 'structure';
    setPendingRole('structure');
    commit(next);
    cameraTokenRef.current += 1;
    const shot = sideCamera(getArena(next.config.arenaId), 'A', 'global');
    setCameraRequest({ token: cameraTokenRef.current, position: shot.position, target: shot.target });
  }, [commit]);

  const reset = useCallback(() => {
    commit(createBattleState());
    setPendingRole('structure');
    pendingRoleRef.current = 'structure';
    shotSnapshotRef.current = null;
    lastTickAtRef.current = 0;
    quietTicksRef.current = 0;
    resolveElapsedRef.current = 0;
  }, [commit]);

  /* ---------------- placement ---------------- */

  /**
   * Validate a ghost pose before the card exists. The core needs its real
   * orientation to know how far it clears the floor, so the ghost passes the
   * rotation in as well.
   */
  const validatePlacement = useCallback((
    position: [number, number, number],
    role: PlacementRole = pendingRoleRef.current,
    rotation?: [number, number, number],
  ): PlacementVerdict => {
    const current = stateRef.current;
    const side = current.activeSide;
    const check = canPlace(current, side, role, usageRef.current[side]);
    if (!check.ok) {
      return {
        ok: false,
        reason: check.reason === 'not-your-turn' ? 'not-your-turn' : check.reason as PlacementVerdict['reason'],
      };
    }
    if (role === 'core') {
      if (!isCoreLegal(arena, side, position)) return { ok: false, reason: 'outside-core-area' };
      const clearance = rotation
        ? lowestCardCorner(
          position,
          quatFromEulerXYZ(rotation[0], rotation[1], rotation[2]),
          cardSize,
        )
        : position[1];
      if (clearance < CORE_MIN_PLACEMENT_CLEARANCE) return { ok: false, reason: 'core-too-low' };
      return { ok: true };
    }
    if (!isInsideZone(arena, side, position)) return { ok: false, reason: 'outside-zone' };
    return { ok: true };
  }, [arena, cardSize]);

  /** Called after a battle card has been added to the scene. */
  const noteCardAdded = useCallback((card: CardData) => {
    const current = stateRef.current;
    const side = card.owner ?? current.activeSide;
    if (card.role === 'core') {
      const quaternion = quatFromEulerXYZ(card.rotation[0], card.rotation[1], card.rotation[2]);
      commit(markCorePlaced(current, side, card.id, card.position, quaternion, cardSize));
      pendingRoleRef.current = 'structure';
      setPendingRole('structure');
      return;
    }
    if (current.phase === 'engineer') {
      commit(advancePhase(markEngineerActionUsed(current, side), Date.now()));
    }
  }, [cardSize, commit]);

  const noteCardRemoved = useCallback((card: CardData) => {
    if (card.role !== 'core') return;
    const current = stateRef.current;
    const side = card.owner ?? current.activeSide;
    if (current.sides[side].core.cardId === card.id) commit(markCoreRemoved(current, side));
  }, [commit]);

  /** True when the given card may be fired right now. */
  const canLaunch = useCallback((card: CardData) => {
    const current = stateRef.current;
    return current.phase === 'fire' &&
      card.role === 'ammo' &&
      card.owner === current.activeSide;
  }, []);

  /** Consume a launch record produced by the physics scene. */
  const noteLaunch = useCallback((record: LaunchRecord) => {
    const current = stateRef.current;
    if (current.phase !== 'fire') return;
    const primary = record.members.find(member => member.cardId === record.intent.primaryCardId)
      ?? record.members[0];
    if (!primary) return;
    shotSnapshotRef.current = snapshotPositions();
    const shot: BattleShotRecord = {
      round: current.round,
      side: current.activeSide,
      ammoCardId: record.intent.primaryCardId,
      preset: record.intent.preset,
      meterPower: record.intent.meterPower,
      targetSpeed: record.intent.targetSpeed,
      launchPosition: primary.snapshotBefore.position,
      contactPointWorld: primary.contactPointWorld,
      direction: primary.directionWorld,
      knockedCards: 0,
      coreDisplacementBefore: {
        A: current.sides.A.core.displacement,
        B: current.sides.B.core.displacement,
      },
      coreDisplacementAfter: {
        A: current.sides.A.core.displacement,
        B: current.sides.B.core.displacement,
      },
      at: Date.now(),
    };
    quietTicksRef.current = 0;
    resolveElapsedRef.current = 0;
    commit(recordShot(current, shot, Date.now()));
  }, [commit, snapshotPositions]);

  const skip = useCallback(() => {
    const current = stateRef.current;
    commit(skipPhase(current, current.activeSide, Date.now()));
  }, [commit]);

  const resign = useCallback((side: BattleSide) => {
    commit(resignEngine(stateRef.current, side, Date.now()));
  }, [commit]);

  const setRole = useCallback((role: PlacementRole) => {
    pendingRoleRef.current = role;
    setPendingRole(role);
  }, []);

  /* ---------------- derived HUD view ---------------- */
  const view = useMemo(() => {
    const durationMs = Math.max(1, (() => {
      switch (state.phase) {
        case 'build': return state.config.buildSeconds * 1000;
        case 'settle': return 4000;
        case 'inspect': return state.config.inspectSeconds * 1000;
        case 'engineer': return state.config.engineerSeconds * 1000;
        case 'fire': return state.config.fireSeconds * 1000;
        case 'resolve': return state.config.resolveSeconds * 1000;
        default: return 1;
      }
    })());
    return {
      phase: state.phase,
      activeSide: state.activeSide,
      round: state.round,
      rounds: state.config.rounds,
      turnIndex: turnIndexOf(state),
      totalTurns: totalTurns(state),
      timeLeftMs: state.timeLeftMs,
      durationMs,
      budgets,
      cores: { A: state.sides.A.core, B: state.sides.B.core },
      needsCore: needsCore(state),
      outcome: state.outcome,
      lastShot: state.lastShot,
      log: state.log.slice(-6).reverse(),
      shots: state.shots.length,
    };
  }, [budgets, state]);

  return {
    arena,
    state,
    view,
    budgets,
    start,
    reset,
    pendingRole,
    setPendingRole: setRole,
    validatePlacement,
    noteCardAdded,
    noteCardRemoved,
    canLaunch,
    noteLaunch,
    skip,
    resign,
    cameraRequest,
    requestCamera,
  };
};
