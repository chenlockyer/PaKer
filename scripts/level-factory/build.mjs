/**
 * Level factory build step.
 *
 *   npm run level:build
 *
 * 1. builds the reference structure for every official level,
 * 2. checks the geometry (no interpenetration) and simulates the level test
 *    with Rapier until it survives with a real safety margin,
 * 3. writes services/officialLevelData.generated.ts,
 * 4. re-imports the runtime level service through esbuild so the exported
 *    .paker-level.json files are byte-for-byte what the game itself builds,
 * 5. writes public/official-campaign.json and a verification report.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

import { boxCorners, roundTuple } from './lib/math.mjs';
import { CARD_SIZES, interpenetrations, minimumCardGap, structureBounds } from './lib/cards.mjs';
import { simulateLevel } from './lib/verify.mjs';
import { shiftAll } from './lib/blocks.mjs';
import { buildLevelStructure } from './structures.mjs';
import { CHAPTERS, LEVEL_CATALOGUE, targetHeightFor } from './levels.mjs';

const CARD_SIZE = 'BRIDGE';
const CREATED_AT = '2026-11-15T00:00:00.000Z';
/** How far a player's build may sit from the reference blueprint. */
const PLACEMENT_SHIFTS = [[0.12, 0], [-0.12, 0], [0, 0.12], [0, -0.12]];
const CATEGORY_BY_CHAPTER = {
  'chapter-foundations': 'tutorial',
  'chapter-trials': 'challenge',
  'chapter-mastery': 'architecture',
};
const SUITS = ['spades', 'hearts', 'clubs', 'diamonds'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const checksumBlueprint = blueprint => {
  const content = JSON.stringify(blueprint);
  let hash = 2166136261;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

const chapterOf = id => CHAPTERS.find(chapter => chapter.levelIds.includes(id));

/** Blueprint snapshot exactly as createBlueprintSnapshot would capture it. */
const buildSnapshot = cards => {
  const corners = cards.flatMap(card => boxCorners(card.position, card.quaternion, card.dimensions));
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const corner of corners) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], corner[axis]);
      max[axis] = Math.max(max[axis], corner[axis]);
    }
  }
  const origin = [(min[0] + max[0]) / 2, min[1], (min[2] + max[2]) / 2];
  const localMin = min.map((value, axis) => value - origin[axis]);
  const localMax = max.map((value, axis) => value - origin[axis]);
  return {
    capturedAt: CREATED_AT,
    source: 'live-physics',
    originWorld: roundTuple(origin, 5),
    bounds: {
      min: roundTuple(localMin, 5),
      max: roundTuple(localMax, 5),
      size: roundTuple(localMax.map((value, axis) => value - localMin[axis]), 5),
    },
    cards: cards.map((card, order) => ({
      id: card.id,
      order,
      position: roundTuple([
        card.position[0] - origin[0],
        card.position[1] - origin[1],
        card.position[2] - origin[2],
      ], 5),
      quaternion: roundTuple(card.quaternion, 6),
      suit: card.suit,
      rank: card.rank,
      color: card.color,
    })),
  };
};

const assignSteps = (cards, stepMetadata) => {
  const metaByKey = new Map(stepMetadata.map(step => [step.key, step]));
  const grouped = new Map(stepMetadata.map(step => [step.key, []]));
  cards.forEach(card => {
    const bucket = grouped.get(card.step);
    if (!bucket) throw new Error(`Card ${card.id} uses undeclared step "${card.step}"`);
    bucket.push(card.id);
  });
  return stepMetadata.map((step, order) => {
    const cardIds = grouped.get(step.key) ?? [];
    if (cardIds.length === 0) throw new Error(`Step ${step.key} has no cards`);
    return {
      id: `${step.key}_step`,
      order,
      title: step.title.zh,
      description: step.description.zh,
      cardIds,
      freezeDuringBuild: false,
      releasePhysicsAfterStep: false,
      recommendedPresetId: metaByKey.get(step.key).preset,
    };
  });
};

const decorateCards = (cards, offset = 0) => cards.map((card, index) => ({
  ...card,
  suit: SUITS[(index + offset) % SUITS.length],
  rank: RANKS[(index + offset) % RANKS.length],
  color: (index + offset) % 2 === 0 ? 'black' : 'red',
}));

