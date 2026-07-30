/// <reference lib="dom" />
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CARD_DIMENSIONS, CardSize } from '../types';
import { GameSaveData } from '../services/gameSaveService';

export type SaveLibraryMode = 'save' | 'load';

interface SaveLibraryModalProps {
  mode: SaveLibraryMode;
  lang: 'en' | 'zh';
  manualSaves: GameSaveData[];
  autosave: GameSaveData | null;
  onClose: () => void;
  onCreate: (name: string) => void;
  onOverwrite: (id: string) => void;
  onLoad: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

const SaveStackMark = () => (
  <span className="save-stack-mark" aria-hidden="true">
    <i />
    <i />
    <i />
  </span>
);

const SaveLibraryModal: React.FC<SaveLibraryModalProps> = ({
  mode,
  lang,
  manualSaves,
  autosave,
  onClose,
  onCreate,
  onOverwrite,
  onLoad,
  onRename,
  onDelete,
}) => {
  const defaultName = useMemo(
    () => lang === 'zh'
      ? `我的搭建 ${manualSaves.length + 1}`
      : `My Build ${manualSaves.length + 1}`,
    [lang, manualSaves.length],
  );
  const [newName, setNewName] = useState(defaultName);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (!editingId) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [editingId]);

  const copy = lang === 'zh'
    ? {
        saveTitle: '保存搭建',
        loadTitle: '读取搭建',
        newSave: '新建存档',
        create: '保存',
        overwrite: '覆盖',
        load: '读取',
        rename: '改名',
        remove: '删除',
        confirm: '确定',
        cancel: '取消',
        empty: '还没有手动存档',
        autosave: '自动存档',
        manual: '我的存档',
        cards: '张牌',
        bridge: '桥牌尺寸',
        poker: '扑克尺寸',
        removeConfirm: '删除这个存档？',
      }
    : {
        saveTitle: 'Save Build',
        loadTitle: 'Load Build',
        newSave: 'New save',
        create: 'Save',
        overwrite: 'Overwrite',
        load: 'Load',
        rename: 'Rename',
        remove: 'Delete',
        confirm: 'Apply',
        cancel: 'Cancel',
        empty: 'No manual saves yet',
        autosave: 'Autosave',
        manual: 'My saves',
        cards: 'cards',
        bridge: 'Bridge size',
        poker: 'Poker size',
        removeConfirm: 'Delete this save?',
      };

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));

  const renderSave = (save: GameSaveData, automatic = false) => {
    const isEditing = editingId === save.id;
    const dimensions = CARD_DIMENSIONS[save.cardSize];
    return (
      <article className={`save-library-item ${automatic ? 'is-autosave' : ''}`} key={save.id}>
        <SaveStackMark />
        <div className="save-item-copy">
          {isEditing ? (
            <input
              ref={renameInputRef}
              value={editingName}
              maxLength={40}
              onChange={event => setEditingName(event.target.value)}
              onKeyDown={event => {
                event.stopPropagation();
                if (event.key === 'Enter' && editingName.trim()) {
                  onRename(save.id, editingName);
                  setEditingId(null);
                }
                if (event.key === 'Escape') setEditingId(null);
              }}
              onKeyUp={event => event.stopPropagation()}
            />
          ) : (
            <strong>{automatic ? copy.autosave : save.name}</strong>
          )}
          <span>
            {formatDate(save.savedAt)}
            <i />
            {save.cards.length} {copy.cards}
            <i />
            {save.cardSize === CardSize.BRIDGE ? copy.bridge : copy.poker}
            <i />
            {dimensions.millimeters}
          </span>
        </div>
        <div className="save-item-actions">
          {isEditing ? (
            <>
              <button
                className="primary-button"
                disabled={!editingName.trim()}
                onClick={() => {
                  onRename(save.id, editingName);
                  setEditingId(null);
                }}
              >
                {copy.confirm}
              </button>
              <button onClick={() => setEditingId(null)}>{copy.cancel}</button>
            </>
          ) : (
            <>
              {(mode === 'load' || automatic) && (
                <button className="primary-button" onClick={() => onLoad(save.id)}>
                  {copy.load}
                </button>
              )}
              {mode === 'save' && !automatic && (
                <button className="primary-button" onClick={() => onOverwrite(save.id)}>
                  {copy.overwrite}
                </button>
              )}
              {!automatic && (
                <>
                  <button onClick={() => {
                    setEditingId(save.id);
                    setEditingName(save.name);
                  }}>
                    {copy.rename}
                  </button>
                  <button
                    className="danger-text"
                    onClick={() => {
                      if (window.confirm(copy.removeConfirm)) onDelete(save.id);
                    }}
                  >
                    {copy.remove}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </article>
    );
  };

  return (
    <div
      className="modal-layer save-library-layer ui-scale-surface"
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'save' ? copy.saveTitle : copy.loadTitle}
    >
      <section className="save-library-window">
        <header className="settings-header">
          <div>
            <span className="panel-kicker">PAKER</span>
            <h2>{mode === 'save' ? copy.saveTitle : copy.loadTitle}</h2>
          </div>
          <button className="close-button" onClick={onClose} aria-label={copy.cancel}>×</button>
        </header>

        {mode === 'save' && (
          <form
            className="save-create-row"
            onSubmit={event => {
              event.preventDefault();
              if (!newName.trim()) return;
              onCreate(newName);
            }}
          >
            <label htmlFor="new-save-name">{copy.newSave}</label>
            <input
              id="new-save-name"
              value={newName}
              maxLength={40}
              onChange={event => setNewName(event.target.value)}
              onKeyDown={event => event.stopPropagation()}
              onKeyUp={event => event.stopPropagation()}
            />
            <button className="primary-button" disabled={!newName.trim()}>
              {copy.create}
            </button>
          </form>
        )}

        <div className="save-library-content">
          {autosave && (
            <section className="save-library-group">
              <h3>{copy.autosave}</h3>
              {renderSave(autosave, true)}
            </section>
          )}
          <section className="save-library-group">
            <h3>{copy.manual}</h3>
            {manualSaves.length > 0
              ? manualSaves.map(save => renderSave(save))
              : <div className="save-library-empty"><SaveStackMark /><span>{copy.empty}</span></div>}
          </section>
        </div>
      </section>
    </div>
  );
};

export default SaveLibraryModal;
