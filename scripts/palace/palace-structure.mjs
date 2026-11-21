/**
 * The "纸牌宫殿" (Paper Palace) — built from the user's own 格 lattices, plus
 * three devices that only exist in this file.
 *
 * Base modules, taken straight from the blueprint library (`modules.json`):
 *
 *   低格 · 田字格   5.62 × 5.81 × 1.85   八张低格牌围成田字，顶部两张平板
 *   高格 · 顺高格   2.06 × 2.10 × 2.79   四张高格牌同向倚靠，中空方柱
 *   逆格            4.22 × 4.25 × 1.78   反向四张低格牌，用作连廊
 *
 * Original structure on top of them:
 *
 *   1. 台基   3 × 3 田字格拼成一个 17.9 × 18.4 的格状高台（低格）
 *   2. 楼身   顺高格逐层叠加，层与层之间铺**十字双层平板**——实测单层平板会滑，
 *             十字交叉后 8 秒内倾角 0.1°、下沉 3 cm，是唯一站得住的叠法
 *   3. 重檐   中塔三层、角塔两层，每层顶部的十字平板就是檐口
 *   4. 连廊   逆格框架压在台基四边
 *   5. 宫门   叠涩门洞（两片高格门柱 + 三层逐级内收的板）
 *   6. 台阶   两块倾斜平板搭到台基前沿
 *
 * `stage` builds a prefix so the physics check can bisect failures.
 */

import { TARGET_GAP } from '../level-factory/lib/blocks.mjs';
import { interpenetrations, minimumCardGap, structureBounds } from '../level-factory/lib/cards.mjs';
import { plank, gateTower } from './palace-parts.mjs';
import { moduleInfo, placeModule } from './palace-modules.mjs';

const MODULE_GAP = 0.5;
const FLOOR_GAP = 0.0012;
const FLOOR_THICKNESS = 0.02;
/** The 田字格 caps itself with two planks whose union is off-centre by this much. */
const CAP_OFFSET = 0.31;

export const MODULE_SIZES = {
  low: moduleInfo('田字格'),
  high: moduleInfo('顺高格'),
  gallery: moduleInfo('逆格'),
  highRoof: moduleInfo('顺高格有屋顶'),
};

/** One tower level: the pinwheel unit, then a crossed plank floor on its top. */
const towerLevel = ({ prefix, x, z, baseY, levels }) => {
  const cards = [];
  const floors = [];
  let topY = baseY;
  for (let level = 0; level < levels; level += 1) {
    const unit = placeModule('顺高格', {
      x,
      z,
      y: topY,
      idPrefix: `${prefix}_l${level + 1}`,
    });
    cards.push(...unit.cards);
    const floorY = unit.topY + FLOOR_GAP;
    // A four-plank deck per level. One plank only touches two of the four card
    // tops and the upper unit then hangs off its edge (5 cm of sag per level);
    // two planks per layer cover the whole 2.8 × 2.8 top and nothing sags.
    for (const offset of [-0.91, 0.91]) {
      floors.push(plank({
        id: `${prefix}_floor${level + 1}a${offset}`,
        x,
        z: z + offset,
        bottomY: floorY,
        axis: [1, 0],
      }));
    }
    for (const offset of [-0.91, 0.91]) {
      floors.push(plank({
        id: `${prefix}_floor${level + 1}b${offset}`,
        x: x + offset,
        z,
        bottomY: floorY + FLOOR_THICKNESS + FLOOR_GAP,
        axis: [0, 1],
      }));
    }
    topY = floorY + 2 * (FLOOR_THICKNESS + FLOOR_GAP);
  }
  return { cards: [...cards, ...floors], topY, floors };
};