const assembleLevel = (level, structure) => {
  const cards = decorateCards(structure.cards);
  const steps = assignSteps(structure.cards, structure.steps);
  const snapshot = buildSnapshot(cards);
  const chapter = chapterOf(level.id);
  const tags = ['官方', '关卡', ...(chapter?.name.zh ? [chapter.name.zh] : [])];
  const blueprint = {
    schemaVersion: 2,
    id: `${level.id}_blueprint`,
    name: level.name.zh,
    description: level.description.zh,
    author: 'PaKer',
    category: CATEGORY_BY_CHAPTER[chapter?.id] ?? 'tutorial',
    tags,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    cardSize: CARD_SIZE,
    cardDimensions: {
      width: CARD_SIZES[CARD_SIZE].width,
      height: CARD_SIZES[CARD_SIZE].height,
      thickness: CARD_SIZES[CARD_SIZE].thickness,
    },
    cardCount: cards.length,
    coordinateSpace: 'structure-local',
    status: 'published',
    tolerances: level.tolerances,
    steps,
    snapshot,
  };
  const blueprintChecksum = checksumBlueprint(blueprint);
  const firstStage = level.stages[0];
  const tutorialCues = typeof level.tutorial.cues === 'function'
    ? level.tutorial.cues({ stepCount: steps.length, targetHeight: level.targetHeight })
    : level.tutorial.cues;
  return {
    schemaVersion: 2,
    publishRevision: 1,
    id: level.id,
    name: level.name,
    description: level.description,
    origin: 'official',
    requiresBlueprintMatch: level.requiresBlueprintMatch,
    author: 'PaKer',
    tags,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    status: 'published',
    sourceBlueprintId: blueprint.id,
    embeddedBlueprint: blueprint,
    blueprintChecksum,
    maxCards: level.maxCards,
    minCards: level.minCards,
    heightMultiplier: level.heightMultiplier,
    testDuration: firstStage.duration,
    testType: firstStage.testType,
    windStrength: firstStage.testType === 'WIND' ? firstStage.windStrength : undefined,
    weightMass: firstStage.testType === 'WEIGHT_DROP' ? firstStage.weightMass : undefined,
    weightDropOffset: firstStage.testType === 'WEIGHT_DROP' ? firstStage.weightDropOffset : undefined,
    testStages: level.stages.map((stage, index) => ({
      id: `${level.id}_stage_${index + 1}`,
      name: stage.name,
      testType: stage.testType,
      duration: stage.duration,
      windStrength: stage.testType === 'WIND' ? stage.windStrength : undefined,
      weightMass: stage.testType === 'WEIGHT_DROP' ? stage.weightMass : undefined,
      weightDropOffset: stage.testType === 'WEIGHT_DROP' ? stage.weightDropOffset : undefined,
    })),
    tutorial: {
      enabled: true,
      displayMode: 'first-time',
      skippable: true,
      entryDurationMs: 3800,
      entryTitle: level.tutorial.entryTitle,
      entrySubtitle: level.tutorial.entrySubtitle,
      cues: tutorialCues,
    },
    scoring: {
      baseScore: level.stages.reduce((total, stage) => total + stage.duration, 0) * 50,
      unusedCardBonus: 50,
      heightBonus: 100,
    },
    verification: {
      passed: true,
      playtestedAt: CREATED_AT,
      blueprintChecksum,
    },
  };
};

const survivorsWith = (level, strength) => simulateLevel({
  cards: level.__cards,
  stages: [{ id: 'probe', testType: 'WIND', duration: level.stages.find(stage => stage.testType === 'WIND').duration, windStrength: strength }],
  targetHeight: level.targetHeight,
}).then(result => result.survived);

/**
 * Largest of 1.4× / 2× / 3× the configured wind the structure still survives.
 * Survival is not strictly monotonic in the parameter (a harder gust can throw
 * the structure somewhere it keeps standing), so this probes fixed factors
 * instead of bisecting.
 */
