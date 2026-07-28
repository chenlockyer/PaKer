/// <reference lib="dom" />
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  Blueprint,
  BlueprintCategory,
  BlueprintSnapshot,
  CardSize,
} from '../types';
import {
  CreateBlueprintInput,
  downloadBlueprint,
  parseBlueprintFile,
} from '../services/blueprintService';

interface BlueprintStudioProps {
  isOpen: boolean;
  lang: 'en' | 'zh';
  cardSize: CardSize;
  snapshot: BlueprintSnapshot | null;
  blueprints: Blueprint[];
  onRefreshSnapshot: () => void;
  onSave: (input: CreateBlueprintInput) => void;
  onDelete: (id: string) => void;
  onImport: (blueprint: Blueprint) => void;
  onClose: () => void;
}

const CATEGORIES: BlueprintCategory[] = [
  'architecture',
  'tutorial',
  'battle',
  'challenge',
  'experiment',
];

const categoryLabels: Record<BlueprintCategory, Record<'zh' | 'en', string>> = {
  architecture: { zh: '建筑结构', en: 'Structure' },
  tutorial: { zh: '教学蓝图', en: 'Tutorial' },
  battle: { zh: '对战建筑', en: 'Battle' },
  challenge: { zh: '挑战方案', en: 'Challenge' },
  experiment: { zh: '实验结构', en: 'Experiment' },
};

