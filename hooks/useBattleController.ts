/**
 * React binding for the Card Siege battle engine.
 *
 * Owns the BattleState, drives it with a 100 ms tick, samples every tracked
 * card pose out of the physics scene and exposes the small API the rest of the
 * app needs (placement rules, launch permission, blueprint checks, skip/resign,
 * camera framing).
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
  type BattleArena,
  type BattleCameraRequest,
  type BattleCardSample,
  type BattleConfig,
  type BattleSide,
  type BattleShotRecord,
  type BattleState,
} from '../battle/types';
import { getArena, isInsideZone, sideCamera } from '../battle/arena';
import {
  advancePhase,
  blueprintFits,
  canPlace,
  createBattleState,
  markEngineerActionUsed,
  patchLastShot,
  reconcileCards,
  recordShot,
  registerCard,
  resign as resignEngine,
  skipPhase,
  startBattle,
  tick,
  totalTurns,
  turnIndexOf,
  type PlacementRole,
  type PlacementUsage,
} from '../battle/engine';
import { distance3, quatFromEulerXYZ } from '../battle/geometry';

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
  /** Message key; see PLACEMENT_REASON in BattleHUD. */
  reason?: string;
  /** Cards that fell outside the zone, or the cards a blueprint needs. */
  count?: number;
  /** Structure cards left, when a blueprint does not fit the budget. */
  remaining?: number;
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

  const cardSizeRef = useRef(cardSize);
  cardSizeRef.current = cardSize;

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

  /** Live counts of cards per side, used for every budget decision. */
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

  /** Live pose of every tracked card, keyed by id. */
  const collectSamples = useCallback((): Record<string, BattleCardSample> => {
    const samples: Record<string, BattleCardSample> = {};
    for (const card of cardsRef.current) {
      if (!card.owner) continue;
      const live = liveTransforms.current.get(card.id);
      const position = live ? live.position : card.position;
      const euler = live ? live.rotation : card.rotation;
      samples[card.id] = {
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
    shotSnapshotRef.current = null;
    return patchLastShot(next, {
      knockedCards: knocked,
      collapseAfter: {
        A: next.sides.A.collapse.rate,
        B: next.sides.B.collapse.rate,
      },
    });
  }, [countKnocked]);

  /* ---------------- ticking ---------------- */
  useEffect(() => {
    if (!active) return;
    const interval = window.setInterval(() => {
      const current = stateRef.current;
      if (current.phase === 'idle' || current.phase === 'finished') return;

      // Delete / undo can remove cards behind the engine's back; keep the
      // tracked card list in sync with the scene before scoring collapse.
      const liveIds = new Set(cardsRef.current.map(card => card.id));
      const reconciled = reconcileCards(current, liveIds);

      const now = Date.now();
      // Wall-clock delta: background tabs throttle timers, and a fixed step
      // would make the match run in slow motion.
      const dt = lastTickAtRef.current > 0
        ? Math.min(600, Math.max(0, now - lastTickAtRef.current))
        : TICK_MS;
      lastTickAtRef.current = now;
      const samples = collectSamples();

      // Quiet-table detection for the resolve phase.
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

      const next = tick(reconciled, dt, now, { arena, samples, settled });
      if (next === current) return;
      if (reconciled.phase === 'resolve' && next.phase !== 'resolve') {
        commit(finaliseShot(next));
        return;
      }
      commit(next);
    }, TICK_MS);
    return () => window.clearInterval(interval);
  }, [active, arena, collectSamples, commit, finaliseShot, liveTransforms]);

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

  /** Validate a ghost pose before the card exists. */
  const validatePlacement = useCallback((
    position: [number, number, number],
    role: PlacementRole = pendingRoleRef.current,
    _rotation?: [number, number, number],
  ): PlacementVerdict => {
    const current = stateRef.current;
    const side = current.activeSide;
    const check = canPlace(current, side, role, usageRef.current[side]);
    if (!check.ok) {
      return { ok: false, reason: check.reason };
    }
    if (!isInsideZone(arena, side, position)) return { ok: false, reason: 'outside-zone' };
    return { ok: true };
  }, [arena]);

  /** Called after a battle card has been added to the scene. */
  const noteCardAdded = useCallback((card: CardData) => {
    const current = stateRef.current;
    let next = registerCard(current, card);
    if (current.phase === 'engineer' && card.owner === current.activeSide) {
      next = advancePhase(markEngineerActionUsed(next, current.activeSide), Date.now());
    }
    commit(next);
  }, [commit]);

  /** Batch variant used by whole-blueprint placement. */
  const noteCardsAdded = useCallback((added: CardData[]) => {
    if (added.length === 0) return;
    const current = stateRef.current;
    let next = current;
    added.forEach(card => { next = registerCard(next, card); });
    if (current.phase === 'engineer' && added[0]?.owner === current.activeSide) {
      next = advancePhase(markEngineerActionUsed(next, current.activeSide), Date.now());
    }
    commit(next);
  }, [commit]);

  const noteCardRemoved = useCallback((card: CardData) => {
    const current = stateRef.current;
    const liveIds = new Set(cardsRef.current.filter(item => item.id !== card.id).map(item => item.id));
    commit(reconcileCards(current, liveIds));
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
      collapseBefore: {
        A: current.sides.A.collapse.rate,
        B: current.sides.B.collapse.rate,
      },
      collapseAfter: {
        A: current.sides.A.collapse.rate,
        B: current.sides.B.collapse.rate,
      },
      at: Date.now(),
    };
    quietTicksRef.current = 0;
    resolveElapsedRef.current = 0;
    commit(recordShot(current, shot, Date.now()));
  }, [commit, snapshotPositions]);

  /* ---------------- blueprints ---------------- */

  /**
   * Validate placing a whole blueprint at once: every card has to land inside
   * the active side's zone and the structure budget has to cover all of them.
   */
  const validateBlueprint = useCallback((
    positions: [number, number, number][],
    side: BattleSide = stateRef.current.activeSide,
  ): PlacementVerdict => {
    const current = stateRef.current;
    if (side !== current.activeSide) return { ok: false, reason: 'not-your-turn' };
    const check = canPlace(current, side, 'structure', usageRef.current[side]);
    if (!check.ok) return { ok: false, reason: check.reason };
    if (positions.length === 0) return { ok: false, reason: 'wrong-phase' };
    if (!blueprintFits(arena, side, positions)) {
      const outside = positions.filter(position => !isInsideZone(arena, side, position)).length;
      return { ok: false, reason: 'outside-zone', count: outside };
    }
    const remaining = current.config.structureCards - usageRef.current[side].structure;
    if (positions.length > remaining) {
      return { ok: false, reason: 'budget', count: positions.length, remaining };
    }
    return { ok: true, count: positions.length, remaining };
  }, [arena]);

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
      collapse: { A: state.sides.A.collapse, B: state.sides.B.collapse },
      outcome: state.outcome,
      lastShot: state.lastShot,
      log: state.log.slice(-6).reverse(),
      shots: state.shots.length,
      trackedCards: state.cards.length,
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
    validateBlueprint,
    noteCardAdded,
    noteCardsAdded,
    noteCardRemoved,
    canLaunch,
    noteLaunch,
    skip,
    resign,
    cameraRequest,
    requestCamera,
  };
};
