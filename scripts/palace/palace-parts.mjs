/**
 * Original palace vocabulary for PaKer cards.
 *
 * The campaign builds everything from one block ("two pairs + a deck"). A palace
 * needs a different language, so this module invents it from the two card
 * formats the game has:
 *
 *   高格 (tall)  short edge on the floor, 2.8 high  → piers, gate jambs
 *   低格 (low)   long edge on the floor, 1.8 high   → podium posts, upper walls
 *
 * A lone vertical card cannot stand, so every vertical element is a *pair* with a
 * chosen tilt: 4–6° reads as a solid pier or wall panel, 12–16° reads as a tent.
 * Flat cards (planks) become beams, floors, eaves and steps.
 *
 * Four devices carry the palace look and none of them exists in the campaign:
 *
 *   terrace     a pier grid carrying two crossed plank layers — a raised podium
 *   post/lintel piers with planks spanning the gaps and cross beams on top
 *   wall ring   low pairs standing on the beam plane, capped by eave planks
 *   double eave two sizes of wall ring with planks between them — 重檐
 *
 * Builders return `{ cards, topY }`; `topY` is the height the load bearing edge
 * reaches, so the next layer stacks without magic numbers.
 */

import { TARGET_GAP } from '../level-factory/lib/blocks.mjs';
import { CARD_SIZES, cardAtCenter, structureBounds } from '../level-factory/lib/cards.mjs';
import { cross, normalize } from '../level-factory/lib/math.mjs';

const SIZE = CARD_SIZES.BRIDGE;
const HALF_WIDTH = SIZE.width / 2;
const HALF_HEIGHT = SIZE.height / 2;
const HALF_THICKNESS = SIZE.thickness / 2;
const DEG = Math.PI / 180;

/** Card dimensions of the two formats: what stands on the floor is the height. */
export const FORM = {
  tall: { height: SIZE.height, width: SIZE.width },
  low: { height: SIZE.width, width: SIZE.height },
};

const round = (value, digits = 6) => Number(value.toFixed(digits));

/* ------------------------------------------------------------------ */
/* Atoms                                                               */
/* ------------------------------------------------------------------ */

/**
 * Two cards leaning towards each other with their tops pressed together.
 *
 * `leanAxis` is the direction the cards lean along; the pair's own width runs
 * perpendicular to it, which is what makes a row of pairs read as a wall.
 */
export const vPair = ({
  prefix,
  x = 0,
  z = 0,
  surfaceY = 0,
  kind = 'tall',
  tilt = 10,
  leanAxis = [1, 0],
  gap = TARGET_GAP,
}) => {
  const angle = tilt * DEG;
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const lean = normalize([leanAxis[0], 0, leanAxis[1]]);
  const ridge = [-lean[2], 0, lean[0]];
  const isTall = kind === 'tall';
  const height = FORM[kind].height;
  const reach = height / 2;

  const build = extra => [1, -1].map(side => {
    const upLean = [lean[0] * side * sin, cos, lean[2] * side * sin];
    const heightDir = isTall ? upLean : ridge;
    const widthDir = isTall ? ridge : upLean;
    const centre = [
      x - heightDir[0] * reach - lean[0] * side * extra,
      -heightDir[1] * reach,
      z - heightDir[2] * reach - lean[2] * side * extra,
    ];
    return cardAtCenter({
      id: `${prefix}_${side === 1 ? 'a' : 'b'}`,
      center: centre,
      heightDir,
      normal: normalize(cross(heightDir, widthDir)),
    });
  });

  // Nudge the pair apart until the two boxes clear, then sit it on `surfaceY`.
  const pairGap = cards => cardGap(cards[0], cards[1]);
  let extra = 0;
  if (pairGap(build(0)) < gap) {
    let low = 0;
    let high = 0.4;
    for (let iteration = 0; iteration < 40; iteration += 1) {
      const middle = (low + high) / 2;
      if (pairGap(build(middle)) < gap) low = middle;
      else high = middle;
    }
    extra = high;
  }
  const cards = build(extra);
  const lowest = structureBounds(cards).min[1];
  const lift = surfaceY + gap - lowest;
  const lifted = cards.map(card => ({
    ...card,
    position: [
      round(card.position[0]),
      round(card.position[1] + lift),
      round(card.position[2]),
    ],
  }));
  return {
    cards: lifted,
    topY: round(surfaceY + gap + height * cos),
    apex: [x, round(surfaceY + gap + height * cos), z],
  };
};

