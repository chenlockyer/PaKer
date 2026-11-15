/**
 * Official campaign catalogue: level metadata, test stages and tutorial cues.
 *
 * Geometry lives in structures.mjs; this file only decides what each level
 * asks of the player. `npm run level:build` merges the two and verifies every
 * reference structure with a headless Rapier run before writing any output.
 */

import { PRESET } from './lib/blocks.mjs';

const text = (zh, en) => ({ zh, en });

const TOLERANCE_GUIDED = {
  horizontal: 0.26,
  height: 0.18,
  rotationDegrees: 8,
  nearHorizontal: 0.55,
  nearHeight: 0.4,
  nearRotationDegrees: 24,
};

const TOLERANCE_LOOSE = {
  horizontal: 0.32,
  height: 0.22,
  rotationDegrees: 10,
  nearHorizontal: 0.62,
  nearHeight: 0.46,
  nearRotationDegrees: 28,
};

const stability = (duration, name = '稳定性测试') => ({
  name,
  testType: 'STABILITY',
  duration,
});

const wind = (strength, duration, name = '风力测试') => ({
  name,
  testType: 'WIND',
  duration,
  windStrength: strength,
});

const drop = (mass, offset, duration, name = '落物冲击') => ({
  name,
  testType: 'WEIGHT_DROP',
  duration,
  weightMass: mass,
  weightDropOffset: offset,
});

const hint = (delayMs, textZh, textEn, highlight = 'pulse') => ({
  delayMs,
  highlight,
  text: text(textZh, textEn),
});

const cue = (id, kind, textZh, textEn, extras = {}) => ({
  id,
  kind,
  enabled: true,
  text: text(textZh, textEn),
  target: { type: 'none' },
  highlight: 'pulse',
  hints: [],
  feedback: { flash: true, sound: true },
  ...extras,
});

/** Preset → first step → last blueprint step → test → success. */
const guidedCues = (level) => [
  cue('cue_preset', 'preset', '先选短边后倾 10° 的预设', 'Pick the short-edge leaning preset', {
    presetId: PRESET.tallPair,
    target: { type: 'preset', presetId: PRESET.tallPair },
    highlight: 'arrow',
    hints: [
      hint(4000, '预设轮盘里带箭头的图标就是倾斜放置', 'The arrowed icon in the preset wheel is the leaning placement'),
    ],
  }),
  cue('cue_first_step', 'blueprint-step', '按蓝图放下第一组牌', 'Place the first group of cards', {
    blueprintStepIndex: 0,
    target: { type: 'blueprint-step', stepIndex: 0 },
    highlight: 'blueprint-glow',
  }),
  cue('cue_finish_build', 'blueprint-step', '补齐剩余蓝图，再用空格锁定高度', 'Finish the blueprint; hold Space to lock height', {
    blueprintStepIndex: Math.max(0, level.stepCount - 1),
    target: { type: 'blueprint-step', stepIndex: Math.max(0, level.stepCount - 1) },
    highlight: 'blueprint-glow',
  }),
  cue('cue_test', 'test-start', '开始测试，看它能不能站住', 'Start the test and see if it holds', {
    target: { type: 'control', control: 'test' },
    highlight: 'arrow',
  }),
  cue('cue_success', 'test-success', '站住了！', 'It stands!', { highlight: 'pulse' }),
];

/** Free-build levels: preset hint → height goal → test → success. */
const buildCues = (level) => [
  cue('cue_preset', 'preset', '从短边倾斜的支撑开始', 'Start with short-edge leaning supports', {
    presetId: PRESET.tallPair,
    target: { type: 'preset', presetId: PRESET.tallPair },
    highlight: 'arrow',
    hints: [hint(5000, '一组 A 字架就能站住，但成对摆放才承得住上面一层', 'One A-frame stands, but a pair carries the storey above')],
  }),
  cue('cue_height', 'height', '把结构搭到目标高度', 'Build up to the target height', {
    targetHeight: level.targetHeight,
    target: { type: 'world', position: [0, level.targetHeight, 0] },
    highlight: 'arrow',
    hints: [hint(6000, '按住空格可以锁定当前高度再放牌', 'Hold Space to lock the current height while placing')],
  }),
  cue('cue_test', 'test-start', '开始测试', 'Start the test', {
    target: { type: 'control', control: 'test' },
    highlight: 'arrow',
  }),
  cue('cue_success', 'test-success', '撑住了！', 'It held!', { highlight: 'pulse' }),
];

