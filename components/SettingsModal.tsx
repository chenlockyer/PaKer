/// <reference lib="dom" />
import React, { useState } from 'react';
import { AppTheme, CARD_DIMENSIONS, CardSize, RotationPreset } from '../types';
import { translations } from '../utils/translations';

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
}

type Tab = 'general' | 'visuals' | 'controls' | 'presets';

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen, onClose, lang, setLang, presets, onAddPreset, onUpdatePreset,
  onDeletePreset, onResetPresets, cardSize, setCardSize, theme, setTheme,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [editingId, setEditingId] = useState<string | null>(null);
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
    ['controls', copy.controls], ['presets', copy.presets],
  ];

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-label={copy.title}>
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

          {activeTab === 'controls' && (
            <div className="settings-section settings-scroll">
              <div className="control-columns">
                <ControlGroup title={`${t.place} / ${t.move}`} rows={[
                  ['Q / E', t.rotateYaw], ['R / F', t.tiltPitch], ['Z / X', t.rollZ],
                  ['H', t.holdHeight], ['Space', t.resetRot], ['Shift + Wheel', t.rotateYaw],
                ]} />
                <ControlGroup title={t.precision} rows={[
                  ['T', t.translate], ['R', t.rotate], ['Enter', t.placeCard], ['Tab', t.togglePrecision],
                ]} />
                <ControlGroup title={copy.global} rows={[
                  ['L', t.freeze], ['Del / Backspace', t.delete], ['Esc', `${t.place} Mode`],
                ]} />
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

const ControlGroup = ({ title, rows }: { title: string; rows: Array<[string, string]> }) => (
  <section className="control-group">
    <h3>{title}</h3>
    {rows.map(([key, action]) => <div key={`${key}-${action}`}><kbd>{key}</kbd><span>{action}</span></div>)}
  </section>
);

export default SettingsModal;
