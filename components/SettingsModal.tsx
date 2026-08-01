/// <reference lib="dom" />
import React, { useEffect, useState } from 'react';
import { AppTheme, CARD_DIMENSIONS, CardSize, PhysicsSettings, RotationPreset, UiScaleSetting } from '../types';
import { UI_SCALE_OPTIONS } from '../services/uiScaleService';
import {
  DEFAULT_PHYSICS_SETTINGS,
  normalizePhysicsSettings,
  PHYSICS_SETTING_RANGES,
  physicsSettingsEqual,
} from '../services/physicsSettingsService';
import { translations } from '../utils/translations';
import {
  InputAction,
  keyBindingFromEvent,
  useInput,
} from '../input/InputContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'en' | 'zh';
  setLang: (lang: 'en' | 'zh') => void;
  presets: RotationPreset[];
  onAddPreset: () => void;
  onUpdatePreset: (preset: RotationPreset) => void;
  onDeletePreset: (id: string) => void;
  onResetPresets: () => void;
  cardSize: CardSize;
  setCardSize: (size: CardSize) => void;
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  uiScaleSetting: UiScaleSetting;
  setUiScaleSetting: (scale: UiScaleSetting) => void;
  resolvedUiScale: number;
  physicsSettings: PhysicsSettings;
  onApplyPhysicsSettings: (settings: PhysicsSettings) => void;
}

