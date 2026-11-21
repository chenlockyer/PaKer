/**
 * The "纸牌宫殿" (Paper Palace) — a courtyard palace built from the campaign's
 * verified blocks.
 *
 * Every unit is one of the campaign's proven structures, so each of them is
 * stable on its own; the palace is a composition, and the units are spaced so
 * that no two of them touch. That keeps the whole thing standing without any
 * hidden bracing, which matters because the save is re-loaded into the same
 * Rapier world and simulated again.
 *
 * Plan (x right, +z is the front of the palace, i.e. where the player stands):
 *
 *   z = -7.4                     [后殿 rear hall, crowned]
 *   z =  0.0        [左配殿]         [主殿 main hall]         [右配殿]
 *   z = +4.2                  [前廊 colonnade, 4 pairs]
 *   z = +8.0                      [宫门 gate]
 *
 * Every block ends on a flat deck, so each tower carries a crown — a three-card
 * tripod on the main hall, an A-frame pair on the wings — to give the palace a
 * pitched skyline instead of five flat boxes.
 *
 * Usage:  node scripts/palace/palace-structure.mjs   (prints a summary)
 */

import { TARGET_GAP, pair, storey, wall, shiftAll } from '../level-factory/lib/blocks.mjs';
import { portico, tripod } from '../level-factory/structures.mjs';
import {
  CARD_SIZES,
  structureBounds,
} from '../level-factory/lib/cards.mjs';
import { cross, dot, length, normalize, roundTuple, rotate, sub } from '../level-factory/lib/math.mjs';

