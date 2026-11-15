/**
 * Battle arena geometry and the placement rules that go with it.
 *
 * One standard symmetric arena measured in ground grid cells: each side builds
 * inside a 15 × 15 cell square, and the neutral no-build band between the two
 * zones is another 15 cells. A cell is the visible floor grid, 0.9 world units,
 * so one side is 13.5 × 13.5 and the gap between them is 13.5.
 */

import type { BattleArena, BattleArenaRect, BattleSide } from './types';

/** Ground grid cell used by the renderer (`CARD_DIMENSIONS.width / 2`). */
export const GRID_CELL = 0.9;
export const ZONE_CELLS = 15;
export const BUFFER_CELLS = 15;

const HALF = (ZONE_CELLS * GRID_CELL) / 2;
const HALF_BUFFER = (BUFFER_CELLS * GRID_CELL) / 2;

const STANDARD_ARENA: BattleArena = {
  id: 'standard',
  name: { zh: '标准竞技场', en: 'Standard Arena' },
  cell: GRID_CELL,
  zones: {
    A: { minX: -HALF, maxX: HALF, minZ: HALF_BUFFER, maxZ: HALF_BUFFER + ZONE_CELLS * GRID_CELL },
    B: { minX: -HALF, maxX: HALF, minZ: -HALF_BUFFER - ZONE_CELLS * GRID_CELL, maxZ: -HALF_BUFFER },
  },
  buffer: { minX: -HALF, maxX: HALF, minZ: -HALF_BUFFER, maxZ: HALF_BUFFER },
  camera: {
    position: [0, 30, 38],
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

/** Nothing may be built inside the neutral band between both sides. */
export const isInBuffer = (
  arena: BattleArena,
  position: [number, number, number],
) => pointInRect(position, arena.buffer, -0.2);

/** The area a side is allowed to build in, as a rect (used by the HUD). */
export const zoneOf = (arena: BattleArena, side: BattleSide) => arena.zones[side];

/**
 * Where a side's camera looks when the HUD asks to frame a player.
 *
 * `mine` is the default fighting view: stand behind your own house and look
 * across the table at the opponent, so your zone fills the lower third, the
 * neutral band the middle and the enemy's house the upper third. `theirs`
 * pushes up to the front edge of your own zone for a close look at the target.
 */
export const sideCamera = (
  arena: BattleArena,
  side: BattleSide,
  view: 'global' | 'mine' | 'theirs' = 'mine',
): { position: [number, number, number]; target: [number, number, number] } => {
  if (view === 'global') return arena.camera;
  // Side A builds on the +Z half, side B on the -Z half.
  const outward = side === 'A' ? 1 : -1;
  const opponent: BattleSide = side === 'A' ? 'B' : 'A';
  const [ownX, ownZ] = rectCenter(arena.zones[side]);
  const [otherX, otherZ] = rectCenter(arena.zones[opponent]);

  if (view === 'mine') {
    // Over the shoulder, facing the enemy. These numbers are tuned so both
    // 13.5 × 13.5 zones fit in a 45° frame: own zone in the lower third, the
    // enemy's in the upper third, with the neutral band between them.
    return {
      position: [ownX + outward * 2, 36, ownZ + outward * 28],
      target: [0, 1.5, -outward * 2],
    };
  }

  // Target view: from the front edge of the own zone, straight at the enemy.
  return {
    position: [ownX + outward * 2, 16, ownZ - outward * 5.5],
    target: [otherX, 2, otherZ],
  };
};
