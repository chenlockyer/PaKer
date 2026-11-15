/**
 * Reusable structural blocks for generated PaKer levels.
 *
 * Every structure is built from two primitives — the leaning pair (a two card
 * A-frame) and the flat deck card — and each block keeps a 1–2 mm clearance so
 * generated geometry never starts interpenetrating.
 *
 * Two pair kinds exist, matching the in-game placement presets:
 *   tall  short edge on the floor, 2.8 high  → short_edge_*_10 presets
 *   low   long edge on the floor, 1.8 high   → long_edge_*_10 presets
 *
 * Every card carries a `step` label so the level factory can turn the same
 * geometry into ordered blueprint steps without a second source of truth.
 */

import { DEG, add, boxGap, cross, normalize } from './math.mjs';
import { CARD_SIZES, cardAtCenter, structureBounds } from './cards.mjs';

export const TILT_DEGREES = 10;
export const TILT = TILT_DEGREES * DEG;
export const TARGET_GAP = 0.0012;

const SIZE = CARD_SIZES.BRIDGE;
const HALF_HEIGHT = SIZE.height / 2;
const HALF_WIDTH = SIZE.width / 2;

export const PRESET = {
  tallPair: 'short_edge_forward_10',
  tallPairAlt: 'short_edge_backward_10',
  lowPair: 'long_edge_left_10',
  lowPairAlt: 'long_edge_right_10',
  deck: 'flat_landscape',
};

const pairGeometry = ({ apex, leanAxis, tilt, kind, extra }) => {
  const sin = Math.sin(tilt);
  const cos = Math.cos(tilt);
  const ridge = [-leanAxis[1], 0, leanAxis[0]];
  return [1, -1].map(side => {
    const upLean = [leanAxis[0] * side * sin, cos, leanAxis[1] * side * sin];
    const isLow = kind === 'low';
    const widthDir = isLow ? upLean : ridge;
    const heightDir = isLow ? ridge : upLean;
    const reachDir = isLow ? widthDir : heightDir;
    const reach = isLow ? HALF_WIDTH : HALF_HEIGHT;
    return {
      side,
      widthDir,
      heightDir,
      normalDir: normalize(cross(heightDir, widthDir)),
      center: [
        apex[0] - reachDir[0] * reach - leanAxis[0] * side * extra,
        -reachDir[1] * reach,
        apex[1] - reachDir[2] * reach - leanAxis[1] * side * extra,
      ],
    };
  });
};

const pairCards = ({ prefix, apex, leanAxis, surfaceY, tilt, kind, extra, step }) => pairGeometry({
  apex,
  leanAxis,
  tilt,
  kind,
  extra,
}).map((part, index) => {
  const card = cardAtCenter({
    id: `${prefix}_${index === 0 ? 'a' : 'b'}`,
    center: part.center,
    heightDir: part.heightDir,
    normal: part.normalDir,
  });
  const lowest = structureBounds([card]).min[1];
  return {
    ...card,
    step,
    position: [card.position[0], card.position[1] + (surfaceY - lowest), card.position[2]],
  };
});

/**
 * Two cards leaning towards each other, meeting at `apex`. They are nudged
 * apart along the lean axis until both boxes clear, so the apex is a real
 * contact instead of an initial interpenetration.
 */
export const pair = ({
  prefix,
  apex,
  leanAxis = [1, 0],
  surfaceY = 0,
  tilt = TILT,
  kind = 'tall',
  gap = TARGET_GAP,
  step = 'pair',
}) => {
  const at = extra => pairCards({ prefix, apex, leanAxis, surfaceY, tilt, kind, extra, step });
  const separationAt = extra => {
    const cards = at(extra);
    return boxGap(cards[0], cards[1]);
  };
  if (separationAt(0) >= gap) return at(0);
  let low = 0;
  let high = 0.4;
  for (let iteration = 0; iteration < 48; iteration += 1) {
    const middle = (low + high) / 2;
    if (separationAt(middle) < gap) low = middle;
    else high = middle;
  }
  return at(high);
};

/** Topmost Y of a set of cards — the ridge a deck can rest on. */
export const ridgeTop = cards => structureBounds(cards).max[1];