const dateLabel = (iso: string, lang: 'zh' | 'en') => {
  try {
    return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const BlueprintPreview = ({
  snapshot,
  compact = false,
}: {
  snapshot: BlueprintSnapshot;
  compact?: boolean;
}) => {
  const segments = useMemo(() => snapshot.cards.map(card => {
    const quaternion = new THREE.Quaternion(...card.quaternion);
    const center = new THREE.Vector3(...card.position);
    const longAxis = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);
    const halfLength = 1.4;
    return {
      id: card.id,
      color: card.color === 'red' ? '#c83b49' : '#27313d',
      start: center.clone().addScaledVector(longAxis, -halfLength),
      end: center.clone().addScaledVector(longAxis, halfLength),
      center,
    };
  }), [snapshot]);

  const width = Math.max(snapshot.bounds.size[0], 1);
  const height = Math.max(snapshot.bounds.size[1], 1);
  const depth = Math.max(snapshot.bounds.size[2], 1);
  const padding = 0.55;

  return (
    <div className={`blueprint-preview ${compact ? 'is-compact' : ''}`}>
      <div>
        <span>{compact ? '' : 'TOP'}</span>
        <svg viewBox={`${-width / 2 - padding} ${-depth / 2 - padding} ${width + padding * 2} ${depth + padding * 2}`}>
          <g transform="scale(1,-1)">
            {segments.map(segment => (
              <line
                key={segment.id}
                x1={segment.start.x}
                y1={segment.start.z}
                x2={segment.end.x}
                y2={segment.end.z}
                stroke={segment.color}
                strokeWidth={compact ? 0.08 : 0.045}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        </svg>
      </div>
      {!compact && (
        <div>
          <span>FRONT</span>
          <svg viewBox={`${-width / 2 - padding} ${-padding} ${width + padding * 2} ${height + padding * 2}`}>
            <g transform={`translate(0, ${height}) scale(1,-1)`}>
              {segments.map(segment => (
                <line
                  key={segment.id}
                  x1={segment.start.x}
                  y1={segment.start.y}
                  x2={segment.end.x}
                  y2={segment.end.y}
                  stroke={segment.color}
                  strokeWidth={0.045}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
          </svg>
        </div>
      )}
    </div>
  );
};

const BlueprintStudio: React.FC<BlueprintStudioProps> = ({
  isOpen,
  lang,
  cardSize,
  snapshot,
  blueprints,
  onRefreshSnapshot,
  onSave,
  onDelete,
  onImport,
  onClose,
}) => {
  const [tab, setTab] = useState<'create' | 'library'>('create');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [author, setAuthor] = useState(() => localStorage.getItem('hoc_blueprint_author') ?? '');
  const [category, setCategory] = useState<BlueprintCategory>('architecture');
  const [tags, setTags] = useState('');
  const [notice, setNotice] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setNotice('');
  }, [isOpen, snapshot?.capturedAt]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const copy = lang === 'zh'
    ? {
        title: '蓝图工作台',
        subtitle: '从物理世界捕获卡牌的当前状态',
        create: '创建蓝图',
        library: `蓝图库 ${blueprints.length}`,
        structure: '当前结构',
        live: '实时物理快照',
        refresh: '重新捕获',
        noCards: '场景中还没有可捕获的卡牌',
        noCardsHint: '关闭工作台，完成搭建后再创建蓝图。',
        name: '蓝图名称',
        namePlaceholder: '例如：双层加固纸牌屋',
        author: '作者',
        authorPlaceholder: '你的名称',
        category: '蓝图类型',
        tags: '标签',
        tagsPlaceholder: '稳固, 双层, 新手（用逗号分隔）',
        description: '结构说明',
        descriptionPlaceholder: '说明用途、搭建难点或使用方法',
        save: '保存到蓝图库',
        close: '关闭',
        saved: '蓝图已保存。捕获的是卡牌此刻的实际位置与姿态。',
        count: '卡牌',
        size: '结构尺寸',
        captured: '捕获时间',
        emptyLibrary: '蓝图库还是空的',
        emptyHint: '从当前建筑创建第一份蓝图，之后可以导出并分享给其他玩家。',
        export: '导出',
        remove: '删除',
        import: '导入蓝图',
        imported: '蓝图已导入',
        invalidImport: '导入失败：文件不是有效的 PaKer 蓝图',
        deleteConfirm: '确定删除这份蓝图吗？',
        required: '请填写蓝图名称，并确保场景中至少有一张牌。',
      }
    : {
        title: 'Blueprint Studio',
        subtitle: 'Capture the cards as they exist in the physics world now',
        create: 'Create',
        library: `Library ${blueprints.length}`,
        structure: 'Current structure',
        live: 'Live physics snapshot',
        refresh: 'Recapture',
        noCards: 'There are no cards to capture',
        noCardsHint: 'Close the studio, build a structure, then create a blueprint.',
        name: 'Blueprint name',
        namePlaceholder: 'e.g. Reinforced two-story house',
        author: 'Author',
        authorPlaceholder: 'Your name',
        category: 'Type',
        tags: 'Tags',
        tagsPlaceholder: 'stable, two-story, beginner',
        description: 'Notes',
        descriptionPlaceholder: 'Describe its purpose, difficult steps, or usage',
        save: 'Save to library',
        close: 'Close',
        saved: 'Blueprint saved from the cards’ current physical positions and poses.',
        count: 'Cards',
        size: 'Dimensions',
        captured: 'Captured',
        emptyLibrary: 'Your blueprint library is empty',
        emptyHint: 'Create one from the current structure, then export it to share.',
        export: 'Export',
        remove: 'Delete',
        import: 'Import blueprint',
        imported: 'Blueprint imported',
        invalidImport: 'Import failed: this is not a valid PaKer blueprint',
        deleteConfirm: 'Delete this blueprint?',
        required: 'Enter a name and make sure at least one card is in the scene.',
      };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!snapshot || snapshot.cards.length === 0 || !name.trim()) {
      setNotice(copy.required);
      return;
    }
    localStorage.setItem('hoc_blueprint_author', author.trim());
    onSave({
      name,
      description,
      author,
      category,
      tags: tags.split(/[,，]/),
      cardSize,
      snapshot,
    });
    setName('');
    setDescription('');
    setTags('');
    setNotice(copy.saved);
  };

  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      onImport(parseBlueprintFile(await file.text()));
      setNotice(copy.imported);
      setTab('library');
    } catch (error) {
      console.error(error);
      setNotice(copy.invalidImport);
    }
  };

  const sizeText = snapshot
    ? snapshot.bounds.size.map(value => value.toFixed(2)).join(' × ')
    : '—';

  return (
    <div className="modal-layer blueprint-layer" role="dialog" aria-modal="true">
      <section className="blueprint-window">
        <header className="blueprint-header">
          <div>
            <span className="panel-kicker">{copy.subtitle}</span>
            <h2>{copy.title}</h2>
          </div>
          <button className="close-button" onClick={onClose} aria-label={copy.close}>×</button>
        </header>

        <nav className="blueprint-tabs">
          <button className={tab === 'create' ? 'is-active' : ''} onClick={() => setTab('create')}>
            {copy.create}
          </button>
          <button className={tab === 'library' ? 'is-active' : ''} onClick={() => setTab('library')}>
            {copy.library}
          </button>
          <button className="blueprint-import" onClick={() => importRef.current?.click()}>
            {copy.import}
          </button>
          <input ref={importRef} type="file" accept=".json,.paker-blueprint.json" onChange={importFile} hidden />
        </nav>

        {notice && <div className="blueprint-notice">{notice}</div>}

        {tab === 'create' ? (
          <div className="blueprint-create">
            <section className="blueprint-capture-panel">
              <div className="blueprint-section-heading">
                <div>
                  <span className="panel-kicker">{copy.live}</span>
                  <h3>{copy.structure}</h3>
                </div>
                <button onClick={onRefreshSnapshot}>{copy.refresh}</button>
              </div>

              {snapshot && snapshot.cards.length > 0 ? (
                <>
                  <BlueprintPreview snapshot={snapshot} />
                  <dl className="blueprint-metrics">
                    <div><dt>{copy.count}</dt><dd>{snapshot.cards.length}</dd></div>
                    <div><dt>{copy.size}</dt><dd>{sizeText}</dd></div>
                    <div><dt>{copy.captured}</dt><dd>{dateLabel(snapshot.capturedAt, lang)}</dd></div>
                  </dl>
                </>
              ) : (
                <div className="blueprint-empty">
                  <span className="blueprint-empty-mark">□</span>
                  <strong>{copy.noCards}</strong>
                  <p>{copy.noCardsHint}</p>
                </div>
              )}
            </section>

            <form className="blueprint-form" onSubmit={submit}>
              <label>
                <span>{copy.name}</span>
                <input value={name} onChange={event => setName(event.target.value)} placeholder={copy.namePlaceholder} maxLength={60} autoFocus />
              </label>
              <div className="blueprint-form-row">
                <label>
                  <span>{copy.author}</span>
                  <input value={author} onChange={event => setAuthor(event.target.value)} placeholder={copy.authorPlaceholder} maxLength={30} />
                </label>
                <label>
                  <span>{copy.category}</span>
                  <select value={category} onChange={event => setCategory(event.target.value as BlueprintCategory)}>
                    {CATEGORIES.map(item => <option key={item} value={item}>{categoryLabels[item][lang]}</option>)}
                  </select>
                </label>
              </div>
              <label>
                <span>{copy.tags}</span>
                <input value={tags} onChange={event => setTags(event.target.value)} placeholder={copy.tagsPlaceholder} maxLength={100} />
              </label>
              <label className="blueprint-description">
                <span>{copy.description}</span>
                <textarea value={description} onChange={event => setDescription(event.target.value)} placeholder={copy.descriptionPlaceholder} maxLength={500} />
              </label>
              <button className="primary-button blueprint-save" disabled={!snapshot || snapshot.cards.length === 0}>
                {copy.save}
              </button>
            </form>
          </div>
        ) : (
          <div className="blueprint-library">
            {blueprints.length === 0 ? (
              <div className="blueprint-empty">
                <span className="blueprint-empty-mark">◇</span>
                <strong>{copy.emptyLibrary}</strong>
                <p>{copy.emptyHint}</p>
                <button className="primary-button" onClick={() => setTab('create')}>{copy.create}</button>
              </div>
            ) : (
              <div className="blueprint-library-grid">
                {blueprints.map(blueprint => (
                  <article className="blueprint-card" key={blueprint.id}>
                    <BlueprintPreview snapshot={blueprint.snapshot} compact />
                    <div className="blueprint-card-body">
                      <span className="panel-kicker">{categoryLabels[blueprint.category][lang]}</span>
                      <h3>{blueprint.name}</h3>
                      <p>{blueprint.description || (lang === 'zh' ? '暂无结构说明' : 'No notes')}</p>
                      <div className="blueprint-card-meta">
                        <span>{blueprint.cardCount} {copy.count}</span>
                        <span>{blueprint.author || (lang === 'zh' ? '匿名' : 'Anonymous')}</span>
                        <span>{dateLabel(blueprint.createdAt, lang)}</span>
                      </div>
                      {blueprint.tags.length > 0 && (
                        <div className="blueprint-tags">{blueprint.tags.map(tag => <i key={tag}>{tag}</i>)}</div>
                      )}
                    </div>
                    <footer>
                      <button onClick={() => downloadBlueprint(blueprint)}>{copy.export}</button>
                      <button
                        className="danger-text"
                        onClick={() => {
                          if (confirm(copy.deleteConfirm)) onDelete(blueprint.id);
                        }}
                      >
                        {copy.remove}
                      </button>
                    </footer>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default BlueprintStudio;
