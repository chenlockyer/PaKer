/**
 * The reference structures behind the official campaign levels.
 *
 * Composites return `{ cards, steps }`: the cards carry a `step` label and the
 * steps describe how the blueprint is presented to the player. Everything is a
 * pure function of the constants in this file, so `npm run level:build`
 * reproduces byte-identical geometry on any machine.
 */

import { DEG, boxGap, cross, normalize } from './lib/math.mjs';
import { CARD_SIZES, cardAtCenter, structureBounds } from './lib/cards.mjs';
import {
  PRESET,
  TARGET_GAP,
  deck,
  gate,
  pair,
  ridgeTop,
  storey,
  translateTo,
  tower,
} from './lib/blocks.mjs';

const SIZE = CARD_SIZES.BRIDGE;

const text = (zh, en) => ({ zh, en });

const storeySteps = index => ([
  {
    key: `s${index}`,
    title: text(`第 ${index} 层支撑`, `Storey ${index} supports`),
    description: text('两张相向倾斜的牌构成一组支撑，成对摆放后形成承重面带。', 'Each pair of leaning cards is one support; two pairs make a load-bearing band.'),
    preset: PRESET.tallPair,
  },
  {
    key: `s${index}_deck`,
    title: text(`第 ${index} 层横梁`, `Storey ${index} deck`),
    description: text('把平放的牌横跨两组支撑的顶端，锁定这一层的平面。', 'Lay a flat card across both apexes to lock the storey in place.'),
    preset: PRESET.deck,
  },
]);

/** Three cards leaning inward, tops meeting: the smallest three-way support. */
export const tripod = ({ prefix = 'tripod', tilt = 18, gap = TARGET_GAP } = {}) => {
  const t = tilt * DEG;
  const sin = Math.sin(t);
  const cos = Math.cos(t);
  const build = extra => [0, 1, 2].map(index => {
    const angle = index * 120 * DEG;
    const lean = [Math.cos(angle), Math.sin(angle)];
    const heightDir = [-lean[0] * sin, cos, -lean[1] * sin];
    const widthDir = normalize(cross([0, 1, 0], heightDir));
    const center = [
      lean[0] * (SIZE.height * sin + extra),
      SIZE.height * cos / 2,
      lean[1] * (SIZE.height * sin + extra),
    ];
    return cardAtCenter({
      id: `${prefix}_${index + 1}`,
      center,
      heightDir,
      normal: normalize(cross(heightDir, widthDir)),
    });
  });
  const clearance = extra => {
    const cards = build(extra);
    let best = Infinity;
    for (let left = 0; left < cards.length; left += 1) {
      for (let right = left + 1; right < cards.length; right += 1) {
        best = Math.min(best, boxGap(cards[left], cards[right]));
      }
    }
    return best;
  };
  let low = 0;
  let high = 0.5;
  for (let iteration = 0; iteration < 48; iteration += 1) {
    const middle = (low + high) / 2;
    if (clearance(middle) < gap) low = middle;
    else high = middle;
  }
  const cards = build(high).map(card => ({ ...card, step: 'legs' }));
  return {
    cards,
    steps: [{
      key: 'legs',
      title: text('三足鼎立', 'Three legs'),
      description: text('三张牌各自向内倾斜，顶端互相压住，形成最省牌的三向支撑。', 'Lean three cards inward so their tops press against each other — the cheapest three-way support.'),
      preset: PRESET.tallPair,
    }],
  };
};

/** A storey stack. Steps are `s1`, `s1_deck`, `s2`, `s2_deck`, … */
export const towerStructure = ({ prefix, storeys = 1, spacing = 0.62, center = [0, 0] } = {}) => {
  const result = tower({ prefix, storeys, spacing, center });
  const steps = [];
  for (let index = 1; index <= storeys; index += 1) steps.push(...storeySteps(index));
  return { cards: result.cards, steps, deckTop: result.deckTop };
};

