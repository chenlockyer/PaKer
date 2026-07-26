/// <reference lib="dom" />
import React, { useMemo, useState } from 'react';
import {
  AppTheme,
  RotationPreset,
  InteractionMode,
  PointerMode,
  GameMode,
  ChallengePhase,
  ChallengeTestType
} from '../types';
import { translations } from '../utils/translations';
import ChallengeHUD from './ChallengeHUD';

interface UIOverlayProps {
  presets: RotationPreset[];
  currentPresetId: string;
  setPresetId: (id: string) => void;
  interactionMode: InteractionMode;
  setInteractionMode: (mode: InteractionMode) => void;
  pointerMode: PointerMode;
  setPointerMode: (mode: PointerMode) => void;
  isFreezeMode: boolean;
  setIsFreezeMode: (val: boolean) => void;
  onClear: () => void;
  onSave: () => void;
  onLoad: () => void;
  cardCount: number;
  lang: 'en' | 'zh';
  onOpenSettings: () => void;
  onBackToMenu: () => void;
  gameMode: GameMode;
  challengePhase: ChallengePhase;
  maxCards: number;
  minCards: number;
  levelIndex: number;
  levelCount: number;
  levelName: string;
  levelDescription: string;
  testType: ChallengeTestType;
  targetHeight: number;
  liveHeight: number;
  countdown: number;
  testTimeRemaining: number;
  score: number;
  stars: number;
  onStartTest: () => void;
  onRetryChallenge: () => void;
  onUndo: () => void;
  onNextChallenge: () => void;
  interactionEnabled: boolean;
  theme: AppTheme;
}

type PresetGroup = 'flat' | 'upright' | 'tilt' | 'custom';

const getPresetGroup = (preset: RotationPreset): PresetGroup => {
  if (preset.id.startsWith('flat_')) return 'flat';
  if (preset.id.includes('upright')) return 'upright';
  if (preset.id.startsWith('short_edge_') || preset.id.startsWith('long_edge_')) return 'tilt';
  return 'custom';
};

const getDiagramClass = (preset: RotationPreset) => {
  if (preset.id.includes('left')) return 'lean-left';
  if (preset.id.includes('right')) return 'lean-right';
  if (preset.id.includes('forward')) return 'lean-forward';
  if (preset.id.includes('backward')) return 'lean-backward';
  if (preset.id.includes('landscape')) return 'landscape';
  if (preset.id.includes('portrait')) return 'portrait';
  return 'custom';
};