const windMargin = async (level, configured) => {
  let achieved = 0;
  for (const factor of [1.4, 2, 3]) {
    if (await survivorsWith(level, configured * factor)) achieved = factor;
  }
  return achieved;
};

const findings = [];
const failures = [];

const verifyLevel = async (level, assembled) => {
  const structure = level.structure ? buildLevelStructure(level.structure) : null;
  if (!structure) throw new Error(`Level ${level.id} has no structure`);
  const cards = structure.cards;
  const gaps = interpenetrations(cards, 0.0005);
  const minGap = minimumCardGap(cards);
  const bounds = structureBounds(cards);
  const targetHeight = targetHeightFor(CARD_SIZES[CARD_SIZE].width, level.heightMultiplier);
  const testStages = assembled.testStages.map(stage => ({
    id: stage.id,
    testType: stage.testType,
    duration: stage.duration,
    windStrength: stage.windStrength,
    weightMass: stage.weightMass,
    weightDropOffset: stage.weightDropOffset,
  }));
  const result = await simulateLevel({ cards, stages: testStages, targetHeight });
  const level_ = { ...level, __cards: cards, targetHeight };

  const windStage = level.stages.find(stage => stage.testType === 'WIND');
  const dropStage = level.stages.find(stage => stage.testType === 'WEIGHT_DROP');
  const windAchieved = windStage ? await windMargin(level_, windStage.windStrength) : null;

  // Placement error: the player's build can sit up to ~12 cm off the reference
  // blueprint, so every verified build must also pass when the whole structure
  // is nudged in each direction.
  const placementRuns = [];
  for (const [shiftX, shiftZ] of PLACEMENT_SHIFTS) {
    const shifted = shiftAll(cards, [shiftX, 0, shiftZ]);
    const outcome = await simulateLevel({ cards: shifted, stages: testStages, targetHeight });
    placementRuns.push({ shift: [shiftX, shiftZ], survived: outcome.survived });
  }
  const placementPassed = placementRuns.filter(run => run.survived).length;

  const problems = [];
  if (gaps.length) problems.push(`interpenetration: ${gaps.slice(0, 3).map(hit => `${hit.left}/${hit.right}=${hit.gap}`).join(', ')}`);
  if (minGap < 0.0004) problems.push(`minimum gap ${minGap.toFixed(5)} below 0.4 mm`);
  if (level.requiresBlueprintMatch && cards.length !== level.minCards) {
    problems.push(`guided level must require every card (structure ${cards.length}, minCards ${level.minCards})`);
  }
  if (cards.length > level.maxCards) problems.push(`structure has ${cards.length} cards but maxCards is ${level.maxCards}`);
  if (!result.settled || result.settled.maxDisplacement > 0.05) problems.push(`settle drift ${result.settled?.maxDisplacement} m`);
  if (bounds.max[1] < targetHeight) problems.push(`structure height ${bounds.max[1].toFixed(2)} below target ${targetHeight}`);
  if (!result.survived) {
    const failedStage = result.stages.find(stage => !stage.survived);
    problems.push(`test failed at ${failedStage?.testType}: top ${failedStage?.maxTop} < ${failedStage?.threshold}`);
  }
  if (placementPassed < placementRuns.length) {
    const broken = placementRuns.filter(run => !run.survived).map(run => run.shift.join('/')).join(' ');
    problems.push(`placement error tolerance: ${placementPassed}/${placementRuns.length} shifted builds survive (failed at ${broken})`);
  }
  if (windStage && windAchieved !== null && windAchieved < 1.4) {
    problems.push(`wind margin below 1.4x (survives up to ${windAchieved}x)`);
  }

  findings.push({
    id: level.id,
    name: level.name.zh,
    cards: cards.length,
    height: Number(bounds.max[1].toFixed(2)),
    footprint: `${(bounds.max[0] - bounds.min[0]).toFixed(2)} × ${(bounds.max[2] - bounds.min[2]).toFixed(2)}`,
    targetHeight,
    wind: windStage ? windStage.windStrength : null,
    windTolerance: windAchieved,
    drop: dropStage ? dropStage.weightMass : null,
    placementPassed,
    placementTotal: placementRuns.length,
    settledDrift: result.settled?.maxDisplacement ?? null,
    stages: result.stages.map(stage => ({
      testType: stage.testType,
      survived: stage.survived,
      top: stage.maxTop,
      threshold: stage.threshold,
    })),
    minGap: Number(minGap.toFixed(5)),
    problems,
  });
  if (problems.length) failures.push({ id: level.id, problems });
};

