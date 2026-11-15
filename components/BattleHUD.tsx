/**
 * Card Siege HUD: phase banner, clock, both core read-outs, the active side's
 * action panel and a compact build toolbar (presets, tools, freeze, launch
 * preset) so the battle screen does not need the campaign overlay.
 */

import React, { useMemo } from 'react';
import {
  CardSize,
  LaunchPreset,
  PointerMode,
  RotationPreset,
} from '../types';
import type {
  BattleArena,
  BattleSide,
  BattleShotRecord,
  BattleState,
} from '../battle/types';
import { phaseDurationMs, phaseLabel, totalTurns, turnIndexOf } from '../battle/engine';
import type { BattleBudgetView } from '../hooks/useBattleController';
import type { PlacementRole } from '../battle/engine';
import { translations } from '../utils/translations';

const SIDE_NAME: Record<BattleSide, Record<'zh' | 'en', string>> = {
  A: { zh: '蓝方', en: 'Blue' },
  B: { zh: '红方', en: 'Red' },
};

const LAUNCH_PRESETS: { id: LaunchPreset; zh: string; en: string }[] = [
  { id: 'short-edge', zh: '直线 · 短边', en: 'Straight · short edge' },
  { id: 'long-edge-quarter', zh: '斜抛 · 长边', en: 'Angled · long edge' },
  { id: 'card-back-half', zh: '翻滚 · 卡背', en: 'Tumbling · card back' },
];

const PLACEMENT_REASON: Record<string, Record<'zh' | 'en', string>> = {
  'not-your-turn': { zh: '现在不是这一方的回合', en: 'Not this side’s turn' },
  'wrong-phase': { zh: '当前阶段不能放牌', en: 'Placement is closed in this phase' },
  budget: { zh: '这一类的牌已经用完了', en: 'That card budget is empty' },
  'outside-zone': { zh: '只能建在自己的建筑区里', en: 'Build only inside your own zone' },
  'outside-core-area': { zh: '核心牌必须放进黄色核心区', en: 'The core must sit inside the yellow core area' },
  'core-too-low': { zh: '核心牌不能贴地放置', en: 'The core cannot be placed on the floor' },
};

export interface BattleHUDProps {
  lang: 'zh' | 'en';
  state: BattleState;
  arena: BattleArena;
  budgets: Record<BattleSide, BattleBudgetView>;
  pendingRole: PlacementRole;
  placementVerdict: { ok: boolean; reason?: string } | null;
  presets: RotationPreset[];
  currentPresetId: string;
  setPresetId: (id: string) => void;
  pointerMode: PointerMode;
  setPointerMode: (mode: PointerMode) => void;
  launchPreset: LaunchPreset;
  setLaunchPreset: (preset: LaunchPreset) => void;
  isFreezeMode: boolean;
  onToggleFreeze: () => void;
  onSetRole: (role: PlacementRole) => void;
  onSkip: () => void;
  onResign: () => void;
  onRequestCamera: (view: 'global' | 'mine' | 'theirs') => void;
  onRematch: () => void;
  onExit: () => void;
  onUndo: () => void;
  canUndo: boolean;
  cardSize: CardSize;
}

const formatSeconds = (ms: number) => {
  const safe = Math.max(0, ms) / 1000;
  if (safe >= 10) return safe.toFixed(0);
  return safe.toFixed(1);
};

const ShotSummary = ({
  shot,
  lang,
}: {
  shot: BattleShotRecord;
  lang: 'zh' | 'en';
}) => (
  <div className="battle-shot">
    <span className="battle-shot-kicker">
      {lang === 'zh' ? `第 ${shot.round} 回合 · ${SIDE_NAME[shot.side].zh}出手` : `Round ${shot.round} · ${SIDE_NAME[shot.side].en}`}
    </span>
    <div className="battle-shot-row">
      <span>{lang === 'zh' ? '击倒' : 'Knocked'}</span>
      <strong>{shot.knockedCards}</strong>
    </div>
    <div className="battle-shot-row">
      <span>{lang === 'zh' ? '核心位移' : 'Core shift'}</span>
      <strong>
        {shot.coreDisplacementAfter.A.toFixed(2)} / {shot.coreDisplacementAfter.B.toFixed(2)}
      </strong>
    </div>
    <div className="battle-shot-row">
      <span>{lang === 'zh' ? '出手速度' : 'Exit speed'}</span>
      <strong>{shot.targetSpeed.toFixed(1)}</strong>
    </div>
  </div>
);

