import React, { useEffect, useRef, useState } from 'react';
import { CampaignDefinition, LevelDefinition } from '../types';
import {
  CampaignValidationIssue,
  createCampaign,
  downloadCampaign,
  getCampaignValidationIssues,
  loadCampaignDraft,
  makeCampaignLevelEntry,
  parseCampaignFile,
  publishCampaign,
  saveCampaignDraft,
} from '../services/campaignService';

interface Props {
  lang: 'zh' | 'en';
  levels: LevelDefinition[];
  initialCampaign: CampaignDefinition;
  onApply: (campaign: CampaignDefinition) => void;
  onRestoreBuiltIn: () => CampaignDefinition;
  onPreview: (campaign: CampaignDefinition, levelEntryId: string) => void;
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

const CampaignStudio: React.FC<Props> = ({ lang, levels, initialCampaign, onApply, onRestoreBuiltIn, onPreview }) => {
  const [campaign, setCampaign] = useState<CampaignDefinition>(() => loadCampaignDraft() ?? clone(initialCampaign));
  const [notice, setNotice] = useState('');
  const importRef = useRef<HTMLInputElement>(null);
  const eligibleLevels = levels.filter(level => level.status === 'published' && level.verification.passed && level.verification.blueprintChecksum === level.blueprintChecksum);

  useEffect(() => { if (!campaign.chapters.length) setCampaign(createCampaign()); }, []);
  const update = (mutator: (draft: CampaignDefinition) => void) => {
    const next = clone(campaign);
    mutator(next);
    next.status = 'draft';
    next.updatedAt = new Date().toISOString();
    setCampaign(next);
  };
  const issueLabel = (issue: CampaignValidationIssue) => {
    const chapter = campaign.chapters.find(item => item.id === issue.chapterId);
    const entry = chapter?.levels.find(item => item.id === issue.levelEntryId);
    const prefix = chapter ? `${chapter.name[lang]}${entry ? ` / ${entry.level.name[lang]}` : ''}：` : '';
    const labels = {
      'missing-name': lang === 'zh' ? '缺少战役名称' : 'Campaign name is missing',
      'empty-chapter': lang === 'zh' ? '启用的章节没有可玩关卡' : 'Enabled chapter has no playable levels',
      'duplicate-level': lang === 'zh' ? '同一关卡重复出现' : 'Level appears more than once',
      'invalid-level-snapshot': lang === 'zh' ? '关卡快照损坏' : 'Level snapshot is invalid',
      'unverified-level': lang === 'zh' ? '关卡未发布或未完整试玩' : 'Level is unpublished or unverified',
      'no-playable-levels': lang === 'zh' ? '流程中没有可玩关卡' : 'Campaign has no playable levels',
    };
    return prefix + labels[issue.code];
  };
  const saveDraft = () => { saveCampaignDraft(campaign); setNotice(lang === 'zh' ? '战役草稿已保存到本机。' : 'Campaign draft saved locally.'); };
  const apply = () => {
    const issues = getCampaignValidationIssues(campaign);
    if (issues.length) { setNotice(issues.map(issueLabel).join('；')); return; }
    const published = publishCampaign(campaign);
    setCampaign(published);
    saveCampaignDraft(published);
    onApply(published);
    setNotice(lang === 'zh' ? '已应用为本机“开始挑战”流程。' : 'Applied as the local challenge campaign.');
  };
  const writeOfficial = async () => {
    const issues = getCampaignValidationIssues(campaign);
    if (issues.length) { setNotice(issues.map(issueLabel).join('；')); return; }
    if (!window.desktopAPI?.writeOfficialCampaign) { setNotice(lang === 'zh' ? '浏览器模式只能导出；请在 Electron 开发模式写入官方资源。' : 'Browser mode can only export. Use Electron development mode.'); return; }
    const published = campaign.status === 'published' ? campaign : publishCampaign(campaign);
    const result = await window.desktopAPI.writeOfficialCampaign(published);
    setNotice(result.ok ? (lang === 'zh' ? '官方战役资源已原子写入，重新启动后生效。' : 'Official campaign resource written. Restart to load it.') : result.error);
  };
  const addChapter = () => update(draft => draft.chapters.push({ id: uid('chapter'), name: { zh: `第${draft.chapters.length + 1}章`, en: `Chapter ${draft.chapters.length + 1}` }, description: { zh: '', en: '' }, enabled: true, levels: [] }));
  const moveChapter = (index: number, delta: number) => update(draft => { const target = index + delta; if (target < 0 || target >= draft.chapters.length) return; [draft.chapters[index], draft.chapters[target]] = [draft.chapters[target], draft.chapters[index]]; });
  const moveEntry = (chapterIndex: number, entryIndex: number, targetChapterIndex: number, targetIndex: number) => update(draft => {
    const [entry] = draft.chapters[chapterIndex].levels.splice(entryIndex, 1);
    if (!entry) return;
    const adjustedTarget = chapterIndex === targetChapterIndex && targetIndex > entryIndex ? targetIndex - 1 : targetIndex;
    draft.chapters[targetChapterIndex].levels.splice(Math.max(0, Math.min(adjustedTarget, draft.chapters[targetChapterIndex].levels.length)), 0, entry);
  });
  const importCampaign = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    try { const next = parseCampaignFile(await file.text()); setCampaign(next); setNotice(lang === 'zh' ? '完整战役包已导入。' : 'Campaign package imported.'); } catch { setNotice(lang === 'zh' ? '导入失败：战役文件损坏。' : 'Import failed: invalid campaign.'); }
  };

