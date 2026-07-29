import React, { useEffect, useMemo, useState } from 'react';
import {
  Blueprint,
  BlueprintCameraHint,
  BlueprintCategory,
  BlueprintStep,
  RotationPreset,
} from '../types';
import { DEFAULT_BLUEPRINT_TOLERANCE } from '../services/blueprintService';

interface BlueprintEditorProps {
  blueprint: Blueprint;
  presets: RotationPreset[];
  lang: 'zh' | 'en';
  currentCameraHint: BlueprintCameraHint;
  onChange: (blueprint: Blueprint) => void;
  onTest: (blueprint: Blueprint) => void;
  onBack: () => void;
}

const stepId = () => `step_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const BLUEPRINT_CATEGORIES: BlueprintCategory[] = [
  'architecture',
  'tutorial',
  'battle',
  'challenge',
  'experiment',
];

const BlueprintEditor: React.FC<BlueprintEditorProps> = ({
  blueprint,
  presets,
  lang,
  currentCameraHint,
  onChange,
  onTest,
  onBack,
}) => {
  const orderedSteps = useMemo(
    () => [...blueprint.steps].sort((left, right) => left.order - right.order),
    [blueprint.steps],
  );
  const [selectedStepId, setSelectedStepId] = useState(orderedSteps[0]?.id ?? '');
  const [tagsText, setTagsText] = useState(blueprint.tags.join(', '));

  useEffect(() => {
    if (!orderedSteps.some(step => step.id === selectedStepId)) {
      setSelectedStepId(orderedSteps[0]?.id ?? '');
    }
  }, [orderedSteps, selectedStepId]);

  useEffect(() => {
    setTagsText(blueprint.tags.join(', '));
  }, [blueprint.id]);

  const selectedStep = orderedSteps.find(step => step.id === selectedStepId) ?? orderedSteps[0];
  const copy = lang === 'zh'
    ? {
        back: '返回蓝图库',
        timeline: '步骤时间线',
        addStep: '添加步骤',
        cards: '卡牌分组',
        unassigned: '未分配',
        editor: '步骤设置',
        title: '步骤标题',
        description: '教学说明',
        recommended: '推荐放置预设',
        noPreset: '不指定',
        physicsScene: '蓝图不会改变卡牌物理状态；锁定与运行完全跟随场景“物理”开关。',
        camera: '镜头提示',
        captureCamera: '记录当前镜头',
        cameraSaved: '已记录',
        tolerance: '全局判定容差',
        horizontal: '水平位置',
        height: '高度',
        rotation: '旋转角度',
        near: '接近提示倍率',
        test: '从头测试',
        publish: '发布蓝图',
        draft: '转为草稿',
        delete: '删除步骤',
        moveUp: '上移',
        moveDown: '下移',
        hint: '点击卡牌可将它移动到当前步骤。同一张牌只能属于一个步骤。',
      }
    : {
        back: 'Back to library',
        timeline: 'STEP TIMELINE',
        addStep: 'Add step',
        cards: 'CARD GROUPING',
        unassigned: 'Unassigned',
        editor: 'STEP SETTINGS',
        title: 'Step title',
        description: 'Instruction',
        recommended: 'Recommended preset',
        noPreset: 'None',
        physicsScene: 'Blueprints never override card physics; lock state follows the scene Physics control.',
        camera: 'Camera hint',
        captureCamera: 'Capture current camera',
        cameraSaved: 'Captured',
        tolerance: 'MATCH TOLERANCE',
        horizontal: 'Horizontal',
        height: 'Height',
        rotation: 'Rotation',
        near: 'Near hint multiplier',
        test: 'Test from start',
        publish: 'Publish blueprint',
        draft: 'Move to drafts',
        delete: 'Delete step',
        moveUp: 'Move up',
        moveDown: 'Move down',
        hint: 'Click a card to move it into the selected step. Each card belongs to one step.',
        blueprintInfo: 'BLUEPRINT INFORMATION',
        blueprintName: 'Blueprint name',
        blueprintDescription: 'Blueprint description',
        author: 'Author',
        category: 'Category',
        tags: 'Tags',
        autoSave: 'Changes are saved automatically',
        cardSummary: 'Structure',
      };

  const categoryLabels: Record<BlueprintCategory, string> = lang === 'zh'
    ? {
        architecture: '建筑结构',
        tutorial: '教学蓝图',
        battle: '对战建筑',
        challenge: '挑战方案',
        experiment: '实验结构',
      }
    : {
        architecture: 'Structure',
        tutorial: 'Tutorial',
        battle: 'Battle',
        challenge: 'Challenge',
        experiment: 'Experiment',
      };

  const updateBlueprint = (changes: Partial<Blueprint>) => {
    onChange({ ...blueprint, ...changes, updatedAt: new Date().toISOString() });
  };

  const updateStep = (changes: Partial<BlueprintStep>) => {
    if (!selectedStep) return;
    updateBlueprint({
      steps: blueprint.steps.map(step =>
        step.id === selectedStep.id ? { ...step, ...changes } : step
      ),
    });
  };

  const addStep = () => {
    const next: BlueprintStep = {
      id: stepId(),
      order: orderedSteps.length,
      title: `${lang === 'zh' ? '步骤' : 'Step'} ${orderedSteps.length + 1}`,
      description: '',
      cardIds: [],
      freezeDuringBuild: false,
      releasePhysicsAfterStep: false,
    };
    updateBlueprint({ steps: [...orderedSteps, next] });
    setSelectedStepId(next.id);
  };

  const deleteStep = () => {
    if (!selectedStep || orderedSteps.length <= 1) return;
    const index = orderedSteps.findIndex(step => step.id === selectedStep.id);
    const receiver = orderedSteps[index > 0 ? index - 1 : 1];
    const next = orderedSteps
      .filter(step => step.id !== selectedStep.id)
      .map(step => step.id === receiver.id
        ? { ...step, cardIds: [...step.cardIds, ...selectedStep.cardIds] }
        : step
      )
      .map((step, order) => ({ ...step, order }));
    updateBlueprint({ steps: next });
    setSelectedStepId(receiver.id);
  };

  const moveStep = (direction: -1 | 1) => {
    if (!selectedStep) return;
    const index = orderedSteps.findIndex(step => step.id === selectedStep.id);
    const target = index + direction;
    if (target < 0 || target >= orderedSteps.length) return;
    const next = [...orderedSteps];
    [next[index], next[target]] = [next[target], next[index]];
    updateBlueprint({ steps: next.map((step, order) => ({ ...step, order })) });
  };

  const assignCard = (cardId: string) => {
    if (!selectedStep) return;
    const alreadySelected = selectedStep.cardIds.includes(cardId);
    updateBlueprint({
      steps: blueprint.steps.map(step => {
        if (step.id === selectedStep.id) {
          return {
            ...step,
            cardIds: alreadySelected
              ? step.cardIds.filter(id => id !== cardId)
              : [...step.cardIds, cardId],
          };
        }
        return alreadySelected ? step : { ...step, cardIds: step.cardIds.filter(id => id !== cardId) };
      }),
    });
  };

  const cardOwner = (cardId: string) =>
    orderedSteps.find(step => step.cardIds.includes(cardId));

  const setTolerance = (key: keyof Blueprint['tolerances'], value: number) => {
    if (!Number.isFinite(value) || value <= 0) return;
    updateBlueprint({
      tolerances: { ...blueprint.tolerances, [key]: value },
    });
  };

  const captureCameraHint = () => {
    const origin = blueprint.snapshot.originWorld;
    updateStep({
      cameraHint: {
        position: [
          currentCameraHint.position[0] - origin[0],
          currentCameraHint.position[1] - origin[1],
          currentCameraHint.position[2] - origin[2],
        ],
        target: [
          currentCameraHint.target[0] - origin[0],
          currentCameraHint.target[1] - origin[1],
          currentCameraHint.target[2] - origin[2],
        ],
      },
    });
  };

  const removeCameraHint = () => {
    updateStep({ cameraHint: undefined });
  };

  if (!selectedStep) return null;

  const selectedIndex = orderedSteps.findIndex(step => step.id === selectedStep.id);
  const assignedCardIds = new Set(orderedSteps.flatMap(step => step.cardIds));
  const canPublish =
    blueprint.name.trim().length > 0 &&
    orderedSteps.every(step => step.cardIds.length > 0 && step.title.trim().length > 0) &&
    blueprint.snapshot.cards.every(card => assignedCardIds.has(card.id));

  return (
    <div className="blueprint-editor">
      <aside className="blueprint-timeline">
        <div className="blueprint-editor-toolbar">
          <button onClick={onBack}>← {copy.back}</button>
          <span>{blueprint.status === 'published' ? (lang === 'zh' ? '已发布' : 'Published') : (lang === 'zh' ? '草稿' : 'Draft')}</span>
        </div>
        <div className="blueprint-timeline-heading">
          <span className="panel-kicker">{copy.timeline}</span>
          <button onClick={addStep}>+ {copy.addStep}</button>
        </div>
        <div className="blueprint-step-list">
          {orderedSteps.map((step, index) => (
            <button
              key={step.id}
              className={step.id === selectedStep.id ? 'is-selected' : ''}
              onClick={() => setSelectedStepId(step.id)}
            >
              <b>{String(index + 1).padStart(2, '0')}</b>
              <span>
                <strong>{step.title}</strong>
                <small>{step.cardIds.length} {lang === 'zh' ? '张牌' : 'cards'}</small>
              </span>
              <i>·</i>
            </button>
          ))}
        </div>
        <div className="blueprint-card-grouping">
          <span className="panel-kicker">{copy.cards}</span>
          <p>{copy.hint}</p>
          <div>
            {[...blueprint.snapshot.cards]
              .sort((left, right) => left.order - right.order)
              .map((card, index) => {
                const owner = cardOwner(card.id);
                return (
                  <button
                    key={card.id}
                    className={owner?.id === selectedStep.id ? 'is-selected' : owner ? 'is-assigned' : ''}
                    onClick={() => assignCard(card.id)}
                    title={owner?.title ?? copy.unassigned}
                  >
                    <b>{index + 1}</b>
                    <span className={card.color === 'red' ? 'is-red' : ''}>{card.rank}</span>
                  </button>
                );
              })}
          </div>
        </div>
      </aside>

      <main className="blueprint-step-editor">
        <header>
          <div>
            <span className="panel-kicker">{copy.editor}</span>
            <h3>{selectedStep.title}</h3>
          </div>
          <div>
            <button onClick={() => moveStep(-1)} disabled={selectedIndex === 0}>↑ {copy.moveUp}</button>
            <button onClick={() => moveStep(1)} disabled={selectedIndex === orderedSteps.length - 1}>↓ {copy.moveDown}</button>
          </div>
        </header>

        <div className="blueprint-editor-scroll">
          <section className="blueprint-metadata-editor">
            <header>
              <div>
                <span className="panel-kicker">
                  {lang === 'zh' ? '蓝图信息' : 'BLUEPRINT INFORMATION'}
                </span>
                <strong>{blueprint.name || (lang === 'zh' ? '未命名蓝图' : 'Untitled blueprint')}</strong>
              </div>
              <small>{lang === 'zh' ? '修改后自动保存' : 'Changes are saved automatically'}</small>
            </header>
            <div className="blueprint-metadata-grid">
              <label className="is-wide">
                <span>{lang === 'zh' ? '蓝图名称' : 'Blueprint name'}</span>
                <input
                  value={blueprint.name}
                  onChange={event => updateBlueprint({ name: event.target.value })}
                  maxLength={60}
                />
              </label>
              <label>
                <span>{lang === 'zh' ? '作者' : 'Author'}</span>
                <input
                  value={blueprint.author}
                  onChange={event => updateBlueprint({ author: event.target.value })}
                  maxLength={30}
                />
              </label>
              <label>
                <span>{lang === 'zh' ? '蓝图类型' : 'Category'}</span>
                <select
                  value={blueprint.category}
                  onChange={event => updateBlueprint({
                    category: event.target.value as BlueprintCategory,
                  })}
                >
                  {BLUEPRINT_CATEGORIES.map(category => (
                    <option key={category} value={category}>{categoryLabels[category]}</option>
                  ))}
                </select>
              </label>
              <label className="is-wide">
                <span>{lang === 'zh' ? '标签（用逗号分隔）' : 'Tags (comma separated)'}</span>
                <input
                  value={tagsText}
                  onChange={event => {
                    const value = event.target.value;
                    setTagsText(value);
                    updateBlueprint({
                      tags: value
                        .split(/[,，]/)
                        .map(tag => tag.trim())
                        .filter(Boolean)
                        .slice(0, 8),
                    });
                  }}
                  maxLength={100}
                />
              </label>
              <label className="is-wide">
                <span>{lang === 'zh' ? '蓝图说明' : 'Blueprint description'}</span>
                <textarea
                  value={blueprint.description}
                  onChange={event => updateBlueprint({ description: event.target.value })}
                  maxLength={500}
                />
              </label>
            </div>
            <div className="blueprint-metadata-readonly">
              <span>{lang === 'zh' ? '结构信息' : 'Structure'}</span>
              <b>{blueprint.cardCount} {lang === 'zh' ? '张牌' : 'cards'}</b>
              <b>{blueprint.cardSize === 'BRIDGE' ? (lang === 'zh' ? '桥牌尺寸' : 'Bridge') : (lang === 'zh' ? '扑克牌尺寸' : 'Poker')}</b>
              <b>{blueprint.snapshot.bounds.size.map(value => value.toFixed(2)).join(' × ')}</b>
            </div>
          </section>

          <div className="blueprint-editor-fields">
            <label>
              <span>{copy.title}</span>
              <input value={selectedStep.title} onChange={event => updateStep({ title: event.target.value })} maxLength={60} />
            </label>
            <label>
              <span>{copy.description}</span>
              <textarea value={selectedStep.description} onChange={event => updateStep({ description: event.target.value })} maxLength={500} />
            </label>
            <label>
              <span>{copy.recommended}</span>
              <select
                value={selectedStep.recommendedPresetId ?? ''}
                onChange={event => updateStep({ recommendedPresetId: event.target.value || undefined })}
              >
                <option value="">{copy.noPreset}</option>
                {presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
              </select>
            </label>
            <div className="blueprint-physics-note">
              <span className="physics-indicator" />
              <p>{copy.physicsScene}</p>
            </div>
            <section className="blueprint-camera-editor">
              <div>
                <span className="panel-kicker">{copy.camera}</span>
                <strong>{selectedStep.cameraHint ? copy.cameraSaved : (lang === 'zh' ? '尚未记录' : 'Not captured')}</strong>
              </div>
              <div className="blueprint-camera-actions">
                {selectedStep.cameraHint && (
                  <button className="danger-text" onClick={removeCameraHint}>
                    {lang === 'zh' ? '删除镜头' : 'Remove camera'}
                  </button>
                )}
                <button onClick={captureCameraHint}>{copy.captureCamera}</button>
              </div>
            </section>
          </div>

          <section className="blueprint-tolerance-editor">
            <div>
              <span className="panel-kicker">{copy.tolerance}</span>
              <button onClick={() => updateBlueprint({ tolerances: { ...DEFAULT_BLUEPRINT_TOLERANCE } })}>
                {lang === 'zh' ? '恢复默认' : 'Reset'}
              </button>
            </div>
            <div className="blueprint-tolerance-grid">
              <label>
                <span>{copy.horizontal}</span>
                <input type="number" step="0.01" min="0.01" value={blueprint.tolerances.horizontal} onChange={event => setTolerance('horizontal', Number(event.target.value))} />
              </label>
              <label>
                <span>{copy.height}</span>
                <input type="number" step="0.01" min="0.01" value={blueprint.tolerances.height} onChange={event => setTolerance('height', Number(event.target.value))} />
              </label>
              <label>
                <span>{copy.rotation}</span>
                <input type="number" step="1" min="1" value={blueprint.tolerances.rotationDegrees} onChange={event => setTolerance('rotationDegrees', Number(event.target.value))} />
              </label>
              <label>
                <span>{copy.near}</span>
                <input
                  type="number"
                  step="0.1"
                  min="1.1"
                  value={Number((blueprint.tolerances.nearHorizontal / blueprint.tolerances.horizontal).toFixed(1))}
                  onChange={event => {
                    const multiplier = Math.max(1.1, Number(event.target.value));
                    updateBlueprint({
                      tolerances: {
                        ...blueprint.tolerances,
                        nearHorizontal: Number((blueprint.tolerances.horizontal * multiplier).toFixed(3)),
                        nearHeight: Number((blueprint.tolerances.height * multiplier).toFixed(3)),
                        nearRotationDegrees: Number((blueprint.tolerances.rotationDegrees * multiplier).toFixed(2)),
                      },
                    });
                  }}
                />
              </label>
            </div>
          </section>
        </div>

        <footer className="blueprint-editor-footer">
          <button className="danger-text" onClick={deleteStep} disabled={orderedSteps.length <= 1}>{copy.delete}</button>
          <span />
          <button
            onClick={() => updateBlueprint({ status: blueprint.status === 'published' ? 'draft' : 'published' })}
            disabled={blueprint.status === 'draft' && !canPublish}
            title={!canPublish && blueprint.status === 'draft'
              ? (lang === 'zh' ? '发布前需要为每张牌分配非空步骤' : 'Assign every card to a non-empty step before publishing')
              : undefined}
          >
            {blueprint.status === 'published' ? copy.draft : copy.publish}
          </button>
          <button
            className="primary-button"
            onClick={() => onTest(blueprint)}
            disabled={!canPublish}
            title={!canPublish
              ? (lang === 'zh' ? '请先完成全部卡牌分组' : 'Assign every card before testing')
              : undefined}
          >
            {copy.test}
          </button>
        </footer>
      </main>
    </div>
  );
};

export default BlueprintEditor;
