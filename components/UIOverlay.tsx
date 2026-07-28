/// <reference lib="dom" />
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { useInput, useInputAction } from '../input/InputContext';

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
  onRedo: () => void;
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
  onRedo,
  onNextChallenge,
  interactionEnabled,
}) => {
  const t = translations[lang];
  const { formatBinding, profile } = useInput();
  const [presetOpen, setPresetOpen] = useState(true);
  const [showControlCoach, setShowControlCoach] = useState(
    () => localStorage.getItem('hoc_control_coach_seen_v1') !== '1',
  );
  useEffect(() => {
    const resetCoach = () => setShowControlCoach(true);
    window.addEventListener('reset-control-coach', resetCoach);
    return () => window.removeEventListener('reset-control-coach', resetCoach);
  }, []);
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
        holdHeight: `按住 ${formatBinding('card.lockHeight')} 锁定高度`,
        precisionHint: `${formatBinding('precision.translate')} 移动 · ${formatBinding('precision.rotate')} 旋转 · ${formatBinding('action.confirm')} 放置`,
        controls: '当前操作',
        camera: '右键旋转镜头 · 中键平移 · 滚轮缩放',
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
        holdHeight: `Hold ${formatBinding('card.lockHeight')} to lock height`,
        precisionHint: `${formatBinding('precision.translate')} translate · ${formatBinding('precision.rotate')} rotate · ${formatBinding('action.confirm')} place`,
        controls: 'CURRENT CONTROLS',
        camera: 'Right drag orbit · Middle drag pan · Wheel zoom',
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

      {showControlCoach && interactionEnabled && (
        <section className="control-coach">
          <div>
            <span className="panel-kicker">{lang === 'zh' ? '新的操作方式' : 'NEW CONTROLS'}</span>
            <strong>{lang === 'zh' ? '左手调整纸牌，鼠标控制镜头' : 'Left hand adjusts cards; mouse controls the camera'}</strong>
          </div>
          <p>
            <kbd>W S A D Q E</kbd>{lang === 'zh' ? ' 调整姿态' : ' adjust pose'}
            <kbd>{formatBinding('card.lockHeight')}</kbd>{lang === 'zh' ? ' 锁定高度' : ' lock height'}
            <kbd>{formatBinding('preset.radial')}</kbd>{lang === 'zh' ? ' 姿态轮盘' : ' preset wheel'}
          </p>
          <button
            onClick={() => {
              localStorage.setItem('hoc_control_coach_seen_v1', '1');
              setShowControlCoach(false);
            }}
          >
            {lang === 'zh' ? '知道了' : 'Got it'}
          </button>
        </section>
      )}

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
                        {profile === 'legacy' && preset.shortcut && <kbd>{preset.shortcut}</kbd>}
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

          {presetOpen && <div className="height-hint"><kbd>{formatBinding('card.lockHeight')}</kbd><span>{labels.holdHeight}</span></div>}
        </aside>
      )}

      <PresetWheel
        presets={presets}
        currentPresetId={currentPresetId}
        setPresetId={setPresetId}
        interactionEnabled={interactionEnabled && interactionMode === InteractionMode.QUICK}
        lang={lang}
      />

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
        >{labels.quick}<kbd>{formatBinding('mode.togglePrecision')}</kbd></button>
        <button
          className={interactionMode === InteractionMode.PRECISION ? 'is-active' : ''}
          onClick={() => setInteractionMode(InteractionMode.PRECISION)}
          disabled={!interactionEnabled}
        >{labels.precision}</button>
      </div>

      <div className="tool-dock">
        <button className={pointerMode === PointerMode.PLACE ? 'is-active' : ''} onClick={() => setPointerMode(PointerMode.PLACE)} disabled={!interactionEnabled}>
          <span className="tool-symbol">+</span><strong>{labels.place}</strong><kbd>{formatBinding('tool.place')}</kbd>
        </button>
        <button className={pointerMode === PointerMode.MOVE ? 'is-active' : ''} onClick={() => setPointerMode(PointerMode.MOVE)} disabled={!interactionEnabled}>
          <span className="tool-symbol move-symbol">↔</span><strong>{labels.move}</strong><kbd>{formatBinding('tool.move')}</kbd>
        </button>
        <button className={pointerMode === PointerMode.DELETE ? 'is-danger' : ''} onClick={() => setPointerMode(PointerMode.DELETE)} disabled={!interactionEnabled}>
          <span className="tool-symbol">×</span><strong>{labels.remove}</strong><kbd>{formatBinding('tool.delete')}</kbd>
        </button>
        <span className="dock-divider" />
        <button className={isFreezeMode ? 'is-locked' : ''} onClick={() => setIsFreezeMode(!isFreezeMode)} disabled={!interactionEnabled}>
          <span className="physics-indicator" />
          <strong>{labels.physics}</strong>
          <small>{isFreezeMode ? labels.frozen : labels.active}</small>
          <kbd>{formatBinding('physics.toggle')}</kbd>
        </button>
      </div>

      <div className="context-controls" aria-label={labels.controls}>
        <span>{labels.camera}</span>
        {pointerMode === PointerMode.PLACE && interactionMode === InteractionMode.QUICK ? (
          <>
            <kbd>{formatBinding('preset.radial')}</kbd><span>{lang === 'zh' ? '姿态轮盘' : 'Preset wheel'}</span>
            <kbd>W S A D Q E</kbd><span>{lang === 'zh' ? '调整姿态' : 'Adjust pose'}</span>
            <kbd>{formatBinding('card.lockHeight')}</kbd><span>{lang === 'zh' ? '锁定高度' : 'Lock height'}</span>
          </>
        ) : interactionMode === InteractionMode.PRECISION ? (
          <>
            <kbd>{formatBinding('precision.translate')}</kbd><span>{lang === 'zh' ? '移动轴' : 'Translate'}</span>
            <kbd>{formatBinding('precision.rotate')}</kbd><span>{lang === 'zh' ? '旋转轴' : 'Rotate'}</span>
            <kbd>{formatBinding('action.confirm')}</kbd><span>{lang === 'zh' ? '确认' : 'Confirm'}</span>
          </>
        ) : (
          <>
            <kbd>{formatBinding('history.undo')}</kbd><button onClick={onUndo}>{lang === 'zh' ? '撤销' : 'Undo'}</button>
            <kbd>{formatBinding('history.redo')}</kbd><button onClick={onRedo}>{lang === 'zh' ? '重做' : 'Redo'}</button>
          </>
        )}
      </div>
    </div>
  );
};