/** Storey stack with a low storey on top: a stepped house with a roof. */
export const house = ({ prefix = 'house', storeys = 1, spacing = 0.62, roofSpacing = 0.55 } = {}) => {
  const base = tower({ prefix: `${prefix}_base`, storeys, spacing });
  const roof = storey({
    prefix: `${prefix}_roof`,
    surfaceY: base.deckTop + TARGET_GAP,
    spacing: roofSpacing,
    leanAxis: [1, 0],
    kind: 'low',
    step: 'roof',
  });
  return {
    cards: [...base.cards, ...roof.cards],
    steps: [
      ...Array.from({ length: storeys }, (_, index) => storeySteps(index + 1)).flat(),
      {
        key: 'roof',
        title: text('屋顶斜撑', 'Roof braces'),
        description: text('用长边接地的矮支撑压在顶层横梁上，形成收口的屋顶。', 'Low long-edge supports on the top deck close the house with a roof.'),
        preset: PRESET.lowPair,
      },
      {
        key: 'roof_deck',
        title: text('屋脊', 'Roof ridge'),
        description: text('最后盖上屋脊牌，让屋顶的重量落回两层支撑之间。', 'Cap the roof so its weight lands between both support bands.'),
        preset: PRESET.deck,
      },
    ],
    deckTop: roof.deckTop,
  };
};

/** A row of storeys sharing one axis — a wind corridor. */
export const corridor = ({ prefix = 'corridor', count = 3, spacing = 2.9, storeySpacing = 0.62 } = {}) => {
  const cards = [];
  const steps = [];
  for (let index = 0; index < count; index += 1) {
    const z = (index - (count - 1) / 2) * spacing;
    const result = storey({
      prefix: `${prefix}${index + 1}`,
      center: [0, z],
      spacing: storeySpacing,
      leanAxis: [1, 0],
      step: `bay${index + 1}`,
    });
    cards.push(...result.cards);
    steps.push(
      {
        key: `bay${index + 1}`,
        title: text(`第 ${index + 1} 跨支撑`, `Bay ${index + 1} supports`),
        description: text('跨与跨之间保持半张牌的间隙，风会从缝隙穿过而不是推动整面墙。', 'Keep half a card of clearance between bays so wind slips through instead of pushing the wall.'),
        preset: PRESET.tallPair,
      },
      {
        key: `bay${index + 1}_deck`,
        title: text(`第 ${index + 1} 跨横梁`, `Bay ${index + 1} deck`),
        description: text('每个跨都要单独封顶，让每一跨都能独立承重。', 'Cap every bay individually so each one carries its own load.'),
        preset: PRESET.deck,
      },
    );
  }
  return { cards, steps };
};

/** Two towers joined by a bridge deck laid across both roofs. */
export const twinTowers = ({ prefix = 'twin', storeys = 2, span = 3.1, spacing = 0.62 } = {}) => {
  const left = tower({ prefix: `${prefix}_left`, storeys, spacing, center: [-span / 2, 0] });
  const right = tower({ prefix: `${prefix}_right`, storeys, spacing, center: [span / 2, 0] });
  const top = Math.max(left.deckTop, right.deckTop);
  const bridge = deck({
    id: `${prefix}_bridge`,
    center: [0, 0],
    axis: [1, 0],
    bottomY: top + TARGET_GAP,
    step: 'bridge',
  });
  const steps = [];
  for (let index = 1; index <= storeys; index += 1) {
    steps.push(
      {
        key: `s${index}`,
        title: text(`第 ${index} 层双塔支撑`, `Storey ${index} twin supports`),
        description: text('左右两座塔同步上升，每层都先立支撑再封顶。', 'Raise both towers together: supports first, then the deck.'),
        preset: PRESET.tallPair,
      },
      {
        key: `s${index}_deck`,
        title: text(`第 ${index} 层双塔横梁`, `Storey ${index} twin decks`),
        description: text('两座塔的横梁要落在同一高度，桥面才能平稳地躺上去。', 'Keep both tower decks at the same height so the bridge lies flat.'),
        preset: PRESET.deck,
      },
    );
  }
  steps.push({
    key: 'bridge',
    title: text('连桥', 'Bridge'),
    description: text('一张平放的长牌横跨两座塔顶，把左右塔锁成一个整体。', 'One flat card across both roofs locks the towers into a single frame.'),
    preset: PRESET.deck,
  });
  return {
    cards: [...left.cards, ...right.cards, bridge],
    steps,
    deckTop: top + TARGET_GAP + SIZE.thickness,
  };
};

