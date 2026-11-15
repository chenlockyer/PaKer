/**
 * Card Siege HUD: phase banner, clock, both sides' collapse read-outs, the
 * active side's action panel and a compact build toolbar (blueprint, presets,
 * tools, freeze, launch preset) so the battle screen does not need the campaign
 * overlay.
 */

import React, { useMemo } from 'react';
import {
  LaunchPreset,
  PointerMode,
  RotationPreset,
} from '../types';
import {
  COLLAPSE_THRESHOLD,
  MIN_STANDING_CARDS,
  type BattleArena,
  type BattleSide,
  type BattleShotRecord,
  type BattleState,
} from '../battle/types';
import { phaseDurationMs, totalTurns, turnIndexOf } from '../battle/engine';
import type { BattleBudgetView, PlacementVerdict } from '../hooks/useBattleController';
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
  'action-already-used': { zh: '本回合的工程行动已经用掉了', en: 'The engineering action is already spent' },
  budget: { zh: '这一类的牌已经用完了', en: 'That card budget is empty' },
  'outside-zone': { zh: '只能建在自己的建筑区里', en: 'Build only inside your own zone' },
};

export interface BattleHUDProps {
  lang: 'zh' | 'en';
  state: BattleState;
  arena: BattleArena;
  budgets: Record<BattleSide, BattleBudgetView>;
  pendingRole: PlacementRole;
  placementVerdict: PlacementVerdict | null;
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
  onOpenBlueprint: () => void;
  onClearBlueprint: () => void;
  blueprintLabel: string | null;
}

const formatSeconds = (ms: number) => {
  const safe = Math.max(0, ms) / 1000;
  if (safe >= 10) return safe.toFixed(0);
  return safe.toFixed(1);
};

const ShotSummary = ({ shot, lang }: { shot: BattleShotRecord; lang: 'zh' | 'en' }) => (
  <div className="battle-shot">
    <span className="battle-shot-kicker">
      {lang === 'zh'
        ? `第 ${shot.round} 回合 · ${SIDE_NAME[shot.side].zh}出手`
        : `Round ${shot.round} · ${SIDE_NAME[shot.side].en}`}
    </span>
    <div className="battle-shot-row">
      <span>{lang === 'zh' ? '击倒' : 'Knocked'}</span>
      <strong>{shot.knockedCards}</strong>
    </div>
    <div className="battle-shot-row">
      <span>{lang === 'zh' ? '倒塌率' : 'Collapse'}</span>
      <strong>
        {Math.round(shot.collapseAfter.A * 100)}% / {Math.round(shot.collapseAfter.B * 100)}%
      </strong>
    </div>
    <div className="battle-shot-row">
      <span>{lang === 'zh' ? '出手速度' : 'Exit speed'}</span>
      <strong>{shot.targetSpeed.toFixed(1)}</strong>
    </div>
  </div>
);

