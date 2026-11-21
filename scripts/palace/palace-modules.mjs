/**
 * The user's own blueprint modules, used as palace building blocks.
 *
 * Two of these are the "格" lattices from the blueprint library:
 *
 *   顺高格   4 tall cards in a pinwheel      → a hollow 2.1 m column, 2.79 tall
 *   田字格   8 low cards in a 田 pattern      → a 5.7 m lattice slab, 1.85 tall
 *   逆格     4 low cards in a counter pinwheel → a 4.2 m gallery frame, 1.78 tall
 *
 * The geometry is baked from `modules.json`, which was exported from the client's
 * blueprint library, so the palace is literally built out of the saved designs —
 * it is not a re-implementation of them.
 */

import { readFileSync } from 'node:fs';
import { CARD_SIZES } from '../level-factory/lib/cards.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = JSON.parse(readFileSync(join(HERE, 'modules.json'), 'utf8'));

export const MODULES = DATA.modules;

const rotateY = (point, yaw) => {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return [point[0] * cos - point[2] * sin, point[1], point[0] * sin + point[2] * cos];
};

/** q = yaw * local, so a module can be spun on the spot. */
const multiply = (left, right) => {
  const [ax, ay, az, aw] = left;
  const [bx, by, bz, bw] = right;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
};

export const moduleInfo = name => {
  const module = MODULES[name];
  if (!module) throw new Error(`unknown module ${name}`);
  const size = module.bounds?.size ?? [2, 2, 2];
  return {
    name,
    cardCount: module.cards.length,
    width: size[0],
    depth: size[2],
    height: size[1],
  };
};

/**
 * Place a module: rotate its cards about Y, then translate.
 * `y` is the height the module's bottom sits at.
 */
export const placeModule = (name, { x = 0, y = 0, z = 0, yaw = 0, idPrefix = name } = {}) => {
  const module = MODULES[name];
  if (!module) throw new Error(`unknown module ${name}`);
  const quaternionYaw = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
  const cards = module.cards.map(card => {
    const [px, py, pz] = rotateY(card.position, yaw);
    return {
      id: `${idPrefix}_${card.order}`,
      position: [px + x, py + y, pz + z],
      quaternion: multiply(quaternionYaw, card.quaternion),
      dimensions: CARD_SIZES.BRIDGE,
      suit: card.suit,
      rank: card.rank,
      color: card.color,
    };
  });
  const info = moduleInfo(name);
  return { ...info, cards, topY: y + info.height };
};