const UIOverlay: React.FC<UIOverlayProps> = ({
  presets,
  currentPresetId,
  setPresetId,
  interactionMode,
  setInteractionMode,
  pointerMode,
  setPointerMode,
  isFreezeMode,
  setIsFreezeMode,
  onClear,
  onSave,
  onLoad,
  cardCount,
  lang,
  onOpenSettings,
  onBackToMenu,
  gameMode,
  challengePhase,
  maxCards,
  minCards,
  levelIndex,
  levelCount,
  levelName,
  levelDescription,
  testType,
  targetHeight,
  liveHeight,
  countdown,
  testTimeRemaining,
  score,
  stars,
  onStartTest,
  onRetryChallenge,
  onUndo,
  onNextChallenge,
  interactionEnabled,
}) => {
  const t = translations[lang];
  const [presetOpen, setPresetOpen] = useState(true);
  const labels = lang === 'zh'
    ? {
        project: '纸牌建筑师',
        challenge: '挑战',
        free: '自由搭建',
        quick: '快捷放置',
        precision: '精确放置',
        presetTitle: '放置预设',
        collapse: '收起',
        expand: '展开预设',
        flat: '平放',
        upright: '竖直',
        tilt: '倾斜 10°',
        custom: '自定义',
        place: '放置',
        move: '移动',
        remove: '删除',
        physics: '物理',
        frozen: '已锁定',
        active: '运行中',
        settings: '设置',
        menu: '主菜单',
        clear: '清空',
        cards: '牌数',
        holdHeight: '按住 H 锁定高度',
        precisionHint: 'T 移动 · R 旋转 · Enter 放置',
      }
    : {
        project: 'CARD ARCHITECT',
        challenge: 'Challenge',
        free: 'Free build',
        quick: 'Quick',
        precision: 'Precision',
        presetTitle: 'PLACEMENT PRESETS',
        collapse: 'Collapse',
        expand: 'Open presets',
        flat: 'Flat',
        upright: 'Upright',
        tilt: 'Tilt 10°',
        custom: 'Custom',
        place: 'Place',
        move: 'Move',
        remove: 'Delete',
        physics: 'Physics',
        frozen: 'Locked',
        active: 'Active',
        settings: 'Settings',
        menu: 'Menu',
        clear: 'Clear',
        cards: 'Cards',
        holdHeight: 'Hold H to lock height',
        precisionHint: 'T translate · R rotate · Enter place',
      };

  const groupedPresets = useMemo(() => {
    const groups: Record<PresetGroup, RotationPreset[]> = { flat: [], upright: [], tilt: [], custom: [] };
    presets.forEach(preset => groups[getPresetGroup(preset)].push(preset));
    return groups;
  }, [presets]);

  return (
    <div className="game-ui">
      <header className="game-topbar">
        <div className="game-brand">
          <span className="brand-pip" />
          <strong>{labels.project}</strong>
        </div>
        <div className="game-context">
          <span className="mode-chip">{gameMode === GameMode.CHALLENGE ? labels.challenge : labels.free}</span>
          <span className="context-divider" />
          <strong>{gameMode === GameMode.CHALLENGE ? levelName : labels.free}</strong>
          <span className="card-counter">{labels.cards} <b>{cardCount}</b>{gameMode === GameMode.CHALLENGE ? ` / ${maxCards}` : ''}</span>
        </div>
        <nav className="top-actions">
          <button onClick={onSave}>{t.save}</button>
          <button onClick={onLoad}>{t.load}</button>
          <button onClick={onClear} className="danger-text">{labels.clear}</button>
          <button onClick={onOpenSettings}>{labels.settings}</button>
          <button onClick={onBackToMenu}>{labels.menu}</button>
        </nav>
      </header>

      {pointerMode !== PointerMode.DELETE && (
        <aside className={`preset-drawer ${presetOpen ? '' : 'is-collapsed'}`}>
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">{labels.presetTitle}</span>
              <strong>{t[presets.find(p => p.id === currentPresetId)?.name as keyof typeof t] || presets.find(p => p.id === currentPresetId)?.name}</strong>
            </div>
            <button
              className="panel-toggle"
              onClick={() => setPresetOpen(value => !value)}
              aria-label={presetOpen ? labels.collapse : labels.expand}
            >
              {presetOpen ? '−' : '+'}
            </button>
          </div>

          {presetOpen && interactionMode === InteractionMode.QUICK && (
            <div className="preset-scroll">
              {(Object.keys(groupedPresets) as PresetGroup[]).map(group => groupedPresets[group].length > 0 && (
                <section className="preset-group" key={group}>
                  <h3>{labels[group]}</h3>
                  <div className="preset-grid">
                    {groupedPresets[group].map(preset => (
                      <button
                        key={preset.id}
                        className={`preset-item ${currentPresetId === preset.id ? 'is-selected' : ''}`}
                        onClick={() => setPresetId(preset.id)}
                        disabled={!interactionEnabled}
                        title={t[preset.name as keyof typeof t] || preset.name}
                      >
                        <span className={`preset-diagram ${getDiagramClass(preset)}`}><i /></span>
                        <span className="preset-name">{t[preset.name as keyof typeof t] || preset.name}</span>
                        {preset.shortcut && <kbd>{preset.shortcut}</kbd>}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {presetOpen && interactionMode === InteractionMode.PRECISION && (
            <div className="precision-panel">
              <span className="preset-diagram precision"><i /></span>
              <strong>{labels.precision}</strong>
              <p>{labels.precisionHint}</p>
              <button
                className="primary-button"
                onClick={() => window.dispatchEvent(new CustomEvent('trigger-precision-place'))}
              >
                {t.placeCard}
              </button>
            </div>
          )}

          {presetOpen && <div className="height-hint"><kbd>H</kbd><span>{labels.holdHeight}</span></div>}
        </aside>
      )}

      {gameMode === GameMode.CHALLENGE && (
        <ChallengeHUD
          lang={lang}
          phase={challengePhase}
          cardCount={cardCount}
          maxCards={maxCards}
          minCards={minCards}
          levelIndex={levelIndex}
          levelCount={levelCount}
          levelName={levelName}
          levelDescription={levelDescription}
          testType={testType}
          liveHeight={liveHeight}
          targetHeight={targetHeight}
          countdown={countdown}
          testTimeRemaining={testTimeRemaining}
          score={score}
          stars={stars}
          onStartTest={onStartTest}
          onRetry={onRetryChallenge}
          onUndo={onUndo}
          onNext={onNextChallenge}
          hasNext={levelIndex < levelCount - 1}
        />
      )}

      <div className="placement-mode">
        <button
          className={interactionMode === InteractionMode.QUICK ? 'is-active' : ''}
          onClick={() => setInteractionMode(InteractionMode.QUICK)}
          disabled={!interactionEnabled}
        >{labels.quick}<kbd>Tab</kbd></button>
        <button
          className={interactionMode === InteractionMode.PRECISION ? 'is-active' : ''}
          onClick={() => setInteractionMode(InteractionMode.PRECISION)}
          disabled={!interactionEnabled}
        >{labels.precision}</button>
      </div>

      <div className="tool-dock">
        <button className={pointerMode === PointerMode.PLACE ? 'is-active' : ''} onClick={() => setPointerMode(PointerMode.PLACE)} disabled={!interactionEnabled}>
          <span className="tool-symbol">+</span><strong>{labels.place}</strong><kbd>Esc</kbd>
        </button>
        <button className={pointerMode === PointerMode.MOVE ? 'is-active' : ''} onClick={() => setPointerMode(PointerMode.MOVE)} disabled={!interactionEnabled}>
          <span className="tool-symbol move-symbol">↔</span><strong>{labels.move}</strong>
        </button>
        <button className={pointerMode === PointerMode.DELETE ? 'is-danger' : ''} onClick={() => setPointerMode(PointerMode.DELETE)} disabled={!interactionEnabled}>
          <span className="tool-symbol">×</span><strong>{labels.remove}</strong><kbd>Del</kbd>
        </button>
        <span className="dock-divider" />
        <button className={isFreezeMode ? 'is-locked' : ''} onClick={() => setIsFreezeMode(!isFreezeMode)} disabled={!interactionEnabled}>
          <span className="physics-indicator" />
          <strong>{labels.physics}</strong>
          <small>{isFreezeMode ? labels.frozen : labels.active}</small>
          <kbd>L</kbd>
        </button>
      </div>
    </div>
  );
};

export default UIOverlay;
