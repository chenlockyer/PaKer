/**
 * Battle arena geometry and the placement rules that go with it.
 *
 * One standard symmetric arena: two build zones, a neutral buffer in the
 * middle and a core area at the back of each zone. Coordinates are in game
 * units where a Bridge card is 1.8 wide and 2.8 tall.
 */

import type { BattleArena, BattleArenaRect, BattleSide } from './types';

const STANDARD_ARENA: BattleArena = {
  id: 'standard',
  name: { zh: '标准竞技场', en: 'Standard Arena' },
  zones: {
    A: { minX: -7, maxX: 7, minZ: 1.6, maxZ: 8.6 },
    B: { minX: -7, maxX: 7, minZ: -8.6, maxZ: -1.6 },
  },
  coreAreas: {
    A: { minX: -3.5, maxX: 3.5, minZ: 5.6, maxZ: 8.6 },
    B: { minX: -3.5, maxX: 3.5, minZ: -8.6, maxZ: -5.6 },
  },
  buffer: { minX: -7, maxX: 7, minZ: -1.6, maxZ: 1.6 },
  camera: {
    position: [0, 19, 24],
    target: [0, 1, 0],
  },
  facing: { A: 'neg-z', B: 'pos-z' },
};

export const ARENAS: Record<string, BattleArena> = {
  [STANDARD_ARENA.id]: STANDARD_ARENA,
};

export const getArena = (arenaId: string): BattleArena =>
  ARENAS[arenaId] ?? STANDARD_ARENA;

export const pointInRect = (
  point: [number, number, number] | { x: number; z: number },
  rect: BattleArenaRect,
  margin = 0,
): boolean => {
  const x = Array.isArray(point) ? point[0] : point.x;
  const z = Array.isArray(point) ? point[2] : point.z;
  return x >= rect.minX - margin && x <= rect.maxX + margin &&
    z >= rect.minZ - margin && z <= rect.maxZ + margin;
};

export const rectCenter = (rect: BattleArenaRect): [number, number] => [
  (rect.minX + rect.maxX) / 2,
  (rect.minZ + rect.maxZ) / 2,
];

export const rectSize = (rect: BattleArenaRect): [number, number] => [
  rect.maxX - rect.minX,
  rect.maxZ - rect.minZ,
];

/** Structure and ammo cards may only be placed inside the owner's zone. */
export const isInsideZone = (
  arena: BattleArena,
  side: BattleSide,
  position: [number, number, number],
) => pointInRect(position, arena.zones[side]);

/** The core card must sit inside the core area of its owner. */
export const isInsideCoreArea = (
  arena: BattleArena,
  side: BattleSide,
  position: [number, number, number],
) => pointInRect(position, arena.coreAreas[side]);

/** The core must never be inside the neutral buffer either. */
export const isInBuffer = (
  arena: BattleArena,
  position: [number, number, number],
) => pointInRect(position, arena.buffer, -0.2);

export const isCoreLegal = (
  arena: BattleArena,
  side: BattleSide,
  position: [number, number, number],
) => isInsideCoreArea(arena, side, position) && !isInBuffer(arena, position);

export const defaultCoreSpot = (
  arena: BattleArena,
  side: BattleSide,
): [number, number, number] => {
  const [centerX, centerZ] = rectCenter(arena.coreAreas[side]);
  return [centerX, 1.45, centerZ];
};

/** Where a side's camera looks when the HUD asks to frame a player. */
export const sideCamera = (
  arena: BattleArena,
  side: BattleSide,
  view: 'global' | 'mine' | 'theirs' = 'global',
): { position: [number, number, number]; target: [number, number, number] } => {
  if (view === 'global') return arena.camera;
  // Side A builds on the +Z half, side B on the -Z half.
  const outward = side === 'A' ? 1 : -1;
  const [ownX, ownZ] = rectCenter(arena.zones[side]);
  if (view === 'mine') {
    return {
      position: [ownX + 1.5, 11, ownZ + outward * 13],
      target: [ownX, 1.2, ownZ],
    };
  }
  const opponent: BattleSide = side === 'A' ? 'B' : 'A';
  const [otherX, otherZ] = rectCenter(arena.zones[opponent]);
  return {
    position: [otherX - 2, 10, otherZ + outward * 13],
    target: [otherX, 1.2, otherZ],
  };
};
