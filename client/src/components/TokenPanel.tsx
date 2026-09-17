import { useEffect, useRef, useState } from 'react';
import type { TokenFields } from 'shared';
import { emptyAttacks, statsPaired } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { uploadImage } from '../lib/api';
import { canAddLibraryItem, canSetAsCharacter, useIsDm } from '../lib/control';
import Modal from './Modal';
import StatblockForm from './StatblockForm';
import StatblockSpells from './StatblockSpells';
import TokenFieldsForm from './TokenFieldsForm';

export default function TokenPanel() {
  const items = useGameStore((s) => s.library);
  const addLibraryItem = useGameStore((s) => s.addLibraryItem);
  const updateLibraryItem = useGameStore((s) => s.updateLibraryItem);
  const removeLibraryItem = useGameStore((s) => s.removeLibraryItem);
  const currentCharacterId = useGameStore((s) => s.currentCharacterId);
  const setCurrentCharacter = useGameStore((s) => s.setCurrentCharacter);
  const isDm = useIsDm();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<'main' | 'statblock' | 'spells'>('main');
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
        canInteract: editing.canInteract,
        damageDefenses: editing.damageDefenses ?? [],
        statblock: editing.statblock,
      });
      setTab('main');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- черновик инициализируется при открытии редактора
  }, [editingId]);

  // Сняли галку «кастер» — вкладка заклинаний исчезает, уходим на статблок.
  useEffect(() => {
    if (tab === 'spells' && !draft?.statblock?.spellcasting) setTab('statblock');
  }, [tab, draft]);

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
        canInteract: false,
        damageDefenses: [],
      });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Не удалось загрузить токен');
    }
  };

  return (
    <div className={`token-panel ${collapsed ? 'collapsed' : ''}`}>
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
            data-testid="token-panel-item"
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
            {!isDm && canSetAsCharacter(item) && (
              <button
                className={`token-star${item.id === currentCharacterId ? ' active' : ''}`}
                data-testid="token-star"
                title={item.id === currentCharacterId ? 'Отвязать персонажа' : 'Сделать моим персонажем'}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentCharacter(item.id === currentCharacterId ? null : item.id);
                }}
              >
                {item.id === currentCharacterId ? '★' : '☆'}
              </button>
            )}
            <span className="token-size-badge">
              {item.cells}×{item.cells}
            </span>
          </div>
        ))}
      </div>
      )}

      {editing && draft && (
        <Modal onClose={() => setEditingId(null)} className="token-modal">
          <div className="tm-header">
            <div className="tm-portrait">
              {draft.imageUrl ? <img src={draft.imageUrl} alt={draft.name} draggable={false} /> : <span>?</span>}
            </div>
            <div className="tm-head-info">
              <div className="tm-name">{draft.name || 'Без имени'}</div>
              <div className="tm-stats">
                <span>
                  {draft.cells}×{draft.cells}
                </span>
              </div>
              <div className="tm-sub">
                {draft.isPlayerToken && (
                  <span className="tm-owner">Токен игрока{draft.owner ? `: ${draft.owner}` : ''}</span>
                )}
              </div>
            </div>
            <button className="tm-close" aria-label="Закрыть" onClick={() => setEditingId(null)}>
              ×
            </button>
          </div>
          {!isDm && setCurrentCharacter && !editing.owner && editing.isPlayerToken && (
            <button
              type="button"
              className="tm-link-btn"
              data-testid="token-set-character"
              onClick={() => {
                setCurrentCharacter(currentCharacterId === editing.id ? null : editing.id);
                setEditingId(null);
              }}
            >
              {currentCharacterId === editing.id ? 'Отвязать персонажа' : 'Это мой персонаж'}
            </button>
          )}
          <div className="tm-tabs">
            <button className={`tm-tab${tab === 'main' ? ' active' : ''}`} onClick={() => setTab('main')}>
              Основное
            </button>
            {isDm && (
              <button
                className={`tm-tab${tab === 'statblock' ? ' active' : ''}`}
                onClick={() => setTab('statblock')}
              >
                Статблок
              </button>
            )}
            {isDm && draft.statblock?.spellcasting && (
              <button className={`tm-tab${tab === 'spells' ? ' active' : ''}`} onClick={() => setTab('spells')}>
                Заклинания
              </button>
            )}
          </div>
          <div className="tm-body">
            {tab === 'main' && (
              <TokenFieldsForm value={draft} onChange={(patch) => setDraft({ ...draft, ...patch })} />
            )}
            {tab === 'statblock' && isDm && (
              <StatblockForm
                value={draft.statblock}
                onChange={(statblock) => setDraft({ ...draft, statblock })}
              />
            )}
            {tab === 'spells' && isDm && draft.statblock?.spellcasting && (
              <StatblockSpells
                statblock={draft.statblock}
                onChange={(statblock) => setDraft({ ...draft, statblock })}
              />
            )}
          </div>
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
        </Modal>
      )}
    </div>
  );
}