  return <div className="campaign-studio">
    <section className="campaign-toolbar">
      <label><span>{lang === 'zh' ? '挑战流程名称' : 'Campaign name'}</span><input value={campaign.name[lang]} onChange={event => update(draft => { draft.name.zh = event.target.value; draft.name.en = event.target.value; })} /></label>
      <label><span>{lang === 'zh' ? '说明' : 'Description'}</span><input value={campaign.description[lang]} onChange={event => update(draft => { draft.description.zh = event.target.value; draft.description.en = event.target.value; })} /></label>
      <div className="campaign-actions"><button onClick={addChapter}>{lang === 'zh' ? '新增章节' : 'Add chapter'}</button><button onClick={saveDraft}>{lang === 'zh' ? '保存草稿' : 'Save draft'}</button><button className="primary-button" onClick={apply}>{lang === 'zh' ? '应用到开始挑战' : 'Apply locally'}</button><button onClick={() => downloadCampaign(campaign)}>{lang === 'zh' ? '导出' : 'Export'}</button><button onClick={() => importRef.current?.click()}>{lang === 'zh' ? '导入' : 'Import'}</button><button onClick={writeOfficial}>{lang === 'zh' ? '写入官方资源' : 'Write official resource'}</button><button onClick={() => { const restored = onRestoreBuiltIn(); setCampaign(clone(restored)); saveCampaignDraft(restored); setNotice(lang === 'zh' ? '已恢复项目内置流程。' : 'Built-in campaign restored.'); }}>{lang === 'zh' ? '恢复项目内置流程' : 'Restore built-in'}</button><input ref={importRef} hidden type="file" accept=".json,.paker-campaign.json" onChange={importCampaign} /></div>
      {notice && <div className="blueprint-notice">{notice}</div>}
    </section>
    <div className="campaign-chapters">
      {campaign.chapters.map((chapter, chapterIndex) => <article className={`campaign-chapter ${chapter.enabled ? '' : 'is-disabled'}`} key={chapter.id} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); try { const from = JSON.parse(event.dataTransfer.getData('application/paker-entry')); moveEntry(from.chapterIndex, from.entryIndex, chapterIndex, campaign.chapters[chapterIndex].levels.length); } catch { /* ignore non-entry drops */ } }}>
        <header><input value={chapter.name[lang]} onChange={event => update(draft => { const target = draft.chapters[chapterIndex]; target.name.zh = event.target.value; target.name.en = event.target.value; })} /><label><input type="checkbox" checked={chapter.enabled} onChange={event => update(draft => { draft.chapters[chapterIndex].enabled = event.target.checked; })} />{lang === 'zh' ? '启用' : 'Enabled'}</label><button onClick={() => { const first = chapter.levels.find(entry => entry.enabled); if (first) onPreview(campaign, first.id); }} disabled={!chapter.levels.some(entry => entry.enabled)}>{lang === 'zh' ? '预览章节' : 'Preview chapter'}</button><button onClick={() => moveChapter(chapterIndex, -1)} disabled={!chapterIndex}>↑</button><button onClick={() => moveChapter(chapterIndex, 1)} disabled={chapterIndex === campaign.chapters.length - 1}>↓</button><button title={lang === 'zh' ? '复制章节设置（关卡不重复复制）' : 'Duplicate chapter settings without levels'} onClick={() => update(draft => { const copy = clone(draft.chapters[chapterIndex]); copy.id = uid('chapter'); copy.name.zh += ' 副本'; copy.name.en += ' Copy'; copy.levels = []; draft.chapters.splice(chapterIndex + 1, 0, copy); })}>⧉</button><button className="danger-text" onClick={() => update(draft => { draft.chapters.splice(chapterIndex, 1); })}>×</button></header>
        <textarea value={chapter.description[lang]} placeholder={lang === 'zh' ? '章节说明' : 'Chapter description'} onChange={event => update(draft => { draft.chapters[chapterIndex].description.zh = event.target.value; draft.chapters[chapterIndex].description.en = event.target.value; })} />
        <div className="campaign-levels">
          {chapter.levels.map((entry, entryIndex) => {
            const source = levels.find(level => level.id === entry.sourceLevelId);
            const hasUpdate = Boolean(source && source.publishRevision > entry.sourcePublishRevision);
            return <div className={`campaign-entry ${entry.enabled ? '' : 'is-disabled'}`} key={entry.id} draggable onDragStart={event => event.dataTransfer.setData('application/paker-entry', JSON.stringify({ chapterIndex, entryIndex }))} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); event.stopPropagation(); try { const from = JSON.parse(event.dataTransfer.getData('application/paker-entry')); moveEntry(from.chapterIndex, from.entryIndex, chapterIndex, entryIndex); } catch { /* ignore */ } }}>
              <label><input type="checkbox" checked={entry.enabled} onChange={event => update(draft => { draft.chapters[chapterIndex].levels[entryIndex].enabled = event.target.checked; })} />{entry.level.name[lang]}</label><small>r{entry.sourcePublishRevision}{hasUpdate ? ` · ${lang === 'zh' ? '有更新' : 'update available'}` : ''}</small>
              <button onClick={() => onPreview(campaign, entry.id)}>{lang === 'zh' ? '预览' : 'Preview'}</button>{hasUpdate && <button onClick={() => update(draft => { const target = draft.chapters[chapterIndex].levels[entryIndex]; target.level = clone(source!); target.sourcePublishRevision = source!.publishRevision; })}>{lang === 'zh' ? '同步快照' : 'Sync'}</button>}
              <button onClick={() => moveEntry(chapterIndex, entryIndex, chapterIndex, entryIndex - 1)} disabled={!entryIndex}>↑</button><button onClick={() => moveEntry(chapterIndex, entryIndex, chapterIndex, entryIndex + 2)} disabled={entryIndex === chapter.levels.length - 1}>↓</button>
              <select value={chapterIndex} onChange={event => moveEntry(chapterIndex, entryIndex, Number(event.target.value), campaign.chapters[Number(event.target.value)].levels.length)}>{campaign.chapters.map((target, index) => <option key={target.id} value={index}>{target.name[lang]}</option>)}</select>
              <button className="danger-text" onClick={() => update(draft => { draft.chapters[chapterIndex].levels.splice(entryIndex, 1); })}>×</button>
            </div>;
          })}
        </div>
        <select defaultValue="" onChange={event => { const level = eligibleLevels.find(item => item.id === event.target.value); event.currentTarget.value = ''; if (level) update(draft => draft.chapters[chapterIndex].levels.push(makeCampaignLevelEntry(level))); }}><option value="">{lang === 'zh' ? '＋ 添加已发布且试玩通过的关卡' : '+ Add published verified level'}</option>{eligibleLevels.filter(level => !campaign.chapters.some(item => item.levels.some(entry => entry.sourceLevelId === level.id))).map(level => <option key={level.id} value={level.id}>{level.name[lang]} · r{level.publishRevision}</option>)}</select>
      </article>)}
    </div>
  </div>;
};

export default CampaignStudio;
