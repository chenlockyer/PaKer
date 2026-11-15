/**
 * Card geometry primitives for generated PaKer levels.
 *
 * A card is a box of `width × thickness × height` whose local axes are
 * X = width (the short edge), Y = thickness (the face normal) and
 * Z = height (the long edge). Every builder below works with those two named
 * directions instead of Euler angles:
 *
 *   heightDir  where the 2.8 long axis points
 *   normal     where the card face points
 *
 * widthDir is derived, so the result is always a right-handed rotation.
 */

import {
  UP,
  add,
  boxCorners,
  boxGap,
  boundsOfPoints,
  cross,
  horizontal,
  normalize,
  quatFromAxes,
  roundTuple,
  scale,
} from './math.mjs';

export const CARD_SIZES = {
  BRIDGE: { width: 1.8, height: 2.8, thickness: 0.02, millimeters: '56 × 87 mm' },
  POKER: { width: 2, height: 2.8, thickness: 0.02, millimeters: '63 × 88 mm' },
};

/** Grip/normal direction implied by a height direction. */
export const orientationFromHeight = heightDir => {
  const height = normalize(heightDir);
  const widthDir = horizontal(cross(UP, height)) ?? [1, 0, 0];
  return { heightDir: height, widthDir, normal: normalize(cross(height, widthDir)) };
};

const finalize = ({ id, position, quaternion, dimensions, suit, rank, color }) => ({
  id,
  position,
  quaternion,
  dimensions,
  suit,
  rank,
  color,
});

const axesFor = (heightDir, normal, size) => {
  const dimensions = CARD_SIZES[size];
  const height = normalize(heightDir);
  const resolved = normal ? normalize(normal) : orientationFromHeight(height).normal;
  const width = normalize(cross(resolved, height));
  return { dimensions, height, normal: resolved, width, quaternion: quatFromAxes(width, resolved, height) };
};

/**
 * Place a card so the centre of its bottom edge face (the 1.8 × 0.02 face
 * opposite the height axis) sits exactly on `butt`.
 */
export const cardFromButt = ({
  id,
  butt,
  heightDir,
  size = 'BRIDGE',
  normal,
  faceOffset = 0,
  suit = 'spades',
  rank = 'A',
  color = 'black',
}) => {
  const axes = axesFor(heightDir, normal, size);
  const position = add(butt, add(scale(axes.height, axes.dimensions.height / 2), scale(axes.normal, faceOffset)));
  return finalize({
    id,
    position: roundTuple(position, 6),
    quaternion: roundTuple(axes.quaternion, 6),
    dimensions: axes.dimensions,
    suit,
    rank,
    color,
  });
};

/** Place a card by its centre point. */
export const cardAtCenter = ({
  id,
  center,
  heightDir,
  size = 'BRIDGE',
  normal,
  suit = 'spades',
  rank = 'A',
  color = 'black',
}) => {
  const axes = axesFor(heightDir, normal, size);
  return finalize({
    id,
    position: roundTuple(center, 6),
    quaternion: roundTuple(axes.quaternion, 6),
    dimensions: axes.dimensions,
    suit,
    rank,
    color,
  });
};

/** Lowest world Y of the oriented box, used to sit cards exactly on a surface. */
export const lowestOffset = ({ heightDir, normal, size = 'BRIDGE' }) => {
  const axes = axesFor(heightDir, normal, size);
  return Math.abs(axes.height[1]) * axes.dimensions.height / 2 +
    Math.abs(axes.normal[1]) * axes.dimensions.thickness / 2 +
    Math.abs(axes.width[1]) * axes.dimensions.width / 2;
};

export const cardBounds = card => boundsOfPoints(boxCorners(card.position, card.quaternion, card.dimensions));

export const structureBounds = cards => boundsOfPoints(
  cards.flatMap(card => boxCorners(card.position, card.quaternion, card.dimensions)),
);

export const highestPoint = cards => Math.max(...cards.map(card => cardBounds(card).max[1]));

/** Minimum signed gap between any two cards; negative means interpenetration. */
export const minimumCardGap = cards => {
  let best = Infinity;
  for (let i = 0; i < cards.length; i += 1) {
    for (let j = i + 1; j < cards.length; j += 1) {
      const gap = boxGap(cards[i], cards[j]);
      if (gap < best) best = gap;
    }
  }
  return best;
};

export const interpenetrations = (cards, tolerance = 0.0005) => {
  const hits = [];
  for (let i = 0; i < cards.length; i += 1) {
    for (let j = i + 1; j < cards.length; j += 1) {
      const gap = boxGap(cards[i], cards[j]);
      if (gap < tolerance) hits.push({ left: cards[i].id, right: cards[j].id, gap: Number(gap.toFixed(5)) });
    }
  }
  return hits;
};