type Tab = 'general' | 'visuals' | 'physics' | 'controls' | 'presets';
type PhysicsSettingKey = Exclude<keyof PhysicsSettings, 'schemaVersion'>;

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen, onClose, lang, setLang, presets, onAddPreset, onUpdatePreset,
  onDeletePreset, onResetPresets, cardSize, setCardSize, theme, setTheme,
  uiScaleSetting, setUiScaleSetting, resolvedUiScale,
  physicsSettings, onApplyPhysicsSettings,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [capturingAction, setCapturingAction] = useState<InputAction | null>(null);
  const [bindingError, setBindingError] = useState('');
  const [physicsDraft, setPhysicsDraft] = useState<PhysicsSettings>(physicsSettings);
  const {
    profile,
    bindings,
    setProfile,
    setBinding,
    resetBindings,
    formatBinding,
    findConflict,
  } = useInput();
  useEffect(() => {
    if (isOpen) setPhysicsDraft(physicsSettings);
  }, [isOpen, physicsSettings]);

  if (!isOpen) return null;

  const t = translations[lang];
  const editingPreset = editingId ? presets.find(preset => preset.id === editingId) : null;
  const copy = lang === 'zh'
    ? {
        title: '设置',
        general: '常规',
        visual: '视觉',
        controls: '操作',
        presets: '预设',
        language: '界面语言',
        languageHint: '切换界面文本，不影响存档。',
        theme: '界面主题',
        themeHint: '主题会同时应用到菜单、游戏界面和建造场景。',
        blue: '原版蓝',
        blueHint: '现代、中性、带少量游戏感',
        warm: '暖白',
        warmHint: '柔和纸张与工作台质感',
        dark: '深色',
        darkHint: '低光环境与高对比界面',
        choosePreset: '从左侧选择一个预设进行编辑',
        presetList: '预设列表',
        add: '新建',
        restore: '恢复内置预设',
        rotation: '旋转角度',
        delete: '删除此预设',
        global: '全局',
        recommended: '推荐布局',
        legacy: '旧版布局',
        custom: '自定义布局',
        bindingHint: '点击一个键位后按下新的组合键。Ctrl、Shift、Alt 可以作为修饰键。',
        resetBindings: '恢复推荐键位',
        pressKey: '请按新键',
        conflict: '该组合键已经用于',
        replayCoach: '重新显示操作教学',
      }
    : {
        title: 'Settings',
        general: 'General',
        visual: 'Visual',
        controls: 'Controls',
        presets: 'Presets',
        language: 'Interface language',
        languageHint: 'Changes interface text without affecting saves.',
        theme: 'Interface theme',
        themeHint: 'Applies to menus, game UI and the building scene.',
        blue: 'Original Blue',
        blueHint: 'Modern, neutral and game-focused',
        warm: 'Warm White',
        warmHint: 'Soft paper and workshop tones',
        dark: 'Dark',
        darkHint: 'Low-light, high-contrast interface',
        choosePreset: 'Select a preset from the list to edit it',
        presetList: 'PRESET LIST',
        add: 'New',
        restore: 'Restore built-ins',
        rotation: 'Rotation',
        delete: 'Delete preset',
        global: 'Global',
        recommended: 'Recommended',
        legacy: 'Legacy',
        custom: 'Custom',
        bindingHint: 'Click a binding, then press a new key combination. Ctrl, Shift and Alt are supported.',
        resetBindings: 'Reset recommended bindings',
        pressKey: 'Press a new key',
        conflict: 'This binding is already used by',
        replayCoach: 'Show control tutorial again',
      };

  const updateEditingValue = <K extends keyof RotationPreset>(field: K, value: RotationPreset[K]) => {
    if (editingPreset) onUpdatePreset({ ...editingPreset, [field]: value });
  };
  const updateRotation = (axisIndex: number, degrees: number) => {
    if (!editingPreset) return;
    const next = [...editingPreset.rotation] as [number, number, number];
    next[axisIndex] = degrees * Math.PI / 180;
    onUpdatePreset({ ...editingPreset, rotation: next });
  };

  const tabs: Array<[Tab, string]> = [
    ['general', copy.general], ['visuals', copy.visual],
    ['physics', lang === 'zh' ? '物理' : 'Physics'],
    ['controls', copy.controls], ['presets', copy.presets],
  ];

  const physicsLabels: Record<PhysicsSettingKey, [string, string]> = lang === 'zh'
    ? {
        cardMass: ['卡牌质量', 'kg'],
        cardFriction: ['卡牌摩擦', ''],
        floorFriction: ['地板摩擦', ''],
        launchMinimumSpeed: ['最低弹射速度', 'm/s'],
        launchMaximumSpeed: ['最高弹射速度', 'm/s'],
        launchMaximumForce: ['手指最大推力', 'N'],
        launchStrokeDistance: ['弹射加速行程', 'm'],
        launchMaximumActuationMs: ['最长接触时间', '秒'],
        structureLinearDamping: ['结构线性阻尼', ''],
        structureAngularDamping: ['结构角阻尼', ''],
        flightLinearDamping: ['飞行线性阻尼', ''],
        flightAngularDamping: ['飞行角阻尼', ''],
        pushMaximumImpulse: ['推拨最大冲量', ''],
        meterOneWayDurationMs: ['力度条单程时间', '秒'],
      }
    : {
        cardMass: ['Card mass', 'kg'],
        cardFriction: ['Card friction', ''],
        floorFriction: ['Floor friction', ''],
        launchMinimumSpeed: ['Minimum launch speed', 'm/s'],
        launchMaximumSpeed: ['Maximum launch speed', 'm/s'],
        launchMaximumForce: ['Maximum finger force', 'N'],
        launchStrokeDistance: ['Acceleration stroke', 'm'],
        launchMaximumActuationMs: ['Maximum contact time', 's'],
        structureLinearDamping: ['Structure linear damping', ''],
        structureAngularDamping: ['Structure angular damping', ''],
        flightLinearDamping: ['Flight linear damping', ''],
        flightAngularDamping: ['Flight angular damping', ''],
        pushMaximumImpulse: ['Maximum push impulse', ''],
        meterOneWayDurationMs: ['Meter one-way duration', 's'],
      };

  const updatePhysicsDraft = (key: PhysicsSettingKey, displayedValue: number) => {
    if (!Number.isFinite(displayedValue)) return;
    const rawValue = key === 'meterOneWayDurationMs' || key === 'launchMaximumActuationMs'
      ? displayedValue * 1000
      : displayedValue;
    const range = PHYSICS_SETTING_RANGES[key];
    const value = Math.min(range.max, Math.max(range.min, rawValue));
    setPhysicsDraft(previous => {
      const next: PhysicsSettings = { ...previous, [key]: value };
      if (key === 'launchMinimumSpeed' && value > next.launchMaximumSpeed) {
        next.launchMaximumSpeed = value;
      }
      if (key === 'launchMaximumSpeed' && value < next.launchMinimumSpeed) {
        next.launchMinimumSpeed = value;
      }
      return next;
    });
  };

  const renderPhysicsControl = (key: PhysicsSettingKey) => {
    const range = PHYSICS_SETTING_RANGES[key];
    const divisor = key === 'meterOneWayDurationMs' || key === 'launchMaximumActuationMs'
      ? 1000
      : 1;
    const value = physicsDraft[key] / divisor;
    const [label, unit] = physicsLabels[key];
    return (
      <label className="physics-setting-row" key={key}>
        <span><strong>{label}</strong><output>{value.toFixed(2)}{unit ? ` ${unit}` : ''}</output></span>
        <div>
          <input
            type="range"
            min={range.min / divisor}
            max={range.max / divisor}
            step={range.step / divisor}
            value={value}
            onChange={event => updatePhysicsDraft(key, Number(event.target.value))}
          />
          <input
            className="physics-number-input"
            type="number"
            min={range.min / divisor}
            max={range.max / divisor}
            step={range.step / divisor}
            value={value}
            onFocus={event => event.currentTarget.select()}
            onChange={event => updatePhysicsDraft(key, Number(event.target.value))}
          />
        </div>
      </label>
    );
  };

  const actionLabels: Record<InputAction, string> = lang === 'zh'
    ? {
        'tool.place': '放置工具',
        'tool.push': '推拨工具',
        'tool.delete': '删除工具',
        'tool.launch': '弹射工具',
        'launch.presetPrevious': '上一个弹射预设',
        'launch.presetNext': '下一个弹射预设',
        'mode.togglePrecision': '切换快速/精准模式',
        'card.yawLeft': '水平左转',
        'card.yawRight': '水平右转',
        'card.tiltForward': '前倾',
        'card.tiltBackward': '后倾',
        'card.tiltLeft': '左倾',
        'card.tiltRight': '右倾',
        'card.resetRotation': '恢复预设旋转',
        'card.lockHeight': '按住锁定高度',
        'preset.radial': '姿态轮盘',
        'preset.previous': '上一个预设',
        'preset.next': '下一个预设',
        'preset.slot1': '旧版预设 1', 'preset.slot2': '旧版预设 2',
        'preset.slot3': '旧版预设 3', 'preset.slot4': '旧版预设 4',
        'preset.slot5': '旧版预设 5', 'preset.slot6': '旧版预设 6',
        'preset.slot7': '旧版预设 7', 'preset.slot8': '旧版预设 8',
        'preset.slot9': '旧版预设 9', 'preset.slot0': '旧版预设 0',
        'physics.toggle': '冻结/恢复物理',
        'history.undo': '撤销',
        'history.redo': '重做',
        'precision.translate': '精准移动控制器',
        'precision.rotate': '精准旋转控制器',
        'action.confirm': '确认',
        'action.cancel': '取消',
      }
    : {
        'tool.place': 'Place tool',
        'tool.push': 'Push tool',
        'tool.delete': 'Delete tool',
        'tool.launch': 'Launch tool',
        'launch.presetPrevious': 'Previous launch preset',
        'launch.presetNext': 'Next launch preset',
        'mode.togglePrecision': 'Toggle quick/precision',
        'card.yawLeft': 'Yaw left',
        'card.yawRight': 'Yaw right',
        'card.tiltForward': 'Tilt forward',
        'card.tiltBackward': 'Tilt backward',
        'card.tiltLeft': 'Tilt left',
        'card.tiltRight': 'Tilt right',
        'card.resetRotation': 'Reset to preset',
        'card.lockHeight': 'Hold height lock',
        'preset.radial': 'Preset wheel',
        'preset.previous': 'Previous preset',
        'preset.next': 'Next preset',
        'preset.slot1': 'Legacy preset 1', 'preset.slot2': 'Legacy preset 2',
        'preset.slot3': 'Legacy preset 3', 'preset.slot4': 'Legacy preset 4',
        'preset.slot5': 'Legacy preset 5', 'preset.slot6': 'Legacy preset 6',
        'preset.slot7': 'Legacy preset 7', 'preset.slot8': 'Legacy preset 8',
        'preset.slot9': 'Legacy preset 9', 'preset.slot0': 'Legacy preset 0',
        'physics.toggle': 'Toggle physics',
        'history.undo': 'Undo',
        'history.redo': 'Redo',
        'precision.translate': 'Precision translate',
        'precision.rotate': 'Precision rotate',
        'action.confirm': 'Confirm',
        'action.cancel': 'Cancel',
      };

  const controlGroups: Array<{ title: string; actions: InputAction[] }> = [
    {
      title: lang === 'zh' ? '工具与历史' : 'Tools & history',
      actions: ['tool.place', 'tool.push', 'tool.delete', 'tool.launch', 'mode.togglePrecision', 'history.undo', 'history.redo'],
    },
    {
      title: lang === 'zh' ? '弹射预设' : 'Launch presets',
      actions: ['launch.presetPrevious', 'launch.presetNext'],
    },
    {
      title: lang === 'zh' ? '纸牌姿态' : 'Card pose',
      actions: [
        'card.yawLeft', 'card.yawRight', 'card.tiltForward', 'card.tiltBackward',
        'card.tiltLeft', 'card.tiltRight', 'card.resetRotation', 'card.lockHeight',
      ],
    },
    {
      title: lang === 'zh' ? '预设与物理' : 'Presets & physics',
      actions: ['preset.radial', 'preset.previous', 'preset.next', 'physics.toggle'],
    },
    {
      title: lang === 'zh' ? '精准与确认' : 'Precision & confirmation',
      actions: ['precision.translate', 'precision.rotate', 'action.confirm', 'action.cancel'],
    },
  ];

  const captureBinding = (action: InputAction, event: React.KeyboardEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (['ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight'].includes(event.code)) {
      return;
    }
    const binding = keyBindingFromEvent(event);
    const current = bindings[action];
    if (
      current.code === binding.code &&
      Boolean(current.ctrl) === Boolean(binding.ctrl) &&
      Boolean(current.shift) === Boolean(binding.shift) &&
      Boolean(current.alt) === Boolean(binding.alt)
    ) {
      setCapturingAction(null);
      setBindingError('');
      return;
    }
    const conflict = findConflict(action, binding);
    if (conflict) {
      setBindingError(`${copy.conflict}“${actionLabels[conflict]}”`);
      return;
    }
    setBinding(action, binding);
    setCapturingAction(null);
    setBindingError('');
  };

  return (
    <div className="modal-layer ui-scale-surface" role="dialog" aria-modal="true" aria-label={copy.title}>
      <section className="settings-window">
        <header className="settings-header">
          <div>
            <span className="panel-kicker">HOUSE OF CARDS</span>
            <h2>{copy.title}</h2>
          </div>
          <button className="close-button" onClick={onClose} aria-label={lang === 'zh' ? '关闭' : 'Close'}>×</button>
        </header>
        <nav className="settings-tabs">
          {tabs.map(([id, label]) => (
            <button key={id} className={activeTab === id ? 'is-active' : ''} onClick={() => setActiveTab(id)}>{label}</button>
          ))}
        </nav>

        <div className="settings-content">
          {activeTab === 'general' && (
            <div className="settings-section">
              <div className="section-title"><span>01</span><div><h3>{copy.language}</h3><p>{copy.languageHint}</p></div></div>
              <div className="segmented-options">
                <button className={lang === 'zh' ? 'is-selected' : ''} onClick={() => setLang('zh')}><strong>中文</strong><small>简体中文</small></button>
                <button className={lang === 'en' ? 'is-selected' : ''} onClick={() => setLang('en')}><strong>English</strong><small>English</small></button>
              </div>
              <div className="section-title section-spaced">
                <span>02</span>
                <div>
                  <h3>{lang === 'zh' ? '界面缩放' : 'UI scale'}</h3>
                  <p>{lang === 'zh' ? '只缩放菜单、文字和操作控件，不改变 3D 场景分辨率。' : 'Scale menus and controls without changing the 3D scene resolution.'}</p>
                </div>
              </div>
              <div className="ui-scale-options">
                {UI_SCALE_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    className={uiScaleSetting === option.value ? 'is-selected' : ''}
                    onClick={() => setUiScaleSetting(option.value)}
                  >
                    {option.value === 'auto'
                      ? `${lang === 'zh' ? '自动' : 'Auto'} · ${Math.round(resolvedUiScale * 100)}%`
                      : `${option.value}%`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'visuals' && (
            <div className="settings-section settings-scroll">
              <div className="section-title"><span>01</span><div><h3>{copy.theme}</h3><p>{copy.themeHint}</p></div></div>
              <div className="theme-options">
                {([
                  ['blue', copy.blue, copy.blueHint],
                  ['warm', copy.warm, copy.warmHint],
                  ['dark', copy.dark, copy.darkHint],
                ] as Array<[AppTheme, string, string]>).map(([id, name, hint]) => (
                  <button key={id} className={theme === id ? 'is-selected' : ''} onClick={() => setTheme(id)}>
                    <span className={`theme-swatch theme-${id}`}><i /><b /></span>
                    <strong>{name}</strong><small>{hint}</small>
                  </button>
                ))}
              </div>
              <div className="section-title section-spaced"><span>02</span><div><h3>{t.cardSize}</h3><p>{t.cardSizeHint}</p></div></div>
              <div className="card-size-options">
                {[CardSize.BRIDGE, CardSize.POKER].map(size => (
                  <button key={size} className={cardSize === size ? 'is-selected' : ''} onClick={() => setCardSize(size)}>
                    <span className={`card-sample ${size === CardSize.BRIDGE ? 'is-bridge' : 'is-poker'}`}><b>A</b><i>♥</i></span>
                    <strong>{size === CardSize.BRIDGE ? t.bridgeSize : t.pokerSize}</strong>
                    <small>{CARD_DIMENSIONS[size].millimeters} · {size === CardSize.BRIDGE ? t.narrowCard : t.wideCard}</small>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'physics' && (
            <div className="settings-section settings-scroll physics-settings-section">
              <div className="section-title">
                <span>01</span>
                <div>
                  <h3>{lang === 'zh' ? '物理参数' : 'Physics parameters'}</h3>
                  <p>{lang === 'zh'
                    ? '点击应用后，会一次性更新当前桌面和所有游戏模式。'
                    : 'Apply once to update the current table and every game mode.'}</p>
                </div>
              </div>
              <div className="physics-settings-list">
                {(['cardMass', 'cardFriction', 'floorFriction', 'launchMaximumSpeed'] as PhysicsSettingKey[])
                  .map(renderPhysicsControl)}
              </div>
              <details className="physics-advanced">
                <summary>{lang === 'zh' ? '高级参数' : 'Advanced parameters'}</summary>
                <div className="physics-settings-list">
                  {([
                    'launchMinimumSpeed',
                    'launchMaximumForce',
                    'launchStrokeDistance',
                    'launchMaximumActuationMs',
                    'structureLinearDamping',
                    'structureAngularDamping',
                    'flightLinearDamping',
                    'flightAngularDamping',
                    'pushMaximumImpulse',
                    'meterOneWayDurationMs',
                  ] as PhysicsSettingKey[]).map(renderPhysicsControl)}
                </div>
              </details>
              <div className="physics-settings-actions">
                <button onClick={() => setPhysicsDraft({ ...DEFAULT_PHYSICS_SETTINGS })}>
                  {lang === 'zh' ? '恢复默认' : 'Restore defaults'}
                </button>
                <button
                  className="primary"
                  disabled={physicsSettingsEqual(physicsDraft, physicsSettings)}
                  onClick={() => {
                    const normalized = normalizePhysicsSettings(physicsDraft);
                    setPhysicsDraft(normalized);
                    onApplyPhysicsSettings(normalized);
                  }}
                >
                  {lang === 'zh' ? '应用参数' : 'Apply settings'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'controls' && (
            <div className="settings-section settings-scroll">
              <div className="input-profile-header">
                <div>
                  <h3>{lang === 'zh' ? '键位方案' : 'Control profile'}</h3>
                  <p>{copy.bindingHint}</p>
                </div>
                <div className="input-profile-options">
                  <button className={profile === 'recommended' ? 'is-selected' : ''} onClick={() => setProfile('recommended')}>{copy.recommended}</button>
                  <button className={profile === 'legacy' ? 'is-selected' : ''} onClick={() => setProfile('legacy')}>{copy.legacy}</button>
                  {profile === 'custom' && <span>{copy.custom}</span>}
                  <button onClick={resetBindings}>{copy.resetBindings}</button>
                  <button onClick={() => {
                    localStorage.removeItem('hoc_control_coach_seen_v1');
                    window.dispatchEvent(new CustomEvent('reset-control-coach'));
                  }}>{copy.replayCoach}</button>
                </div>
              </div>
              {bindingError && <p className="binding-error">{bindingError}</p>}
              <div className="binding-groups">
                {controlGroups.map(group => (
                  <section className="binding-group" key={group.title}>
                    <h3>{group.title}</h3>
                    {group.actions.map(action => (
                      <div className="binding-row" key={action}>
                        <span>{actionLabels[action]}</span>
                        <button
                          className={capturingAction === action ? 'is-capturing' : ''}
                          onClick={() => {
                            setCapturingAction(action);
                            setBindingError('');
                          }}
                          onKeyDown={event => capturingAction === action && captureBinding(action, event)}
                          onBlur={() => setCapturingAction(current => current === action ? null : current)}
                        >
                          <kbd>{capturingAction === action ? copy.pressKey : formatBinding(action)}</kbd>
                        </button>
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'presets' && (
            <div className="preset-editor">
              <aside>
                <div className="preset-editor-head"><span>{copy.presetList}</span><button onClick={onAddPreset}>{copy.add}</button></div>
                <div className="preset-editor-list">
                  {presets.map(preset => (
                    <button key={preset.id} className={editingId === preset.id ? 'is-selected' : ''} onClick={() => setEditingId(preset.id)}>
                      <span>{t[preset.name as keyof typeof t] || preset.name}</span>{preset.shortcut && <kbd>{preset.shortcut}</kbd>}
                    </button>
                  ))}
                </div>
                <button className="restore-button" onClick={onResetPresets}>{copy.restore}</button>
              </aside>
              <div className="preset-form">
                {editingPreset ? (
                  <>
                    <div className="section-title"><span>14</span><div><h3>{t.presetEditor}</h3><p>{copy.rotation}</p></div></div>
                    <div className="form-row">
                      <label>{t.name}<input value={editingPreset.name} onChange={event => updateEditingValue('name', event.target.value)} /></label>
                      <label>{t.shortcut}<input maxLength={1} value={editingPreset.shortcut} onChange={event => updateEditingValue('shortcut', event.target.value)} /></label>
                    </div>
                    <div className="range-list">
                      {['X · Pitch', 'Y · Yaw', 'Z · Roll'].map((label, index) => {
                        const degrees = Math.round(editingPreset.rotation[index] * 180 / Math.PI);
                        return <label key={label}><span>{label}<b>{degrees}°</b></span><input type="range" min="-180" max="180" value={degrees} onChange={event => updateRotation(index, Number(event.target.value))} /></label>;
                      })}
                    </div>
                    <button className="delete-preset" onClick={() => onDeletePreset(editingPreset.id)}>{copy.delete}</button>
                  </>
                ) : <p className="empty-editor">{copy.choosePreset}</p>}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default SettingsModal;