/** Two storeys under one flat roof — the campaign gate. */
export const portico = ({ prefix = 'portico', span = 2.6, spacing = 0.62 } = {}) => {
  const result = gate({ prefix, span, spacing });
  return {
    cards: result.cards,
    steps: [
      {
        key: 'left',
        title: text('左柱支撑', 'Left pier supports'),
        description: text('先立起一侧的两组支撑，柱子要垂直于地面。', 'Raise one pier first: two leaning supports.'),
        preset: PRESET.tallPair,
      },
      {
        key: 'left_deck',
        title: text('左柱横梁', 'Left pier deck'),
        description: text('左柱封顶，这一层才有平面刚度。', 'Cap the left pier so it gains planar stiffness.'),
        preset: PRESET.deck,
      },
      {
        key: 'right',
        title: text('右柱支撑', 'Right pier supports'),
        description: text('另一侧保持同样的间距，两根柱子决定拱门的高度。', 'Mirror the pier — the distance between the two sets the gate width.'),
        preset: PRESET.tallPair,
      },
      {
        key: 'right_deck',
        title: text('右柱横梁', 'Right pier deck'),
        description: text('两侧横梁落在同一高度，门楣才能水平。', 'Both decks must share a height for a level lintel.'),
        preset: PRESET.deck,
      },
      {
        key: 'bridge',
        title: text('门楣', 'Lintel'),
        description: text('把长牌平放在两根柱子上，重量由两侧共同承担。', 'Lay the long card across both piers so each side shares the load.'),
        preset: PRESET.deck,
      },
    ],
    deckTop: result.deckTop,
  };
};

/**
 * Level structure registry. Keys are level ids; each factory returns
 * `{ cards, steps }` already centred on the origin and standing on y = 0.
 */
export const buildLevelStructure = id => {
  const factory = {
    'a-frame': () => {
      const cards = pair({ prefix: 'af', apex: [0, 0], step: 'frame' });
      return {
        cards,
        steps: [{
          key: 'frame',
          title: text('相向倾斜', 'Leaning pair'),
          description: text('两张牌从地面相向倾斜，顶端互相压住，这是所有纸牌结构的最小单元。', 'Two cards lean towards each other and press at the top — the smallest unit of every card structure.'),
          preset: PRESET.tallPair,
        }],
      };
    },
    'roof-house': () => house({ prefix: 'rh' }),
    tripod: () => tripod({ prefix: 'tp' }),
    gate: () => portico({ prefix: 'gt' }),
    'weight-drop': () => house({ prefix: 'wd' }),
    'two-story-wind': () => towerStructure({ prefix: 'tw', storeys: 2 }),
    'wind-corridor': () => corridor({ prefix: 'wc', count: 3 }),
    'three-story': () => towerStructure({ prefix: 'ts', storeys: 3 }),
    'twin-bridge': () => twinTowers({ prefix: 'tb', storeys: 2 }),
    palace: () => house({ prefix: 'pl', storeys: 3 }),
    storm: () => twinTowers({ prefix: 'st', storeys: 3, span: 3.9 }),
    finale: () => corridor({ prefix: 'fn', count: 5 }),
  }[id];
  if (!factory) throw new Error(`Unknown level structure: ${id}`);
  const built = factory();
  return { ...built, cards: translateTo(built.cards) };
};

export const structureCardCount = id => buildLevelStructure(id).cards.length;