const LEVELS = [
  {
    id: 'a-frame',
    structure: 'a-frame',
    name: text('A 字架入门', 'A-Frame Basics'),
    description: text('只使用 2 张牌搭建一个能够独立站立的 A 字架', 'Build a freestanding A-frame using only 2 cards'),
    requiresBlueprintMatch: true,
    maxCards: 2,
    minCards: 2,
    heightMultiplier: 1,
    stages: [stability(3)],
    tolerances: TOLERANCE_GUIDED,
    tutorial: {
      entryTitle: text('第一课 · 相向倾斜', 'Lesson 1 · Lean Together'),
      entrySubtitle: text('两张牌互相压住，就能站住。', 'Two cards pressing on each other can stand.'),
      cues: guidedCues,
    },
  },
  {
    id: 'roof-house',
    structure: 'roof-house',
    name: text('一层纸牌屋', 'One-Story House'),
    description: text('使用不超过 10 张牌搭建有屋顶的一层房子，并顶住 5 秒轻风', 'Build a roofed one-story house with no more than 10 cards and hold 5 seconds of light wind'),
    requiresBlueprintMatch: true,
    maxCards: 10,
    minCards: 10,
    heightMultiplier: 1,
    stages: [wind(0.012, 5)],
    tolerances: TOLERANCE_GUIDED,
    tutorial: {
      entryTitle: text('第二课 · 成对与封顶', 'Lesson 2 · Pairs and Decks'),
      entrySubtitle: text('两组支撑加一张横梁，才有平面的刚度。', 'Two supports and a deck are what give a plane its stiffness.'),
      cues: guidedCues,
    },
  },
  {
    id: 'tripod',
    structure: 'tripod',
    name: text('三足鼎立', 'Three-Legged Stand'),
    description: text('用 3 张牌搭出互相压住的三角支撑，并保持 4 秒', 'Stand three cards against each other in a triangle for 4 seconds'),
    requiresBlueprintMatch: true,
    maxCards: 3,
    minCards: 3,
    heightMultiplier: 1,
    stages: [stability(4)],
    tolerances: TOLERANCE_GUIDED,
    tutorial: {
      entryTitle: text('第三课 · 第三只脚', 'Lesson 3 · The Third Leg'),
      entrySubtitle: text('两张牌只能撑一条线，三张牌才撑住一个面。', 'Two cards hold a line; three cards hold a plane.'),
      cues: guidedCues,
    },
  },
  {
    id: 'gate',
    structure: 'gate',
    name: text('牌拱门', 'Card Gate'),
    description: text('搭出两根柱子和一根门楣，让门楣的重量分到两侧', 'Raise two piers and a lintel so the lintel shares its weight with both sides'),
    requiresBlueprintMatch: true,
    maxCards: 14,
    minCards: 11,
    heightMultiplier: 1,
    stages: [stability(5)],
    tolerances: TOLERANCE_GUIDED,
    tutorial: {
      entryTitle: text('第四课 · 跨与承重', 'Lesson 4 · Spans and Load'),
      entrySubtitle: text('跨度越大，两侧的柱子越要站稳。', 'The wider the span, the harder both piers must work.'),
      cues: guidedCues,
    },
  },
  {
    id: 'weight-drop',
    structure: 'weight-drop',
    name: text('落物冲击', 'Drop Impact'),
    description: text('重物会从 5.1 米高处落下：房子要够高、屋顶要够稳才接得住', 'A weight drops from 5.1 m — build tall enough, with a roof steady enough to catch it'),
    requiresBlueprintMatch: false,
    maxCards: 12,
    minCards: 8,
    heightMultiplier: 1,
    stages: [drop(0.45, 3.4, 6)],
    tolerances: TOLERANCE_LOOSE,
    tutorial: {
      entryTitle: text('第五课 · 承重路径', 'Lesson 5 · Load Path'),
      entrySubtitle: text('重量要沿着牌一直传到地面。', 'Weight has to travel down the cards into the floor.'),
      cues: buildCues,
    },
  },
  {
    id: 'two-story-wind',
    structure: 'two-story-wind',
    name: text('两层风力挑战', 'Two-Story Wind Trial'),
    description: text('搭到两层高度，并承受 10 秒风', 'Build two storeys and survive 10 seconds of wind'),
    requiresBlueprintMatch: false,
    maxCards: 20,
    minCards: 8,
    heightMultiplier: 2,
    stages: [wind(0.05, 10)],
    tolerances: TOLERANCE_LOOSE,
    tutorial: {
      entryTitle: text('第六课 · 交错', 'Lesson 6 · Alternate'),
      entrySubtitle: text('上下两层换一个方向，风就推不动整座塔。', 'Turn each storey ninety degrees and the wind loses its grip.'),
      cues: buildCues,
    },
  },
  {
    id: 'wind-corridor',
    structure: 'wind-corridor',
    name: text('风廊', 'Wind Corridor'),
    description: text('把三跨连成一排，顶住 8 秒侧风', 'Line up three bays and hold 8 seconds of side wind'),
    requiresBlueprintMatch: false,
    maxCards: 18,
    minCards: 12,
    heightMultiplier: 1,
    stages: [wind(0.03, 8)],
    tolerances: TOLERANCE_LOOSE,
    tutorial: {
      entryTitle: text('第七课 · 分散', 'Lesson 7 · Spread Out'),
      entrySubtitle: text('每跨都单独封顶，风就找不到一处能推倒整排。', 'Cap every bay on its own so no single gust can take the row down.'),
      cues: buildCues,
    },
  },
  {
    id: 'three-story',
    structure: 'three-story',
    name: text('三层高塔', 'Three-Story Tower'),
    description: text('搭到三层高度，并在风里站住 10 秒', 'Build three storeys and hold 10 seconds of wind'),
    requiresBlueprintMatch: false,
    maxCards: 20,
    minCards: 12,
    heightMultiplier: 3,
    stages: [wind(0.03, 10)],
    tolerances: TOLERANCE_LOOSE,
    tutorial: {
      entryTitle: text('第八课 · 竖向传递', 'Lesson 8 · Vertical Transfer'),
      entrySubtitle: text('越高越慢，每加一层都要重新对中。', 'Height punishes imprecision: recentre after every storey.'),
      cues: buildCues,
    },
  },
  {
    id: 'twin-bridge',
    structure: 'twin-bridge',
    name: text('双塔连桥', 'Twin Bridge'),
    description: text('两座塔各自站稳，再用一张牌连成整体', 'Raise two towers, then lock them together with one card'),
    requiresBlueprintMatch: false,
    maxCards: 24,
    minCards: 18,
    heightMultiplier: 3,
    stages: [wind(0.05, 8)],
    tolerances: TOLERANCE_LOOSE,
    tutorial: {
      entryTitle: text('第九课 · 整体', 'Lesson 9 · One Frame'),
      entrySubtitle: text('两座塔的横梁在同一高度，桥面才锁得住。', 'Both tower decks must share a height for the bridge to lock them.'),
      cues: buildCues,
    },
  },
  {
    id: 'palace',
    structure: 'palace',
    name: text('纸牌宫殿', 'Card Palace'),
    description: text('三层主体加一座收口屋顶，先站稳，再接住落物', 'Three storeys under a closed roof: stand still, then catch the dropped weight'),
    requiresBlueprintMatch: false,
    maxCards: 24,
    minCards: 16,
    heightMultiplier: 5,
    stages: [stability(3), drop(0.45, 2.2, 5)],
    tolerances: TOLERANCE_LOOSE,
    tutorial: {
      entryTitle: text('第十课 · 收口', 'Lesson 10 · Closing the Roof'),
      entrySubtitle: text('屋顶收得越低，冲击越容易散开。', 'A low, closed roof spreads an impact instead of catching it.'),
      cues: buildCues,
    },
  },
  {
    id: 'storm',
    structure: 'storm',
    name: text('双塔风暴', 'Twin Storm'),
    description: text('三层双塔连桥，先站稳再顶住 8 秒强风', 'Twin three-story towers and a bridge: stand still, then hold 8 seconds of strong wind'),
    requiresBlueprintMatch: false,
    maxCards: 34,
    minCards: 24,
    heightMultiplier: 3,
    stages: [stability(3), wind(0.04, 8)],
    tolerances: TOLERANCE_LOOSE,
    tutorial: {
      entryTitle: text('第十一课 · 抗风', 'Lesson 11 · Wind Bracing'),
      entrySubtitle: text('两层同向会整体倾覆，交错才抗风。', 'Aligned storeys tip as one; alternating storeys resist.'),
      cues: buildCues,
    },
  },
  {
    id: 'finale',
    structure: 'finale',
    name: text('终局试炼', 'Final Trial'),
    description: text('五跨长阵，连续承受稳定、强风与落物三重考验', 'Five bays that must survive stability, strong wind and an impact in one run'),
    requiresBlueprintMatch: false,
    maxCards: 28,
    minCards: 20,
    heightMultiplier: 1,
    stages: [stability(3), wind(0.03, 6), drop(0.45, 4, 5)],
    tolerances: TOLERANCE_LOOSE,
    tutorial: {
      entryTitle: text('第十二课 · 综合', 'Lesson 12 · Everything'),
      entrySubtitle: text('没有新知识了，只剩你搭得够不够稳。', 'Nothing new here — only whether your build is steady enough.'),
      cues: buildCues,
    },
  },
];