const CoreCard = ({
  side,
  state,
  lang,
}: {
  side: BattleSide;
  state: BattleState;
  lang: 'zh' | 'en';
}) => {
  const core = state.sides[side].core;
  const active = state.activeSide === side && state.phase !== 'finished';
  const status = !core.placed
    ? (lang === 'zh' ? '未放置' : 'Not placed')
    : core.broken
      ? (lang === 'zh' ? '已失效' : 'Lost')
      : core.danger ? (lang === 'zh' ? '危险' : 'In danger') : (lang === 'zh' ? '完好' : 'Safe');
  const tone = !core.placed ? 'is-empty' : core.broken ? 'is-lost' : core.danger ? 'is-danger' : 'is-safe';
  return (
    <section className={`battle-core ${active ? 'is-active' : ''} battle-core-${side.toLowerCase()}`}>
      <header>
        <span className={`battle-side-pip battle-side-${side.toLowerCase()}`} />
        <strong>{SIDE_NAME[side][lang]}</strong>
        <em className={tone}>{status}</em>
      </header>
      <div className="battle-core-stats">
        <div>
          <span>{lang === 'zh' ? '离地' : 'Clearance'}</span>
          <strong>{core.placed ? Math.max(0, core.clearance).toFixed(2) : '—'}</strong>
        </div>
        <div>
          <span>{lang === 'zh' ? '位移' : 'Shift'}</span>
          <strong>{core.placed ? core.displacement.toFixed(2) : '—'}</strong>
        </div>
      </div>
      {core.danger && !core.broken && (
        <div className="battle-core-warn">
          {state.phase === 'build'
            ? (lang === 'zh'
              ? '核心已经落地：稳定检查后会被判负，请重建。'
              : 'Core is on the floor — rebuild it before the settle check.')
            : (lang === 'zh'
              ? '核心离地过低，0.75 秒内会判负'
              : 'Core is low: 0.75 s on the floor loses')}
        </div>
      )}
    </section>
  );
};

