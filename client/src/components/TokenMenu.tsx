import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';

export default function TokenMenu() {
  const menuId = useGameStore((s) => s.tokenMenuId);
  const token = useGameStore(
    (s) => s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens.find((t) => t.id === s.tokenMenuId) ?? null
  );
  const close = useGameStore((s) => s.setTokenMenu);
  const setTokenName = useGameStore((s) => s.setTokenName);
  const setTokenDescription = useGameStore((s) => s.setTokenDescription);
  const setTokenCells = useGameStore((s) => s.setTokenCells);
  const setTokenRound = useGameStore((s) => s.setTokenRound);
  const removeToken = useGameStore((s) => s.removeToken);

  const [draft, setDraft] = useState<{
    name: string;
    description: string;
    cells: number;
    round: boolean;
  } | null>(null);

  useEffect(() => {
    if (menuId && token) {
      setDraft({ name: token.name, description: token.description, cells: token.cells, round: token.round });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- черновик инициализируется при открытии меню
  }, [menuId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  if (!token || !draft) return null;

  const apply = () => {
    if (draft.name !== token.name) setTokenName(token.id, draft.name);
    if (draft.description !== token.description) setTokenDescription(token.id, draft.description);
    if (draft.cells !== token.cells) setTokenCells(token.id, draft.cells);
    if (draft.round !== token.round) setTokenRound(token.id, draft.round);
  };

  return (
    <div className="modal-backdrop" onMouseDown={() => close(null)}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <h3>Токен</h3>
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
              removeToken(token.id);
              close(null);
            }}
          >
            Удалить
          </button>
          <button
            className="primary"
            onClick={() => {
              apply();
              close(null);
            }}
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
