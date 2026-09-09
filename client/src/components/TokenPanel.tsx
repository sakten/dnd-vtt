import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore } from '../store/useGameStore';
import { uploadImage } from '../lib/api';

export default function TokenPanel() {
  const items = useGameStore((s) => s.library);
  const addLibraryItem = useGameStore((s) => s.addLibraryItem);
  const updateLibraryItem = useGameStore((s) => s.updateLibraryItem);
  const removeLibraryItem = useGameStore((s) => s.removeLibraryItem);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastClickRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });

  const editing = items.find((i) => i.id === editingId) ?? null;

  const [draft, setDraft] = useState<{
    name: string;
    description: string;
    cells: number;
    round: boolean;
  } | null>(null);

  useEffect(() => {
    if (editing) {
      setDraft({
        name: editing.name,
        description: editing.description,
        cells: editing.cells,
        round: editing.round,
      });
    }
  }, [editingId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditingId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleItemClick = (id: string) => {
    setSelectedId(id);
    const now = Date.now();
    if (lastClickRef.current.id === id && now - lastClickRef.current.time < 350) {
      lastClickRef.current = { id: '', time: 0 };
      setEditingId(id);
    } else {
      lastClickRef.current = { id, time: now };
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const url = await uploadImage(file);
      addLibraryItem(file.name.replace(/\.[^.]+$/, ''), url, 1, false, '');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Не удалось загрузить токен');
    }
  };

  return (
    <div className="token-panel">
      <div className="token-panel-header">
        <span>Токены</span>
        <button className="icon" title="Загрузить токен" onClick={() => fileRef.current?.click()}>
          +
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
      </div>
      <div className="token-panel-list">
        {items.length === 0 && <div className="hint">Загрузите картинки токенов</div>}
        {items.map((item) => (
          <div
            className={`token-panel-item ${selectedId === item.id || editingId === item.id ? 'active' : ''}`}
            key={item.id}
            title={`${item.name} (${item.cells}×${item.cells}) — перетащите на карту, двойной клик — свойства`}
          >
            <img
              src={item.url}
              alt={item.name}
              draggable
              onClick={() => handleItemClick(item.id)}
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-vtt-token', JSON.stringify(item));
                e.dataTransfer.effectAllowed = 'copy';
              }}
            />
            <span className="token-size-badge">
              {item.cells}×{item.cells}
            </span>
          </div>
        ))}
      </div>

      {editing &&
        draft &&
        createPortal(
          <div className="modal-backdrop" onMouseDown={() => setEditingId(null)}>
            <div className="modal" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
              <h3>Свойства токена</h3>
              <label className="field">
                <span>Название</span>
                <input
                  type="text"
                  value={draft.name}
                  maxLength={40}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Описание</span>
                <textarea
                  value={draft.description}
                  rows={3}
                  maxLength={200}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </label>
              <div className="size-row">
                <span>Размер:</span>
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    className={draft.cells === n ? 'active' : ''}
                    onClick={() => setDraft({ ...draft, cells: n })}
                  >
                    {n}×{n}
                  </button>
                ))}
              </div>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={draft.round}
                  onChange={(e) => setDraft({ ...draft, round: e.target.checked })}
                />
                Круглый токен
              </label>
              <div className="modal-actions spread">
                <button
                  className="danger"
                  onClick={() => {
                    removeLibraryItem(editing.id);
                    setEditingId(null);
                  }}
                >
                  Убрать из библиотеки
                </button>
                <button
                  className="primary"
                  onClick={() => {
                    updateLibraryItem(editing.id, draft);
                    setEditingId(null);
                  }}
                >
                  Готово
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
