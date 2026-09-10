import { CLASSES, type Player } from 'shared';

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
          </div>
        ))}
      </div>
    </div>
  );
}
