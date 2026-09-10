import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore';

interface RoomInfo {
  code: string;
  name: string;
  players: number;
  maps: number;
}

export default function AdminScreen() {
  const socket = useGameStore((s) => s.socket);
  const connected = useGameStore((s) => s.connected);
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem('vtt-admin') ?? '');
  const [name, setName] = useState(() => localStorage.getItem('vtt-name') ?? '');
  const [newRoomName, setNewRoomName] = useState('');
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const editingRef = useRef<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- обновляем список при появлении сокета
  }, [socket]);

  const create = () => {
    if (!socket || !name.trim()) return;
    localStorage.setItem('vtt-name', name.trim());
    socket.emit(
      'admin:create',
      { adminToken: adminToken.trim(), name: name.trim(), clientId: getPlayerId(), roomName: newRoomName.trim() || undefined },
      (res) => {
        if ('error' in res) setError(res.error);
      }
    );
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

  const startRename = (room: RoomInfo) => {
    setEditingCode(room.code);
    editingRef.current = room.code;
    setError(null);
  };

  const cancelRename = () => {
    setEditingCode(null);
    editingRef.current = null;
  };

  const saveRename = () => {
    const code = editingRef.current;
    if (!socket || !code) return;
    const trimmed = (editInputRef.current?.value ?? '').trim();
    const current = rooms.find((r) => r.code === code);
    cancelRename();
    if (!trimmed || trimmed === current?.name) return;
    setRooms((rs) => rs.map((r) => (r.code === code ? { ...r, name: trimmed } : r)));
    socket.emit('admin:rename', { adminToken: adminToken.trim(), code, name: trimmed }, (res) => {
      if ('error' in res) {
        setError(res.error);
        refresh();
      }
    });
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
          <span>Название новой комнаты (необязательно)</span>
          <input
            type="text"
            value={newRoomName}
            maxLength={60}
            placeholder="Например: Кампания по Страду"
            onChange={(e) => setNewRoomName(e.target.value)}
          />
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
              {editingCode === r.code ? (
                <input
                  className="admin-room-name-input"
                  ref={editInputRef}
                  defaultValue={r.name}
                  maxLength={60}
                  autoFocus
                  onFocus={(e) => e.currentTarget.select()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      saveRename();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      cancelRename();
                    }
                  }}
                  onBlur={saveRename}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="admin-room-name"
                  title="Двойной клик — переименовать"
                  onDoubleClick={() => startRename(r)}
                >
                  {r.name}
                </span>
              )}
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
                Комната <strong>{rooms.find((r) => r.code === deleteTarget)?.name || deleteTarget}</strong> (
                {deleteTarget}) будет удалена безвозвратно, а игроки внутри — отключены.
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
