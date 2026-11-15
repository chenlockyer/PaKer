/**
 * AUTO-GENERATED FILE — do not edit by hand.
 *
 * Produced by `npm run level:build` (scripts/level-factory/build.mjs) from
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
  {
    "id": "a-frame",
    "name": {"zh":"A 字架入门","en":"A-Frame Basics"},
    "description": {"zh":"只使用 2 张牌搭建一个能够独立站立的 A 字架","en":"Build a freestanding A-frame using only 2 cards"},
    "category": "tutorial",
    "tags": ["官方","关卡","第一章 · 搭建基础"],
    "cardSize": "BRIDGE",
    "capturedAt": "2026-11-15T00:00:00.000Z",
    "originWorld": [0,0,0],
    "bounds": {"min":[-0.50652,0,-0.9],"max":[0.50652,2.76093,0.9],"size":[1.01304,2.76093,1.8]},
    "cards": [
      {"id":"af_a","order":0,"position":[-0.25357,1.38047,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"spades","rank":"A","color":"black"},
      {"id":"af_b","order":1,"position":[0.25357,1.38047,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"hearts","rank":"2","color":"red"}
    ],
    "steps": [
      {"id":"frame_step","order":0,"title":"相向倾斜","description":"两张牌从地面相向倾斜，顶端互相压住，这是所有纸牌结构的最小单元。","cardIds":["af_a","af_b"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"short_edge_forward_10"}
    ],
    "tolerances": {"horizontal":0.26,"height":0.18,"rotationDegrees":8,"nearHorizontal":0.55,"nearHeight":0.4,"nearRotationDegrees":24},
    "maxCards": 2,
    "minCards": 2,
    "heightMultiplier": 1,
    "requiresBlueprintMatch": true,
    "testStages": [{"id":"a-frame_stage_1","name":"稳定性测试","testType":"STABILITY","duration":3}],
    "tutorial": {
      "enabled": true,
      "displayMode": "first-time",
      "skippable": true,
      "entryDurationMs": 3800,
      "entryTitle": {"zh":"第一课 · 相向倾斜","en":"Lesson 1 · Lean Together"},
      "entrySubtitle": {"zh":"两张牌互相压住，就能站住。","en":"Two cards pressing on each other can stand."},
      "cues": [
        {"id":"cue_preset","kind":"preset","enabled":true,"text":{"zh":"先选短边后倾 10° 的预设","en":"Pick the short-edge leaning preset"},"target":{"type":"preset","presetId":"short_edge_forward_10"},"highlight":"arrow","hints":[{"delayMs":4000,"highlight":"pulse","text":{"zh":"预设轮盘里带箭头的图标就是倾斜放置","en":"The arrowed icon in the preset wheel is the leaning placement"}}],"feedback":{"flash":true,"sound":true},"presetId":"short_edge_forward_10"},
        {"id":"cue_first_step","kind":"blueprint-step","enabled":true,"text":{"zh":"按蓝图放下第一组牌","en":"Place the first group of cards"},"target":{"type":"blueprint-step","stepIndex":0},"highlight":"blueprint-glow","hints":[],"feedback":{"flash":true,"sound":true},"blueprintStepIndex":0},
        {"id":"cue_finish_build","kind":"blueprint-step","enabled":true,"text":{"zh":"补齐剩余蓝图，再用空格锁定高度","en":"Finish the blueprint; hold Space to lock height"},"target":{"type":"blueprint-step","stepIndex":0},"highlight":"blueprint-glow","hints":[],"feedback":{"flash":true,"sound":true},"blueprintStepIndex":0},
        {"id":"cue_test","kind":"test-start","enabled":true,"text":{"zh":"开始测试，看它能不能站住","en":"Start the test and see if it holds"},"target":{"type":"control","control":"test"},"highlight":"arrow","hints":[],"feedback":{"flash":true,"sound":true}},
        {"id":"cue_success","kind":"test-success","enabled":true,"text":{"zh":"站住了！","en":"It stands!"},"target":{"type":"none"},"highlight":"pulse","hints":[],"feedback":{"flash":true,"sound":true}}
      ]
    },
    "scoring": {"baseScore":150,"unusedCardBonus":50,"heightBonus":100}
  },
  {
    "id": "roof-house",
    "name": {"zh":"一层纸牌屋","en":"One-Story House"},
    "description": {"zh":"使用不超过 10 张牌搭建有屋顶的一层房子，并顶住 5 秒轻风","en":"Build a roofed one-story house with no more than 10 cards and hold 5 seconds of light wind"},
    "category": "tutorial",
    "tags": ["官方","关卡","第一章 · 搭建基础"],
    "cardSize": "BRIDGE",
    "capturedAt": "2026-11-15T00:00:00.000Z",
    "originWorld": [0,0,0],
    "bounds": {"min":[-1.12652,0,-1.4],"max":[1.12652,4.58066,1.4],"size":[2.25304,4.58066,2.8]},
    "cards": [
      {"id":"rh_base_s1_p1_a","order":0,"position":[-0.87357,1.38047,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"spades","rank":"A","color":"black"},
      {"id":"rh_base_s1_p1_b","order":1,"position":[-0.36643,1.38047,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"hearts","rank":"2","color":"red"},
      {"id":"rh_base_s1_p2_a","order":2,"position":[0.36643,1.38047,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"clubs","rank":"3","color":"black"},
      {"id":"rh_base_s1_p2_b","order":3,"position":[0.87357,1.38047,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"diamonds","rank":"4","color":"red"},
      {"id":"rh_base_s1_deck","order":4,"position":[0,2.77213,0],"quaternion":[0,0,0,1],"suit":"spades","rank":"5","color":"black"},
      {"id":"rh_roof_p1_a","order":5,"position":[-0.71674,3.67139,0],"quaternion":[0,0,0.642788,0.766044],"suit":"hearts","rank":"6","color":"red"},
      {"id":"rh_roof_p1_b","order":6,"position":[-0.38326,3.67139,0],"quaternion":[0,0,0.766044,0.642788],"suit":"clubs","rank":"7","color":"black"},
      {"id":"rh_roof_p2_a","order":7,"position":[0.38326,3.67139,0],"quaternion":[0,0,0.642788,0.766044],"suit":"diamonds","rank":"8","color":"red"},
      {"id":"rh_roof_p2_b","order":8,"position":[0.71674,3.67139,0],"quaternion":[0,0,0.766044,0.642788],"suit":"spades","rank":"9","color":"black"},
      {"id":"rh_roof_deck","order":9,"position":[0,4.57066,0],"quaternion":[0,0,0,1],"suit":"hearts","rank":"10","color":"red"}
    ],
    "steps": [
      {"id":"s1_step","order":0,"title":"第 1 层支撑","description":"两张相向倾斜的牌构成一组支撑，成对摆放后形成承重面带。","cardIds":["rh_base_s1_p1_a","rh_base_s1_p1_b","rh_base_s1_p2_a","rh_base_s1_p2_b"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"short_edge_forward_10"},
      {"id":"s1_deck_step","order":1,"title":"第 1 层横梁","description":"把平放的牌横跨两组支撑的顶端，锁定这一层的平面。","cardIds":["rh_base_s1_deck"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"},
      {"id":"roof_step","order":2,"title":"屋顶斜撑","description":"用长边接地的矮支撑压在顶层横梁上，形成收口的屋顶。","cardIds":["rh_roof_p1_a","rh_roof_p1_b","rh_roof_p2_a","rh_roof_p2_b"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"long_edge_left_10"},
      {"id":"roof_deck_step","order":3,"title":"屋脊","description":"最后盖上屋脊牌，让屋顶的重量落回两层支撑之间。","cardIds":["rh_roof_deck"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"}
    ],
    "tolerances": {"horizontal":0.26,"height":0.18,"rotationDegrees":8,"nearHorizontal":0.55,"nearHeight":0.4,"nearRotationDegrees":24},
    "maxCards": 10,
    "minCards": 10,
    "heightMultiplier": 1,
    "requiresBlueprintMatch": true,
    "testStages": [{"id":"roof-house_stage_1","name":"风力测试","testType":"WIND","duration":5,"windStrength":0.012}],
    "tutorial": {
      "enabled": true,
      "displayMode": "first-time",
      "skippable": true,
      "entryDurationMs": 3800,
      "entryTitle": {"zh":"第二课 · 成对与封顶","en":"Lesson 2 · Pairs and Decks"},
      "entrySubtitle": {"zh":"两组支撑加一张横梁，才有平面的刚度。","en":"Two supports and a deck are what give a plane its stiffness."},
      "cues": [
        {"id":"cue_preset","kind":"preset","enabled":true,"text":{"zh":"先选短边后倾 10° 的预设","en":"Pick the short-edge leaning preset"},"target":{"type":"preset","presetId":"short_edge_forward_10"},"highlight":"arrow","hints":[{"delayMs":4000,"highlight":"pulse","text":{"zh":"预设轮盘里带箭头的图标就是倾斜放置","en":"The arrowed icon in the preset wheel is the leaning placement"}}],"feedback":{"flash":true,"sound":true},"presetId":"short_edge_forward_10"},
        {"id":"cue_first_step","kind":"blueprint-step","enabled":true,"text":{"zh":"按蓝图放下第一组牌","en":"Place the first group of cards"},"target":{"type":"blueprint-step","stepIndex":0},"highlight":"blueprint-glow","hints":[],"feedback":{"flash":true,"sound":true},"blueprintStepIndex":0},
        {"id":"cue_finish_build","kind":"blueprint-step","enabled":true,"text":{"zh":"补齐剩余蓝图，再用空格锁定高度","en":"Finish the blueprint; hold Space to lock height"},"target":{"type":"blueprint-step","stepIndex":3},"highlight":"blueprint-glow","hints":[],"feedback":{"flash":true,"sound":true},"blueprintStepIndex":3},
        {"id":"cue_test","kind":"test-start","enabled":true,"text":{"zh":"开始测试，看它能不能站住","en":"Start the test and see if it holds"},"target":{"type":"control","control":"test"},"highlight":"arrow","hints":[],"feedback":{"flash":true,"sound":true}},
        {"id":"cue_success","kind":"test-success","enabled":true,"text":{"zh":"站住了！","en":"It stands!"},"target":{"type":"none"},"highlight":"pulse","hints":[],"feedback":{"flash":true,"sound":true}}
      ]
    },
    "scoring": {"baseScore":250,"unusedCardBonus":50,"heightBonus":100}
  },
  {
    "id": "tripod",
    "name": {"zh":"三足鼎立","en":"Three-Legged Stand"},
    "description": {"zh":"用 3 张牌搭出互相压住的三角支撑，并保持 4 秒","en":"Stand three cards against each other in a triangle for 4 seconds"},
    "category": "tutorial",
    "tags": ["官方","关卡","第一章 · 搭建基础"],
    "cardSize": "BRIDGE",
    "capturedAt": "2026-11-15T00:00:00.000Z",
    "originWorld": [0,0,0],
    "bounds": {"min":[-1.44325,0,-1.66653],"max":[1.44325,2.66914,1.66653],"size":[2.88651,2.66914,3.33305]},
    "cards": [
      {"id":"tp_1","order":0,"position":[1.00112,1.33457,0],"quaternion":[-0.415627,-0.572061,-0.415627,0.572061],"suit":"spades","rank":"A","color":"black"},
      {"id":"tp_2","order":1,"position":[-0.44276,1.33457,0.83363],"quaternion":[-0.15213,0.78145,0.567757,0.209389],"suit":"hearts","rank":"2","color":"red"},
      {"id":"tp_3","order":2,"position":[-0.44276,1.33457,-0.83363],"quaternion":[-0.567757,0.209389,0.15213,0.78145],"suit":"clubs","rank":"3","color":"black"}
    ],
    "steps": [
      {"id":"legs_step","order":0,"title":"三足鼎立","description":"三张牌各自向内倾斜，顶端互相压住，形成最省牌的三向支撑。","cardIds":["tp_1","tp_2","tp_3"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"short_edge_forward_10"}
    ],
    "tolerances": {"horizontal":0.26,"height":0.18,"rotationDegrees":8,"nearHorizontal":0.55,"nearHeight":0.4,"nearRotationDegrees":24},
    "maxCards": 3,
    "minCards": 3,
    "heightMultiplier": 1,
    "requiresBlueprintMatch": true,
    "testStages": [{"id":"tripod_stage_1","name":"稳定性测试","testType":"STABILITY","duration":4}],
    "tutorial": {
      "enabled": true,
      "displayMode": "first-time",
      "skippable": true,
      "entryDurationMs": 3800,
      "entryTitle": {"zh":"第三课 · 第三只脚","en":"Lesson 3 · The Third Leg"},
      "entrySubtitle": {"zh":"两张牌只能撑一条线，三张牌才撑住一个面。","en":"Two cards hold a line; three cards hold a plane."},
      "cues": [
        {"id":"cue_preset","kind":"preset","enabled":true,"text":{"zh":"先选短边后倾 10° 的预设","en":"Pick the short-edge leaning preset"},"target":{"type":"preset","presetId":"short_edge_forward_10"},"highlight":"arrow","hints":[{"delayMs":4000,"highlight":"pulse","text":{"zh":"预设轮盘里带箭头的图标就是倾斜放置","en":"The arrowed icon in the preset wheel is the leaning placement"}}],"feedback":{"flash":true,"sound":true},"presetId":"short_edge_forward_10"},
        {"id":"cue_first_step","kind":"blueprint-step","enabled":true,"text":{"zh":"按蓝图放下第一组牌","en":"Place the first group of cards"},"target":{"type":"blueprint-step","stepIndex":0},"highlight":"blueprint-glow","hints":[],"feedback":{"flash":true,"sound":true},"blueprintStepIndex":0},
        {"id":"cue_finish_build","kind":"blueprint-step","enabled":true,"text":{"zh":"补齐剩余蓝图，再用空格锁定高度","en":"Finish the blueprint; hold Space to lock height"},"target":{"type":"blueprint-step","stepIndex":0},"highlight":"blueprint-glow","hints":[],"feedback":{"flash":true,"sound":true},"blueprintStepIndex":0},
        {"id":"cue_test","kind":"test-start","enabled":true,"text":{"zh":"开始测试，看它能不能站住","en":"Start the test and see if it holds"},"target":{"type":"control","control":"test"},"highlight":"arrow","hints":[],"feedback":{"flash":true,"sound":true}},
        {"id":"cue_success","kind":"test-success","enabled":true,"text":{"zh":"站住了！","en":"It stands!"},"target":{"type":"none"},"highlight":"pulse","hints":[],"feedback":{"flash":true,"sound":true}}
      ]
    },
    "scoring": {"baseScore":200,"unusedCardBonus":50,"heightBonus":100}
  },
  {
    "id": "gate",
    "name": {"zh":"牌拱门","en":"Card Gate"},
    "description": {"zh":"搭出两根柱子和一根门楣，让门楣的重量分到两侧","en":"Raise two piers and a lintel so the lintel shares its weight with both sides"},
    "category": "tutorial",
    "tags": ["官方","关卡","第一章 · 搭建基础"],
    "cardSize": "BRIDGE",
    "capturedAt": "2026-11-15T00:00:00.000Z",
    "originWorld": [0,0,0],
    "bounds": {"min":[-2.42652,0,-1.4],"max":[2.42652,2.80333,1.4],"size":[4.85304,2.80333,2.8]},
    "cards": [
      {"id":"gt_left_p1_a","order":0,"position":[-2.17357,1.38047,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"spades","rank":"A","color":"black"},
      {"id":"gt_left_p1_b","order":1,"position":[-1.66643,1.38047,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"hearts","rank":"2","color":"red"},
      {"id":"gt_left_p2_a","order":2,"position":[-0.93357,1.38047,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"clubs","rank":"3","color":"black"},
      {"id":"gt_left_p2_b","order":3,"position":[-0.42643,1.38047,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"diamonds","rank":"4","color":"red"},
      {"id":"gt_left_deck","order":4,"position":[-1.3,2.77213,0],"quaternion":[0,0,0,1],"suit":"spades","rank":"5","color":"black"},
      {"id":"gt_right_p1_a","order":5,"position":[0.42643,1.38047,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"hearts","rank":"6","color":"red"},
      {"id":"gt_right_p1_b","order":6,"position":[0.93357,1.38047,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"clubs","rank":"7","color":"black"},
      {"id":"gt_right_p2_a","order":7,"position":[1.66643,1.38047,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"diamonds","rank":"8","color":"red"},
      {"id":"gt_right_p2_b","order":8,"position":[2.17357,1.38047,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"spades","rank":"9","color":"black"},
      {"id":"gt_right_deck","order":9,"position":[1.3,2.77213,0],"quaternion":[0,0,0,1],"suit":"hearts","rank":"10","color":"red"},
      {"id":"gt_bridge","order":10,"position":[0,2.79333,0],"quaternion":[0,0.707107,0,0.707107],"suit":"clubs","rank":"J","color":"black"}
    ],
    "steps": [
      {"id":"left_step","order":0,"title":"左柱支撑","description":"先立起一侧的两组支撑，柱子要垂直于地面。","cardIds":["gt_left_p1_a","gt_left_p1_b","gt_left_p2_a","gt_left_p2_b"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"short_edge_forward_10"},
      {"id":"left_deck_step","order":1,"title":"左柱横梁","description":"左柱封顶，这一层才有平面刚度。","cardIds":["gt_left_deck"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"},
      {"id":"right_step","order":2,"title":"右柱支撑","description":"另一侧保持同样的间距，两根柱子决定拱门的高度。","cardIds":["gt_right_p1_a","gt_right_p1_b","gt_right_p2_a","gt_right_p2_b"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"short_edge_forward_10"},
      {"id":"right_deck_step","order":3,"title":"右柱横梁","description":"两侧横梁落在同一高度，门楣才能水平。","cardIds":["gt_right_deck"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"},
      {"id":"bridge_step","order":4,"title":"门楣","description":"把长牌平放在两根柱子上，重量由两侧共同承担。","cardIds":["gt_bridge"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"}
    ],
    "tolerances": {"horizontal":0.26,"height":0.18,"rotationDegrees":8,"nearHorizontal":0.55,"nearHeight":0.4,"nearRotationDegrees":24},
    "maxCards": 14,
    "minCards": 11,
    "heightMultiplier": 1,
    "requiresBlueprintMatch": true,
    "testStages": [{"id":"gate_stage_1","name":"稳定性测试","testType":"STABILITY","duration":5}],
    "tutorial": {
      "enabled": true,
      "displayMode": "first-time",
      "skippable": true,
      "entryDurationMs": 3800,
      "entryTitle": {"zh":"第四课 · 跨与承重","en":"Lesson 4 · Spans and Load"},
      "entrySubtitle": {"zh":"跨度越大，两侧的柱子越要站稳。","en":"The wider the span, the harder both piers must work."},
      "cues": [
        {"id":"cue_preset","kind":"preset","enabled":true,"text":{"zh":"先选短边后倾 10° 的预设","en":"Pick the short-edge leaning preset"},"target":{"type":"preset","presetId":"short_edge_forward_10"},"highlight":"arrow","hints":[{"delayMs":4000,"highlight":"pulse","text":{"zh":"预设轮盘里带箭头的图标就是倾斜放置","en":"The arrowed icon in the preset wheel is the leaning placement"}}],"feedback":{"flash":true,"sound":true},"presetId":"short_edge_forward_10"},
        {"id":"cue_first_step","kind":"blueprint-step","enabled":true,"text":{"zh":"按蓝图放下第一组牌","en":"Place the first group of cards"},"target":{"type":"blueprint-step","stepIndex":0},"highlight":"blueprint-glow","hints":[],"feedback":{"flash":true,"sound":true},"blueprintStepIndex":0},
        {"id":"cue_finish_build","kind":"blueprint-step","enabled":true,"text":{"zh":"补齐剩余蓝图，再用空格锁定高度","en":"Finish the blueprint; hold Space to lock height"},"target":{"type":"blueprint-step","stepIndex":4},"highlight":"blueprint-glow","hints":[],"feedback":{"flash":true,"sound":true},"blueprintStepIndex":4},
        {"id":"cue_test","kind":"test-start","enabled":true,"text":{"zh":"开始测试，看它能不能站住","en":"Start the test and see if it holds"},"target":{"type":"control","control":"test"},"highlight":"arrow","hints":[],"feedback":{"flash":true,"sound":true}},
        {"id":"cue_success","kind":"test-success","enabled":true,"text":{"zh":"站住了！","en":"It stands!"},"target":{"type":"none"},"highlight":"pulse","hints":[],"feedback":{"flash":true,"sound":true}}
      ]
    },
    "scoring": {"baseScore":250,"unusedCardBonus":50,"heightBonus":100}
  },
  {
    "id": "weight-drop",
    "name": {"zh":"落物冲击","en":"Drop Impact"},
    "description": {"zh":"重物会从 5.1 米高处落下：房子要够高、屋顶要够稳才接得住","en":"A weight drops from 5.1 m — build tall enough, with a roof steady enough to catch it"},
    "category": "challenge",
    "tags": ["官方","关卡","第二章 · 结构考验"],
    "cardSize": "BRIDGE",
    "capturedAt": "2026-11-15T00:00:00.000Z",
    "originWorld": [0,0,0],
    "bounds": {"min":[-1.12652,0,-1.4],"max":[1.12652,4.58066,1.4],"size":[2.25304,4.58066,2.8]},
    "cards": [
      {"id":"wd_base_s1_p1_a","order":0,"position":[-0.87357,1.38047,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"spades","rank":"A","color":"black"},
      {"id":"wd_base_s1_p1_b","order":1,"position":[-0.36643,1.38047,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"hearts","rank":"2","color":"red"},
      {"id":"wd_base_s1_p2_a","order":2,"position":[0.36643,1.38047,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"clubs","rank":"3","color":"black"},
      {"id":"wd_base_s1_p2_b","order":3,"position":[0.87357,1.38047,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"diamonds","rank":"4","color":"red"},
      {"id":"wd_base_s1_deck","order":4,"position":[0,2.77213,0],"quaternion":[0,0,0,1],"suit":"spades","rank":"5","color":"black"},
      {"id":"wd_roof_p1_a","order":5,"position":[-0.71674,3.67139,0],"quaternion":[0,0,0.642788,0.766044],"suit":"hearts","rank":"6","color":"red"},
      {"id":"wd_roof_p1_b","order":6,"position":[-0.38326,3.67139,0],"quaternion":[0,0,0.766044,0.642788],"suit":"clubs","rank":"7","color":"black"},
      {"id":"wd_roof_p2_a","order":7,"position":[0.38326,3.67139,0],"quaternion":[0,0,0.642788,0.766044],"suit":"diamonds","rank":"8","color":"red"},
      {"id":"wd_roof_p2_b","order":8,"position":[0.71674,3.67139,0],"quaternion":[0,0,0.766044,0.642788],"suit":"spades","rank":"9","color":"black"},
      {"id":"wd_roof_deck","order":9,"position":[0,4.57066,0],"quaternion":[0,0,0,1],"suit":"hearts","rank":"10","color":"red"}
    ],
    "steps": [
      {"id":"s1_step","order":0,"title":"第 1 层支撑","description":"两张相向倾斜的牌构成一组支撑，成对摆放后形成承重面带。","cardIds":["wd_base_s1_p1_a","wd_base_s1_p1_b","wd_base_s1_p2_a","wd_base_s1_p2_b"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"short_edge_forward_10"},
      {"id":"s1_deck_step","order":1,"title":"第 1 层横梁","description":"把平放的牌横跨两组支撑的顶端，锁定这一层的平面。","cardIds":["wd_base_s1_deck"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"},
      {"id":"roof_step","order":2,"title":"屋顶斜撑","description":"用长边接地的矮支撑压在顶层横梁上，形成收口的屋顶。","cardIds":["wd_roof_p1_a","wd_roof_p1_b","wd_roof_p2_a","wd_roof_p2_b"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"long_edge_left_10"},
      {"id":"roof_deck_step","order":3,"title":"屋脊","description":"最后盖上屋脊牌，让屋顶的重量落回两层支撑之间。","cardIds":["wd_roof_deck"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"}
    ],
    "tolerances": {"horizontal":0.32,"height":0.22,"rotationDegrees":10,"nearHorizontal":0.62,"nearHeight":0.46,"nearRotationDegrees":28},
    "maxCards": 12,
    "minCards": 8,
    "heightMultiplier": 1,
    "requiresBlueprintMatch": false,
    "testStages": [{"id":"weight-drop_stage_1","name":"落物冲击","testType":"WEIGHT_DROP","duration":6,"weightMass":0.45,"weightDropOffset":3.4}],
    "tutorial": {
      "enabled": true,
      "displayMode": "first-time",
      "skippable": true,
      "entryDurationMs": 3800,
      "entryTitle": {"zh":"第五课 · 承重路径","en":"Lesson 5 · Load Path"},
      "entrySubtitle": {"zh":"重量要沿着牌一直传到地面。","en":"Weight has to travel down the cards into the floor."},
      "cues": [
        {"id":"cue_preset","kind":"preset","enabled":true,"text":{"zh":"从短边倾斜的支撑开始","en":"Start with short-edge leaning supports"},"target":{"type":"preset","presetId":"short_edge_forward_10"},"highlight":"arrow","hints":[{"delayMs":5000,"highlight":"pulse","text":{"zh":"一组 A 字架就能站住，但成对摆放才承得住上面一层","en":"One A-frame stands, but a pair carries the storey above"}}],"feedback":{"flash":true,"sound":true},"presetId":"short_edge_forward_10"},
        {"id":"cue_height","kind":"height","enabled":true,"text":{"zh":"把结构搭到目标高度","en":"Build up to the target height"},"target":{"type":"world","position":[0,1.7,0]},"highlight":"arrow","hints":[{"delayMs":6000,"highlight":"pulse","text":{"zh":"按住空格可以锁定当前高度再放牌","en":"Hold Space to lock the current height while placing"}}],"feedback":{"flash":true,"sound":true},"targetHeight":1.7},
        {"id":"cue_test","kind":"test-start","enabled":true,"text":{"zh":"开始测试","en":"Start the test"},"target":{"type":"control","control":"test"},"highlight":"arrow","hints":[],"feedback":{"flash":true,"sound":true}},
        {"id":"cue_success","kind":"test-success","enabled":true,"text":{"zh":"撑住了！","en":"It held!"},"target":{"type":"none"},"highlight":"pulse","hints":[],"feedback":{"flash":true,"sound":true}}
      ]
    },
    "scoring": {"baseScore":300,"unusedCardBonus":50,"heightBonus":100}
  },
  {
    "id": "two-story-wind",
    "name": {"zh":"两层风力挑战","en":"Two-Story Wind Trial"},
    "description": {"zh":"搭到两层高度，并承受 10 秒风","en":"Build two storeys and survive 10 seconds of wind"},
    "category": "challenge",
    "tags": ["官方","关卡","第二章 · 结构考验"],
    "cardSize": "BRIDGE",
    "capturedAt": "2026-11-15T00:00:00.000Z",
    "originWorld": [0,0,0],
    "bounds": {"min":[-1.4,0,-1.4],"max":[1.4,5.56547,1.4],"size":[2.8,5.56547,2.8]},
    "cards": [
      {"id":"tw_s1_p1_a","order":0,"position":[-0.87357,1.38047,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"spades","rank":"A","color":"black"},
      {"id":"tw_s1_p1_b","order":1,"position":[-0.36643,1.38047,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"hearts","rank":"2","color":"red"},
      {"id":"tw_s1_p2_a","order":2,"position":[0.36643,1.38047,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"clubs","rank":"3","color":"black"},
      {"id":"tw_s1_p2_b","order":3,"position":[0.87357,1.38047,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"diamonds","rank":"4","color":"red"},
      {"id":"tw_s1_deck","order":4,"position":[0,2.77213,0],"quaternion":[0,0,0,1],"suit":"spades","rank":"5","color":"black"},
      {"id":"tw_s2_p1_a","order":5,"position":[0,4.1638,-0.87356],"quaternion":[0,0.642788,0.766044,0],"suit":"hearts","rank":"6","color":"red"},
      {"id":"tw_s2_p1_b","order":6,"position":[0,4.1638,-0.36644],"quaternion":[0,0.766044,0.642788,0],"suit":"clubs","rank":"7","color":"black"},
      {"id":"tw_s2_p2_a","order":7,"position":[0,4.1638,0.36644],"quaternion":[0,0.642788,0.766044,0],"suit":"diamonds","rank":"8","color":"red"},
      {"id":"tw_s2_p2_b","order":8,"position":[0,4.1638,0.87356],"quaternion":[0,0.766044,0.642788,0],"suit":"spades","rank":"9","color":"black"},
      {"id":"tw_s2_deck","order":9,"position":[0,5.55547,0],"quaternion":[0,0.707107,0,0.707107],"suit":"hearts","rank":"10","color":"red"}
    ],
    "steps": [
      {"id":"s1_step","order":0,"title":"第 1 层支撑","description":"两张相向倾斜的牌构成一组支撑，成对摆放后形成承重面带。","cardIds":["tw_s1_p1_a","tw_s1_p1_b","tw_s1_p2_a","tw_s1_p2_b"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"short_edge_forward_10"},
      {"id":"s1_deck_step","order":1,"title":"第 1 层横梁","description":"把平放的牌横跨两组支撑的顶端，锁定这一层的平面。","cardIds":["tw_s1_deck"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"},
      {"id":"s2_step","order":2,"title":"第 2 层支撑","description":"两张相向倾斜的牌构成一组支撑，成对摆放后形成承重面带。","cardIds":["tw_s2_p1_a","tw_s2_p1_b","tw_s2_p2_a","tw_s2_p2_b"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"short_edge_forward_10"},
      {"id":"s2_deck_step","order":3,"title":"第 2 层横梁","description":"把平放的牌横跨两组支撑的顶端，锁定这一层的平面。","cardIds":["tw_s2_deck"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"}
    ],
    "tolerances": {"horizontal":0.32,"height":0.22,"rotationDegrees":10,"nearHorizontal":0.62,"nearHeight":0.46,"nearRotationDegrees":28},
    "maxCards": 20,
    "minCards": 8,
    "heightMultiplier": 2,
    "requiresBlueprintMatch": false,
    "testStages": [{"id":"two-story-wind_stage_1","name":"风力测试","testType":"WIND","duration":10,"windStrength":0.05}],
    "tutorial": {
      "enabled": true,
      "displayMode": "first-time",
      "skippable": true,
      "entryDurationMs": 3800,
      "entryTitle": {"zh":"第六课 · 交错","en":"Lesson 6 · Alternate"},
      "entrySubtitle": {"zh":"上下两层换一个方向，风就推不动整座塔。","en":"Turn each storey ninety degrees and the wind loses its grip."},
      "cues": [
        {"id":"cue_preset","kind":"preset","enabled":true,"text":{"zh":"从短边倾斜的支撑开始","en":"Start with short-edge leaning supports"},"target":{"type":"preset","presetId":"short_edge_forward_10"},"highlight":"arrow","hints":[{"delayMs":5000,"highlight":"pulse","text":{"zh":"一组 A 字架就能站住，但成对摆放才承得住上面一层","en":"One A-frame stands, but a pair carries the storey above"}}],"feedback":{"flash":true,"sound":true},"presetId":"short_edge_forward_10"},
        {"id":"cue_height","kind":"height","enabled":true,"text":{"zh":"把结构搭到目标高度","en":"Build up to the target height"},"target":{"type":"world","position":[0,3.5,0]},"highlight":"arrow","hints":[{"delayMs":6000,"highlight":"pulse","text":{"zh":"按住空格可以锁定当前高度再放牌","en":"Hold Space to lock the current height while placing"}}],"feedback":{"flash":true,"sound":true},"targetHeight":3.5},
        {"id":"cue_test","kind":"test-start","enabled":true,"text":{"zh":"开始测试","en":"Start the test"},"target":{"type":"control","control":"test"},"highlight":"arrow","hints":[],"feedback":{"flash":true,"sound":true}},
        {"id":"cue_success","kind":"test-success","enabled":true,"text":{"zh":"撑住了！","en":"It held!"},"target":{"type":"none"},"highlight":"pulse","hints":[],"feedback":{"flash":true,"sound":true}}
      ]
    },
    "scoring": {"baseScore":500,"unusedCardBonus":50,"heightBonus":100}
  },
  {
    "id": "wind-corridor",
    "name": {"zh":"风廊","en":"Wind Corridor"},
    "description": {"zh":"把三跨连成一排，顶住 8 秒侧风","en":"Line up three bays and hold 8 seconds of side wind"},
    "category": "challenge",
    "tags": ["官方","关卡","第二章 · 结构考验"],
    "cardSize": "BRIDGE",
    "capturedAt": "2026-11-15T00:00:00.000Z",
    "originWorld": [0,0,0],
    "bounds": {"min":[-1.12652,0,-4.3],"max":[1.12652,2.78213,4.3],"size":[2.25304,2.78213,8.6]},
    "cards": [
      {"id":"wc1_p1_a","order":0,"position":[-0.87357,1.38047,-2.9],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"spades","rank":"A","color":"black"},
      {"id":"wc1_p1_b","order":1,"position":[-0.36643,1.38047,-2.9],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"hearts","rank":"2","color":"red"},
      {"id":"wc1_p2_a","order":2,"position":[0.36643,1.38047,-2.9],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"clubs","rank":"3","color":"black"},
      {"id":"wc1_p2_b","order":3,"position":[0.87357,1.38047,-2.9],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"diamonds","rank":"4","color":"red"},
      {"id":"wc1_deck","order":4,"position":[0,2.77213,-2.9],"quaternion":[0,0,0,1],"suit":"spades","rank":"5","color":"black"},
      {"id":"wc2_p1_a","order":5,"position":[-0.87357,1.38047,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"hearts","rank":"6","color":"red"},
      {"id":"wc2_p1_b","order":6,"position":[-0.36643,1.38047,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"clubs","rank":"7","color":"black"},
      {"id":"wc2_p2_a","order":7,"position":[0.36643,1.38047,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"diamonds","rank":"8","color":"red"},
      {"id":"wc2_p2_b","order":8,"position":[0.87357,1.38047,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"spades","rank":"9","color":"black"},
      {"id":"wc2_deck","order":9,"position":[0,2.77213,0],"quaternion":[0,0,0,1],"suit":"hearts","rank":"10","color":"red"},
      {"id":"wc3_p1_a","order":10,"position":[-0.87357,1.38047,2.9],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"clubs","rank":"J","color":"black"},
      {"id":"wc3_p1_b","order":11,"position":[-0.36643,1.38047,2.9],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"diamonds","rank":"Q","color":"red"},
      {"id":"wc3_p2_a","order":12,"position":[0.36643,1.38047,2.9],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"spades","rank":"K","color":"black"},
      {"id":"wc3_p2_b","order":13,"position":[0.87357,1.38047,2.9],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"hearts","rank":"A","color":"red"},
      {"id":"wc3_deck","order":14,"position":[0,2.77213,2.9],"quaternion":[0,0,0,1],"suit":"clubs","rank":"2","color":"black"}
    ],
    "steps": [
      {"id":"bay1_step","order":0,"title":"第 1 跨支撑","description":"跨与跨之间保持半张牌的间隙，风会从缝隙穿过而不是推动整面墙。","cardIds":["wc1_p1_a","wc1_p1_b","wc1_p2_a","wc1_p2_b"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"short_edge_forward_10"},
      {"id":"bay1_deck_step","order":1,"title":"第 1 跨横梁","description":"每个跨都要单独封顶，让每一跨都能独立承重。","cardIds":["wc1_deck"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"},
      {"id":"bay2_step","order":2,"title":"第 2 跨支撑","description":"跨与跨之间保持半张牌的间隙，风会从缝隙穿过而不是推动整面墙。","cardIds":["wc2_p1_a","wc2_p1_b","wc2_p2_a","wc2_p2_b"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"short_edge_forward_10"},
      {"id":"bay2_deck_step","order":3,"title":"第 2 跨横梁","description":"每个跨都要单独封顶，让每一跨都能独立承重。","cardIds":["wc2_deck"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"},
      {"id":"bay3_step","order":4,"title":"第 3 跨支撑","description":"跨与跨之间保持半张牌的间隙，风会从缝隙穿过而不是推动整面墙。","cardIds":["wc3_p1_a","wc3_p1_b","wc3_p2_a","wc3_p2_b"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"short_edge_forward_10"},
      {"id":"bay3_deck_step","order":5,"title":"第 3 跨横梁","description":"每个跨都要单独封顶，让每一跨都能独立承重。","cardIds":["wc3_deck"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"}
    ],
    "tolerances": {"horizontal":0.32,"height":0.22,"rotationDegrees":10,"nearHorizontal":0.62,"nearHeight":0.46,"nearRotationDegrees":28},
    "maxCards": 18,
    "minCards": 12,
    "heightMultiplier": 1,
    "requiresBlueprintMatch": false,
    "testStages": [{"id":"wind-corridor_stage_1","name":"风力测试","testType":"WIND","duration":8,"windStrength":0.03}],
    "tutorial": {
      "enabled": true,
      "displayMode": "first-time",
      "skippable": true,
      "entryDurationMs": 3800,
      "entryTitle": {"zh":"第七课 · 分散","en":"Lesson 7 · Spread Out"},
      "entrySubtitle": {"zh":"每跨都单独封顶，风就找不到一处能推倒整排。","en":"Cap every bay on its own so no single gust can take the row down."},
      "cues": [
        {"id":"cue_preset","kind":"preset","enabled":true,"text":{"zh":"从短边倾斜的支撑开始","en":"Start with short-edge leaning supports"},"target":{"type":"preset","presetId":"short_edge_forward_10"},"highlight":"arrow","hints":[{"delayMs":5000,"highlight":"pulse","text":{"zh":"一组 A 字架就能站住，但成对摆放才承得住上面一层","en":"One A-frame stands, but a pair carries the storey above"}}],"feedback":{"flash":true,"sound":true},"presetId":"short_edge_forward_10"},
        {"id":"cue_height","kind":"height","enabled":true,"text":{"zh":"把结构搭到目标高度","en":"Build up to the target height"},"target":{"type":"world","position":[0,1.7,0]},"highlight":"arrow","hints":[{"delayMs":6000,"highlight":"pulse","text":{"zh":"按住空格可以锁定当前高度再放牌","en":"Hold Space to lock the current height while placing"}}],"feedback":{"flash":true,"sound":true},"targetHeight":1.7},
        {"id":"cue_test","kind":"test-start","enabled":true,"text":{"zh":"开始测试","en":"Start the test"},"target":{"type":"control","control":"test"},"highlight":"arrow","hints":[],"feedback":{"flash":true,"sound":true}},
        {"id":"cue_success","kind":"test-success","enabled":true,"text":{"zh":"撑住了！","en":"It held!"},"target":{"type":"none"},"highlight":"pulse","hints":[],"feedback":{"flash":true,"sound":true}}
      ]
    },
    "scoring": {"baseScore":400,"unusedCardBonus":50,"heightBonus":100}
  },
  {
    "id": "three-story",
    "name": {"zh":"三层高塔","en":"Three-Story Tower"},
    "description": {"zh":"搭到三层高度，并在风里站住 10 秒","en":"Build three storeys and hold 10 seconds of wind"},
    "category": "challenge",
    "tags": ["官方","关卡","第二章 · 结构考验"],
    "cardSize": "BRIDGE",
    "capturedAt": "2026-11-15T00:00:00.000Z",
    "originWorld": [0,0,0],
    "bounds": {"min":[-1.4,0,-1.4],"max":[1.4,8.3488,1.4],"size":[2.8,8.3488,2.8]},
    "cards": [
      {"id":"ts_s1_p1_a","order":0,"position":[-0.87357,1.38047,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"spades","rank":"A","color":"black"},
      {"id":"ts_s1_p1_b","order":1,"position":[-0.36643,1.38047,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"hearts","rank":"2","color":"red"},
      {"id":"ts_s1_p2_a","order":2,"position":[0.36643,1.38047,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"clubs","rank":"3","color":"black"},
      {"id":"ts_s1_p2_b","order":3,"position":[0.87357,1.38047,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"diamonds","rank":"4","color":"red"},
      {"id":"ts_s1_deck","order":4,"position":[0,2.77213,0],"quaternion":[0,0,0,1],"suit":"spades","rank":"5","color":"black"},
      {"id":"ts_s2_p1_a","order":5,"position":[0,4.1638,-0.87356],"quaternion":[0,0.642788,0.766044,0],"suit":"hearts","rank":"6","color":"red"},
      {"id":"ts_s2_p1_b","order":6,"position":[0,4.1638,-0.36644],"quaternion":[0,0.766044,0.642788,0],"suit":"clubs","rank":"7","color":"black"},
      {"id":"ts_s2_p2_a","order":7,"position":[0,4.1638,0.36644],"quaternion":[0,0.642788,0.766044,0],"suit":"diamonds","rank":"8","color":"red"},
      {"id":"ts_s2_p2_b","order":8,"position":[0,4.1638,0.87356],"quaternion":[0,0.766044,0.642788,0],"suit":"spades","rank":"9","color":"black"},
      {"id":"ts_s2_deck","order":9,"position":[0,5.55547,0],"quaternion":[0,0.707107,0,0.707107],"suit":"hearts","rank":"10","color":"red"},
      {"id":"ts_s3_p1_a","order":10,"position":[-0.87357,6.94713,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"clubs","rank":"J","color":"black"},
      {"id":"ts_s3_p1_b","order":11,"position":[-0.36643,6.94713,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"diamonds","rank":"Q","color":"red"},
      {"id":"ts_s3_p2_a","order":12,"position":[0.36643,6.94713,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"spades","rank":"K","color":"black"},
      {"id":"ts_s3_p2_b","order":13,"position":[0.87357,6.94713,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"hearts","rank":"A","color":"red"},
      {"id":"ts_s3_deck","order":14,"position":[0,8.3388,0],"quaternion":[0,0,0,1],"suit":"clubs","rank":"2","color":"black"}
    ],
    "steps": [
      {"id":"s1_step","order":0,"title":"第 1 层支撑","description":"两张相向倾斜的牌构成一组支撑，成对摆放后形成承重面带。","cardIds":["ts_s1_p1_a","ts_s1_p1_b","ts_s1_p2_a","ts_s1_p2_b"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"short_edge_forward_10"},
      {"id":"s1_deck_step","order":1,"title":"第 1 层横梁","description":"把平放的牌横跨两组支撑的顶端，锁定这一层的平面。","cardIds":["ts_s1_deck"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"},
      {"id":"s2_step","order":2,"title":"第 2 层支撑","description":"两张相向倾斜的牌构成一组支撑，成对摆放后形成承重面带。","cardIds":["ts_s2_p1_a","ts_s2_p1_b","ts_s2_p2_a","ts_s2_p2_b"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"short_edge_forward_10"},
      {"id":"s2_deck_step","order":3,"title":"第 2 层横梁","description":"把平放的牌横跨两组支撑的顶端，锁定这一层的平面。","cardIds":["ts_s2_deck"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"},
      {"id":"s3_step","order":4,"title":"第 3 层支撑","description":"两张相向倾斜的牌构成一组支撑，成对摆放后形成承重面带。","cardIds":["ts_s3_p1_a","ts_s3_p1_b","ts_s3_p2_a","ts_s3_p2_b"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"short_edge_forward_10"},
      {"id":"s3_deck_step","order":5,"title":"第 3 层横梁","description":"把平放的牌横跨两组支撑的顶端，锁定这一层的平面。","cardIds":["ts_s3_deck"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"}
    ],
    "tolerances": {"horizontal":0.32,"height":0.22,"rotationDegrees":10,"nearHorizontal":0.62,"nearHeight":0.46,"nearRotationDegrees":28},
    "maxCards": 20,
    "minCards": 12,
    "heightMultiplier": 3,
    "requiresBlueprintMatch": false,
    "testStages": [{"id":"three-story_stage_1","name":"风力测试","testType":"WIND","duration":10,"windStrength":0.03}],
    "tutorial": {
      "enabled": true,
      "displayMode": "first-time",
      "skippable": true,
      "entryDurationMs": 3800,
      "entryTitle": {"zh":"第八课 · 竖向传递","en":"Lesson 8 · Vertical Transfer"},
      "entrySubtitle": {"zh":"越高越慢，每加一层都要重新对中。","en":"Height punishes imprecision: recentre after every storey."},
      "cues": [
        {"id":"cue_preset","kind":"preset","enabled":true,"text":{"zh":"从短边倾斜的支撑开始","en":"Start with short-edge leaning supports"},"target":{"type":"preset","presetId":"short_edge_forward_10"},"highlight":"arrow","hints":[{"delayMs":5000,"highlight":"pulse","text":{"zh":"一组 A 字架就能站住，但成对摆放才承得住上面一层","en":"One A-frame stands, but a pair carries the storey above"}}],"feedback":{"flash":true,"sound":true},"presetId":"short_edge_forward_10"},
        {"id":"cue_height","kind":"height","enabled":true,"text":{"zh":"把结构搭到目标高度","en":"Build up to the target height"},"target":{"type":"world","position":[0,5.3,0]},"highlight":"arrow","hints":[{"delayMs":6000,"highlight":"pulse","text":{"zh":"按住空格可以锁定当前高度再放牌","en":"Hold Space to lock the current height while placing"}}],"feedback":{"flash":true,"sound":true},"targetHeight":5.3},
        {"id":"cue_test","kind":"test-start","enabled":true,"text":{"zh":"开始测试","en":"Start the test"},"target":{"type":"control","control":"test"},"highlight":"arrow","hints":[],"feedback":{"flash":true,"sound":true}},
        {"id":"cue_success","kind":"test-success","enabled":true,"text":{"zh":"撑住了！","en":"It held!"},"target":{"type":"none"},"highlight":"pulse","hints":[],"feedback":{"flash":true,"sound":true}}
      ]
    },
    "scoring": {"baseScore":500,"unusedCardBonus":50,"heightBonus":100}
  },
  {
    "id": "twin-bridge",
    "name": {"zh":"双塔连桥","en":"Twin Bridge"},
    "description": {"zh":"两座塔各自站稳，再用一张牌连成整体","en":"Raise two towers, then lock them together with one card"},
    "category": "architecture",
    "tags": ["官方","关卡","第三章 · 极限工艺"],
    "cardSize": "BRIDGE",
    "capturedAt": "2026-11-15T00:00:00.000Z",
    "originWorld": [0,0,0],
    "bounds": {"min":[-2.95,0,-1.4],"max":[2.95,5.58667,1.4],"size":[5.9,5.58667,2.8]},
    "cards": [
      {"id":"tb_left_s1_p1_a","order":0,"position":[-2.42356,1.38047,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"spades","rank":"A","color":"black"},
      {"id":"tb_left_s1_p1_b","order":1,"position":[-1.91643,1.38047,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"hearts","rank":"2","color":"red"},
      {"id":"tb_left_s1_p2_a","order":2,"position":[-1.18357,1.38047,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"clubs","rank":"3","color":"black"},
      {"id":"tb_left_s1_p2_b","order":3,"position":[-0.67643,1.38047,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"diamonds","rank":"4","color":"red"},
      {"id":"tb_left_s1_deck","order":4,"position":[-1.55,2.77213,0],"quaternion":[0,0,0,1],"suit":"spades","rank":"5","color":"black"},
      {"id":"tb_left_s2_p1_a","order":5,"position":[-1.55,4.1638,-0.87356],"quaternion":[0,0.642788,0.766044,0],"suit":"hearts","rank":"6","color":"red"},
      {"id":"tb_left_s2_p1_b","order":6,"position":[-1.55,4.1638,-0.36644],"quaternion":[0,0.766044,0.642788,0],"suit":"clubs","rank":"7","color":"black"},
      {"id":"tb_left_s2_p2_a","order":7,"position":[-1.55,4.1638,0.36644],"quaternion":[0,0.642788,0.766044,0],"suit":"diamonds","rank":"8","color":"red"},
      {"id":"tb_left_s2_p2_b","order":8,"position":[-1.55,4.1638,0.87356],"quaternion":[0,0.766044,0.642788,0],"suit":"spades","rank":"9","color":"black"},
      {"id":"tb_left_s2_deck","order":9,"position":[-1.55,5.55547,0],"quaternion":[0,0.707107,0,0.707107],"suit":"hearts","rank":"10","color":"red"},
      {"id":"tb_right_s1_p1_a","order":10,"position":[0.67643,1.38047,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"clubs","rank":"J","color":"black"},
      {"id":"tb_right_s1_p1_b","order":11,"position":[1.18357,1.38047,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"diamonds","rank":"Q","color":"red"},
      {"id":"tb_right_s1_p2_a","order":12,"position":[1.91643,1.38047,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"spades","rank":"K","color":"black"},
      {"id":"tb_right_s1_p2_b","order":13,"position":[2.42357,1.38047,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"hearts","rank":"A","color":"red"},
      {"id":"tb_right_s1_deck","order":14,"position":[1.55,2.77213,0],"quaternion":[0,0,0,1],"suit":"clubs","rank":"2","color":"black"},
      {"id":"tb_right_s2_p1_a","order":15,"position":[1.55,4.1638,-0.87356],"quaternion":[0,0.642788,0.766044,0],"suit":"diamonds","rank":"3","color":"red"},
      {"id":"tb_right_s2_p1_b","order":16,"position":[1.55,4.1638,-0.36644],"quaternion":[0,0.766044,0.642788,0],"suit":"spades","rank":"4","color":"black"},
      {"id":"tb_right_s2_p2_a","order":17,"position":[1.55,4.1638,0.36644],"quaternion":[0,0.642788,0.766044,0],"suit":"hearts","rank":"5","color":"red"},
      {"id":"tb_right_s2_p2_b","order":18,"position":[1.55,4.1638,0.87356],"quaternion":[0,0.766044,0.642788,0],"suit":"clubs","rank":"6","color":"black"},
      {"id":"tb_right_s2_deck","order":19,"position":[1.55,5.55547,0],"quaternion":[0,0.707107,0,0.707107],"suit":"diamonds","rank":"7","color":"red"},
      {"id":"tb_bridge","order":20,"position":[0,5.57667,0],"quaternion":[0,0.707107,0,0.707107],"suit":"spades","rank":"8","color":"black"}
    ],
    "steps": [
      {"id":"s1_step","order":0,"title":"第 1 层双塔支撑","description":"左右两座塔同步上升，每层都先立支撑再封顶。","cardIds":["tb_left_s1_p1_a","tb_left_s1_p1_b","tb_left_s1_p2_a","tb_left_s1_p2_b","tb_right_s1_p1_a","tb_right_s1_p1_b","tb_right_s1_p2_a","tb_right_s1_p2_b"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"short_edge_forward_10"},
      {"id":"s1_deck_step","order":1,"title":"第 1 层双塔横梁","description":"两座塔的横梁要落在同一高度，桥面才能平稳地躺上去。","cardIds":["tb_left_s1_deck","tb_right_s1_deck"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"},
      {"id":"s2_step","order":2,"title":"第 2 层双塔支撑","description":"左右两座塔同步上升，每层都先立支撑再封顶。","cardIds":["tb_left_s2_p1_a","tb_left_s2_p1_b","tb_left_s2_p2_a","tb_left_s2_p2_b","tb_right_s2_p1_a","tb_right_s2_p1_b","tb_right_s2_p2_a","tb_right_s2_p2_b"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"short_edge_forward_10"},
      {"id":"s2_deck_step","order":3,"title":"第 2 层双塔横梁","description":"两座塔的横梁要落在同一高度，桥面才能平稳地躺上去。","cardIds":["tb_left_s2_deck","tb_right_s2_deck"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"},
      {"id":"bridge_step","order":4,"title":"连桥","description":"一张平放的长牌横跨两座塔顶，把左右塔锁成一个整体。","cardIds":["tb_bridge"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"}
    ],
    "tolerances": {"horizontal":0.32,"height":0.22,"rotationDegrees":10,"nearHorizontal":0.62,"nearHeight":0.46,"nearRotationDegrees":28},
    "maxCards": 24,
    "minCards": 18,
    "heightMultiplier": 3,
    "requiresBlueprintMatch": false,
    "testStages": [{"id":"twin-bridge_stage_1","name":"风力测试","testType":"WIND","duration":8,"windStrength":0.05}],
    "tutorial": {
      "enabled": true,
      "displayMode": "first-time",
      "skippable": true,
      "entryDurationMs": 3800,
      "entryTitle": {"zh":"第九课 · 整体","en":"Lesson 9 · One Frame"},
      "entrySubtitle": {"zh":"两座塔的横梁在同一高度，桥面才锁得住。","en":"Both tower decks must share a height for the bridge to lock them."},
      "cues": [
        {"id":"cue_preset","kind":"preset","enabled":true,"text":{"zh":"从短边倾斜的支撑开始","en":"Start with short-edge leaning supports"},"target":{"type":"preset","presetId":"short_edge_forward_10"},"highlight":"arrow","hints":[{"delayMs":5000,"highlight":"pulse","text":{"zh":"一组 A 字架就能站住，但成对摆放才承得住上面一层","en":"One A-frame stands, but a pair carries the storey above"}}],"feedback":{"flash":true,"sound":true},"presetId":"short_edge_forward_10"},
        {"id":"cue_height","kind":"height","enabled":true,"text":{"zh":"把结构搭到目标高度","en":"Build up to the target height"},"target":{"type":"world","position":[0,5.3,0]},"highlight":"arrow","hints":[{"delayMs":6000,"highlight":"pulse","text":{"zh":"按住空格可以锁定当前高度再放牌","en":"Hold Space to lock the current height while placing"}}],"feedback":{"flash":true,"sound":true},"targetHeight":5.3},
        {"id":"cue_test","kind":"test-start","enabled":true,"text":{"zh":"开始测试","en":"Start the test"},"target":{"type":"control","control":"test"},"highlight":"arrow","hints":[],"feedback":{"flash":true,"sound":true}},
        {"id":"cue_success","kind":"test-success","enabled":true,"text":{"zh":"撑住了！","en":"It held!"},"target":{"type":"none"},"highlight":"pulse","hints":[],"feedback":{"flash":true,"sound":true}}
      ]
    },
    "scoring": {"baseScore":400,"unusedCardBonus":50,"heightBonus":100}
  },
  {
    "id": "palace",
    "name": {"zh":"纸牌宫殿","en":"Card Palace"},
    "description": {"zh":"三层主体加一座收口屋顶，先站稳，再接住落物","en":"Three storeys under a closed roof: stand still, then catch the dropped weight"},
    "category": "architecture",
    "tags": ["官方","关卡","第三章 · 极限工艺"],
    "cardSize": "BRIDGE",
    "capturedAt": "2026-11-15T00:00:00.000Z",
    "originWorld": [0,0,0],
    "bounds": {"min":[-1.4,0,-1.4],"max":[1.4,10.14732,1.4],"size":[2.8,10.14732,2.8]},
    "cards": [
      {"id":"pl_base_s1_p1_a","order":0,"position":[-0.87357,1.38047,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"spades","rank":"A","color":"black"},
      {"id":"pl_base_s1_p1_b","order":1,"position":[-0.36643,1.38047,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"hearts","rank":"2","color":"red"},
      {"id":"pl_base_s1_p2_a","order":2,"position":[0.36643,1.38047,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"clubs","rank":"3","color":"black"},
      {"id":"pl_base_s1_p2_b","order":3,"position":[0.87357,1.38047,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"diamonds","rank":"4","color":"red"},
      {"id":"pl_base_s1_deck","order":4,"position":[0,2.77213,0],"quaternion":[0,0,0,1],"suit":"spades","rank":"5","color":"black"},
      {"id":"pl_base_s2_p1_a","order":5,"position":[0,4.1638,-0.87356],"quaternion":[0,0.642788,0.766044,0],"suit":"hearts","rank":"6","color":"red"},
      {"id":"pl_base_s2_p1_b","order":6,"position":[0,4.1638,-0.36644],"quaternion":[0,0.766044,0.642788,0],"suit":"clubs","rank":"7","color":"black"},
      {"id":"pl_base_s2_p2_a","order":7,"position":[0,4.1638,0.36644],"quaternion":[0,0.642788,0.766044,0],"suit":"diamonds","rank":"8","color":"red"},
      {"id":"pl_base_s2_p2_b","order":8,"position":[0,4.1638,0.87356],"quaternion":[0,0.766044,0.642788,0],"suit":"spades","rank":"9","color":"black"},
      {"id":"pl_base_s2_deck","order":9,"position":[0,5.55547,0],"quaternion":[0,0.707107,0,0.707107],"suit":"hearts","rank":"10","color":"red"},
      {"id":"pl_base_s3_p1_a","order":10,"position":[-0.87357,6.94713,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"clubs","rank":"J","color":"black"},
      {"id":"pl_base_s3_p1_b","order":11,"position":[-0.36643,6.94713,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"diamonds","rank":"Q","color":"red"},
      {"id":"pl_base_s3_p2_a","order":12,"position":[0.36643,6.94713,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"spades","rank":"K","color":"black"},
      {"id":"pl_base_s3_p2_b","order":13,"position":[0.87357,6.94713,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"hearts","rank":"A","color":"red"},
      {"id":"pl_base_s3_deck","order":14,"position":[0,8.3388,0],"quaternion":[0,0,0,1],"suit":"clubs","rank":"2","color":"black"},
      {"id":"pl_roof_p1_a","order":15,"position":[-0.71674,9.23806,0],"quaternion":[0,0,0.642788,0.766044],"suit":"diamonds","rank":"3","color":"red"},
      {"id":"pl_roof_p1_b","order":16,"position":[-0.38326,9.23806,0],"quaternion":[0,0,0.766044,0.642788],"suit":"spades","rank":"4","color":"black"},
      {"id":"pl_roof_p2_a","order":17,"position":[0.38326,9.23806,0],"quaternion":[0,0,0.642788,0.766044],"suit":"hearts","rank":"5","color":"red"},
      {"id":"pl_roof_p2_b","order":18,"position":[0.71674,9.23806,0],"quaternion":[0,0,0.766044,0.642788],"suit":"clubs","rank":"6","color":"black"},
      {"id":"pl_roof_deck","order":19,"position":[0,10.13732,0],"quaternion":[0,0,0,1],"suit":"diamonds","rank":"7","color":"red"}
    ],
    "steps": [
      {"id":"s1_step","order":0,"title":"第 1 层支撑","description":"两张相向倾斜的牌构成一组支撑，成对摆放后形成承重面带。","cardIds":["pl_base_s1_p1_a","pl_base_s1_p1_b","pl_base_s1_p2_a","pl_base_s1_p2_b"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"short_edge_forward_10"},
      {"id":"s1_deck_step","order":1,"title":"第 1 层横梁","description":"把平放的牌横跨两组支撑的顶端，锁定这一层的平面。","cardIds":["pl_base_s1_deck"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"},
      {"id":"s2_step","order":2,"title":"第 2 层支撑","description":"两张相向倾斜的牌构成一组支撑，成对摆放后形成承重面带。","cardIds":["pl_base_s2_p1_a","pl_base_s2_p1_b","pl_base_s2_p2_a","pl_base_s2_p2_b"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"short_edge_forward_10"},
      {"id":"s2_deck_step","order":3,"title":"第 2 层横梁","description":"把平放的牌横跨两组支撑的顶端，锁定这一层的平面。","cardIds":["pl_base_s2_deck"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"},
      {"id":"s3_step","order":4,"title":"第 3 层支撑","description":"两张相向倾斜的牌构成一组支撑，成对摆放后形成承重面带。","cardIds":["pl_base_s3_p1_a","pl_base_s3_p1_b","pl_base_s3_p2_a","pl_base_s3_p2_b"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"short_edge_forward_10"},
      {"id":"s3_deck_step","order":5,"title":"第 3 层横梁","description":"把平放的牌横跨两组支撑的顶端，锁定这一层的平面。","cardIds":["pl_base_s3_deck"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"},
      {"id":"roof_step","order":6,"title":"屋顶斜撑","description":"用长边接地的矮支撑压在顶层横梁上，形成收口的屋顶。","cardIds":["pl_roof_p1_a","pl_roof_p1_b","pl_roof_p2_a","pl_roof_p2_b"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"long_edge_left_10"},
      {"id":"roof_deck_step","order":7,"title":"屋脊","description":"最后盖上屋脊牌，让屋顶的重量落回两层支撑之间。","cardIds":["pl_roof_deck"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"}
    ],
    "tolerances": {"horizontal":0.32,"height":0.22,"rotationDegrees":10,"nearHorizontal":0.62,"nearHeight":0.46,"nearRotationDegrees":28},
    "maxCards": 24,
    "minCards": 16,
    "heightMultiplier": 5,
    "requiresBlueprintMatch": false,
    "testStages": [{"id":"palace_stage_1","name":"稳定性测试","testType":"STABILITY","duration":3},{"id":"palace_stage_2","name":"落物冲击","testType":"WEIGHT_DROP","duration":5,"weightMass":0.45,"weightDropOffset":2.2}],
    "tutorial": {
      "enabled": true,
      "displayMode": "first-time",
      "skippable": true,
      "entryDurationMs": 3800,
      "entryTitle": {"zh":"第十课 · 收口","en":"Lesson 10 · Closing the Roof"},
      "entrySubtitle": {"zh":"屋顶收得越低，冲击越容易散开。","en":"A low, closed roof spreads an impact instead of catching it."},
      "cues": [
        {"id":"cue_preset","kind":"preset","enabled":true,"text":{"zh":"从短边倾斜的支撑开始","en":"Start with short-edge leaning supports"},"target":{"type":"preset","presetId":"short_edge_forward_10"},"highlight":"arrow","hints":[{"delayMs":5000,"highlight":"pulse","text":{"zh":"一组 A 字架就能站住，但成对摆放才承得住上面一层","en":"One A-frame stands, but a pair carries the storey above"}}],"feedback":{"flash":true,"sound":true},"presetId":"short_edge_forward_10"},
        {"id":"cue_height","kind":"height","enabled":true,"text":{"zh":"把结构搭到目标高度","en":"Build up to the target height"},"target":{"type":"world","position":[0,8.8,0]},"highlight":"arrow","hints":[{"delayMs":6000,"highlight":"pulse","text":{"zh":"按住空格可以锁定当前高度再放牌","en":"Hold Space to lock the current height while placing"}}],"feedback":{"flash":true,"sound":true},"targetHeight":8.8},
        {"id":"cue_test","kind":"test-start","enabled":true,"text":{"zh":"开始测试","en":"Start the test"},"target":{"type":"control","control":"test"},"highlight":"arrow","hints":[],"feedback":{"flash":true,"sound":true}},
        {"id":"cue_success","kind":"test-success","enabled":true,"text":{"zh":"撑住了！","en":"It held!"},"target":{"type":"none"},"highlight":"pulse","hints":[],"feedback":{"flash":true,"sound":true}}
      ]
    },
    "scoring": {"baseScore":400,"unusedCardBonus":50,"heightBonus":100}
  },
  {
    "id": "storm",
    "name": {"zh":"双塔风暴","en":"Twin Storm"},
    "description": {"zh":"三层双塔连桥，先站稳再顶住 8 秒强风","en":"Twin three-story towers and a bridge: stand still, then hold 8 seconds of strong wind"},
    "category": "architecture",
    "tags": ["官方","关卡","第三章 · 极限工艺"],
    "cardSize": "BRIDGE",
    "capturedAt": "2026-11-15T00:00:00.000Z",
    "originWorld": [0,0,0],
    "bounds": {"min":[-3.35,0,-1.4],"max":[3.35,8.37,1.4],"size":[6.7,8.37,2.8]},
    "cards": [
      {"id":"st_left_s1_p1_a","order":0,"position":[-2.82356,1.38047,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"spades","rank":"A","color":"black"},
      {"id":"st_left_s1_p1_b","order":1,"position":[-2.31643,1.38047,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"hearts","rank":"2","color":"red"},
      {"id":"st_left_s1_p2_a","order":2,"position":[-1.58357,1.38047,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"clubs","rank":"3","color":"black"},
      {"id":"st_left_s1_p2_b","order":3,"position":[-1.07643,1.38047,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"diamonds","rank":"4","color":"red"},
      {"id":"st_left_s1_deck","order":4,"position":[-1.95,2.77213,0],"quaternion":[0,0,0,1],"suit":"spades","rank":"5","color":"black"},
      {"id":"st_left_s2_p1_a","order":5,"position":[-1.95,4.1638,-0.87356],"quaternion":[0,0.642788,0.766044,0],"suit":"hearts","rank":"6","color":"red"},
      {"id":"st_left_s2_p1_b","order":6,"position":[-1.95,4.1638,-0.36644],"quaternion":[0,0.766044,0.642788,0],"suit":"clubs","rank":"7","color":"black"},
      {"id":"st_left_s2_p2_a","order":7,"position":[-1.95,4.1638,0.36644],"quaternion":[0,0.642788,0.766044,0],"suit":"diamonds","rank":"8","color":"red"},
      {"id":"st_left_s2_p2_b","order":8,"position":[-1.95,4.1638,0.87356],"quaternion":[0,0.766044,0.642788,0],"suit":"spades","rank":"9","color":"black"},
      {"id":"st_left_s2_deck","order":9,"position":[-1.95,5.55547,0],"quaternion":[0,0.707107,0,0.707107],"suit":"hearts","rank":"10","color":"red"},
      {"id":"st_left_s3_p1_a","order":10,"position":[-2.82356,6.94713,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"clubs","rank":"J","color":"black"},
      {"id":"st_left_s3_p1_b","order":11,"position":[-2.31643,6.94713,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"diamonds","rank":"Q","color":"red"},
      {"id":"st_left_s3_p2_a","order":12,"position":[-1.58357,6.94713,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"spades","rank":"K","color":"black"},
      {"id":"st_left_s3_p2_b","order":13,"position":[-1.07643,6.94713,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"hearts","rank":"A","color":"red"},
      {"id":"st_left_s3_deck","order":14,"position":[-1.95,8.3388,0],"quaternion":[0,0,0,1],"suit":"clubs","rank":"2","color":"black"},
      {"id":"st_right_s1_p1_a","order":15,"position":[1.07644,1.38047,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"diamonds","rank":"3","color":"red"},
      {"id":"st_right_s1_p1_b","order":16,"position":[1.58357,1.38047,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"spades","rank":"4","color":"black"},
      {"id":"st_right_s1_p2_a","order":17,"position":[2.31643,1.38047,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"hearts","rank":"5","color":"red"},
      {"id":"st_right_s1_p2_b","order":18,"position":[2.82357,1.38047,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"clubs","rank":"6","color":"black"},
      {"id":"st_right_s1_deck","order":19,"position":[1.95,2.77213,0],"quaternion":[0,0,0,1],"suit":"diamonds","rank":"7","color":"red"},
      {"id":"st_right_s2_p1_a","order":20,"position":[1.95,4.1638,-0.87356],"quaternion":[0,0.642788,0.766044,0],"suit":"spades","rank":"8","color":"black"},
      {"id":"st_right_s2_p1_b","order":21,"position":[1.95,4.1638,-0.36644],"quaternion":[0,0.766044,0.642788,0],"suit":"hearts","rank":"9","color":"red"},
      {"id":"st_right_s2_p2_a","order":22,"position":[1.95,4.1638,0.36644],"quaternion":[0,0.642788,0.766044,0],"suit":"clubs","rank":"10","color":"black"},
      {"id":"st_right_s2_p2_b","order":23,"position":[1.95,4.1638,0.87356],"quaternion":[0,0.766044,0.642788,0],"suit":"diamonds","rank":"J","color":"red"},
      {"id":"st_right_s2_deck","order":24,"position":[1.95,5.55547,0],"quaternion":[0,0.707107,0,0.707107],"suit":"spades","rank":"Q","color":"black"},
      {"id":"st_right_s3_p1_a","order":25,"position":[1.07644,6.94713,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"hearts","rank":"K","color":"red"},
      {"id":"st_right_s3_p1_b","order":26,"position":[1.58357,6.94713,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"clubs","rank":"A","color":"black"},
      {"id":"st_right_s3_p2_a","order":27,"position":[2.31643,6.94713,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"diamonds","rank":"2","color":"red"},
      {"id":"st_right_s3_p2_b","order":28,"position":[2.82357,6.94713,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"spades","rank":"3","color":"black"},
      {"id":"st_right_s3_deck","order":29,"position":[1.95,8.3388,0],"quaternion":[0,0,0,1],"suit":"hearts","rank":"4","color":"red"},
      {"id":"st_bridge","order":30,"position":[0,8.36,0],"quaternion":[0,0.707107,0,0.707107],"suit":"clubs","rank":"5","color":"black"}
    ],
    "steps": [
      {"id":"s1_step","order":0,"title":"第 1 层双塔支撑","description":"左右两座塔同步上升，每层都先立支撑再封顶。","cardIds":["st_left_s1_p1_a","st_left_s1_p1_b","st_left_s1_p2_a","st_left_s1_p2_b","st_right_s1_p1_a","st_right_s1_p1_b","st_right_s1_p2_a","st_right_s1_p2_b"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"short_edge_forward_10"},
      {"id":"s1_deck_step","order":1,"title":"第 1 层双塔横梁","description":"两座塔的横梁要落在同一高度，桥面才能平稳地躺上去。","cardIds":["st_left_s1_deck","st_right_s1_deck"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"},
      {"id":"s2_step","order":2,"title":"第 2 层双塔支撑","description":"左右两座塔同步上升，每层都先立支撑再封顶。","cardIds":["st_left_s2_p1_a","st_left_s2_p1_b","st_left_s2_p2_a","st_left_s2_p2_b","st_right_s2_p1_a","st_right_s2_p1_b","st_right_s2_p2_a","st_right_s2_p2_b"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"short_edge_forward_10"},
      {"id":"s2_deck_step","order":3,"title":"第 2 层双塔横梁","description":"两座塔的横梁要落在同一高度，桥面才能平稳地躺上去。","cardIds":["st_left_s2_deck","st_right_s2_deck"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"},
      {"id":"s3_step","order":4,"title":"第 3 层双塔支撑","description":"左右两座塔同步上升，每层都先立支撑再封顶。","cardIds":["st_left_s3_p1_a","st_left_s3_p1_b","st_left_s3_p2_a","st_left_s3_p2_b","st_right_s3_p1_a","st_right_s3_p1_b","st_right_s3_p2_a","st_right_s3_p2_b"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"short_edge_forward_10"},
      {"id":"s3_deck_step","order":5,"title":"第 3 层双塔横梁","description":"两座塔的横梁要落在同一高度，桥面才能平稳地躺上去。","cardIds":["st_left_s3_deck","st_right_s3_deck"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"},
      {"id":"bridge_step","order":6,"title":"连桥","description":"一张平放的长牌横跨两座塔顶，把左右塔锁成一个整体。","cardIds":["st_bridge"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"}
    ],
    "tolerances": {"horizontal":0.32,"height":0.22,"rotationDegrees":10,"nearHorizontal":0.62,"nearHeight":0.46,"nearRotationDegrees":28},
    "maxCards": 34,
    "minCards": 24,
    "heightMultiplier": 3,
    "requiresBlueprintMatch": false,
    "testStages": [{"id":"storm_stage_1","name":"稳定性测试","testType":"STABILITY","duration":3},{"id":"storm_stage_2","name":"风力测试","testType":"WIND","duration":8,"windStrength":0.04}],
    "tutorial": {
      "enabled": true,
      "displayMode": "first-time",
      "skippable": true,
      "entryDurationMs": 3800,
      "entryTitle": {"zh":"第十一课 · 抗风","en":"Lesson 11 · Wind Bracing"},
      "entrySubtitle": {"zh":"两层同向会整体倾覆，交错才抗风。","en":"Aligned storeys tip as one; alternating storeys resist."},
      "cues": [
        {"id":"cue_preset","kind":"preset","enabled":true,"text":{"zh":"从短边倾斜的支撑开始","en":"Start with short-edge leaning supports"},"target":{"type":"preset","presetId":"short_edge_forward_10"},"highlight":"arrow","hints":[{"delayMs":5000,"highlight":"pulse","text":{"zh":"一组 A 字架就能站住，但成对摆放才承得住上面一层","en":"One A-frame stands, but a pair carries the storey above"}}],"feedback":{"flash":true,"sound":true},"presetId":"short_edge_forward_10"},
        {"id":"cue_height","kind":"height","enabled":true,"text":{"zh":"把结构搭到目标高度","en":"Build up to the target height"},"target":{"type":"world","position":[0,5.3,0]},"highlight":"arrow","hints":[{"delayMs":6000,"highlight":"pulse","text":{"zh":"按住空格可以锁定当前高度再放牌","en":"Hold Space to lock the current height while placing"}}],"feedback":{"flash":true,"sound":true},"targetHeight":5.3},
        {"id":"cue_test","kind":"test-start","enabled":true,"text":{"zh":"开始测试","en":"Start the test"},"target":{"type":"control","control":"test"},"highlight":"arrow","hints":[],"feedback":{"flash":true,"sound":true}},
        {"id":"cue_success","kind":"test-success","enabled":true,"text":{"zh":"撑住了！","en":"It held!"},"target":{"type":"none"},"highlight":"pulse","hints":[],"feedback":{"flash":true,"sound":true}}
      ]
    },
    "scoring": {"baseScore":550,"unusedCardBonus":50,"heightBonus":100}
  },
  {
    "id": "finale",
    "name": {"zh":"终局试炼","en":"Final Trial"},
    "description": {"zh":"五跨长阵，连续承受稳定、强风与落物三重考验","en":"Five bays that must survive stability, strong wind and an impact in one run"},
    "category": "architecture",
    "tags": ["官方","关卡","第三章 · 极限工艺"],
    "cardSize": "BRIDGE",
    "capturedAt": "2026-11-15T00:00:00.000Z",
    "originWorld": [0,0,0],
    "bounds": {"min":[-1.12652,0,-7.2],"max":[1.12652,2.78213,7.2],"size":[2.25304,2.78213,14.4]},
    "cards": [
      {"id":"fn1_p1_a","order":0,"position":[-0.87357,1.38047,-5.8],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"spades","rank":"A","color":"black"},
      {"id":"fn1_p1_b","order":1,"position":[-0.36643,1.38047,-5.8],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"hearts","rank":"2","color":"red"},
      {"id":"fn1_p2_a","order":2,"position":[0.36643,1.38047,-5.8],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"clubs","rank":"3","color":"black"},
      {"id":"fn1_p2_b","order":3,"position":[0.87357,1.38047,-5.8],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"diamonds","rank":"4","color":"red"},
      {"id":"fn1_deck","order":4,"position":[0,2.77213,-5.8],"quaternion":[0,0,0,1],"suit":"spades","rank":"5","color":"black"},
      {"id":"fn2_p1_a","order":5,"position":[-0.87357,1.38047,-2.9],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"hearts","rank":"6","color":"red"},
      {"id":"fn2_p1_b","order":6,"position":[-0.36643,1.38047,-2.9],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"clubs","rank":"7","color":"black"},
      {"id":"fn2_p2_a","order":7,"position":[0.36643,1.38047,-2.9],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"diamonds","rank":"8","color":"red"},
      {"id":"fn2_p2_b","order":8,"position":[0.87357,1.38047,-2.9],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"spades","rank":"9","color":"black"},
      {"id":"fn2_deck","order":9,"position":[0,2.77213,-2.9],"quaternion":[0,0,0,1],"suit":"hearts","rank":"10","color":"red"},
      {"id":"fn3_p1_a","order":10,"position":[-0.87357,1.38047,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"clubs","rank":"J","color":"black"},
      {"id":"fn3_p1_b","order":11,"position":[-0.36643,1.38047,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"diamonds","rank":"Q","color":"red"},
      {"id":"fn3_p2_a","order":12,"position":[0.36643,1.38047,0],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"spades","rank":"K","color":"black"},
      {"id":"fn3_p2_b","order":13,"position":[0.87357,1.38047,0],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"hearts","rank":"A","color":"red"},
      {"id":"fn3_deck","order":14,"position":[0,2.77213,0],"quaternion":[0,0,0,1],"suit":"clubs","rank":"2","color":"black"},
      {"id":"fn4_p1_a","order":15,"position":[-0.87357,1.38047,2.9],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"diamonds","rank":"3","color":"red"},
      {"id":"fn4_p1_b","order":16,"position":[-0.36643,1.38047,2.9],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"spades","rank":"4","color":"black"},
      {"id":"fn4_p2_a","order":17,"position":[0.36643,1.38047,2.9],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"hearts","rank":"5","color":"red"},
      {"id":"fn4_p2_b","order":18,"position":[0.87357,1.38047,2.9],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"clubs","rank":"6","color":"black"},
      {"id":"fn4_deck","order":19,"position":[0,2.77213,2.9],"quaternion":[0,0,0,1],"suit":"diamonds","rank":"7","color":"red"},
      {"id":"fn5_p1_a","order":20,"position":[-0.87357,1.38047,5.8],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"spades","rank":"8","color":"black"},
      {"id":"fn5_p1_b","order":21,"position":[-0.36643,1.38047,5.8],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"hearts","rank":"9","color":"red"},
      {"id":"fn5_p2_a","order":22,"position":[0.36643,1.38047,5.8],"quaternion":[0.541675,0.454519,0.541675,-0.454519],"suit":"clubs","rank":"10","color":"black"},
      {"id":"fn5_p2_b","order":23,"position":[0.87357,1.38047,5.8],"quaternion":[-0.454519,-0.541675,-0.454519,0.541675],"suit":"diamonds","rank":"J","color":"red"},
      {"id":"fn5_deck","order":24,"position":[0,2.77213,5.8],"quaternion":[0,0,0,1],"suit":"spades","rank":"Q","color":"black"}
    ],
    "steps": [
      {"id":"bay1_step","order":0,"title":"第 1 跨支撑","description":"跨与跨之间保持半张牌的间隙，风会从缝隙穿过而不是推动整面墙。","cardIds":["fn1_p1_a","fn1_p1_b","fn1_p2_a","fn1_p2_b"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"short_edge_forward_10"},
      {"id":"bay1_deck_step","order":1,"title":"第 1 跨横梁","description":"每个跨都要单独封顶，让每一跨都能独立承重。","cardIds":["fn1_deck"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"},
      {"id":"bay2_step","order":2,"title":"第 2 跨支撑","description":"跨与跨之间保持半张牌的间隙，风会从缝隙穿过而不是推动整面墙。","cardIds":["fn2_p1_a","fn2_p1_b","fn2_p2_a","fn2_p2_b"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"short_edge_forward_10"},
      {"id":"bay2_deck_step","order":3,"title":"第 2 跨横梁","description":"每个跨都要单独封顶，让每一跨都能独立承重。","cardIds":["fn2_deck"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"},
      {"id":"bay3_step","order":4,"title":"第 3 跨支撑","description":"跨与跨之间保持半张牌的间隙，风会从缝隙穿过而不是推动整面墙。","cardIds":["fn3_p1_a","fn3_p1_b","fn3_p2_a","fn3_p2_b"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"short_edge_forward_10"},
      {"id":"bay3_deck_step","order":5,"title":"第 3 跨横梁","description":"每个跨都要单独封顶，让每一跨都能独立承重。","cardIds":["fn3_deck"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"},
      {"id":"bay4_step","order":6,"title":"第 4 跨支撑","description":"跨与跨之间保持半张牌的间隙，风会从缝隙穿过而不是推动整面墙。","cardIds":["fn4_p1_a","fn4_p1_b","fn4_p2_a","fn4_p2_b"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"short_edge_forward_10"},
      {"id":"bay4_deck_step","order":7,"title":"第 4 跨横梁","description":"每个跨都要单独封顶，让每一跨都能独立承重。","cardIds":["fn4_deck"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"},
      {"id":"bay5_step","order":8,"title":"第 5 跨支撑","description":"跨与跨之间保持半张牌的间隙，风会从缝隙穿过而不是推动整面墙。","cardIds":["fn5_p1_a","fn5_p1_b","fn5_p2_a","fn5_p2_b"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"short_edge_forward_10"},
      {"id":"bay5_deck_step","order":9,"title":"第 5 跨横梁","description":"每个跨都要单独封顶，让每一跨都能独立承重。","cardIds":["fn5_deck"],"freezeDuringBuild":false,"releasePhysicsAfterStep":false,"recommendedPresetId":"flat_landscape"}
    ],
    "tolerances": {"horizontal":0.32,"height":0.22,"rotationDegrees":10,"nearHorizontal":0.62,"nearHeight":0.46,"nearRotationDegrees":28},
    "maxCards": 28,
    "minCards": 20,
    "heightMultiplier": 1,
    "requiresBlueprintMatch": false,
    "testStages": [{"id":"finale_stage_1","name":"稳定性测试","testType":"STABILITY","duration":3},{"id":"finale_stage_2","name":"风力测试","testType":"WIND","duration":6,"windStrength":0.03},{"id":"finale_stage_3","name":"落物冲击","testType":"WEIGHT_DROP","duration":5,"weightMass":0.45,"weightDropOffset":4}],
    "tutorial": {
      "enabled": true,
      "displayMode": "first-time",
      "skippable": true,
      "entryDurationMs": 3800,
      "entryTitle": {"zh":"第十二课 · 综合","en":"Lesson 12 · Everything"},
      "entrySubtitle": {"zh":"没有新知识了，只剩你搭得够不够稳。","en":"Nothing new here — only whether your build is steady enough."},
      "cues": [
        {"id":"cue_preset","kind":"preset","enabled":true,"text":{"zh":"从短边倾斜的支撑开始","en":"Start with short-edge leaning supports"},"target":{"type":"preset","presetId":"short_edge_forward_10"},"highlight":"arrow","hints":[{"delayMs":5000,"highlight":"pulse","text":{"zh":"一组 A 字架就能站住，但成对摆放才承得住上面一层","en":"One A-frame stands, but a pair carries the storey above"}}],"feedback":{"flash":true,"sound":true},"presetId":"short_edge_forward_10"},
        {"id":"cue_height","kind":"height","enabled":true,"text":{"zh":"把结构搭到目标高度","en":"Build up to the target height"},"target":{"type":"world","position":[0,1.7,0]},"highlight":"arrow","hints":[{"delayMs":6000,"highlight":"pulse","text":{"zh":"按住空格可以锁定当前高度再放牌","en":"Hold Space to lock the current height while placing"}}],"feedback":{"flash":true,"sound":true},"targetHeight":1.7},
        {"id":"cue_test","kind":"test-start","enabled":true,"text":{"zh":"开始测试","en":"Start the test"},"target":{"type":"control","control":"test"},"highlight":"arrow","hints":[],"feedback":{"flash":true,"sound":true}},
        {"id":"cue_success","kind":"test-success","enabled":true,"text":{"zh":"撑住了！","en":"It held!"},"target":{"type":"none"},"highlight":"pulse","hints":[],"feedback":{"flash":true,"sound":true}}
      ]
    },
    "scoring": {"baseScore":700,"unusedCardBonus":50,"heightBonus":100}
  },
] as unknown) as GeneratedOfficialLevel[];