const BattleHUD: React.FC<BattleHUDProps> = ({
  lang,
  state,
  arena,
  budgets,
  pendingRole,
  placementVerdict,
  presets,
  currentPresetId,
  setPresetId,
  pointerMode,
  setPointerMode,
  launchPreset,
  setLaunchPreset,
  isFreezeMode,
  onToggleFreeze,
  onSetRole,
  onSkip,
  onResign,
  onRequestCamera,
  onRematch,
  onExit,
  onUndo,
  canUndo,
}) => {
  const t = translations[lang];
  const side = state.activeSide;
  const budget = budgets[side];
  const core = state.sides[side].core;
  const duration = phaseDurationMs(state);
  const progress = duration > 0 ? Math.max(0, Math.min(1, state.timeLeftMs / duration)) : 0;
  const turn = Math.min(turnIndexOf(state) + 1, totalTurns(state));
  const isBuild = state.phase === 'build';
  const isEngineer = state.phase === 'engineer';
  const isFire = state.phase === 'fire';
  const finished = state.phase === 'finished';

  const copy = useMemo(() => (lang === 'zh' ? {
    round: '回合',
    turn: '手',
    buildTitle: '建造阶段',
    settleTitle: '稳定检查',
    inspectTitle: '检查战场',
    engineerTitle: '工程行动',
    fireTitle: '发射阶段',
    resolveTitle: '结算',
    finishedTitle: '对局结束',
    finishBuild: '完成建造',
    skip: '跳过',
    skipFire: '放弃攻击',
    resign: '认输',
    core: '核心',
    placeCore: '放置核心',
    corePlaced: '核心已放置',
    structure: '结构牌',
    ammo: '弹药牌',
    reserve: '储备牌',
    reload: '装填弹药',
    remaining: '剩余',
    hintBuildCore: '先把核心牌放进自己的黄色核心区（不能贴地）。',
    hintBuild: '先搭底座再放核心：核心落在结构上才安全。',
    hintEngineer: '这一回合可以放 1 张储备牌，或者装填 1 张弹药。',
    hintFire: '切换到“弹射”工具，点住一张弹药牌蓄力松手。',
    hintWait: '等待结算，双方都不能操作。',
    camera: '视角',
    global: '全局',
    mine: '己方',
    theirs: '对方',
    tools: '工具',
    presets: '预设',
    launchMode: '弹射方式',
    freezeOn: '物理暂停',
    freezeOff: '物理生效',
    undo: '撤销',
    exit: '退出对战',
    rematch: '再来一局',
    winner: '获胜',
    draw: '平局',
    reasonFlat: '核心落地',
    reasonOutside: '核心被推出合法区域',
    reasonResign: '认输',
    reasonRoundLimit: '回合上限判定',
    coreSummary: '核心状态',
    exitHint: '返回主菜单会放弃这局对战。',
    lastShot: '上一发',
    noShot: '还没有出手记录',
    phaseWaiting: '等待中',
    confirmResign: '确定认输吗？',
  } : {
    round: 'Round',
    turn: 'turn',
    buildTitle: 'Build phase',
    settleTitle: 'Settle check',
    inspectTitle: 'Inspect',
    engineerTitle: 'Engineering',
    fireTitle: 'Fire',
    resolveTitle: 'Resolve',
    finishedTitle: 'Match over',
    finishBuild: 'Finish build',
    skip: 'Skip',
    skipFire: 'Hold fire',
    resign: 'Resign',
    core: 'Core',
    placeCore: 'Place core',
    corePlaced: 'Core placed',
    structure: 'Structure',
    ammo: 'Ammo',
    reserve: 'Reserve',
    reload: 'Load ammo',
    remaining: 'Left',
    hintBuildCore: 'Put your core card inside your yellow core area — never on the floor.',
    hintBuild: 'Build a base first: a core resting on a structure is a safe core.',
    hintEngineer: 'One engineering action: place a reserve card or load one ammo card.',
    hintFire: 'Switch to the launch tool, press and hold an ammo card, release to fire.',
    hintWait: 'Resolving — neither side may act.',
    camera: 'Camera',
    global: 'Global',
    mine: 'Mine',
    theirs: 'Theirs',
    tools: 'Tools',
    presets: 'Presets',
    launchMode: 'Launch',
    freezeOn: 'Physics paused',
    freezeOff: 'Physics live',
    undo: 'Undo',
    exit: 'Leave battle',
    rematch: 'Rematch',
    winner: 'wins',
    draw: 'Draw',
    reasonFlat: 'core hit the floor',
    reasonOutside: 'core left its legal area',
    reasonResign: 'resignation',
    reasonRoundLimit: 'round limit',
    coreSummary: 'Core status',
    exitHint: 'Leaving returns to the main menu and drops this match.',
    lastShot: 'Last shot',
    noShot: 'No shot fired yet',
    phaseWaiting: 'Waiting',
    confirmResign: 'Resign this match?',
  }), [lang]);

  const phaseTitle = state.phase === 'build' ? copy.buildTitle
    : state.phase === 'settle' ? copy.settleTitle
      : state.phase === 'inspect' ? copy.inspectTitle
        : state.phase === 'engineer' ? copy.engineerTitle
          : state.phase === 'fire' ? copy.fireTitle
            : state.phase === 'resolve' ? copy.resolveTitle
              : copy.finishedTitle;

  const presetLabel = (preset: RotationPreset) => (
    (translations[lang] as unknown as Record<string, string>)[preset.name] ?? preset.name
  );

  const outcomeText = () => {
    if (!state.outcome) return '';
    const { winner, reason } = state.outcome;
    const reasonText = reason === 'core-flat' ? copy.reasonFlat
      : reason === 'core-outside' ? copy.reasonOutside
        : reason === 'resign' ? copy.reasonResign
          : copy.reasonRoundLimit;
    const who = winner === 'draw' ? copy.draw : `${SIDE_NAME[winner][lang]} ${copy.winner}`;
    return `${who} · ${reasonText}`;
  };

  return (
    <div className="battle-hud ui-scale-surface">
      <header className="battle-topbar">
        <div className="battle-topbar-side">
          <span className="panel-kicker">{copy.round} {state.round}/{state.config.rounds}</span>
          <strong className={`battle-phase-name phase-${state.phase}`}>
            {phaseTitle}
            <i className={`battle-side-pip battle-side-${side.toLowerCase()}`} />
            {state.phase !== 'finished' && state.phase !== 'settle' && (
              <small>{SIDE_NAME[side][lang]}</small>
            )}
          </strong>
        </div>
        <div className={`battle-clock ${state.timeLeftMs <= 5000 && !finished ? 'is-urgent' : ''}`}>
          <strong>{finished ? '—' : formatSeconds(state.timeLeftMs)}</strong>
          <div className="battle-clock-track">
            <i style={{ width: `${progress * 100}%` }} className={`phase-${state.phase}`} />
          </div>
          <small>{copy.turn} {turn}/{totalTurns(state)}</small>
        </div>
        <div className="battle-topbar-side is-right">
          <span className="panel-kicker">{arena.name[lang]}</span>
          <strong className="battle-score">
            {state.sides.A.core.placed ? (state.sides.A.core.broken ? '×' : '●') : '○'}
            <em>vs</em>
            {state.sides.B.core.placed ? (state.sides.B.core.broken ? '×' : '●') : '○'}
          </strong>
        </div>
      </header>

      <aside className="battle-cores">
        <span className="panel-kicker">{copy.coreSummary}</span>
        <CoreCard side="A" state={state} lang={lang} />
        <CoreCard side="B" state={state} lang={lang} />
        <div className="battle-camera">
          <span>{copy.camera}</span>
          <div>
            <button onClick={() => onRequestCamera('global')}>{copy.global}</button>
            <button onClick={() => onRequestCamera('mine')}>{copy.mine}</button>
            <button onClick={() => onRequestCamera('theirs')}>{copy.theirs}</button>
          </div>
        </div>
      </aside>

      <aside className="battle-actions">
        <div className="battle-actions-head">
          <span className={`battle-side-pip battle-side-${side.toLowerCase()}`} />
          <strong>{SIDE_NAME[side][lang]}</strong>
          <span className="battle-actions-phase">{phaseTitle}</span>
        </div>

        <div className="battle-budget">
          <div><span>{copy.structure}</span><strong>{budget.structureLeft}/{state.config.structureCards}</strong></div>
          <div><span>{copy.reserve}</span><strong>{budget.reserveLeft}/{state.config.reserveCards}</strong></div>
          <div><span>{copy.ammo}</span><strong>{budget.ammoLeft}/{state.config.ammoCards}</strong></div>
        </div>

        {isBuild && (
          <div className="battle-role-row">
            <button
              className={pendingRole === 'core' ? 'is-active' : ''}
              disabled={core.placed}
              onClick={() => onSetRole('core')}
            >
              {core.placed ? copy.corePlaced : copy.placeCore}
            </button>
            <button
              className={pendingRole === 'structure' ? 'is-active' : ''}
              onClick={() => onSetRole('structure')}
            >
              {copy.structure}
            </button>
            <button
              className={pendingRole === 'ammo' ? 'is-active' : ''}
              onClick={() => onSetRole('ammo')}
            >
              {copy.ammo}
            </button>
          </div>
        )}

        {isEngineer && (
          <div className="battle-role-row">
            <button
              className={pendingRole === 'structure' ? 'is-active' : ''}
              disabled={state.sides[side].engineerUsedThisTurn}
              onClick={() => onSetRole('structure')}
            >
              {copy.reserve}
            </button>
            <button
              className={pendingRole === 'ammo' ? 'is-active' : ''}
              disabled={state.sides[side].engineerUsedThisTurn}
              onClick={() => onSetRole('ammo')}
            >
              {copy.reload}
            </button>
          </div>
        )}

        <p className="battle-hint">
          {isBuild && !core.placed ? copy.hintBuildCore
            : isBuild ? copy.hintBuild
              : isEngineer ? copy.hintEngineer
                : isFire ? copy.hintFire
                  : copy.hintWait}
        </p>

        {isBuild && !core.placed && (
          <p className="battle-warning">
            {lang === 'zh'
              ? '还没有核心牌：直接结束建造会被判负。'
              : 'No core placed yet — finishing the build without one loses the match.'}
          </p>
        )}

        {placementVerdict && !placementVerdict.ok && placementVerdict.reason && (
          <p className="battle-verdict">{PLACEMENT_REASON[placementVerdict.reason]?.[lang] ?? placementVerdict.reason}</p>
        )}

        <div className="battle-action-row">
          {isBuild && (
            <button className="primary-button" onClick={onSkip}>{copy.finishBuild}</button>
          )}
          {isEngineer && (
            <button className="primary-button" onClick={onSkip}>{copy.skip}</button>
          )}
          {isFire && (
            <button className="primary-button" onClick={onSkip}>{copy.skipFire}</button>
          )}
          <button onClick={onUndo} disabled={!canUndo}>{copy.undo}</button>
          <button
            className="danger-button"
            onClick={() => { if (window.confirm(copy.confirmResign)) onResign(); }}
          >
            {copy.resign}
          </button>
        </div>

        {state.lastShot ? (
          <>
            <span className="panel-kicker battle-last-shot-kicker">{copy.lastShot}</span>
            <ShotSummary shot={state.lastShot} lang={lang} />
          </>
        ) : (
          <p className="battle-empty">{copy.noShot}</p>
        )}
      </aside>

      <div className="battle-toolbar">
        <div className="battle-toolbar-group">
          <span>{copy.tools}</span>
          <button
            className={pointerMode === PointerMode.PLACE ? 'is-active' : ''}
            onClick={() => setPointerMode(PointerMode.PLACE)}
          >
            {t.place}
          </button>
          <button
            className={pointerMode === PointerMode.DELETE ? 'is-active' : ''}
            onClick={() => setPointerMode(PointerMode.DELETE)}
          >
            {t.delete}
          </button>
          <button
            className={pointerMode === PointerMode.LAUNCH ? 'is-active' : ''}
            onClick={() => setPointerMode(PointerMode.LAUNCH)}
          >
            {copy.launchMode}
          </button>
          <button
            className={isFreezeMode ? 'is-active' : ''}
            onClick={onToggleFreeze}
          >
            {isFreezeMode ? copy.freezeOn : copy.freezeOff}
          </button>
        </div>

        <div className="battle-toolbar-presets">
          {presets.map(preset => (
            <button
              key={preset.id}
              className={`battle-preset ${preset.id === currentPresetId ? 'is-active' : ''}`}
              title={`${presetLabel(preset)}${preset.shortcut ? ` (${preset.shortcut})` : ''}`}
              onClick={() => setPresetId(preset.id)}
            >
              <i aria-hidden="true">{preset.icon}</i>
              <span>{presetLabel(preset)}</span>
            </button>
          ))}
        </div>

        <div className="battle-toolbar-group">
          <span>{copy.launchMode}</span>
          {LAUNCH_PRESETS.map(option => (
            <button
              key={option.id}
              className={launchPreset === option.id ? 'is-active' : ''}
              onClick={() => setLaunchPreset(option.id)}
            >
              {option[lang]}
            </button>
          ))}
        </div>
      </div>

      {(state.phase === 'settle' || (state.phase === 'inspect' && (duration - state.timeLeftMs) < 2200)) && !finished && (
        <div className="battle-banner">
          <span className={`battle-side-pip battle-side-${side.toLowerCase()}`} />
          <strong>
            {state.phase === 'settle'
              ? (lang === 'zh' ? '检查结构稳定性' : 'Checking structure stability')
              : `${SIDE_NAME[side][lang]}${lang === 'zh' ? ' 回合开始' : ' turn begins'}`}
          </strong>
          <small>
            {state.phase === 'settle'
              ? (lang === 'zh' ? '建造结束，力量开始起作用' : 'Building is over — physics takes over')
              : `${copy.round} ${state.round}/${state.config.rounds}`}
          </small>
        </div>
      )}

      {finished && (
        <div className="result-layer">
          <section className={`result-card ${state.outcome?.winner === 'draw' ? '' : 'is-success'}`}>
            <span className="panel-kicker">{copy.finishedTitle}</span>
            <div className="result-mark">{state.outcome?.winner === 'draw' ? '=' : '✓'}</div>
            <h2>{outcomeText()}</h2>
            <p>{state.outcome?.detail}</p>
            <div className="battle-result-cores">
              {(['A', 'B'] as BattleSide[]).map(item => (
                <div key={item}>
                  <span className={`battle-side-pip battle-side-${item.toLowerCase()}`} />
                  <strong>{SIDE_NAME[item][lang]}</strong>
                  <em>
                    {copy.core} {state.sides[item].core.placed
                      ? `${Math.max(0, state.sides[item].core.clearance).toFixed(2)} / ${state.sides[item].core.displacement.toFixed(2)}`
                      : '—'}
                  </em>
                </div>
              ))}
            </div>
            <div className="result-actions">
              <button className="primary-button" onClick={onRematch}>{copy.rematch}</button>
              <button onClick={onExit}>{copy.exit}</button>
            </div>
            <small className="battle-exit-hint">{copy.exitHint}</small>
          </section>
        </div>
      )}
    </div>
  );
};

export default BattleHUD;
