/**
 * Pre-match screen for Card Siege: rules summary plus the a handful of knobs
 * (rounds, build time, card budgets). Everything is local so a solo player can
 * tune the pacing before controlling both sides in turn.
 */

import React, { useState } from 'react';
import {
  BATTLE_LIMITS,
  DEFAULT_BATTLE_CONFIG,
  type BattleConfig,
} from '../battle/types';

export interface BattleSetupProps {
  lang: 'zh' | 'en';
  initial?: Partial<BattleConfig>;
  onStart: (config: Partial<BattleConfig>) => void;
  onClose: () => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(value)));

const BattleSetup: React.FC<BattleSetupProps> = ({ lang, initial, onStart, onClose }) => {
  const [rounds, setRounds] = useState(initial?.rounds ?? DEFAULT_BATTLE_CONFIG.rounds);
  const [buildSeconds, setBuildSeconds] = useState(initial?.buildSeconds ?? DEFAULT_BATTLE_CONFIG.buildSeconds);
  const [structureCards, setStructureCards] = useState(initial?.structureCards ?? DEFAULT_BATTLE_CONFIG.structureCards);
  const [reserveCards, setReserveCards] = useState(initial?.reserveCards ?? DEFAULT_BATTLE_CONFIG.reserveCards);
  const [ammoCards, setAmmoCards] = useState(initial?.ammoCards ?? DEFAULT_BATTLE_CONFIG.ammoCards);

  const copy = lang === 'zh'
    ? {
      kicker: '1v1 回合制',
      title: '纸牌攻城',
      lead: '一人操作蓝红两方，轮流建造堡垒、亲手弹射纸牌，把对手立着的牌打倒一半。',
      rules: [
        '建造：双方各有一段建造时间，只能在自己 15×15 格的正方形场地里放牌。',
        '中间是 15 格宽的非战斗区，谁的牌都不能放进中间。',
        '倒坍：原本立着的牌，牌面翻成朝上/朝下、重心掉了 1 格、或被撞飞 3 格，算作倒下。',
        '胜负：每方统计“倒塌率”，站牌倒掉 50% 即判负；也可以直接用蓝图一键放下已存的结构。',
      ],
      rounds: '每人回合数',
      build: '建造时间',
      structure: '结构牌',
      reserve: '储备牌',
      ammo: '弹药牌',
      seconds: '秒',
      start: '开始对战',
      cancel: '取消',
      hint: '牌数越少节奏越快；回合数默认 6 个，与设计文档的上限 8 一致。',
      resets: '调整只影响这一局，不会写入存档。',
    }
    : {
      kicker: '1v1 TURN BASED',
      title: 'Card Siege',
      lead: 'One player runs both Blue and Red: build a fortress, then hand-fire cards until half of the other side’s standing cards are down.',
      rules: [
        'Build: each side gets its own build window and may only build inside its own 15×15 cell square.',
        'The 15 cell band between both sides is neutral — nothing may be placed there.',
        'Collapse: a card placed on an edge counts as fallen once it lies flat, drops a cell, or is knocked three cells away.',
        'Win: each side has a collapse rate; 50% of your standing cards going down loses. Saved blueprints can be dropped in one click.',
      ],
      rounds: 'Rounds each',
      build: 'Build time',
      structure: 'Structure',
      reserve: 'Reserve',
      ammo: 'Ammo',
      seconds: 's',
      start: 'Start battle',
      cancel: 'Cancel',
      hint: 'Fewer cards makes a faster match; the default of six rounds matches the design doc’s cap of eight.',
      resets: 'These settings only affect this match and are not written into a save.',
    };

  const start = () => onStart({
    rounds: clamp(rounds, BATTLE_LIMITS.rounds.min, BATTLE_LIMITS.rounds.max),
    buildSeconds: clamp(buildSeconds, BATTLE_LIMITS.buildSeconds.min, BATTLE_LIMITS.buildSeconds.max),
    structureCards: clamp(structureCards, BATTLE_LIMITS.structureCards.min, BATTLE_LIMITS.structureCards.max),
    reserveCards: clamp(reserveCards, BATTLE_LIMITS.reserveCards.min, BATTLE_LIMITS.reserveCards.max),
    ammoCards: clamp(ammoCards, BATTLE_LIMITS.ammoCards.min, BATTLE_LIMITS.ammoCards.max),
  });

  return (
    <div className="modal-layer battle-setup-layer ui-scale-surface" role="dialog" aria-modal="true">
      <section className="battle-setup-card">
        <header>
          <span className="panel-kicker">{copy.kicker}</span>
          <h2>{copy.title}</h2>
          <p>{copy.lead}</p>
        </header>

        <ul className="battle-rules">
          {copy.rules.map(rule => <li key={rule}>{rule}</li>)}
        </ul>

        <div className="battle-setup-grid">
          <label>
            <span>{copy.rounds}</span>
            <input
              type="number"
              min={BATTLE_LIMITS.rounds.min}
              max={BATTLE_LIMITS.rounds.max}
              value={rounds}
              onChange={event => setRounds(Number(event.target.value))}
            />
          </label>
          <label>
            <span>{copy.build} ({copy.seconds})</span>
            <input
              type="number"
              min={BATTLE_LIMITS.buildSeconds.min}
              max={BATTLE_LIMITS.buildSeconds.max}
              step={BATTLE_LIMITS.buildSeconds.step}
              value={buildSeconds}
              onChange={event => setBuildSeconds(Number(event.target.value))}
            />
          </label>
          <label>
            <span>{copy.structure}</span>
            <input
              type="number"
              min={BATTLE_LIMITS.structureCards.min}
              max={BATTLE_LIMITS.structureCards.max}
              value={structureCards}
              onChange={event => setStructureCards(Number(event.target.value))}
            />
          </label>
          <label>
            <span>{copy.reserve}</span>
            <input
              type="number"
              min={BATTLE_LIMITS.reserveCards.min}
              max={BATTLE_LIMITS.reserveCards.max}
              value={reserveCards}
              onChange={event => setReserveCards(Number(event.target.value))}
            />
          </label>
          <label>
            <span>{copy.ammo}</span>
            <input
              type="number"
              min={BATTLE_LIMITS.ammoCards.min}
              max={BATTLE_LIMITS.ammoCards.max}
              value={ammoCards}
              onChange={event => setAmmoCards(Number(event.target.value))}
            />
          </label>
        </div>

        <p className="battle-setup-hint">{copy.hint}</p>
        <p className="battle-setup-hint is-muted">{copy.resets}</p>

        <div className="battle-setup-actions">
          <button className="primary-button" onClick={start}>{copy.start}</button>
          <button onClick={onClose}>{copy.cancel}</button>
        </div>
      </section>
    </div>
  );
};

export default BattleSetup;
