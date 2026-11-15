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
      lead: '一人操作蓝红两方，轮流建造堡垒、保护核心、亲手弹射纸牌把对手的核心打下来。',
      rules: [
        '建造：双方各有一段建造时间，只能在自己的建筑区放牌。',
        '核心：每方必须把金色核心牌放进自己的黄色核心区，且离地至少一张牌。',
        '回合：检查 → 工程（放 1 张储备牌或装填 1 张弹药）→ 发射（打出一张弹药）→ 结算。',
        '胜负：核心落地 0.75 秒、或核心被推出合法区域 0.75 秒即判负；回合用尽按核心高度与位移判定。',
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
      lead: 'One player runs both Blue and Red: build a fortress, protect your core, then hand-fire cards to knock the other core down.',
      rules: [
        'Build: each side gets its own build window and may only build inside its own zone.',
        'Core: each side must place the gold core card inside its yellow core area, at least one card off the floor.',
        'Turn: inspect → engineer (one reserve card or one ammo load) → fire (one ammo card) → resolve.',
        'Win: a core that rests on the floor for 0.75 s or leaves its legal area loses; after the last round the higher, steadier core wins.',
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
