/// <reference lib="dom" />
import React, { useEffect, useRef, useState } from 'react';
import {
  Blueprint,
  ChallengeTestType,
  LevelDefinition,
  LevelOrigin,
  LevelTestStage,
  LevelTutorialCue,
  LevelTutorialCueKind,
  LevelTutorialTarget,
  PointerMode,
  RotationPreset,
} from '../types';
import { ACTIONS, InputAction } from '../input/InputContext';
import {
  CreateLevelInput,
  createLevel,
  downloadLevel,
  parseLevelFile,
  updateLevel,
} from '../services/levelService';
import { createTutorialCue, normalizeTutorialCue } from '../services/tutorialService';

interface LevelStudioProps {
  isOpen: boolean;
  lang: 'zh' | 'en';
  blueprints: Blueprint[];
  presets: RotationPreset[];
  levels: LevelDefinition[];
  officialLevelIds: string[];
  overriddenOfficialLevelIds: string[];
  onSave: (input: CreateLevelInput, editingId: string | null) => void;
  onDelete: (id: string) => void;
  onDuplicate: (level: LevelDefinition) => void;
  onPublish: (level: LevelDefinition) => string[];
  onImport: (level: LevelDefinition) => void;
  onPlay: (level: LevelDefinition, startCueId?: string) => void;
  onClose: () => void;
}