/** Largest separation between two oriented boxes (proper SAT margin). */
export const cardGap = (left, right) => {
  const axesOf = card => [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(axis => rotateVector(card.quaternion, axis));
  const leftAxes = axesOf(left);
  const rightAxes = axesOf(right);
  const leftHalf = [HALF_WIDTH, HALF_THICKNESS, HALF_HEIGHT];
  const rightHalf = leftHalf;
  const delta = [
    right.position[0] - left.position[0],
    right.position[1] - left.position[1],
    right.position[2] - left.position[2],
  ];
  const axes = [...leftAxes, ...rightAxes];
  for (const a of leftAxes) {
    for (const b of rightAxes) {
      const candidate = cross(a, b);
      if (Math.hypot(...candidate) > 1e-6) axes.push(normalize(candidate));
    }
  }
  let largest = -Infinity;
  for (const axis of axes) {
    const distance = Math.abs(delta[0] * axis[0] + delta[1] * axis[1] + delta[2] * axis[2]);
    const radius = (half, axesIn) => Math.abs(axesIn[0][0] * axis[0] + axesIn[0][1] * axis[1] + axesIn[0][2] * axis[2]) * half[0]
      + Math.abs(axesIn[1][0] * axis[0] + axesIn[1][1] * axis[1] + axesIn[1][2] * axis[2]) * half[1]
      + Math.abs(axesIn[2][0] * axis[0] + axesIn[2][1] * axis[1] + axesIn[2][2] * axis[2]) * half[2];
    largest = Math.max(largest, distance - radius(leftHalf, leftAxes) - radius(rightHalf, rightAxes));
  }
  return largest;
};

const rotateVector = (quaternion, vector) => {
  const [x, y, z, w] = quaternion;
  const ix = w * vector[0] + y * vector[2] - z * vector[1];
  const iy = w * vector[1] + z * vector[0] - x * vector[2];
  const iz = w * vector[2] + x * vector[1] - y * vector[0];
  const iw = -x * vector[0] - y * vector[1] - z * vector[2];
  return [
    ix * w + iw * -x + iy * -z - iz * -y,
    iy * w + iw * -y + iz * -x - ix * -z,
    iz * w + iw * -z + ix * -y - iy * -x,
  ];
};

/** A flat card: floor, beam, eave, step. `axis` is its 2.8 length direction. */
export const plank = ({ id, x = 0, z = 0, bottomY, axis = [1, 0] }) => cardAtCenter({
  id,
  center: [x, bottomY + HALF_THICKNESS, z],
  heightDir: [axis[0], 0, axis[1]],
  normal: [0, 1, 0],
});

/* ------------------------------------------------------------------ */
/* Palace elements                                                     */
/* ------------------------------------------------------------------ */

/**
 * Terrace: a grid of low pairs acting as posts, two crossed plank layers on top.
 * The result is a raised podium you can see through — the stone platform every
 * palace hall sits on.
 */
export const terrace = ({
  prefix,
  center = [0, 0],
  width,
  depth,
  kind = 'low',
  tilt = 5,
  spacing = 2.2,
}) => {
  const [cx, cz] = center;
  const columns = Math.max(2, Math.round(width / spacing) + 1);
  const rows = Math.max(2, Math.round(depth / spacing) + 1);
  const cards = [];
  let topY = 0;
  for (let row = 0; row < rows; row += 1) {
    const z = cz - depth / 2 + (row * depth) / (rows - 1);
    for (let column = 0; column < columns; column += 1) {
      const x = cx - width / 2 + (column * width) / (columns - 1);
      const result = vPair({
        prefix: `${prefix}_post${row}_${column}`,
        x,
        z,
        surfaceY: 0,
        kind,
        tilt,
        leanAxis: row % 2 === 0 ? [0, 1] : [1, 0],
      });
      cards.push(...result.cards);
      topY = Math.max(topY, result.topY);
    }
  }

  // Lower layer: planks along x, resting on the post apexes.
  let order = 0;
  const lowerPitch = SIZE.width * 0.98;
  const lowerRows = Math.max(1, Math.round(depth / lowerPitch));
  for (let row = 0; row < lowerRows; row += 1) {
    const z = cz - depth / 2 + (row + 0.5) * (depth / lowerRows);
    const count = Math.max(1, Math.round(width / SIZE.height));
    for (let column = 0; column < count; column += 1) {
      const x = cx - width / 2 - 0.2 + (column + 0.5) * ((width + 0.4) / count);
      cards.push(plank({
        id: `${prefix}_floor${order += 1}`,
        x,
        z,
        bottomY: topY + TARGET_GAP,
        axis: [0, 1],
      }));
    }
  }
  const lowerTop = topY + TARGET_GAP + SIZE.thickness;

  // Upper layer: planks along z, closing the floor.
  const upperPitch = SIZE.height * 0.98;
  const upperColumns = Math.max(1, Math.round(width / upperPitch));
  for (let column = 0; column < upperColumns; column += 1) {
    const x = cx - width / 2 + (column + 0.5) * (width / upperColumns);
    const count = Math.max(1, Math.round(depth / SIZE.width));
    for (let row = 0; row < count; row += 1) {
      const z = cz - depth / 2 - 0.2 + (row + 0.5) * ((depth + 0.4) / count);
      cards.push(plank({
        id: `${prefix}_deck${order += 1}`,
        x,
        z,
        bottomY: lowerTop + TARGET_GAP,
        axis: [1, 0],
      }));
    }
  }

  return {
    cards,
    topY: lowerTop + TARGET_GAP + SIZE.thickness,
  };
};

/**
 * Post-and-lintel hall frame: tall piers on a grid, planks spanning the gaps,
 * cross beams on top. The body and roof stand on this.
 */
export const pierFrame = ({
  prefix,
  center = [0, 0],
  columns = 4,
  rows = 2,
  span = 2.2,
  kind = 'tall',
  tilt = 5,
  surfaceY = 0,
  beamAxis = 'x',
}) => {
  const [cx, cz] = center;
  const columnXs = Array.from({ length: columns }, (_, index) => cx + (index - (columns - 1) / 2) * span);
  const rowZs = Array.from({ length: rows }, (_, index) => cz + (index - (rows - 1) / 2) * span);

  const cards = [];
  let topY = surfaceY;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const result = vPair({
        prefix: `${prefix}_pier${row}${column}`,
        x: columnXs[column],
        z: rowZs[row],
        surfaceY,
        kind,
        tilt,
        leanAxis: [1, 0],
      });
      cards.push(...result.cards);
      topY = Math.max(topY, result.topY);
    }
  }

  let order = 0;
  // Beams along x, one per gap between piers.
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      cards.push(plank({
        id: `${prefix}_beam${order += 1}`,
        x: (columnXs[column] + columnXs[column + 1]) / 2,
        z: rowZs[row],
        bottomY: topY + TARGET_GAP,
        axis: [1, 0],
      }));
    }
  }
  const beamTop = topY + TARGET_GAP + SIZE.thickness;

  // Cross beams along z on top of them.
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows - 1; row += 1) {
      cards.push(plank({
        id: `${prefix}_cross${order += 1}`,
        x: columnXs[column],
        z: (rowZs[row] + rowZs[row + 1]) / 2,
        bottomY: beamTop + TARGET_GAP,
        axis: [0, 1],
      }));
    }
  }

  return {
    cards,
    topY: beamTop + TARGET_GAP + SIZE.thickness,
    /** Where the piers stand, so the body can be aligned to them. */
    columnXs,
    rowZs,
  };
};

