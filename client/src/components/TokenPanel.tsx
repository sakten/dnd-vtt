import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LibraryItem, TokenFields } from 'shared';
import { emptyAttacks, statsPaired } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { uploadImage } from '../lib/api';
import { canAddLibraryItem, canSetAsCharacter } from '../lib/control';
import TokenFieldsForm from './TokenFieldsForm';

export default function TokenPanel() {
  const items = useGameStore((s) => s.library);
  const addLibraryItem = useGameStore((s) => s.addLibraryItem);
  const updateLibraryItem = useGameStore((s) => s.updateLibraryItem);
  const removeLibraryItem = useGameStore((s) => s.removeLibraryItem);
  const currentCharacterId = useGameStore((s) => s.currentCharacterId);
  const setCurrentCharacter = useGameStore((s) => s.setCurrentCharacter);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastClickRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('vtt-token-panel') === 'collapsed');

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      localStorage.setItem('vtt-token-panel', v ? 'open' : 'collapsed');
      return !v;
    });
  };

  const editing = items.find((i) => i.id === editingId) ?? null;
  const currentItem = items.find((i) => i.id === currentCharacterId) ?? null;

  const [draft, setDraft] = useState<TokenFields | null>(null);
  const draftInvalid = !draft || !statsPaired(draft.ac ?? '', draft.hpMax ?? '');

  useEffect(() => {
    if (editing) {
      setDraft({
        name: editing.name,
        description: editing.description,
        imageUrl: editing.imageUrl,
        initiativeBonus: editing.initiativeBonus ?? '',
        cells: editing.cells,
        round: editing.round,
        isPlayerToken: editing.isPlayerToken,
        owner: editing.owner,
        attacks: editing.attacks,
        ac: editing.ac,
        hpMax: editing.hpMax,
        showStats: editing.showStats,
        damageDefenses: editing.damageDefenses ?? [],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- черновик инициализируется при открытии редактора
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
      addLibraryItem({
        name: file.name.replace(/\.[^.]+$/, ''),
        imageUrl: url,
        cells: 1,
        round: false,
        description: '',
        initiativeBonus: '',
        isPlayerToken: false,
        owner: '',
        attacks: emptyAttacks(),
        ac: '',
        hpMax: '',
        showStats: false,
        damageDefenses: [],
      });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Не удалось загрузить токен');
    }
  };

  return (
    <div className={`token-panel ${collapsed ? 'collapsed' : ''}`}>
      {!collapsed && (
      <div
        className={`character-slot ${currentItem ? 'filled' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={(e) => {
          e.preventDefault();
          const raw = e.dataTransfer.getData('application/x-vtt-token');
          if (!raw) return;
          let item: LibraryItem;
          try {
            item = JSON.parse(raw) as LibraryItem;
          } catch {
            return;
          }
          if (!canSetAsCharacter(item)) {
            window.alert('Только токены с галкой «Это токен игрока» и без владельца');
            return;
          }
          setCurrentCharacter(item.id);
        }}
      >
        <span className="character-slot-label">Текущий Персонаж</span>
        {currentItem ? (
          <div className="character-slot-item">
            <img src={currentItem.imageUrl} alt={currentItem.name} />
            <span className="character-slot-name">{currentItem.name}</span>
            <button
              className="character-slot-clear"
              title="Сбросить персонажа"
              onClick={() => setCurrentCharacter(null)}
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="character-slot-empty">Перетащите сюда своего персонажа</div>
        )}
      </div>
      )}
      <div className="token-panel-header">
        <span>Токены</span>
        <div className="token-panel-header-actions">
          <button className="icon" title="Загрузить токен" onClick={() => fileRef.current?.click()}>
            +
          </button>
          <button
            className="icon token-panel-toggle"
            title={collapsed ? 'Развернуть' : 'Свернуть'}
            onClick={toggleCollapsed}
          >
            {collapsed ? '▲' : '▼'}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={handleFile} />
      </div>
      {!collapsed && (
      <div className="token-panel-list">
        {items.length === 0 && <div className="hint">Загрузите картинки токенов</div>}
        {items.map((item) => (
          <div
            className={`token-panel-item ${selectedId === item.id || editingId === item.id ? 'active' : ''}`}
            key={item.id}
            title={`${item.name} (${item.cells}×${item.cells}) — перетащите на карту, двойной клик — свойства`}
          >
            <img
              src={item.imageUrl}
              alt={item.name}
              draggable={canAddLibraryItem(item) || canSetAsCharacter(item)}
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
      )}

      {editing &&
        draft &&
        createPortal(
          <div className="modal-backdrop" onMouseDown={() => setEditingId(null)}>
            <div className="modal token-modal" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
              <h3>Свойства токена</h3>
              <TokenFieldsForm value={draft} onChange={(patch) => setDraft({ ...draft, ...patch })} />
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
                  disabled={draftInvalid}
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
