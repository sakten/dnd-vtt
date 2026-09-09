import { useState } from 'react';
import { useGameStore } from '../store/useGameStore';

export default function JoinScreen({ connected }: { connected: boolean }) {
  const [name, setName] = useState(() => localStorage.getItem('vtt-name') ?? '');
  const [code, setCode] = useState(
    () => new URLSearchParams(window.location.search).get('room')?.toUpperCase() ?? ''
  );
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem('vtt-admin') ?? '');
  const joinError = useGameStore((s) => s.joinError);
  const createRoom = useGameStore((s) => s.createRoom);
  const joinRoom = useGameStore((s) => s.joinRoom);

  const saveName = (value: string) => {
    setName(value);
    localStorage.setItem('vtt-name', value);
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    saveName(name.trim());
    createRoom(name.trim(), adminToken.trim() || undefined);
  };

  const handleJoin = () => {
    if (!name.trim() || !code.trim()) return;
    saveName(name.trim());
    joinRoom(code.trim(), name.trim());
  };

  return (
    <div className="join-screen">
      <div className="join-card">
        <h1>D&amp;D VTT</h1>
        <p className="join-subtitle">Виртуальный стол для игры с друзьями</p>
        <label className="field">
          <span>Ваше имя</span>
          <input
            value={name}
            onChange={(e) => saveName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Например: Виктор"
            maxLength={30}
          />
        </label>
        <div className="join-actions">
          <button className="primary" onClick={handleCreate} disabled={!connected}>
            Создать комнату (я — ведущий)
          </button>
        </div>
        <label className="field">
          <span>Пароль ведущего (если настроен на сервере)</span>
          <input
            type="password"
            value={adminToken}
            onChange={(e) => setAdminToken(e.target.value)}
            placeholder="Пароль ведущего"
          />
        </label>
        <div className="join-divider">
          <span>или</span>
        </div>
        <label className="field">
          <span>Код комнаты</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="Например: XK42"
            maxLength={6}
          />
        </label>
        <div className="join-actions">
          <button className="primary" onClick={handleJoin} disabled={!connected}>
            Войти в комнату
          </button>
        </div>
        {joinError && <div className="join-error">{joinError}</div>}
        {!connected && <div className="join-error">Нет соединения с сервером…</div>}
        <a className="join-admin-link" href="?admin=1">
          Управление комнатами (для ведущего)
        </a>
      </div>
    </div>
  );
}