/** Flat card whose 2.8 length axis runs along `axis`, bottom face at `bottomY`. */
export const deck = ({ id, center, axis = [1, 0], bottomY, step = 'deck' }) => ({
  ...cardAtCenter({
    id,
    center: [center[0], bottomY + SIZE.thickness / 2, center[1]],
    heightDir: [axis[0], 0, axis[1]],
    normal: [0, 1, 0],
  }),
  step,
});

/** One storey: two pairs leaning along `leanAxis`, bridged by a deck card. */
export const storey = ({
  prefix,
  center = [0, 0],
  surfaceY = 0,
  spacing = 0.62,
  leanAxis = [1, 0],
  kind = 'tall',
  step = 'storey',
}) => {
  const axis = leanAxis[0] !== 0 ? [0, 1] : [1, 0];
  const along = value => [center[0] + leanAxis[0] * value, center[1] + leanAxis[1] * value];
  const pairs = [
    ...pair({ prefix: `${prefix}_p1`, apex: along(-spacing), leanAxis, surfaceY, kind, step }),
    ...pair({ prefix: `${prefix}_p2`, apex: along(spacing), leanAxis, surfaceY, kind, step }),
  ];
  const ridge = ridgeTop(pairs);
  const card = deck({
    id: `${prefix}_deck`,
    center,
    axis,
    bottomY: ridge + TARGET_GAP,
    step: `${step}_deck`,
  });
  return { cards: [...pairs, card], deckTop: ridge + TARGET_GAP + SIZE.thickness };
};

/** Stacked storeys; each one stands on the measured deck of the previous one. */
export const tower = ({
  prefix,
  storeys = 1,
  spacing = 0.62,
  center = [0, 0],
  alternating = true,
  kind = 'tall',
}) => {
  const cards = [];
  let surfaceY = 0;
  let deckTop = 0;
  for (let index = 0; index < storeys; index += 1) {
    const leanAxis = alternating && index % 2 === 1 ? [0, 1] : [1, 0];
    const result = storey({
      prefix: `${prefix}_s${index + 1}`,
      center,
      surfaceY: index === 0 ? 0 : surfaceY,
      spacing,
      leanAxis,
      kind,
      step: `s${index + 1}`,
    });
    cards.push(...result.cards);
    deckTop = result.deckTop;
    surfaceY = deckTop + TARGET_GAP;
  }
  return { cards, deckTop, height: deckTop };
};

/** A row of pairs sharing one lean direction — the classic card wall. */
export const wall = ({
  prefix,
  count = 4,
  spacing = 1.9,
  leanAxis = [1, 0],
  surfaceY = 0,
  kind = 'tall',
}) => {
  const cards = [];
  for (let index = 0; index < count; index += 1) {
    const offset = (index - (count - 1) / 2) * spacing;
    const apex = leanAxis[0] !== 0 ? [0, offset] : [offset, 0];
    cards.push(...pair({
      prefix: `${prefix}${index}`,
      apex,
      leanAxis,
      surfaceY,
      kind,
      step: `pair${index + 1}`,
    }));
  }
  return cards;
};

/** Two storeys side by side with a deck bridging their tops — a gate. */
export const gate = ({ prefix, span = 2.2, surfaceY = 0, spacing = 0.62 }) => {
  const left = storey({
    prefix: `${prefix}_left`,
    center: [-span / 2, 0],
    surfaceY,
    spacing,
    step: 'left',
  });
  const right = storey({
    prefix: `${prefix}_right`,
    center: [span / 2, 0],
    surfaceY,
    spacing,
    step: 'right',
  });
  const top = Math.max(left.deckTop, right.deckTop);
  const bridge = deck({
    id: `${prefix}_bridge`,
    center: [0, 0],
    axis: [1, 0],
    bottomY: top + TARGET_GAP,
    step: 'bridge',
  });
  return {
    cards: [...left.cards, ...right.cards, bridge],
    deckTop: top + TARGET_GAP + SIZE.thickness,
  };
};

export const shiftAll = (cards, delta) => cards.map(card => ({ ...card, position: add(card.position, delta) }));

export const translateTo = (cards, target = [0, 0, 0]) => {
  const bounds = structureBounds(cards);
  return shiftAll(cards, [
    target[0] - (bounds.min[0] + bounds.max[0]) / 2,
    target[1] - bounds.min[1],
    target[2] - (bounds.min[2] + bounds.max[2]) / 2,
  ]);
};
