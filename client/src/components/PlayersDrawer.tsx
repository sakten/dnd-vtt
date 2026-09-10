import { useState } from 'react';
import { createPortal } from 'react-dom';
import { CLASSES, type Player } from 'shared';
import { useGameStore } from '../store/useGameStore';

function hpText(p: Player): string {
  if (p.hpMax == null) return '—';
  return `${p.hpCurrent ?? 0} / ${p.hpMax}`;
}

function classText(key?: string | null): string {
  if (!key) return '—';
  return CLASSES[key]?.name ?? key;
}

export default function PlayersDrawer({
  players,
  open,
  onClose,
}: {
  players: Player[];
  open: boolean;
  onClose: () => void;
}) {
  const role = useGameStore((s) => s.role);
  const selfId = useGameStore((s) => s.selfId);
  const removePlayer = useGameStore((s) => s.removePlayer);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const isDm = role === 'dm';
  const target = players.find((p) => p.id === confirmId) ?? null;

  return (
    <div className={`players-drawer${open ? ' open' : ''}`} aria-hidden={!open}>
      <div className="players-head">
        <strong>Игроки</strong>
        <button className="icon" title="Закрыть" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="players-list">
        {players.map((p) => (
          <div className={`player-row${p.isConnected ? '' : ' offline'}`} key={p.id}>
            <span className={`player-chip${p.isConnected ? ' online' : ' offline'}`}>
              {p.name}
              {p.role === 'dm' ? ' (DM)' : ''}
            </span>
            <span className="player-hp" title="Текущее / максимальное HP">
              {hpText(p)}
            </span>
            <span className="player-class" title="Класс">
              {classText(p.classKey)}
            </span>
            {isDm && p.id !== selfId && (
              <button
                className="icon danger"
                title="Удалить игрока из комнаты"
                onClick={() => setConfirmId(p.id)}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      {target &&
        createPortal(
          <div className="modal-backdrop" onMouseDown={() => setConfirmId(null)}>
            <div className="modal" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
              <h3>Удалить игрока?</h3>
              <p className="confirm-text">
                Игрок <strong>{target.name}</strong> будет удалён из комнаты и отключён.
              </p>
              <div className="modal-actions spread">
                <button onClick={() => setConfirmId(null)}>Отмена</button>
                <button
                  className="danger"
                  onClick={() => {
                    removePlayer(target.id);
                    setConfirmId(null);
                  }}
                >
                  Удалить
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