const serializeModule = levels => {
  const body = levels.map(level => {
    const payload = {
      id: level.id,
      name: level.name,
      description: level.description,
      category: level.embeddedBlueprint.category,
      tags: level.tags,
      cardSize: level.embeddedBlueprint.cardSize,
      capturedAt: level.embeddedBlueprint.snapshot.capturedAt,
      originWorld: level.embeddedBlueprint.snapshot.originWorld,
      bounds: level.embeddedBlueprint.snapshot.bounds,
      cards: level.embeddedBlueprint.snapshot.cards,
      steps: level.embeddedBlueprint.steps,
      tolerances: level.embeddedBlueprint.tolerances,
      maxCards: level.maxCards,
      minCards: level.minCards,
      heightMultiplier: level.heightMultiplier,
      requiresBlueprintMatch: level.requiresBlueprintMatch,
      testStages: level.testStages,
      tutorial: level.tutorial,
      scoring: level.scoring,
    };
    const oneLine = value => JSON.stringify(value);
    const rows = (list, indent) => list
      .map((item, index) => `${indent}${oneLine(item)}${index === list.length - 1 ? '' : ','}`)
      .join('\n');
    return `  {
    "id": ${oneLine(payload.id)},
    "name": ${oneLine(payload.name)},
    "description": ${oneLine(payload.description)},
    "category": ${oneLine(payload.category)},
    "tags": ${oneLine(payload.tags)},
    "cardSize": ${oneLine(payload.cardSize)},
    "capturedAt": ${oneLine(payload.capturedAt)},
    "originWorld": ${oneLine(payload.originWorld)},
    "bounds": ${oneLine(payload.bounds)},
    "cards": [
${rows(payload.cards, '      ')}
    ],
    "steps": [
${rows(payload.steps, '      ')}
    ],
    "tolerances": ${oneLine(payload.tolerances)},
    "maxCards": ${payload.maxCards},
    "minCards": ${payload.minCards},
    "heightMultiplier": ${payload.heightMultiplier},
    "requiresBlueprintMatch": ${payload.requiresBlueprintMatch},
    "testStages": ${oneLine(payload.testStages)},
    "tutorial": {
      "enabled": ${payload.tutorial.enabled},
      "displayMode": ${oneLine(payload.tutorial.displayMode)},
      "skippable": ${payload.tutorial.skippable},
      "entryDurationMs": ${payload.tutorial.entryDurationMs},
      "entryTitle": ${oneLine(payload.tutorial.entryTitle)},
      "entrySubtitle": ${oneLine(payload.tutorial.entrySubtitle)},
      "cues": [
${rows(payload.tutorial.cues, '        ')}
      ]
    },
    "scoring": ${oneLine(payload.scoring)}
  },`;
  }).join('\n');

  return `/**
 * AUTO-GENERATED FILE — do not edit by hand.
 *
 * Produced by \`npm run level:build\` (scripts/level-factory/build.mjs) from
 * scripts/level-factory/levels.mjs and structures.mjs. Every reference
 * structure below was simulated with Rapier and had to survive its own level
 * test with a safety margin before this file was written.
 */

import type {
  BlueprintBounds,
  BlueprintStep,
  BlueprintTolerance,
  CardSize,
  LevelDefinition,
  LevelTestStage,
  LevelTutorial,
} from '../types';

export interface GeneratedLevelCard {
  id: string;
  order: number;
  position: [number, number, number];
  quaternion: [number, number, number, number];
  suit: 'spades' | 'hearts' | 'clubs' | 'diamonds';
  rank: string;
  color: 'red' | 'black';
}

export interface GeneratedOfficialLevel {
  id: string;
  name: Record<'zh' | 'en', string>;
  description: Record<'zh' | 'en', string>;
  category: 'tutorial' | 'architecture' | 'battle' | 'challenge' | 'experiment';
  tags: string[];
  cardSize: CardSize;
  capturedAt: string;
  originWorld: [number, number, number];
  bounds: BlueprintBounds;
  cards: GeneratedLevelCard[];
  steps: BlueprintStep[];
  tolerances: BlueprintTolerance;
  maxCards: number;
  minCards: number;
  heightMultiplier: number;
  requiresBlueprintMatch: boolean;
  testStages: LevelTestStage[];
  tutorial: LevelTutorial;
  scoring: LevelDefinition['scoring'];
}

export const GENERATED_OFFICIAL_LEVELS = ([
${body}
] as unknown) as GeneratedOfficialLevel[];
`;
};

