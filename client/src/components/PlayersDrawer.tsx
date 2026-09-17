import { useState } from 'react';
import { type Player } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { t } from '../i18n';
import { classLabel } from '../i18n/domain';
import { useIsDm } from '../lib/control';
import Modal from './Modal';

function hpText(p: Player): string {
  if (p.hpMax == null) return '—';
  return `${p.hpCurrent ?? 0} / ${p.hpMax}`;
}

function classText(key?: string | null): string {
  if (!key) return '—';
  return classLabel(key);
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
  const selfId = useGameStore((s) => s.selfId);
  const removePlayer = useGameStore((s) => s.removePlayer);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const isDm = useIsDm();
  const target = players.find((p) => p.id === confirmId) ?? null;

  return (
    <div className={`players-drawer${open ? ' open' : ''}`} aria-hidden={!open}>
      <div className="players-head">
        <strong>{t('ui.players.title')}</strong>
        <button className="icon" title={t('ui.common.close')} onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="players-list">
        {players.map((p) => (
          <div className={`player-row${p.isConnected ? '' : ' offline'}`} key={p.id}>
            <span className={`player-chip${p.isConnected ? ' online' : ' offline'}`} data-testid="player-chip">
              {p.name}
              {p.role === 'dm' ? ' (DM)' : ''}
            </span>
            <span className="player-hp" title={t('ui.players.hpTitle')}>
              {hpText(p)}
            </span>
            <span className="player-class" title={t('ui.players.classTitle')}>
              {classText(p.classKey)}
            </span>
            {isDm && p.id !== selfId && (
              <button
                className="icon danger"
                title={t('ui.players.removeTitle')}
                onClick={() => setConfirmId(p.id)}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      {target && (
        <Modal onClose={() => setConfirmId(null)} title={t('ui.players.confirmTitle')}>
          <p className="confirm-text">
            {t('ui.players.confirmPre')} <strong>{target.name}</strong> {t('ui.players.confirmPost')}
          </p>
          <div className="modal-actions spread">
            <button onClick={() => setConfirmId(null)}>{t('ui.common.cancel')}</button>
            <button
              className="danger"
              onClick={() => {
                removePlayer(target.id);
                setConfirmId(null);
              }}
            >
              {t('ui.common.delete')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