const SUITS = ['spades', 'hearts', 'clubs', 'diamonds'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const SIZE = CARD_SIZES.BRIDGE;

const boundsOf = cards => structureBounds(cards);

/* ------------------------------------------------------------------ */
/* Separation between two cards                                         */
/* ------------------------------------------------------------------ */

const AXES = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

const cardAxes = card => AXES.map(axis => rotate(card.quaternion, axis));

const projectRadius = (half, axes, axis) =>
  Math.abs(dot(axes[0], axis)) * half[0] +
  Math.abs(dot(axes[1], axis)) * half[1] +
  Math.abs(dot(axes[2], axis)) * half[2];

/**
 * Signed separation of two oriented card boxes: the largest gap over every
 * separating axis. Positive means the boxes are apart by that distance,
 * negative means they interpenetrate.
 *
 * (`boxGap` in the level factory returns the *first* positive axis instead of
 * the largest one, which under-reports the clearance between distant cards, so
 * the palace uses this variant to report real margins.)
 */
export const cardSeparation = (left, right) => {
  const leftAxes = cardAxes(left);
  const rightAxes = cardAxes(right);
  const leftHalf = [left.dimensions.width / 2, left.dimensions.thickness / 2, left.dimensions.height / 2];
  const rightHalf = [right.dimensions.width / 2, right.dimensions.thickness / 2, right.dimensions.height / 2];
  const delta = sub(right.position, left.position);
  const axes = [...leftAxes, ...rightAxes];
  for (const leftAxis of leftAxes) {
    for (const rightAxis of rightAxes) {
      const candidate = cross(leftAxis, rightAxis);
      if (length(candidate) > 1e-6) axes.push(normalize(candidate));
    }
  }
  let largest = -Infinity;
  for (const axis of axes) {
    const distance = Math.abs(dot(delta, axis));
    const reach = projectRadius(leftHalf, leftAxes, axis) + projectRadius(rightHalf, rightAxes, axis);
    largest = Math.max(largest, distance - reach);
  }
  return largest;
};

const clearances = cards => {
  let min = Infinity;
  const overlaps = [];
  for (let left = 0; left < cards.length; left += 1) {
    for (let right = left + 1; right < cards.length; right += 1) {
      const gap = cardSeparation(cards[left], cards[right]);
      if (gap < min) min = gap;
      if (gap < 0.0006) overlaps.push({ left: cards[left].id, right: cards[right].id, gap: Number(gap.toFixed(5)) });
    }
  }
  return { min, overlaps };
};

const sizeOf = cards => {
  const bounds = boundsOf(cards);
  return {
    width: bounds.max[0] - bounds.min[0],
    depth: bounds.max[2] - bounds.min[2],
    height: bounds.max[1] - bounds.min[1],
  };
};

const moved = (cards, dx, dz) => shiftAll(cards, [dx, 0, dz]);

/** Drop a card set onto a surface so its lowest corner rests on `surfaceY`. */
const sitOn = (cards, surfaceY, gap = TARGET_GAP) => {
  const bounds = structureBounds(cards);
  const lift = surfaceY + gap - bounds.min[1];
  return shiftAll(cards, [0, lift, 0]);
};

/**
 * A tower built storey by storey so each floor's deck height is known — the
 * gallery bridges have to land exactly on those decks.
 */
const towerLevels = ({ prefix, storeys, spacing = 0.62 }) => {
  const cards = [];
  const levels = [];
  let surfaceY = 0;
  for (let index = 0; index < storeys; index += 1) {
    const leanAxis = index % 2 === 1 ? [0, 1] : [1, 0];
    const result = storey({
      prefix: `${prefix}_s${index + 1}`,
      center: [0, 0],
      surfaceY,
      spacing,
      leanAxis,
      step: `s${index + 1}`,
    });
    cards.push(...result.cards);
    levels.push(result.deckTop);
    surfaceY = result.deckTop + TARGET_GAP;
  }
  return { cards, levels, deckTop: levels[levels.length - 1] };
};

/**
 * A tower plus a crown on top: `tower` always ends on a flat deck, and a
 * pointed crown turns that flat box into a palace spire.
 */
const crownedTower = ({ prefix, storeys, crown }) => {
  const body = towerLevels({ prefix, storeys });
  const top = crown === 'tripod'
    ? sitOn(tripod({ prefix: `${prefix}_crown`, tilt: 14 }).cards, body.deckTop)
    : pair({
      prefix: `${prefix}_crown`,
      apex: [0, 0],
      surfaceY: body.deckTop + TARGET_GAP,
      step: `${prefix}_crown`,
    });
  return {
    cards: [...body.cards, ...top],
    levels: body.levels,
    deckTop: body.deckTop,
  };
};

/** Build the units at the origin, then lay them out along the palace axis. */
export const buildPalace = ({ gap = 2.2, wingGap = 1.0 } = {}) => {
  const hall = crownedTower({ prefix: 'palace_hall', storeys: 3, crown: 'pair' });
  const leftWing = crownedTower({ prefix: 'palace_left', storeys: 2, crown: 'pair' });
  const rightWing = crownedTower({ prefix: 'palace_right', storeys: 2, crown: 'pair' });
  const rearHall = crownedTower({ prefix: 'palace_rear', storeys: 2, crown: 'pair' });
  // A row of A-frames across the front: each pair leans along z so the viewer
  // sees the inverted V face on, and the row marches along x.
  const colonnade = wall({ prefix: 'palace_col', count: 4, spacing: 1.9, leanAxis: [0, 1] });
  const gate = portico({ prefix: 'palace_gate', span: 2.6 });

  const hallSize = sizeOf(hall.cards);
  const wingSize = sizeOf(leftWing.cards);
  const rearSize = sizeOf(rearHall.cards);
  const colonnadeSize = sizeOf(colonnade);
  const gateSize = sizeOf(gate.cards);

  // The wings are only a gallery apart from the hall, and gallery decks bridge
  // the gap on every shared floor — that is what turns three towers into one
  // palace body.
  const wingX = hallSize.width / 2 + wingSize.width / 2 + wingGap;
  // Rear hall sits behind the hall, colonnade and gate in front of it.
  const rearZ = -(hallSize.depth / 2) - rearSize.depth / 2 - gap * 1.4;
  const colonnadeZ = hallSize.depth / 2 + gap * 1.2 + colonnadeSize.depth / 2;
  const gateZ = colonnadeZ + colonnadeSize.depth / 2 + gateSize.depth / 2 + gap * 1.4;

  /* ---------------------------------------------------------------- */
  /* Enclosure: a walled courtyard is what makes it read as a palace.   */
  /* ---------------------------------------------------------------- */
  const courtyardHalfWidth = wingX + wingSize.width / 2 + gap * 1.6;
  const courtyardHalfDepth = Math.abs(rearZ) + rearSize.depth / 2 + gap * 1.6;
  // Walls are rows of independent A-frames: pairs leaning along the wall's
  // normal, marching along its length.
  const backWall = moved(
    wall({ prefix: 'palace_wall_back', count: 8, spacing: 1.9, leanAxis: [0, 1] }),
    0,
    -courtyardHalfDepth,
  );
  const leftWall = moved(
    wall({ prefix: 'palace_wall_left', count: 8, spacing: 1.9, leanAxis: [1, 0] }),
    -courtyardHalfWidth,
    0,
  );
  const rightWall = moved(
    wall({ prefix: 'palace_wall_right', count: 8, spacing: 1.9, leanAxis: [1, 0] }),
    courtyardHalfWidth,
    0,
  );
  // The front wall opens in the middle for the gate.
  const frontZ = gateZ + gateSize.depth / 2 + gap * 1.2;
  const frontLeft = moved(
    wall({ prefix: 'palace_wall_front_left', count: 3, spacing: 1.9, leanAxis: [0, 1] }),
    -(gateSize.width / 2 + gap + 2.5),
    frontZ,
  );
  const frontRight = moved(
    wall({ prefix: 'palace_wall_front_right', count: 3, spacing: 1.9, leanAxis: [0, 1] }),
    gateSize.width / 2 + gap + 2.5,
    frontZ,
  );

  const units = [
    { name: '主殿', cards: hall.cards, x: 0, z: 0 },
    { name: '左配殿', cards: leftWing.cards, x: -wingX, z: 0 },
    { name: '右配殿', cards: rightWing.cards, x: wingX, z: 0 },
    { name: '后殿', cards: rearHall.cards, x: 0, z: rearZ },
    { name: '前廊', cards: colonnade, x: 0, z: colonnadeZ },
    { name: '宫门', cards: gate.cards, x: 0, z: gateZ },
    { name: '后墙', cards: backWall, x: 0, z: 0 },
    { name: '左墙', cards: leftWall, x: 0, z: 0 },
    { name: '右墙', cards: rightWall, x: 0, z: 0 },
    { name: '前墙左段', cards: frontLeft, x: 0, z: 0 },
    { name: '前墙右段', cards: frontRight, x: 0, z: 0 },
  ].map(slot => ({
    ...slot,
    cards: moved(slot.cards, slot.x, slot.z),
  }));

  return {
    units: units.map(slot => ({ name: slot.name, cards: slot.cards })),
    cards: units.flatMap(slot => slot.cards),
    sizes: { hall: hallSize, wing: wingSize, rear: rearSize, colonnade: colonnadeSize, gate: gateSize },
  };
};

/** Give every card a face so the palace does not look like a wall of blanks. */
const decorate = cards => cards.map((card, index) => ({
  ...card,
  suit: SUITS[index % SUITS.length],
  rank: RANKS[(index * 3) % RANKS.length],
  color: index % 2 === 0 ? 'black' : 'red',
  id: `palace_${String(index + 1).padStart(3, '0')}`,
}));

export const buildPalaceCards = ({ gap } = {}) => {
  const palace = buildPalace({ gap });
  const cards = decorate(palace.cards);
  const bounds = boundsOf(cards);
  // Sit the palace on y = 0 and centre it on the origin.
  const centre = [
    (bounds.min[0] + bounds.max[0]) / 2,
    bounds.min[1],
    (bounds.min[2] + bounds.max[2]) / 2,
  ];
  const settled = cards.map(card => ({
    ...card,
    position: roundTuple([
      card.position[0] - centre[0],
      card.position[1] - centre[1],
      card.position[2] - centre[2],
    ], 6),
  }));
  const { min, overlaps } = clearances(settled);
  return {
    cards: settled,
    units: palace.units.map(slot => slot.name),
    sizes: palace.sizes,
    bounds: boundsOf(settled),
    minGap: min,
    overlaps,
    size: SIZE,
  };
};

/* ------------------------------------------------------------------ */
/* CLI summary                                                         */
/* ------------------------------------------------------------------ */

const isMain = () => process.argv[1] && process.argv[1].endsWith('palace-structure.mjs');

if (isMain()) {
  const palace = buildPalaceCards();
  const { bounds, minGap, overlaps, cards, units, sizes } = palace;
  const span = axis => (bounds.max[axis] - bounds.min[axis]).toFixed(2);
  console.log(`纸牌宫殿 · ${cards.length} 张牌`);
  console.log(`  单元：${units.join(' / ')}`);
  for (const [name, size] of Object.entries(sizes)) {
    console.log(`    ${name}: ${size.width.toFixed(2)} × ${size.depth.toFixed(2)} × ${size.height.toFixed(2)}`);
  }
  console.log(`  总体：${span(0)} × ${span(2)} × ${span(1)}（长 × 深 × 高）`);
  console.log(`  最小牌间间隙：${minGap.toFixed(4)} m`);
  console.log(`  互相穿模：${overlaps.length === 0 ? '无' : `${overlaps.length} 处`}`);
  if (overlaps.length > 0) console.log(overlaps.slice(0, 10));
}