export const CHAPTERS = [
  {
    id: 'chapter-foundations',
    name: text('第一章 · 搭建基础', 'Chapter 1 · Foundations'),
    description: text('学会支撑、屋顶和基本稳定结构', 'Learn supports, roofs and basic stability.'),
    levelIds: ['a-frame', 'roof-house', 'tripod', 'gate'],
  },
  {
    id: 'chapter-trials',
    name: text('第二章 · 结构考验', 'Chapter 2 · Structural Trials'),
    description: text('抵御冲击与侧风，把结构搭到两层高度', 'Survive impacts and side wind, then build above one storey.'),
    levelIds: ['weight-drop', 'two-story-wind', 'wind-corridor', 'three-story'],
  },
  {
    id: 'chapter-mastery',
    name: text('第三章 · 极限工艺', 'Chapter 3 · Mastery'),
    description: text('连桥、宫殿与三重考验', 'Bridges, palaces and the triple trial.'),
    levelIds: ['twin-bridge', 'palace', 'storm', 'finale'],
  },
];

export const LEVEL_CATALOGUE = LEVELS;

/** Target height formula copied from App.tsx so the catalogue can quote it. */
export const targetHeightFor = (cardWidth, heightMultiplier) =>
  Math.floor(cardWidth * Math.cos(10 * Math.PI / 180) * heightMultiplier * 10) / 10;
