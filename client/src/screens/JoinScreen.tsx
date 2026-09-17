import { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { t } from '../i18n';

export default function JoinScreen({ connected }: { connected: boolean }) {
  const [name, setName] = useState(() => localStorage.getItem('vtt-name') ?? '');
  const [code, setCode] = useState(
    () => new URLSearchParams(window.location.search).get('room')?.toUpperCase() ?? ''
  );
  const joinError = useGameStore((s) => s.joinError);
  const connectError = useGameStore((s) => s.connectError);
  const joinRoom = useGameStore((s) => s.joinRoom);

  const saveName = (value: string) => {
    setName(value);
    localStorage.setItem('vtt-name', value);
  };

  const handleJoin = () => {
    if (!name.trim() || !code.trim()) return;
    saveName(name.trim());
    joinRoom(code.trim(), name.trim());
  };

  return (
    <div className="join-screen">
      <div className="join-card" data-testid="join-card">
        <h1>D&amp;D VTT</h1>
        <p className="join-subtitle">{t('ui.join.subtitle')}</p>
        <label className="field">
          <span>{t('ui.join.name')}</span>
          <input
            value={name}
            onChange={(e) => saveName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder={t('ui.join.namePlaceholder')}
            maxLength={30}
          />
        </label>
        <label className="field">
          <span>{t('ui.join.code')}</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder={t('ui.join.codePlaceholder')}
            maxLength={6}
          />
        </label>
        <div className="join-actions" data-testid="join-actions">
          <button className="primary" onClick={handleJoin} disabled={!connected}>
            {t('ui.join.enter')}
          </button>
        </div>
        {joinError && <div className="join-error">{joinError}</div>}
        {!connected && (
          <div className={connectError ? 'join-error' : 'join-status'}>
            {connectError ? t('ui.join.noConnection') : t('ui.join.connecting')}
          </div>
        )}
        <a className="join-admin-link" href="?admin=1">
          {t('ui.join.adminLink')}
        </a>
      </div>
    </div>
  );
}