const bundledServices = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'paker-level-build-'));
  const levelBundle = join(directory, 'official-levels.mjs');
  const campaignBundle = join(directory, 'official-campaign.mjs');
  await build({
    entryPoints: ['services/officialLevels.ts'],
    outfile: levelBundle,
    bundle: true,
    platform: 'node',
    format: 'esm',
    logLevel: 'silent',
  });
  await build({
    entryPoints: ['services/officialCampaign.ts'],
    outfile: campaignBundle,
    bundle: true,
    platform: 'node',
    format: 'esm',
    logLevel: 'silent',
  });
  const levels = await import(`${pathToFileURL(levelBundle).href}?v=${Date.now()}`);
  const campaign = await import(`${pathToFileURL(campaignBundle).href}?v=${Date.now()}`);
  await rm(directory, { recursive: true, force: true });
  return { levels, campaign };
};

const main = async () => {
  const levels = LEVEL_CATALOGUE.map(level => {
    const structure = buildLevelStructure(level.structure);
    const withTarget = { ...level, targetHeight: targetHeightFor(CARD_SIZES[CARD_SIZE].width, level.heightMultiplier) };
    return { level: withTarget, structure };
  });

  const assembled = [];
  for (const { level, structure } of levels) {
    const levelDefinition = assembleLevel(level, structure);
    assembled.push(levelDefinition);
    await verifyLevel(level, levelDefinition);
  }

  console.log('\nLevel factory verification');
  for (const finding of findings) {
    const wind = finding.wind === null ? '' : ` wind ${finding.wind} (${finding.windTolerance}x)`;
    const drop = finding.drop === null ? '' : ` drop ${finding.drop} kg`;
    const placement = ` placement ${finding.placementPassed}/${finding.placementTotal}`;
    console.log(`  ${finding.problems.length ? 'FAIL' : ' ok '} ${finding.id.padEnd(16)} cards ${String(finding.cards).padStart(2)}  h ${finding.height.toFixed(2)}  target ${finding.targetHeight}${wind}${drop}${placement}`);
  }
  if (failures.length) {
    console.error('\nVerification failed:');
    for (const failure of failures) console.error(`  ${failure.id}: ${failure.problems.join('; ')}`);
    process.exitCode = 1;
    return;
  }

  await writeFile(
    'services/officialLevelData.generated.ts',
    serializeModule(assembled),
    'utf8',
  );
  console.log('\nwrote services/officialLevelData.generated.ts');

  const { levels: runtimeLevels, campaign: runtimeCampaign } = await bundledServices();
  const runtime = runtimeLevels.OFFICIAL_LEVELS;
  if (runtime.length !== assembled.length) throw new Error(`runtime has ${runtime.length} levels, factory built ${assembled.length}`);
  runtime.forEach((levelDefinition, index) => {
    const expected = assembled[index];
    if (levelDefinition.id !== expected.id) throw new Error(`level order mismatch at ${index}`);
    if (levelDefinition.blueprintChecksum !== expected.blueprintChecksum) {
      throw new Error(`checksum mismatch for ${levelDefinition.id}`);
    }
    if (JSON.stringify(levelDefinition.embeddedBlueprint) !== JSON.stringify(expected.embeddedBlueprint)) {
      throw new Error(`blueprint mismatch for ${levelDefinition.id}`);
    }
  });
  console.log('runtime services agree with the factory output');

  await mkdir('public/levels', { recursive: true });
  for (const levelDefinition of runtime) {
    await writeFile(
      `public/levels/${levelDefinition.id}.paker-level.json`,
      `${JSON.stringify(levelDefinition, null, 2)}\n`,
      'utf8',
    );
  }
  console.log(`wrote ${runtime.length} importable level files to public/levels/`);

  const campaign = runtimeCampaign.DEFAULT_OFFICIAL_CAMPAIGN;
  await writeFile('public/official-campaign.json', `${JSON.stringify(campaign, null, 2)}\n`, 'utf8');
  console.log('wrote public/official-campaign.json');

  await writeReport(findings, runtime, campaign);
  console.log('wrote docs/level-factory-report.md');
};