const CollapseCard = ({
  side,
  state,
  lang,
}: {
  side: BattleSide;
  state: BattleState;
  lang: 'zh' | 'en';
}) => {
  const collapse = state.sides[side].collapse;
  const active = state.activeSide === side && state.phase !== 'finished';
  const rate = Math.min(1, collapse.rate);
  const danger = collapse.rate >= COLLAPSE_THRESHOLD * 0.7 && !collapse.broken;
  const status = collapse.standing === 0
    ? (lang === 'zh' ? '没有站牌' : 'No standing cards')
    : collapse.broken
      ? (lang === 'zh' ? '已倒塌' : 'Collapsed')
      : danger ? (lang === 'zh' ? '快塌了' : 'Collapsing') : (lang === 'zh' ? '稳固' : 'Holding');
  const tone = collapse.standing === 0
    ? 'is-empty'
    : collapse.broken ? 'is-lost' : danger ? 'is-danger' : 'is-safe';
  return (
    <section className={`battle-core ${active ? 'is-active' : ''} battle-core-${side.toLowerCase()}`}>
      <header>
        <span className={`battle-side-pip battle-side-${side.toLowerCase()}`} />
        <strong>{SIDE_NAME[side][lang]}</strong>
        <em className={tone}>{status}</em>
      </header>
      <div className="battle-core-stats">
        <div>
          <span>{lang === 'zh' ? '站牌' : 'Standing'}</span>
          <strong>{collapse.standing}</strong>
        </div>
        <div>
          <span>{lang === 'zh' ? '已倒' : 'Fallen'}</span>
          <strong>{collapse.fallen}</strong>
        </div>
      </div>
      <div className="battle-collapse-track">
        <i
          className={collapse.broken ? 'is-lost' : danger ? 'is-danger' : ''}
          style={{ width: `${rate * 100}%` }}
        />
        <b style={{ left: `${COLLAPSE_THRESHOLD * 100}%` }} aria-hidden="true" />
      </div>
      <div className="battle-collapse-caption">
        <span>{lang === 'zh' ? `倒塌率 ${Math.round(collapse.rate * 100)}%` : `Collapse ${Math.round(collapse.rate * 100)}%`}</span>
        <span>{lang === 'zh' ? '判负线 50%' : 'Loses at 50%'}</span>
      </div>
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
  onOpenBlueprint,
  onClearBlueprint,
  blueprintLabel,
}) => {
  const t = translations[lang];
  const side = state.activeSide;
  const budget = budgets[side];
  const collapse = state.sides[side].collapse;
  const duration = phaseDurationMs(state);
  const progress = duration > 0 ? Math.max(0, Math.min(1, state.timeLeftMs / duration)) : 0;
  const turn = Math.min(turnIndexOf(state) + 1, totalTurns(state));
  const isBuild = state.phase === 'build';
  const isEngineer = state.phase === 'engineer';
  const isFire = state.phase === 'fire';
  const finished = state.phase === 'finished';
  const standingNow = state.cards.filter(record => record.side === side && record.standing).length;
  const canFinishBuild = standingNow >= MIN_STANDING_CARDS;

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
    structure: '结构牌',
    ammo: '弹药牌',
    reserve: '储备牌',
    reload: '装填弹药',
    hintBuild: '先搭底座再往上加：每张立着的牌都算进倒塌率，倒掉一半就输。',
    hintEngineer: '这一回合可以放 1 张储备牌，或者装填 1 张弹药。',
    hintFire: '按住自己的弹药牌蓄力，松手打出去。',
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
    reasonCollapse: '结构倒塌',
    reasonResign: '认输',
    reasonRoundLimit: '回合上限判定',
    collapseSummary: '倒塌状态',
    exitHint: '返回主菜单会放弃这局对战。',
    lastShot: '上一发',
    noShot: '还没有出手记录',
    confirmResign: '确定认输吗？',
    blueprint: '蓝图',
    blueprintClear: '移除投影',
    blueprintActive: '参考中',
    noBlueprint: '没有可用的蓝图',
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
    structure: 'Structure',
    ammo: 'Ammo',
    reserve: 'Reserve',
    reload: 'Load ammo',
    hintBuild: 'Base first, then stack: every card standing on an edge counts, and half of them falling loses.',
    hintEngineer: 'One engineering action: place a reserve card or load one ammo card.',
    hintFire: 'Press and hold one of your ammo cards, release to fire.',
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
    reasonCollapse: 'structure collapsed',
    reasonResign: 'resignation',
    reasonRoundLimit: 'round limit',
    collapseSummary: 'Collapse',
    exitHint: 'Leaving returns to the main menu and drops this match.',
    lastShot: 'Last shot',
    noShot: 'No shot fired yet',
    confirmResign: 'Resign this match?',
    blueprint: 'Blueprint',
    blueprintClear: 'Clear guide',
    blueprintActive: 'Guiding',
    noBlueprint: 'No saved blueprints',
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
    const reasonText = reason === 'collapse' ? copy.reasonCollapse
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
            {Math.round(state.sides.A.collapse.rate * 100)}%
            <em>vs</em>
            {Math.round(state.sides.B.collapse.rate * 100)}%
          </strong>
        </div>
      </header>

      <aside className="battle-cores">
        <span className="panel-kicker">{copy.collapseSummary}</span>
        <CollapseCard side="A" state={state} lang={lang} />
        <CollapseCard side="B" state={state} lang={lang} />
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

        {(isBuild || isEngineer) && (
          <div className="battle-role-row">
            <button
              className={pendingRole === 'structure' ? 'is-active' : ''}
              disabled={isEngineer && state.sides[side].engineerUsedThisTurn}
              onClick={() => onSetRole('structure')}
            >
              {isEngineer ? copy.reserve : copy.structure}
            </button>
            <button
              className={pendingRole === 'ammo' ? 'is-active' : ''}
              disabled={isEngineer && state.sides[side].engineerUsedThisTurn}
              onClick={() => onSetRole('ammo')}
            >
              {isEngineer ? copy.reload : copy.ammo}
            </button>
          </div>
        )}

        <p className="battle-hint">
          {isBuild ? copy.hintBuild
            : isEngineer ? copy.hintEngineer
              : isFire ? copy.hintFire
                : copy.hintWait}
        </p>

        {isBuild && !canFinishBuild && (
          <p className="battle-warning">
            {lang === 'zh'
              ? `至少要有 ${MIN_STANDING_CARDS} 张立着的牌才能结束建造（现在 ${standingNow} 张）。`
              : `Place at least ${MIN_STANDING_CARDS} cards on edge before finishing (${standingNow} now).`}
          </p>
        )}

        {pointerMode === PointerMode.PLACE && placementVerdict && !placementVerdict.ok && placementVerdict.reason && (
          <p className="battle-verdict">
            {PLACEMENT_REASON[placementVerdict.reason]?.[lang] ?? placementVerdict.reason}
            {placementVerdict.reason === 'outside-zone' && placementVerdict.count
              ? `（${lang === 'zh' ? `${placementVerdict.count} 张会出界` : `${placementVerdict.count} cards outside`}）`
              : ''}
            {placementVerdict.reason === 'budget' && placementVerdict.count
              ? `（${lang === 'zh'
                ? `需要 ${placementVerdict.count} 张，只剩 ${placementVerdict.remaining ?? 0} 张`
                : `needs ${placementVerdict.count}, ${placementVerdict.remaining ?? 0} left`}）`
              : ''}
          </p>
        )}

        <div className="battle-action-row">
          {isBuild && (
            <button className="primary-button" onClick={onSkip} disabled={!canFinishBuild}>
              {copy.finishBuild}
            </button>
          )}
          {isEngineer && <button className="primary-button" onClick={onSkip}>{copy.skip}</button>}
          {isFire && <button className="primary-button" onClick={onSkip}>{copy.skipFire}</button>}
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
        <div className="battle-toolbar-row">
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
            <button className={isFreezeMode ? 'is-active' : ''} onClick={onToggleFreeze}>
              {isFreezeMode ? copy.freezeOn : copy.freezeOff}
            </button>
            {(isBuild || isEngineer) && (
              <button className={blueprintLabel ? 'is-active' : ''} onClick={onOpenBlueprint}>
                {copy.blueprint}
              </button>
            )}
            {blueprintLabel && (
              <button className="battle-blueprint-chip" onClick={onClearBlueprint} title={copy.blueprintClear}>
                {copy.blueprintActive}：{blueprintLabel} ×
              </button>
            )}
          </div>
        </div>
        <div className="battle-toolbar-row">
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
          <div className="battle-toolbar-group battle-toolbar-launch">
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
              ? (lang === 'zh' ? '建造结束，倒掉一半站牌就判负' : 'Building is over — half your standing cards falling loses')
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
              {(['A', 'B'] as BattleSide[]).map(item => {
                const itemCollapse = state.sides[item].collapse;
                return (
                  <div key={item}>
                    <span className={`battle-side-pip battle-side-${item.toLowerCase()}`} />
                    <strong>{SIDE_NAME[item][lang]}</strong>
                    <em>
                      {lang === 'zh' ? '站牌' : 'standing'} {itemCollapse.standing} ·
                      {' '}{lang === 'zh' ? '倒' : 'fallen'} {itemCollapse.fallen} ·
                      {' '}{Math.round(itemCollapse.rate * 100)}%
                    </em>
                  </div>
                );
              })}
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