/**
 * Wall ring of low pairs standing on a surface, optionally capped by planks.
 * This is the hall body and, one size smaller, the second roof tier.
 */
export const wallRing = ({
  prefix,
  center = [0, 0],
  width,
  depth,
  surfaceY,
  kind = 'low',
  tilt = 7,
  spacing = 1.8,
  cap = false,
  capOverhang = 0.3,
  capAxis = 'x',
}) => {
  const [cx, cz] = center;
  const cards = [];
  let topY = surfaceY;
  const alongX = Math.max(1, Math.round(width / spacing));
  for (let index = 0; index < alongX; index += 1) {
    const x = cx - width / 2 + (index + 0.5) * (width / alongX);
    for (const side of [1, -1]) {
      const result = vPair({
        prefix: `${prefix}_x${index}${side > 0 ? 'f' : 'b'}`,
        x,
        z: cz + side * depth / 2,
        surfaceY,
        kind,
        tilt,
        leanAxis: [0, 1],
      });
      cards.push(...result.cards);
      topY = Math.max(topY, result.topY);
    }
  }
  const alongZ = Math.max(1, Math.round(depth / spacing));
  for (let index = 0; index < alongZ; index += 1) {
    const z = cz - depth / 2 + (index + 0.5) * (depth / alongZ);
    for (const side of [1, -1]) {
      const result = vPair({
        prefix: `${prefix}_z${index}${side > 0 ? 'l' : 'r'}`,
        x: cx + side * width / 2,
        z,
        surfaceY,
        kind,
        tilt,
        leanAxis: [1, 0],
      });
      cards.push(...result.cards);
      topY = Math.max(topY, result.topY);
    }
  }

  if (!cap) return { cards, topY };

  const caps = [];
  let order = 0;
  const capWidth = width + capOverhang * 2;
  const capDepth = depth + capOverhang * 2;
  const rows = Math.max(1, Math.round(capDepth / SIZE.width));
  for (let row = 0; row < rows; row += 1) {
    const z = cz - capDepth / 2 + (row + 0.5) * (capDepth / rows);
    const count = Math.max(1, Math.round(capWidth / SIZE.height));
    for (let column = 0; column < count; column += 1) {
      const x = cx - capWidth / 2 + (column + 0.5) * (capWidth / count);
      caps.push(plank({
        id: `${prefix}_cap${order += 1}`,
        x,
        z,
        bottomY: topY + TARGET_GAP,
        axis: capAxis === 'x' ? [1, 0] : [0, 1],
      }));
    }
  }
  return { cards: [...cards, ...caps], topY: topY + TARGET_GAP + SIZE.thickness };
};

