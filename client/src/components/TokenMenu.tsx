import { useEffect, useState } from 'react';
import { statNumber, statsPaired, type TokenFields } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { canControlWith } from '../lib/control';
import TokenFieldsForm from './TokenFieldsForm';

export default function TokenMenu() {
  const menuId = useGameStore((s) => s.tokenMenuId);
  const token = useGameStore(
    (s) => s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens.find((t) => t.id === s.tokenMenuId) ?? null
  );
  const close = useGameStore((s) => s.setTokenMenu);
  const setTokenFields = useGameStore((s) => s.setTokenFields);
  const removeToken = useGameStore((s) => s.removeToken);
  const isDm = useGameStore((s) => s.role === 'dm');
  const canEdit = useGameStore((s) => {
    const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens.find((x) => x.id === s.tokenMenuId);
    return t ? canControlWith(s, t) : false;
  });

  const [draft, setDraft] = useState<TokenFields | null>(null);
  const [hpCurrent, setHpCurrent] = useState(0);

  useEffect(() => {
    if (menuId && token) {
      setDraft({
        name: token.name,
        description: token.description,
        imageUrl: token.imageUrl,
        initiativeBonus: token.initiativeBonus ?? '',
        cells: token.cells,
        round: token.round,
        isPlayerToken: token.isPlayerToken,
        owner: token.owner,
        attacks: token.attacks,
        ac: token.ac,
        hpMax: token.hpMax,
        showStats: token.showStats,
      });
      setHpCurrent(token.hpCurrent ?? 0);
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

  const showHp = isDm || statNumber(token.hpMax) > 0;
  const invalidStats = !statsPaired(draft.ac ?? '', draft.hpMax ?? '');

  return (
    <div className="modal-backdrop" onMouseDown={() => close(null)}>
      <div className="modal token-modal" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <h3>Токен</h3>
        <TokenFieldsForm
          value={draft}
          onChange={(patch) => {
            setDraft((d) => (d ? { ...d, ...patch } : d));
            if (patch.hpMax !== undefined) {
              setHpCurrent((cur) => (cur === 0 ? statNumber(patch.hpMax) : cur));
            }
          }}
          hpCurrent={showHp ? hpCurrent : undefined}
          onHpCurrentChange={showHp ? setHpCurrent : undefined}
        />
        <div className="modal-actions spread">
          {canEdit && (
            <button
              className="danger"
              onClick={() => {
                removeToken(token.id);
                close(null);
              }}
            >
              Удалить
            </button>
          )}
          <button
            className="primary"
            disabled={!canEdit || invalidStats}
            onClick={() => {
              setTokenFields(token.id, { ...draft, hpCurrent });
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