export const buildPalace = ({ stage = 9 } = {}) => {
  const units = [];
  const add = (name, cards) => {
    units.push({ name, cards });
    return cards;
  };

  const low = MODULE_SIZES.low;
  const high = MODULE_SIZES.high;
  const gallery = MODULE_SIZES.gallery;

  /* 1 · 台基：3 × 3 田字格 --------------------------------------------- */
  const stepX = low.width + MODULE_GAP;
  const stepZ = low.depth + MODULE_GAP;
  const platformCards = [];
  let order = 0;
  for (const gx of [-1, 0, 1]) {
    for (const gz of [-1, 0, 1]) {
      platformCards.push(...placeModule('田字格', {
        x: gx * stepX,
        z: gz * stepZ,
        y: 0,
        idPrefix: `p_terrace${order += 1}`,
      }).cards);
    }
  }
  add('台基·田字格', platformCards);
  const platformTop = low.height;
  const platformHalfDepth = stepZ + low.depth / 2;
  if (stage < 2) return finish(units);

  /* 2 · 月台：台基正前方再铺一块田字格，形成「凸」形台面 ------------------ */
  const apronZ = platformHalfDepth + MODULE_GAP + low.depth / 2;
  const apron = placeModule('田字格', { x: CAP_OFFSET, z: apronZ, y: 0, idPrefix: 'p_apron' });
  add('月台·田字格', apron.cards);
  const apronHalfDepth = apronZ + low.depth / 2;
  if (stage < 3) return finish(units);

  /* 3 · 四角塔：顺高格两层 + 层间四板 ---------------------------------- */
  const cornerCards = [];
  order = 0;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      cornerCards.push(...towerLevel({
        prefix: `p_corner${order += 1}`,
        x: sx * stepX + CAP_OFFSET,
        z: sz * stepZ,
        baseY: platformTop,
        levels: 2,
      }).cards);
    }
  }
  add('角塔·顺高格', cornerCards);
  if (stage < 4) return finish(units);

  /* 4 · 中塔：顺高格三层 + 层间四板 ------------------------------------ */
  const hall = towerLevel({
    prefix: 'p_hall',
    x: CAP_OFFSET,
    z: 0,
    baseY: platformTop,
    levels: 4,
  });
  add('中塔·顺高格', hall.cards);
  if (stage < 5) return finish(units);

  /* 5 · 宫门 + 门前两座逆格亭 ------------------------------------------ */
  const gate = gateTower({
    prefix: 'p_gate',
    center: [0, apronHalfDepth + 2.6],
    opening: 2.5,
    surfaceY: 0,
    tilt: 4,
  });
  add('宫门', gate.cards);

  const pavilionCards = [];
  order = 0;
  for (const sx of [-1, 1]) {
    pavilionCards.push(...placeModule('逆格', {
      x: sx * 7.6,
      z: apronHalfDepth + 0.9,
      y: 0,
      idPrefix: `p_pavilion${order += 1}`,
    }).cards);
  }
  add('门前亭·逆格', pavilionCards);

  return finish(units);
};

const finish = units => {
  const cards = units.flatMap(unit => unit.cards);
  const bounds = structureBounds(cards);
  const centre = [
    (bounds.min[0] + bounds.max[0]) / 2,
    bounds.min[1],
    (bounds.min[2] + bounds.max[2]) / 2,
  ];
  const centred = cards.map((card, index) => ({
    ...card,
    id: `palace_${String(index + 1).padStart(3, '0')}`,
    position: [
      Number((card.position[0] - centre[0]).toFixed(6)),
      Number((card.position[1] - centre[1]).toFixed(6)),
      Number((card.position[2] - centre[2]).toFixed(6)),
    ],
  }));
  const structure = structureBounds(centred);
  const size = [
    structure.max[0] - structure.min[0],
    structure.max[2] - structure.min[2],
    structure.max[1] - structure.min[1],
  ];
  return {
    cards: centred,
    units: units.map(unit => unit.name),
    bounds: structure,
    size,
    minGap: minimumCardGap(centred),
    overlaps: interpenetrations(centred, -0.003).length,
    report: {
      units: units.map(unit => unit.name),
      size,
      minGap: minimumCardGap(centred),
      overlaps: interpenetrations(centred, -0.003).length,
    },
  };
};

export const buildPalaceCards = options => buildPalace(options);

/* ------------------------------------------------------------------ */
/* CLI summary                                                         */
/* ------------------------------------------------------------------ */

const isMain = () => process.argv[1] && process.argv[1].endsWith('palace-structure.mjs');

if (isMain()) {
  const stage = Number(process.env.PALACE_STAGE ?? 9);
  const palace = buildPalace({ stage });
  const { size, minGap, overlaps, cards, units } = palace;
  console.log(`纸牌宫殿 · ${cards.length} 张牌 · stage ${stage}`);
  console.log(`  单元：${units.join(' / ')}`);
  console.log(`  尺寸：${size.map(value => value.toFixed(2)).join(' × ')}（长 × 深 × 高）`);
  console.log(`  最小牌间间隙：${minGap.toFixed(4)} m`);
  console.log(`  互相穿模：${overlaps === 0 ? '无' : `${overlaps} 处`}`);
}