/**
 * 宫门 / gate tower: two tall jambs, a lintel across them, then two planks laid
 * the other way as a wider cap (a gate roof) and a ridge on top.
 *
 * A corbelled lintel needs planks longer than the opening, and cards are only
 * 2.8 long, so the opening has to stay narrow — this is a gate, not a tunnel.
 */
export const gateTower = ({
  prefix,
  center = [0, 0],
  opening = 2.5,
  surfaceY = 0,
  tilt = 4,
}) => {
  const [cx, cz] = center;
  const cards = [];
  let jambTop = surfaceY;
  for (const side of [1, -1]) {
    const result = vPair({
      prefix: `${prefix}_jamb${side > 0 ? 'r' : 'l'}`,
      x: cx + side * (opening / 2),
      z: cz,
      surfaceY,
      kind: 'tall',
      tilt,
      leanAxis: [1, 0],
    });
    cards.push(...result.cards);
    jambTop = Math.max(jambTop, result.topY);
  }

  // Lintel: one card spanning both jambs (2.8 long, jambs 2.5 apart).
  const lintelY = jambTop + TARGET_GAP;
  cards.push(plank({ id: `${prefix}_lintel`, x: cx, z: cz, bottomY: lintelY, axis: [1, 0] }));
  const lintelTop = lintelY + SIZE.thickness;

  // Cap: two planks the other way round, overhanging the jambs — the gate roof.
  const capY = lintelTop + TARGET_GAP;
  for (const offset of [-0.91, 0.91]) {
    cards.push(plank({
      id: `${prefix}_cap${offset}`,
      x: cx + offset,
      z: cz,
      bottomY: capY,
      axis: [0, 1],
    }));
  }
  const capTop = capY + SIZE.thickness;

  // Ridge.
  cards.push(plank({ id: `${prefix}_ridge`, x: cx, z: cz, bottomY: capTop + TARGET_GAP, axis: [1, 0] }));

  return { cards, topY: capTop + TARGET_GAP + SIZE.thickness, jambTop };
};

/** Stair ramp: planks lying on a slope, foot on the floor, head on the terrace. */
export const stairRamp = ({
  prefix,
  center = [0, 0],
  topY,
  width = 1.9,
  planks = 2,
}) => {
  const [cx, cz] = center;
  const length = SIZE.height;
  const rise = Math.min(topY, length * 0.92);
  const run = Math.sqrt(Math.max(0.01, length * length - rise * rise));
  const heightDir = normalize([0, rise, -run]);
  const normal = normalize(cross(heightDir, [1, 0, 0]));
  const cards = [];
  for (let index = 0; index < planks; index += 1) {
    const offset = (index - (planks - 1) / 2) * width;
    cards.push(cardAtCenter({
      id: `${prefix}_${index + 1}`,
      center: [cx + offset, rise / 2 + HALF_THICKNESS, cz + run / 2],
      heightDir,
      normal,
    }));
  }
  return { cards };
};
