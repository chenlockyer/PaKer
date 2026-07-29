/// <reference lib="dom" />
import React, { useRef, useState } from 'react';
import {
  Blueprint,
  ChallengeTestType,
  LevelDefinition,
  LevelOrigin,
} from '../types';
import {
  CreateLevelInput,
  downloadLevel,
  parseLevelFile,
} from '../services/levelService';

interface LevelStudioProps {
  isOpen: boolean;
  lang: 'zh' | 'en';
  blueprints: Blueprint[];
  levels: LevelDefinition[];
  onSave: (input: CreateLevelInput) => void;
  onDelete: (id: string) => void;
  onImport: (level: LevelDefinition) => void;
  onPlay: (level: LevelDefinition) => void;
  onClose: () => void;
}

const LevelStudio: React.FC<LevelStudioProps> = ({
  isOpen, lang, blueprints, levels, onSave, onDelete, onImport, onPlay, onClose,
}) => {
  const [tab, setTab] = useState<'create' | 'library'>('create');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [author, setAuthor] = useState(() => localStorage.getItem('hoc_level_author') ?? '');
  const [origin, setOrigin] = useState<LevelOrigin>('player');
  const [blueprintId, setBlueprintId] = useState(blueprints[0]?.id ?? '');
  const [maxCards, setMaxCards] = useState(10);
  const [minCards, setMinCards] = useState(2);
  const [heightMultiplier, setHeightMultiplier] = useState(1);
  const [testDuration, setTestDuration] = useState(5);
  const [testType, setTestType] = useState(ChallengeTestType.STABILITY);
  const [windStrength, setWindStrength] = useState(0.02);
  const [weightMass, setWeightMass] = useState(0.45);
  const [weightDropOffset, setWeightDropOffset] = useState(4);
  const [tags, setTags] = useState('');
  const [baseScore, setBaseScore] = useState(500);
  const [unusedCardBonus, setUnusedCardBonus] = useState(50);
  const [heightBonus, setHeightBonus] = useState(100);
  const [notice, setNotice] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;
  const selectedBlueprint = blueprints.find(item => item.id === blueprintId);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !selectedBlueprint) {
      setNotice(lang === 'zh' ? '请填写关卡名称并选择蓝图。' : 'Enter a name and select a blueprint.');
      return;
    }
    localStorage.setItem('hoc_level_author', author);
    onSave({
      name, description, author, origin, blueprint: selectedBlueprint,
      tags: tags.split(/[,，]/), maxCards, minCards, heightMultiplier,
      testDuration, testType, windStrength, weightMass, weightDropOffset,
      scoring: { baseScore, unusedCardBonus, heightBonus },
    });
    setName('');
    setDescription('');
    setNotice(lang === 'zh' ? '关卡已保存，蓝图副本已经内嵌。' : 'Level saved with an embedded blueprint snapshot.');
    setTab('library');
  };

  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      onImport(parseLevelFile(await file.text()));
      setTab('library');
      setNotice(lang === 'zh' ? '关卡导入成功。' : 'Level imported.');
    } catch {
      setNotice(lang === 'zh' ? '导入失败：文件无效或蓝图校验不通过。' : 'Import failed: invalid file or blueprint checksum.');
    }
  };

  return (
    <div className="modal-layer level-layer" role="dialog" aria-modal="true">
      <section className="level-window">
        <header className="blueprint-header">
          <div>
            <span className="panel-kicker">{lang === 'zh' ? '关卡制作工具' : 'LEVEL AUTHORING'}</span>
            <h2>{lang === 'zh' ? '关卡编辑器' : 'Level Studio'}</h2>
          </div>
          <button className="close-button" onClick={onClose}>×</button>
        </header>
        <nav className="blueprint-tabs">
          <button className={tab === 'create' ? 'is-active' : ''} onClick={() => setTab('create')}>
            {lang === 'zh' ? '创建关卡' : 'Create'}
          </button>
          <button className={tab === 'library' ? 'is-active' : ''} onClick={() => setTab('library')}>
            {lang === 'zh' ? `关卡库 ${levels.length}` : `Library ${levels.length}`}
          </button>
          <button className="blueprint-import" onClick={() => importRef.current?.click()}>
            {lang === 'zh' ? '导入关卡' : 'Import'}
          </button>
          <input ref={importRef} type="file" accept=".json,.paker-level.json" hidden onChange={importFile} />
        </nav>
        {notice && <div className="blueprint-notice">{notice}</div>}

        {tab === 'create' ? (
          <form className="level-form" onSubmit={submit}>
            <section>
              <span className="panel-kicker">01 · {lang === 'zh' ? '基本信息' : 'IDENTITY'}</span>
              <label><span>{lang === 'zh' ? '关卡名称' : 'Name'}</span><input value={name} onChange={e => setName(e.target.value)} /></label>
              <label><span>{lang === 'zh' ? '关卡说明' : 'Description'}</span><textarea value={description} onChange={e => setDescription(e.target.value)} /></label>
              <div className="blueprint-form-row">
                <label><span>{lang === 'zh' ? '作者' : 'Author'}</span><input value={author} onChange={e => setAuthor(e.target.value)} /></label>
                <label><span>{lang === 'zh' ? '来源' : 'Origin'}</span><select value={origin} onChange={e => setOrigin(e.target.value as LevelOrigin)}><option value="player">{lang === 'zh' ? '玩家关卡' : 'Player'}</option><option value="official">{lang === 'zh' ? '官方关卡' : 'Official'}</option></select></label>
              </div>
              <label><span>{lang === 'zh' ? '标签' : 'Tags'}</span><input value={tags} onChange={e => setTags(e.target.value)} placeholder={lang === 'zh' ? '教学, 稳定, 一层' : 'tutorial, stable'} /></label>
            </section>

            <section>
              <span className="panel-kicker">02 · {lang === 'zh' ? '目标蓝图' : 'TARGET BLUEPRINT'}</span>
              <label><span>{lang === 'zh' ? '选择素材蓝图' : 'Source blueprint'}</span>
                <select value={blueprintId} onChange={e => setBlueprintId(e.target.value)}>
                  <option value="">{lang === 'zh' ? '请选择' : 'Select'}</option>
                  {blueprints.map(item => <option key={item.id} value={item.id}>{item.name} · {item.cardCount} {lang === 'zh' ? '张' : 'cards'}</option>)}
                </select>
              </label>
              <div className="level-blueprint-note">
                <strong>{selectedBlueprint?.name ?? (lang === 'zh' ? '尚未选择蓝图' : 'No blueprint selected')}</strong>
                <p>{lang === 'zh' ? '保存时会复制完整蓝图并写入关卡文件；删除或修改素材蓝图不会影响关卡。' : 'A complete independent copy is embedded when saved.'}</p>
              </div>
            </section>

            <section>
              <span className="panel-kicker">03 · {lang === 'zh' ? '建造与测试' : 'BUILD & TEST'}</span>
              <div className="level-number-grid">
                <label><span>{lang === 'zh' ? '最少牌数' : 'Min cards'}</span><input type="number" min="0" value={minCards} onChange={e => setMinCards(+e.target.value)} /></label>
                <label><span>{lang === 'zh' ? '最多牌数' : 'Max cards'}</span><input type="number" min="1" value={maxCards} onChange={e => setMaxCards(+e.target.value)} /></label>
                <label><span>{lang === 'zh' ? '目标高度层数' : 'Height floors'}</span><input type="number" min=".1" step=".1" value={heightMultiplier} onChange={e => setHeightMultiplier(+e.target.value)} /></label>
                <label><span>{lang === 'zh' ? '测试秒数' : 'Duration'}</span><input type="number" min="1" step=".5" value={testDuration} onChange={e => setTestDuration(+e.target.value)} /></label>
              </div>
              <label><span>{lang === 'zh' ? '测试类型' : 'Test type'}</span><select value={testType} onChange={e => setTestType(e.target.value as ChallengeTestType)}><option value={ChallengeTestType.STABILITY}>{lang === 'zh' ? '稳定性' : 'Stability'}</option><option value={ChallengeTestType.WIND}>{lang === 'zh' ? '风力' : 'Wind'}</option><option value={ChallengeTestType.WEIGHT_DROP}>{lang === 'zh' ? '落物冲击' : 'Weight drop'}</option></select></label>
              {testType === ChallengeTestType.WIND && <label><span>{lang === 'zh' ? '风力强度' : 'Wind strength'}</span><input type="number" min="0" step=".005" value={windStrength} onChange={e => setWindStrength(+e.target.value)} /></label>}
              {testType === ChallengeTestType.WEIGHT_DROP && <div className="blueprint-form-row"><label><span>{lang === 'zh' ? '重物质量' : 'Mass'}</span><input type="number" min=".05" step=".05" value={weightMass} onChange={e => setWeightMass(+e.target.value)} /></label><label><span>{lang === 'zh' ? '下落高度' : 'Drop offset'}</span><input type="number" min=".5" step=".5" value={weightDropOffset} onChange={e => setWeightDropOffset(+e.target.value)} /></label></div>}
              <div className="level-number-grid">
                <label><span>{lang === 'zh' ? '通关基础分' : 'Base score'}</span><input type="number" min="0" step="50" value={baseScore} onChange={e => setBaseScore(+e.target.value)} /></label>
                <label><span>{lang === 'zh' ? '每张节省牌奖励' : 'Unused-card bonus'}</span><input type="number" min="0" step="10" value={unusedCardBonus} onChange={e => setUnusedCardBonus(+e.target.value)} /></label>
                <label><span>{lang === 'zh' ? '每单位高度奖励' : 'Height bonus'}</span><input type="number" min="0" step="10" value={heightBonus} onChange={e => setHeightBonus(+e.target.value)} /></label>
              </div>
            </section>
            <button className="primary-button level-save">{lang === 'zh' ? '保存自包含关卡' : 'Save self-contained level'}</button>
          </form>
        ) : (
          <div className="level-library">
            {levels.length === 0 ? <div className="blueprint-empty"><strong>{lang === 'zh' ? '还没有自定义关卡' : 'No custom levels yet'}</strong></div> : levels.map(level => (
              <article className="level-card" key={level.id}>
                <div><span className="panel-kicker">{level.origin === 'official' ? (lang === 'zh' ? '官方' : 'OFFICIAL') : (lang === 'zh' ? '玩家' : 'PLAYER')} · {level.status}</span><h3>{level.name[lang]}</h3><p>{level.description[lang]}</p><small>{level.embeddedBlueprint.cardCount} {lang === 'zh' ? '张目标牌' : 'target cards'} · {level.testType} · {level.testDuration}s</small></div>
                <div className="level-card-actions"><button className="primary-button" onClick={() => onPlay(level)}>{lang === 'zh' ? '试玩' : 'Playtest'}</button><button onClick={() => downloadLevel(level)}>{lang === 'zh' ? '导出' : 'Export'}</button><button className="danger-text" onClick={() => confirm(lang === 'zh' ? '删除这个关卡？' : 'Delete this level?') && onDelete(level.id)}>{lang === 'zh' ? '删除' : 'Delete'}</button></div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default LevelStudio;
