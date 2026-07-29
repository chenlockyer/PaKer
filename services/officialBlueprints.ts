import {
  Blueprint,
  BlueprintStep,
  CardData,
  CardSize,
  LiveCardTransform,
} from '../types';
import {
  createBlueprint,
  createBlueprintSnapshot,
  DEFAULT_BLUEPRINT_TOLERANCE,
} from './blueprintService';

export const OFFICIAL_BLUEPRINT_PREFIX = 'official_tutorial_';
export const TUTORIAL_PROGRESS_KEY = 'hoc_blueprint_tutorial_progress_v1';

const DEG_10 = Math.PI / 18;
const HEIGHT = 2.8;
const CARD_Y = Math.cos(DEG_10) * HEIGHT / 2 + 0.01;

type TutorialCard = {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  preset: string;
};

const makeCard = (card: TutorialCard, index: number): CardData => ({
  id: card.id,
  position: card.position,
  rotation: card.rotation,
  suit: index % 2 ? 'hearts' : 'spades',
  rank: String(index + 1),
  color: index % 2 ? 'red' : 'black',
  locked: false,
});

const step = (
  id: string,
  order: number,
  title: string,
  description: string,
  cardIds: string[],
  recommendedPresetId: string,
): BlueprintStep => ({
  id,
  order,
  title,
  description,
  cardIds,
  freezeDuringBuild: false,
  releasePhysicsAfterStep: false,
  recommendedPresetId,
});

const buildOfficial = (
  number: number,
  name: string,
  description: string,
  cards: TutorialCard[],
  steps: BlueprintStep[],
): Blueprint => {
  const cardData = cards.map(makeCard);
  const live = new Map<string, LiveCardTransform>(
    cardData.map(card => [card.id, { position: card.position, rotation: card.rotation }]),
  );
  const snapshot = createBlueprintSnapshot(cardData, live, CardSize.BRIDGE);
  const blueprint = createBlueprint({
    name,
    description,
    author: 'PaKer',
    category: 'tutorial',
    tags: ['官方', '教学', `第${number}课`],
    cardSize: CardSize.BRIDGE,
    snapshot,
    steps,
    status: 'published',
    tolerances: {
      ...DEFAULT_BLUEPRINT_TOLERANCE,
      horizontal: 0.26,
      height: 0.18,
      rotationDegrees: 8,
      nearHorizontal: 0.55,
      nearHeight: 0.4,
      nearRotationDegrees: 24,
    },
  });
  return {
    ...blueprint,
    id: `${OFFICIAL_BLUEPRINT_PREFIX}${number}`,
    createdAt: '2026-07-29T00:00:00.000Z',
    updatedAt: '2026-07-29T00:00:00.000Z',
  };
};

const aPair = (prefix: string, x: number): TutorialCard[] => [
  {
    id: `${prefix}_left`,
    position: [x, CARD_Y, -0.24],
    rotation: [Math.PI / 2 - DEG_10, 0, 0],
    preset: 'short_edge_forward_10',
  },
  {
    id: `${prefix}_right`,
    position: [x, CARD_Y, 0.24],
    rotation: [Math.PI / 2 + DEG_10, 0, 0],
    preset: 'short_edge_backward_10',
  },
];

const a1 = aPair('a', 0);
const a2 = [...aPair('front', -1.45), ...aPair('back', 1.45)];
const beam: TutorialCard = {
  id: 'beam',
  position: [0, CARD_Y * 2 + 0.03, 0],
  rotation: [0, Math.PI / 2, 0],
  preset: 'flat_landscape',
};
const houseBase = [
  ...a2,
  { ...beam, id: 'roof_left', position: [-0.72, CARD_Y * 2 + 0.03, 0] as [number, number, number] },
  { ...beam, id: 'roof_right', position: [0.72, CARD_Y * 2 + 0.03, 0] as [number, number, number] },
];
const braces: TutorialCard[] = [
  { id: 'brace_1', position: [-1.45, 0.91, -1.05], rotation: [0, 0, Math.PI / 2 + DEG_10], preset: 'long_edge_left_10' },
  { id: 'brace_2', position: [-1.45, 0.91, 1.05], rotation: [0, 0, Math.PI / 2 - DEG_10], preset: 'long_edge_right_10' },
  { id: 'brace_3', position: [1.45, 0.91, -1.05], rotation: [0, 0, Math.PI / 2 + DEG_10], preset: 'long_edge_left_10' },
  { id: 'brace_4', position: [1.45, 0.91, 1.05], rotation: [0, 0, Math.PI / 2 - DEG_10], preset: 'long_edge_right_10' },
];

export const OFFICIAL_TUTORIAL_BLUEPRINTS: Blueprint[] = [
  buildOfficial(1, '第 1 课：A 字架', '用两张相向倾斜的牌建立最基础的稳定单元。', a1, [
    step('a_left_step', 0, '放置第一面', '使用短边接地，让牌向结构中心倾斜。', ['a_left'], 'short_edge_forward_10'),
    step('a_right_step', 1, '合拢 A 字架', '从另一侧相向倾斜，使两张牌的顶部互相支撑。', ['a_right'], 'short_edge_backward_10'),
  ]),
  buildOfficial(2, '第 2 课：双 A 字支撑', '复制两个 A 字架，学习间距、对齐和成组支撑。', a2, [
    step('front_pair', 0, '前侧 A 字架', '先完成第一组相向支撑。', ['front_left', 'front_right'], 'short_edge_forward_10'),
    step('back_pair', 1, '后侧 A 字架', '保持方向一致，在另一侧复制支撑。', ['back_left', 'back_right'], 'short_edge_forward_10'),
  ]),
  buildOfficial(3, '第 3 课：添加横梁', '在双 A 字支撑上铺设横梁，掌握承托面的搭建。', [...a2, beam], [
    step('supports', 0, '完成双支撑', '先建立两组间距一致的 A 字架。', a2.map(card => card.id), 'short_edge_forward_10'),
    step('beam_step', 1, '铺设横梁', '锁定合适高度，将横梁平放到两个支撑顶部。', ['beam'], 'flat_landscape'),
  ]),
  buildOfficial(4, '第 4 课：一层纸牌屋', '组合支撑、屋顶和外围斜撑，完成第一座完整纸牌房屋。', [...houseBase, ...braces], [
    step('house_supports', 0, '搭建主体支撑', '完成两组平行的 A 字支撑。', a2.map(card => card.id), 'short_edge_forward_10'),
    step('house_roof', 1, '封闭屋顶', '在支撑顶部并排铺设两张屋顶牌。', ['roof_left', 'roof_right'], 'flat_landscape'),
    step('house_braces', 2, '增加外围斜撑', '使用长边接地，在四周形成稳定的防护结构。', braces.map(card => card.id), 'long_edge_left_10'),
  ]),
];

export const loadTutorialProgress = (): Set<string> => {
  try {
    const parsed = JSON.parse(localStorage.getItem(TUTORIAL_PROGRESS_KEY) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter(value => typeof value === 'string') : []);
  } catch {
    return new Set();
  }
};

export const saveTutorialProgress = (completed: ReadonlySet<string>) => {
  localStorage.setItem(TUTORIAL_PROGRESS_KEY, JSON.stringify([...completed]));
};

export const isOfficialTutorial = (blueprint: Blueprint) =>
  blueprint.id.startsWith(OFFICIAL_BLUEPRINT_PREFIX);