const writeReport = async (rows, runtime, campaign) => {
  const table = [
    '| 关卡 | 名称 | 牌数 | 高度 | 目标高度 | 风力 | 风余量 | 落物 | 布置容差 | 判定 |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map(row => `| ${[
      `\`${row.id}\``,
      row.name,
      row.cards,
      row.height.toFixed(2),
      row.targetHeight,
      row.wind === null ? '—' : row.wind,
      row.windTolerance === null ? '—' : `${row.windTolerance}×`,
      row.drop === null ? '—' : `${row.drop} kg`,
      `${row.placementPassed}/${row.placementTotal}`,
      row.problems.length ? '❌' : '✅',
    ].join(' | ')} |`),
  ].join('\n');

  const content = `# 关卡工厂验证报告

> 由 \`npm run level:build\` 自动生成，请勿手工编辑。

## 一、这套东西是什么

PaKer 的关卡是数据，不是手工搭出来的模型：一张牌的位置用四元数描述，关卡就是
「一份蓝图快照 + 测试阶段 + 教学提示」。所以关卡可以由程序生成，也必须由程序验证。

本报告里的每一关都走完了同一条流水线：

1. \`structures.mjs\` 用「倾斜双牌 + 平放横梁」两种积木拼出参考结构；
2. 生成器保证任意两张牌之间至少有 0.4 mm 间隙（不允许初始穿插）；
3. \`verify.mjs\` 在无头 Rapier 里按游戏内完全相同的参数跑一遍该关的测试阶段
   （重力 −9.81、60 Hz、牌重 0.1 kg、摩擦 1、地面摩擦 1.1、阻尼 0.5、CCD 开启、
   风向力施加在质心上方 0.65 m 处、落物为半径 0.36 m 的球）；
4. 通过之后还要留余量：带风力的关卡必须扛住 1.4 倍风力，所有关卡都要按 ±12 cm
   摆放误差（玩家不可能和蓝图分毫不差）在四个方向复验，3 秒结算位移不能超过 5 cm；
5. 全部通过后才写出 \`services/officialLevelData.generated.ts\`。

## 二、验证结果

${table}

## 三、战役结构

${campaign.chapters.map((chapter, index) => `${index + 1}. **${chapter.name.zh}** — ${chapter.description.zh}（${chapter.levels.length} 关：${chapter.levels.map(entry => entry.level.name.zh).join('、')}）`).join('\n')}

## 四、怎么再加一关

1. 在 \`scripts/level-factory/levels.mjs\` 里加一条关卡定义（结构 id、测试阶段、教学文案）；
2. 在 \`structures.mjs\` 的注册表里加一个结构工厂；
3. 跑 \`npm run level:build\`。任何一关站不住，构建会直接失败并打印原因，
   不会把不可玩的关卡写进游戏。

## 五、已知发现

* 旧的 \`officialBlueprints\` 教学蓝图里，一层纸牌屋的两张「屋顶」牌在 X 方向重叠 1.36，
  四根外围斜撑与 A 字架本体穿插最深 0.83，在物理里是 3 秒内炸开的结构。
  本报告中的参考结构全部重新计算，任意两牌之间没有初始穿插。
* 风力原先通过 \`addForceAtPoint\` 每帧累加，而 Rapier 的力与力矩要到
  \`resetForces\` / \`resetTorques\` 才清零，实际风力会随帧数线性增长。
  现在 \`Card.tsx\` 在施力前清零，风才是编辑器里那个「风力强度」。
`;

  await writeFile('docs/level-factory-report.md', content, 'utf8');
};

await main();
