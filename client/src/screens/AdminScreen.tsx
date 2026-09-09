import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';

interface RoomInfo {
  code: string;
  players: number;
  maps: number;
}

export default function AdminScreen() {
  const socket = useGameStore((s) => s.socket);
  const connected = useGameStore((s) => s.connected);
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem('vtt-admin') ?? '');
  const [name, setName] = useState(() => localStorage.getItem('vtt-name') ?? '');
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const getPlayerId = () => {
    const id = localStorage.getItem('vtt-player') ?? crypto.randomUUID();
    localStorage.setItem('vtt-player', id);
    return id;
  };

  const refresh = () => {
    if (!socket) return;
    socket.emit('admin:list', { adminToken: adminToken.trim() }, (res) => {
      if ('error' in res) setError(res.error);
      else {
        setRooms(res.rooms);
        setError(null);
      }
    });
  };

  useEffect(() => {
    refresh();
  }, [socket]);

  const create = () => {
    if (!socket || !name.trim()) return;
    localStorage.setItem('vtt-name', name.trim());
    socket.emit('admin:create', { adminToken: adminToken.trim(), name: name.trim(), clientId: getPlayerId() }, (res) => {
      if ('error' in res) setError(res.error);
    });
  };

  const join = (code: string) => {
    if (!socket || !name.trim()) return;
    localStorage.setItem('vtt-name', name.trim());
    socket.emit('admin:join', { adminToken: adminToken.trim(), code, clientId: getPlayerId(), name: name.trim() }, (res) => {
      if ('error' in res) setError(res.error);
    });
  };

  const remove = (code: string) => {
    setDeleteTarget(code);
  };

  const confirmDelete = () => {
    if (!socket || !deleteTarget) return;
    socket.emit('admin:delete', { adminToken: adminToken.trim(), code: deleteTarget }, (res) => {
      if ('error' in res) setError(res.error);
      else refresh();
      setDeleteTarget(null);
    });
  };

  return (
    <div className="join-screen">
      <div className="join-card admin-card">
        <h1>Комнаты ведущего</h1>
        <label className="field">
          <span>Ваше имя (ведущий)</span>
          <input type="text" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Пароль ведущего (если настроен на сервере)</span>
          <input
            type="password"
            value={adminToken}
            onChange={(e) => {
              setAdminToken(e.target.value);
              localStorage.setItem('vtt-admin', e.target.value);
            }}
          />
        </label>
        <div className="join-actions">
          <button className="primary" onClick={create} disabled={!connected}>
            Создать новую игру
          </button>
          <button onClick={refresh} disabled={!connected}>
            Обновить список
          </button>
        </div>
        {error && <div className="join-error">{error}</div>}
        <div className="admin-rooms">
          {rooms.length === 0 && <div className="hint">Комнат пока нет</div>}
          {rooms.map((r) => (
            <div className="admin-room" key={r.code}>
              <span className="admin-room-code" title={r.code}>
                {r.code}
              </span>
              <span className="admin-room-info">
                {r.players} игрок(ов) · {r.maps} карт
              </span>
              <button onClick={() => join(r.code)}>Войти</button>
              <button className="danger" title="Удалить комнату" onClick={() => remove(r.code)}>
                ✕
              </button>
            </div>
          ))}
        </div>
        <a className="join-admin-link" href="./">
          ← На экран входа
        </a>
        {deleteTarget && (
          <div className="modal-backdrop" onMouseDown={() => setDeleteTarget(null)}>
            <div className="modal" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
              <h3>Удалить комнату?</h3>
              <p className="confirm-text">
                Комната <strong>{deleteTarget}</strong> будет удалена безвозвратно, а игроки внутри — отключены.
              </p>
              <div className="modal-actions spread">
                <button onClick={() => setDeleteTarget(null)}>Отмена</button>
                <button className="danger" onClick={confirmDelete}>
                  Удалить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