const PresetWheel = ({
  presets,
  currentPresetId,
  setPresetId,
  interactionEnabled,
  lang,
}: {
  presets: RotationPreset[];
  currentPresetId: string;
  setPresetId: (id: string) => void;
  interactionEnabled: boolean;
  lang: 'en' | 'zh';
}) => {
  const t = translations[lang];
  const { formatBinding } = useInput();
  const pointerRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [center, setCenter] = useState(pointerRef.current);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const trackPointer = (event: PointerEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY };
      if (!isOpen || presets.length === 0) return;
      const dx = event.clientX - center.x;
      const dy = event.clientY - center.y;
      if (Math.hypot(dx, dy) < 30) {
        const current = presets.findIndex(preset => preset.id === currentPresetId);
        setSelectedIndex(Math.max(0, current));
        return;
      }
      const angle = Math.atan2(dy, dx) + Math.PI / 2;
      const normalized = (angle + Math.PI * 2) % (Math.PI * 2);
      setSelectedIndex(Math.round(normalized / (Math.PI * 2 / presets.length)) % presets.length);
    };
    window.addEventListener('pointermove', trackPointer);
    return () => window.removeEventListener('pointermove', trackPointer);
  }, [center, currentPresetId, isOpen, presets]);

  useInputAction('preset.radial', event => {
    if (!interactionEnabled || presets.length === 0) return;
    if (event.phase === 'down') {
      const current = Math.max(0, presets.findIndex(preset => preset.id === currentPresetId));
      setSelectedIndex(current);
      const safeMargin = 250;
      setCenter({
        x: Math.min(window.innerWidth - safeMargin, Math.max(safeMargin, pointerRef.current.x)),
        y: Math.min(window.innerHeight - safeMargin, Math.max(safeMargin, pointerRef.current.y)),
      });
      setIsOpen(true);
      return;
    }
    if (isOpen) {
      setPresetId(presets[selectedIndex]?.id ?? currentPresetId);
      setIsOpen(false);
    }
  });

  if (!isOpen) return null;

  const radius = Math.min(190, Math.max(132, presets.length * 10));
  return (
    <div className="preset-wheel-layer">
      <div className="preset-wheel" style={{ left: center.x, top: center.y }}>
        <div className="preset-wheel-center">
          <kbd>{formatBinding('preset.radial')}</kbd>
          <strong>{t[presets[selectedIndex]?.name as keyof typeof t] || presets[selectedIndex]?.name}</strong>
          <span>{lang === 'zh' ? '松开应用' : 'Release to apply'}</span>
        </div>
        {presets.map((preset, index) => {
          const angle = (Math.PI * 2 * index) / presets.length - Math.PI / 2;
          return (
            <button
              key={preset.id}
              className={index === selectedIndex ? 'is-selected' : ''}
              style={{
                transform: `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px) translate(-50%, -50%)`,
              }}
              onPointerEnter={() => setSelectedIndex(index)}
              onClick={() => {
                setPresetId(preset.id);
                setIsOpen(false);
              }}
            >
              <span className={`preset-diagram ${getDiagramClass(preset)}`}><i /></span>
              <small>{t[preset.name as keyof typeof t] || preset.name}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default UIOverlay;