const LevelStudio: React.FC<LevelStudioProps> = ({
  isOpen, lang, blueprints, presets, levels, officialLevelIds, overriddenOfficialLevelIds,
  onSave, onDelete, onDuplicate, onPublish, onImport, onPlay, onClose,
}) => {
  const [tab, setTab] = useState<'create' | 'library'>('create');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [author, setAuthor] = useState(() => localStorage.getItem('hoc_level_author') ?? '');
  const [origin, setOrigin] = useState<LevelOrigin>('player');
  const [requiresBlueprintMatch, setRequiresBlueprintMatch] = useState(true);
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
  const [extraStages, setExtraStages] = useState<LevelTestStage[]>([]);
  const [tutorialEnabled, setTutorialEnabled] = useState(false);
  const [tutorialDisplayMode, setTutorialDisplayMode] = useState<'first-time' | 'always'>('first-time');
  const [tutorialSkippable, setTutorialSkippable] = useState(true);
  const [entryDurationMs, setEntryDurationMs] = useState(0);
  const [entryTitle, setEntryTitle] = useState('');
  const [entrySubtitle, setEntrySubtitle] = useState('');
  const [tutorialCues, setTutorialCues] = useState<LevelTutorialCue[]>([]);
  const [notice, setNotice] = useState('');
  const [tutorialDebugEvents, setTutorialDebugEvents] = useState<Array<{ levelId: string | null; message: string; at: string }>>([]);
  const [editingLevel, setEditingLevel] = useState<LevelDefinition | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const loadDebugEvents = () => {
      try {
        const values = JSON.parse(localStorage.getItem('hoc_tutorial_debug_events_v1') ?? '[]');
        setTutorialDebugEvents(Array.isArray(values) ? values.slice(0, 12) : []);
      } catch {
        setTutorialDebugEvents([]);
      }
    };
    loadDebugEvents();
    window.addEventListener('paker-tutorial-debug', loadDebugEvents);
    return () => window.removeEventListener('paker-tutorial-debug', loadDebugEvents);
  }, [isOpen]);

  if (!isOpen) return null;
  const selectedBlueprint = blueprintId === '__embedded__'
    ? editingLevel?.embeddedBlueprint
    : blueprints.find(item => item.id === blueprintId);
  const editingOfficial = Boolean(editingLevel && officialLevelIds.includes(editingLevel.id));
  const issueLabel = (issue: string) => {
    const labels: Record<string, { zh: string; en: string }> = {
      'missing-name': { zh: '缺少关卡名称', en: 'Missing level name' },
      'invalid-card-limit': { zh: '牌数上下限无效', en: 'Invalid card limits' },
      'blueprint-exceeds-card-limit': { zh: '蓝图牌数超过关卡上限', en: 'Blueprint exceeds card limit' },
      'invalid-test-stages': { zh: '测试阶段设置无效', en: 'Invalid test stages' },
      'invalid-tutorial-cues': { zh: '教学步骤不完整', en: 'Incomplete tutorial cues' },
      'blueprint-checksum': { zh: '内嵌蓝图校验失败', en: 'Embedded blueprint checksum failed' },
      'incomplete-blueprint-steps': { zh: '蓝图步骤没有覆盖全部纸牌', en: 'Blueprint steps do not cover every card' },
      'playtest-required': { zh: '尚未试玩验证', en: 'Not playtested yet' },
    };
    return labels[issue]?.[lang] ?? issue;
  };

  const beginEdit = (level: LevelDefinition) => {
    setEditingLevel(level);
    setName(level.name.zh);
    setDescription(level.description.zh);
    setAuthor(level.author);
    setOrigin(level.origin);
    setRequiresBlueprintMatch(level.requiresBlueprintMatch);
    setBlueprintId('__embedded__');
    setMaxCards(level.maxCards);
    setMinCards(level.minCards);
    setHeightMultiplier(level.heightMultiplier);
    setTestDuration(level.testDuration);
    setTestType(level.testType);
    setWindStrength(level.windStrength ?? 0.02);
    setWeightMass(level.weightMass ?? 0.45);
    setWeightDropOffset(level.weightDropOffset ?? 4);
    setTags(level.tags.join(', '));
    setBaseScore(level.scoring.baseScore);
    setUnusedCardBonus(level.scoring.unusedCardBonus);
    setHeightBonus(level.scoring.heightBonus);
    setExtraStages(level.testStages.slice(1));
    setTutorialEnabled(level.tutorial.enabled);
    setTutorialDisplayMode(level.tutorial.displayMode);
    setTutorialSkippable(level.tutorial.skippable);
    setEntryDurationMs(level.tutorial.entryDurationMs);
    setEntryTitle(level.tutorial.entryTitle.zh);
    setEntrySubtitle(level.tutorial.entrySubtitle.zh);
    setTutorialCues(level.tutorial.cues);
    setNotice('');
    setTab('create');
  };

  const buildInput = (): CreateLevelInput | null => {
    if (!name.trim() || !selectedBlueprint) {
      setNotice(lang === 'zh' ? '请填写关卡名称并选择蓝图。' : 'Enter a name and select a blueprint.');
      return null;
    }
    if (tutorialEnabled && tutorialCues.some(cue => cue.enabled && !isCueTargetValid(cue))) {
      setNotice(lang === 'zh' ? '教学时间线包含不存在的语义目标。' : 'The tutorial timeline contains a missing semantic target.');
      return null;
    }
    return {
      name, description, author, origin, requiresBlueprintMatch, blueprint: selectedBlueprint,
      tags: tags.split(/[,，]/), maxCards, minCards, heightMultiplier,
      testDuration, testType, windStrength, weightMass, weightDropOffset,
      scoring: { baseScore, unusedCardBonus, heightBonus },
      testStages: [{
        id: editingLevel?.testStages[0]?.id ?? 'stage_1',
        name: lang === 'zh' ? '第一阶段' : 'Stage 1',
        testType,
        duration: testDuration,
        windStrength,
        weightMass,
        weightDropOffset,
      }, ...extraStages],
      tutorial: {
        enabled: tutorialEnabled,
        displayMode: tutorialDisplayMode,
        skippable: tutorialSkippable,
        entryDurationMs,
        entryTitle: { zh: entryTitle.trim(), en: entryTitle.trim() },
        entrySubtitle: { zh: entrySubtitle.trim(), en: entrySubtitle.trim() },
        cues: tutorialCues.map((cue, index) => ({
          ...cue,
          id: cue.id || `cue_${index + 1}`,
          text: { zh: cue.text.zh.trim(), en: cue.text.zh.trim() },
        })),
      },
    };
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const input = buildInput();
    if (!input) return;
    localStorage.setItem('hoc_level_author', author);
    onSave(input, editingLevel?.id ?? null);
    setName('');
    setDescription('');
    setEditingLevel(null);
    setNotice(lang === 'zh' ? '关卡已保存，蓝图副本已经内嵌。' : 'Level saved with an embedded blueprint snapshot.');
    setTab('library');
  };

  const addTutorialCue = () => {
    setTutorialCues(current => [...current, createTutorialCue()]);
  };

  const updateTutorialCue = (id: string, changes: Partial<LevelTutorialCue>) => {
    setTutorialCues(current => current.map(cue => cue.id === id ? { ...cue, ...changes } : cue));
  };

  const moveTutorialCue = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= tutorialCues.length) return;
    setTutorialCues(current => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const changeTutorialCueKind = (cue: LevelTutorialCue, kind: LevelTutorialCueKind) => {
    const replacement = createTutorialCue(kind, cue.id);
    setTutorialCues(current => current.map(item => item.id === cue.id ? {
      ...replacement,
      text: cue.text,
      enabled: cue.enabled,
    } : item));
  };

  const duplicateTutorialCue = (cue: LevelTutorialCue) => {
    const copy = normalizeTutorialCue({
      ...cue,
      id: `cue_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    });
    setTutorialCues(current => {
      const index = current.findIndex(item => item.id === cue.id);
      const next = [...current];
      next.splice(index + 1, 0, copy);
      return next;
    });
  };

  const updateCueTarget = (cue: LevelTutorialCue, target: LevelTutorialTarget) => {
    updateTutorialCue(cue.id, { target });
  };

  const playFromCue = (cue: LevelTutorialCue) => {
    const input = buildInput();
    if (!input) return;
    const draft = editingLevel ? updateLevel(editingLevel, input) : createLevel(input);
    onPlay(draft, cue.id);
  };

  const isCueTargetValid = (cue: LevelTutorialCue) => {
    const target = cue.target;
    if (target.type === 'preset') return presets.some(preset => preset.id === target.presetId);
    if (target.type === 'blueprint-step') return target.stepIndex >= 0 && target.stepIndex < (selectedBlueprint?.steps.length ?? 0);
    if (target.type === 'world') return target.position.every(Number.isFinite);
    return true;
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
    <div className="modal-layer level-layer ui-scale-surface" role="dialog" aria-modal="true">
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
            {editingLevel ? (lang === 'zh' ? '编辑关卡' : 'Edit') : (lang === 'zh' ? '创建关卡' : 'Create')}
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
                <label><span>{lang === 'zh' ? '来源' : 'Origin'}</span><select value={origin} disabled={editingOfficial} onChange={e => setOrigin(e.target.value as LevelOrigin)}><option value="player">{lang === 'zh' ? '玩家关卡' : 'Player'}</option><option value="official">{lang === 'zh' ? '官方关卡' : 'Official'}</option></select></label>
              </div>
              <label><span>{lang === 'zh' ? '标签' : 'Tags'}</span><input value={tags} onChange={e => setTags(e.target.value)} placeholder={lang === 'zh' ? '教学, 稳定, 一层' : 'tutorial, stable'} /></label>
            </section>

            <section>
              <span className="panel-kicker">02 · {lang === 'zh' ? '目标蓝图' : 'TARGET BLUEPRINT'}</span>
              <label><span>{lang === 'zh' ? '选择素材蓝图' : 'Source blueprint'}</span>
                <select value={blueprintId} onChange={e => setBlueprintId(e.target.value)}>
                  {editingLevel && <option value="__embedded__">{lang === 'zh' ? '当前关卡内嵌蓝图（不替换）' : 'Current embedded blueprint'}</option>}
                  <option value="">{lang === 'zh' ? '请选择' : 'Select'}</option>
                  {blueprints.map(item => <option key={item.id} value={item.id}>{item.name} · {item.cardCount} {lang === 'zh' ? '张' : 'cards'}</option>)}
                </select>
              </label>
              <div className="level-blueprint-note">
                <strong>{selectedBlueprint?.name ?? (lang === 'zh' ? '尚未选择蓝图' : 'No blueprint selected')}</strong>
                <p>{lang === 'zh' ? '保存时会复制完整蓝图并写入关卡文件；删除或修改素材蓝图不会影响关卡。' : 'A complete independent copy is embedded when saved.'}</p>
              </div>
              <label className="level-tutorial-toggle">
                <input
                  type="checkbox"
                  checked={requiresBlueprintMatch}
                  onChange={event => setRequiresBlueprintMatch(event.target.checked)}
                />
                <span>
                  {lang === 'zh'
                    ? '通关前必须完成内嵌蓝图'
                    : 'Require the embedded blueprint before testing'}
                </span>
              </label>
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
              <div className="level-stage-list">
                {extraStages.map((stage, index) => (
                  <div className="level-stage-row" key={stage.id}>
                    <strong>{lang === 'zh' ? `阶段 ${index + 2}` : `Stage ${index + 2}`}</strong>
                    <select value={stage.testType} onChange={e => setExtraStages(current => current.map(item => item.id === stage.id ? { ...item, testType: e.target.value as ChallengeTestType } : item))}>
                      <option value={ChallengeTestType.STABILITY}>{lang === 'zh' ? '稳定性' : 'Stability'}</option>
                      <option value={ChallengeTestType.WIND}>{lang === 'zh' ? '风力' : 'Wind'}</option>
                      <option value={ChallengeTestType.WEIGHT_DROP}>{lang === 'zh' ? '落物冲击' : 'Weight drop'}</option>
                    </select>
                    <input type="number" min="1" step=".5" value={stage.duration} title={lang === 'zh' ? '持续秒数' : 'Duration'} onChange={e => setExtraStages(current => current.map(item => item.id === stage.id ? { ...item, duration: +e.target.value } : item))} />
                    {stage.testType === ChallengeTestType.WIND && <input type="number" min="0" step=".005" value={stage.windStrength ?? 0.02} title={lang === 'zh' ? '风力' : 'Wind'} onChange={e => setExtraStages(current => current.map(item => item.id === stage.id ? { ...item, windStrength: +e.target.value } : item))} />}
                    {stage.testType === ChallengeTestType.WEIGHT_DROP && <input type="number" min=".05" step=".05" value={stage.weightMass ?? 0.45} title={lang === 'zh' ? '质量' : 'Mass'} onChange={e => setExtraStages(current => current.map(item => item.id === stage.id ? { ...item, weightMass: +e.target.value, weightDropOffset: item.weightDropOffset ?? 4 } : item))} />}
                    {stage.testType === ChallengeTestType.WEIGHT_DROP && <input type="number" min=".5" step=".5" value={stage.weightDropOffset ?? 4} title={lang === 'zh' ? '下落高度' : 'Drop offset'} onChange={e => setExtraStages(current => current.map(item => item.id === stage.id ? { ...item, weightDropOffset: +e.target.value } : item))} />}
                    <button type="button" className="danger-text" onClick={() => setExtraStages(current => current.filter(item => item.id !== stage.id))}>×</button>
                  </div>
                ))}
                <button type="button" onClick={() => setExtraStages(current => [...current, {
                  id: `stage_${Date.now().toString(36)}`,
                  name: lang === 'zh' ? `阶段 ${current.length + 2}` : `Stage ${current.length + 2}`,
                  testType: ChallengeTestType.WIND,
                  duration: 5,
                  windStrength: 0.02,
                }])}>{lang === 'zh' ? '＋ 添加测试阶段' : '+ Add test stage'}</button>
              </div>
              <div className="level-number-grid">
                <label><span>{lang === 'zh' ? '通关基础分' : 'Base score'}</span><input type="number" min="0" step="50" value={baseScore} onChange={e => setBaseScore(+e.target.value)} /></label>
                <label><span>{lang === 'zh' ? '每张节省牌奖励' : 'Unused-card bonus'}</span><input type="number" min="0" step="10" value={unusedCardBonus} onChange={e => setUnusedCardBonus(+e.target.value)} /></label>
                <label><span>{lang === 'zh' ? '每单位高度奖励' : 'Height bonus'}</span><input type="number" min="0" step="10" value={heightBonus} onChange={e => setHeightBonus(+e.target.value)} /></label>
              </div>
            </section>

            <section className="level-tutorial-section">
              <div className="level-tutorial-heading">
                <div>
                  <span className="panel-kicker">04 · {lang === 'zh' ? '教学导演' : 'TUTORIAL DIRECTOR'}</span>
                  <p>{lang === 'zh' ? '使用线性时间线编排目标、完成条件、渐进提示和即时反馈。' : 'Author targets, completion rules, progressive hints, and feedback on a linear timeline.'}</p>
                </div>
                <label className="level-tutorial-toggle">
                  <input type="checkbox" checked={tutorialEnabled} onChange={event => setTutorialEnabled(event.target.checked)} />
                  <span>{lang === 'zh' ? '启用教学' : 'Enable tutorial'}</span>
                </label>
              </div>

              {tutorialEnabled && (
                <>
                  <div className="blueprint-form-row">
                    <label>
                      <span>{lang === 'zh' ? '入场标题' : 'Entry title'}</span>
                      <input value={entryTitle} onChange={event => setEntryTitle(event.target.value)} placeholder={lang === 'zh' ? '例如：平衡的力量' : 'e.g. The Power of Balance'} />
                    </label>
                    <label>
                      <span>{lang === 'zh' ? '入场副标题' : 'Entry subtitle'}</span>
                      <input value={entrySubtitle} onChange={event => setEntrySubtitle(event.target.value)} placeholder={lang === 'zh' ? '一句话说明本关目标' : 'One sentence objective'} />
                    </label>
                  </div>
                  <div className="level-tutorial-options">
                    <label><span>{lang === 'zh' ? '播放规则' : 'Display rule'}</span><select value={tutorialDisplayMode} onChange={event => setTutorialDisplayMode(event.target.value as 'first-time' | 'always')}><option value="first-time">{lang === 'zh' ? '每个发布版本首次显示' : 'First time per published version'}</option><option value="always">{lang === 'zh' ? '每次进入都显示' : 'Every entry'}</option></select></label>
                    <label><span>{lang === 'zh' ? '入场自动关闭（秒，0 为手动）' : 'Entry auto close (seconds, 0 manual)'}</span><input type="number" min="0" max="30" step=".5" value={entryDurationMs / 1000} onChange={event => setEntryDurationMs(Math.max(0, Number(event.target.value) * 1000))} /></label>
                    <label className="level-tutorial-toggle"><input type="checkbox" checked={tutorialSkippable} onChange={event => setTutorialSkippable(event.target.checked)} /><span>{lang === 'zh' ? '允许玩家跳过' : 'Allow skip'}</span></label>
                  </div>

                  <div className="level-cue-list">
                    {tutorialCues.map((cue, index) => (
                      <article className={`level-cue-row ${cue.enabled ? '' : 'is-disabled'}`} key={cue.id}>
                        <header>
                          <b>{String(index + 1).padStart(2, '0')}</b>
                          <select
                            value={cue.kind}
                            onChange={event => changeTutorialCueKind(cue, event.target.value as LevelTutorialCueKind)}
                          >
                            <option value="message">{lang === 'zh' ? '引导语句' : 'Message'}</option>
                            <option value="preset">{lang === 'zh' ? '点击预设' : 'Select preset'}</option>
                            <option value="tool">{lang === 'zh' ? '选择工具' : 'Select tool'}</option>
                            <option value="input">{lang === 'zh' ? '按键操作' : 'Press action'}</option>
                            <option value="card-place">{lang === 'zh' ? '放置卡牌' : 'Place cards'}</option>
                            <option value="blueprint-step">{lang === 'zh' ? '完成蓝图步骤' : 'Complete blueprint step'}</option>
                            <option value="height">{lang === 'zh' ? '达到高度' : 'Reach height'}</option>
                            <option value="test-start">{lang === 'zh' ? '开始测试' : 'Start test'}</option>
                            <option value="test-success">{lang === 'zh' ? '测试成功' : 'Test success'}</option>
                            <option value="test-failure">{lang === 'zh' ? '测试失败' : 'Test failure'}</option>
                          </select>
                          <label className="level-cue-enabled" title={lang === 'zh' ? '启用节点' : 'Enable node'}><input type="checkbox" checked={cue.enabled} onChange={event => updateTutorialCue(cue.id, { enabled: event.target.checked })} /></label>
                          <button type="button" onClick={() => moveTutorialCue(index, -1)} disabled={index === 0}>↑</button>
                          <button type="button" onClick={() => moveTutorialCue(index, 1)} disabled={index === tutorialCues.length - 1}>↓</button>
                          <button type="button" onClick={() => duplicateTutorialCue(cue)} title={lang === 'zh' ? '复制节点' : 'Duplicate'}>⧉</button>
                          <button type="button" className="level-cue-play" onClick={() => playFromCue(cue)} title={lang === 'zh' ? '从此节点试玩' : 'Play from here'}>▶</button>
                          <button type="button" className="danger-text" onClick={() => setTutorialCues(current => current.filter(item => item.id !== cue.id))}>×</button>
                        </header>
                        <textarea
                          value={cue.text.zh}
                          onChange={event => updateTutorialCue(cue.id, {
                            text: { zh: event.target.value, en: event.target.value },
                          })}
                          placeholder={lang === 'zh' ? '写一句简短、可执行的引导语句' : 'Write one short actionable instruction'}
                        />
                        {cue.kind === 'preset' && (
                          <label>
                            <span>{lang === 'zh' ? '箭头指向的左侧预设' : 'Preset highlighted by arrow'}</span>
                            <select value={cue.presetId ?? ''} onChange={event => updateTutorialCue(cue.id, { presetId: event.target.value || undefined, target: { type: 'preset', presetId: event.target.value } })}>
                              <option value="">{lang === 'zh' ? '请选择预设' : 'Select preset'}</option>
                              {presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                            </select>
                          </label>
                        )}
                        {cue.kind === 'tool' && (
                          <label><span>{lang === 'zh' ? '要求选择的工具' : 'Required tool'}</span><select value={cue.tool ?? PointerMode.PLACE} onChange={event => { const tool = event.target.value as PointerMode; updateTutorialCue(cue.id, { tool, target: { type: 'tool', tool } }); }}><option value={PointerMode.PLACE}>{lang === 'zh' ? '建造' : 'Place'}</option><option value={PointerMode.PUSH}>{lang === 'zh' ? '推拨' : 'Push'}</option><option value={PointerMode.DELETE}>{lang === 'zh' ? '删除' : 'Delete'}</option><option value={PointerMode.LAUNCH}>{lang === 'zh' ? '弹射' : 'Launch'}</option></select></label>
                        )}
                        {cue.kind === 'input' && (
                          <label>
                            <span>{lang === 'zh' ? '需要玩家执行的操作' : 'Required input action'}</span>
                            <select value={cue.inputAction ?? ''} onChange={event => {
                              const inputAction = event.target.value as InputAction;
                              const target: LevelTutorialTarget = inputAction === 'physics.toggle' ? { type: 'control', control: 'physics' } : inputAction === 'card.lockHeight' ? { type: 'control', control: 'height-lock' } : inputAction === 'history.undo' ? { type: 'control', control: 'undo' } : inputAction === 'history.redo' ? { type: 'control', control: 'redo' } : cue.target;
                              updateTutorialCue(cue.id, { inputAction: inputAction || undefined, target });
                            }}>
                              <option value="">{lang === 'zh' ? '请选择操作' : 'Select action'}</option>
                              {ACTIONS.filter(action => !action.startsWith('preset.slot')).map(action => <option key={action} value={action}>{action}</option>)}
                            </select>
                          </label>
                        )}
                        {cue.kind === 'blueprint-step' && (
                          <label>
                            <span>{lang === 'zh' ? '等待完成的蓝图步骤' : 'Blueprint step to complete'}</span>
                            <select value={cue.blueprintStepIndex ?? 0} onChange={event => { const stepIndex = Number(event.target.value); updateTutorialCue(cue.id, { blueprintStepIndex: stepIndex, target: { type: 'blueprint-step', stepIndex } }); }}>
                              {(selectedBlueprint?.steps ?? []).map((step, stepIndex) => (
                                <option key={step.id} value={stepIndex}>{stepIndex + 1} · {step.title}</option>
                              ))}
                            </select>
                          </label>
                        )}
                        {cue.kind === 'card-place' && <label><span>{lang === 'zh' ? '需要新放置的牌数' : 'New cards required'}</span><input type="number" min="1" max="100" value={cue.cardCount ?? 1} onChange={event => updateTutorialCue(cue.id, { cardCount: Math.max(1, Number(event.target.value)) })} /></label>}
                        {cue.kind === 'height' && <label><span>{lang === 'zh' ? '目标高度' : 'Target height'}</span><input type="number" min=".1" step=".1" value={cue.targetHeight ?? 1} onChange={event => updateTutorialCue(cue.id, { targetHeight: Math.max(.1, Number(event.target.value)) })} /></label>}

                        {!['preset', 'tool', 'blueprint-step'].includes(cue.kind) && (
                          <label><span>{lang === 'zh' ? '视觉指向目标' : 'Visual target'}</span><select value={cue.target.type === 'control' ? `control:${cue.target.control}` : cue.target.type} onChange={event => {
                            const value = event.target.value;
                            updateCueTarget(cue, value === 'world' ? { type: 'world', position: [0, 0, 0] } : value.startsWith('control:') ? { type: 'control', control: value.slice(8) as 'physics' | 'undo' | 'redo' | 'height-lock' | 'test' } : { type: 'none' });
                          }}><option value="none">{lang === 'zh' ? '不指向' : 'None'}</option><option value="control:height-lock">{lang === 'zh' ? '高度锁定提示' : 'Height lock'}</option><option value="control:physics">{lang === 'zh' ? '物理开关' : 'Physics'}</option><option value="control:undo">{lang === 'zh' ? '撤销' : 'Undo'}</option><option value="control:redo">{lang === 'zh' ? '重做' : 'Redo'}</option><option value="control:test">{lang === 'zh' ? '测试按钮' : 'Test button'}</option><option value="world">{lang === 'zh' ? '场景坐标' : 'World position'}</option></select></label>
                        )}
                        {cue.target.type === 'world' && <div className="level-world-target"><span>{lang === 'zh' ? '场景坐标 X / Y / Z' : 'World X / Y / Z'}</span>{cue.target.position.map((value, axis) => <input key={axis} type="number" step=".1" value={value} onChange={event => { const target = cue.target as Extract<LevelTutorialTarget, { type: 'world' }>; const position = [...target.position] as [number, number, number]; position[axis] = Number(event.target.value); updateCueTarget(cue, { type: 'world', position }); }} />)}</div>}

                        <div className={`level-cue-target-status ${isCueTargetValid(cue) ? 'is-valid' : 'is-invalid'}`}>
                          <span>{isCueTargetValid(cue) ? '●' : '!'}</span>
                          {isCueTargetValid(cue)
                            ? (lang === 'zh' ? '语义目标有效；试玩时会跟随真实 UI 和镜头位置' : 'Semantic target valid; preview follows live UI and camera')
                            : (lang === 'zh' ? '目标不存在，请重新选择' : 'Target is missing; choose another target')}
                        </div>

                        <div className="level-cue-visuals">
                          <label><span>{lang === 'zh' ? '初始高亮' : 'Initial highlight'}</span><select value={cue.highlight} onChange={event => updateTutorialCue(cue.id, { highlight: event.target.value as LevelTutorialCue['highlight'] })}><option value="pulse">{lang === 'zh' ? '脉冲' : 'Pulse'}</option><option value="arrow">{lang === 'zh' ? '箭头' : 'Arrow'}</option><option value="spotlight">{lang === 'zh' ? '聚光' : 'Spotlight'}</option><option value="key-badge">{lang === 'zh' ? '按键徽章' : 'Key badge'}</option><option value="blueprint-glow">{lang === 'zh' ? '蓝图发光' : 'Blueprint glow'}</option></select></label>
                          <label className="level-tutorial-toggle"><input type="checkbox" checked={cue.feedback.flash} onChange={event => updateTutorialCue(cue.id, { feedback: { ...cue.feedback, flash: event.target.checked } })} /><span>{lang === 'zh' ? '完成闪光' : 'Flash'}</span></label>
                          <label className="level-tutorial-toggle"><input type="checkbox" checked={cue.feedback.sound} onChange={event => updateTutorialCue(cue.id, { feedback: { ...cue.feedback, sound: event.target.checked } })} /><span>{lang === 'zh' ? '完成音效' : 'Sound'}</span></label>
                        </div>
                        <details className="level-cue-hints">
                          <summary>{lang === 'zh' ? '渐进提示（默认 3 / 8 / 15 秒）' : 'Progressive hints (3 / 8 / 15 seconds)'}</summary>
                          {cue.hints.map((hint, hintIndex) => <div key={`${cue.id}_hint_${hintIndex}`}><input type="number" min="0" step=".5" value={hint.delayMs / 1000} onChange={event => updateTutorialCue(cue.id, { hints: cue.hints.map((item, index) => index === hintIndex ? { ...item, delayMs: Math.max(0, Number(event.target.value) * 1000) } : item) })} /><select value={hint.highlight} onChange={event => updateTutorialCue(cue.id, { hints: cue.hints.map((item, index) => index === hintIndex ? { ...item, highlight: event.target.value as LevelTutorialCue['highlight'] } : item) })}><option value="pulse">{lang === 'zh' ? '脉冲' : 'Pulse'}</option><option value="arrow">{lang === 'zh' ? '箭头' : 'Arrow'}</option><option value="spotlight">{lang === 'zh' ? '聚光' : 'Spotlight'}</option><option value="key-badge">{lang === 'zh' ? '按键' : 'Key'}</option><option value="blueprint-glow">{lang === 'zh' ? '蓝图' : 'Blueprint'}</option></select><input value={hint.text.zh} onChange={event => updateTutorialCue(cue.id, { hints: cue.hints.map((item, index) => index === hintIndex ? { ...item, text: { zh: event.target.value, en: event.target.value } } : item) })} placeholder={lang === 'zh' ? '可选的加强提示' : 'Optional stronger hint'} /></div>)}
                        </details>
                      </article>
                    ))}
                    <button type="button" className="level-add-cue" onClick={addTutorialCue}>
                      {lang === 'zh' ? '+ 添加教学步骤' : '+ Add tutorial cue'}
                    </button>
                  </div>
                  <details className="level-tutorial-debug">
                    <summary>{lang === 'zh' ? '试玩事件日志' : 'Playtest event log'}</summary>
                    {tutorialDebugEvents.filter(event => !editingLevel || event.levelId === editingLevel.id).length === 0
                      ? <p>{lang === 'zh' ? '从任意节点试玩后，完成、输入、回退和跳过事件会显示在这里。' : 'Play from any node to inspect completion, input, regression, and skip events here.'}</p>
                      : tutorialDebugEvents.filter(event => !editingLevel || event.levelId === editingLevel.id).map((event, index) => <code key={`${event.at}_${index}`}>{new Date(event.at).toLocaleTimeString()} · {event.message}</code>)}
                  </details>
                </>
              )}
            </section>
            <button className="primary-button level-save">
              {editingLevel
                ? (lang === 'zh' ? '保存修改并等待重新试玩' : 'Save changes and re-test')
                : (lang === 'zh' ? '保存自包含关卡' : 'Save self-contained level')}
            </button>
          </form>
        ) : (
          <div className="level-library">
            {levels.length === 0 ? <div className="blueprint-empty"><strong>{lang === 'zh' ? '还没有自定义关卡' : 'No custom levels yet'}</strong></div> : levels.map(level => {
              const isOfficial = officialLevelIds.includes(level.id);
              const isOfficialOverride = overriddenOfficialLevelIds.includes(level.id);
              return (
              <article className={`level-card ${isOfficial ? 'is-official' : ''}`} key={level.id}>
                <div>
                  <span className="panel-kicker">
                    {isOfficial ? (lang === 'zh' ? '官方' : 'OFFICIAL') : (lang === 'zh' ? '玩家' : 'PLAYER')}
                    {isOfficialOverride ? ` · ${lang === 'zh' ? '已修改' : 'OVERRIDDEN'}` : ''}
                    {' · '}{level.status}
                  </span>
                  <h3>{level.name[lang]}</h3><p>{level.description[lang]}</p>
                  <small>
                    {level.embeddedBlueprint.cardCount} {lang === 'zh' ? '张目标牌' : 'target cards'} · {level.testType} · {level.testDuration}s
                    {' · '}{level.requiresBlueprintMatch ? (lang === 'zh' ? '要求蓝图' : 'blueprint required') : (lang === 'zh' ? '自由结构' : 'free structure')}
                    {level.tutorial.enabled ? ` · ${level.tutorial.cues.length} ${lang === 'zh' ? '条教学' : 'tutorial cues'}` : ''}
                    {' · '}{level.verification.passed ? (lang === 'zh' ? '已试玩通过' : 'verified') : (lang === 'zh' ? '待试玩' : 'unverified')}
                  </small>
                </div>
                <div className="level-card-actions">
                  <button className="primary-button" onClick={() => onPlay(level)}>{lang === 'zh' ? '试玩' : 'Playtest'}</button>
                  <button onClick={() => beginEdit(level)}>{lang === 'zh' ? '编辑' : 'Edit'}</button>
                  <button onClick={() => onDuplicate(level)}>{lang === 'zh' ? '复制' : 'Duplicate'}</button>
                  {level.status === 'draft' && <button onClick={() => {
                    const issues = onPublish(level);
                    setNotice(issues.length
                      ? (lang === 'zh'
                          ? `无法发布：${issues.map(issueLabel).join('、')}`
                          : `Cannot publish: ${issues.map(issueLabel).join(', ')}`)
                      : (level.verification.passed
                          ? (lang === 'zh' ? '关卡已发布。' : 'Level published.')
                          : (lang === 'zh' ? '关卡已发布，但尚未试玩验证。' : 'Level published without playtest verification.')));
                  }}>{lang === 'zh' ? '发布' : 'Publish'}</button>}
                  <button onClick={() => downloadLevel(level)}>{lang === 'zh' ? '导出' : 'Export'}</button>
                  {isOfficial
                    ? isOfficialOverride && (
                        <button className="danger-text" onClick={() =>
                          confirm(lang === 'zh' ? '恢复官方默认关卡？当前修改会被移除。' : 'Restore the built-in official level?') &&
                          onDelete(level.id)
                        }>
                          {lang === 'zh' ? '恢复默认' : 'Restore default'}
                        </button>
                      )
                    : (
                        <button className="danger-text" onClick={() =>
                          confirm(lang === 'zh' ? '删除这个关卡？' : 'Delete this level?') &&
                          onDelete(level.id)
                        }>
                          {lang === 'zh' ? '删除' : 'Delete'}
                        </button>
                      )}
                </div>
              </article>
            )})}
          </div>
        )}
      </section>
    </div>
  );
};

export default LevelStudio;
