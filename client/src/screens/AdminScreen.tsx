import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { newId } from '../lib/id';
import { t } from '../i18n';
import { errorText } from '../i18n/errors';
import Modal from '../components/Modal';

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
    const id = localStorage.getItem('vtt-player') ?? newId();
    localStorage.setItem('vtt-player', id);
    return id;
  };

  const refresh = () => {
    if (!socket) return;
    socket.emit('admin:list', { adminToken: adminToken.trim() }, (res) => {
      if ('error' in res) setError(errorText(res.error));
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
        if ('error' in res) setError(errorText(res.error));
      }
    );
  };

  const join = (code: string) => {
    if (!socket || !name.trim()) return;
    localStorage.setItem('vtt-name', name.trim());
    socket.emit('admin:join', { adminToken: adminToken.trim(), code, clientId: getPlayerId(), name: name.trim() }, (res) => {
      if ('error' in res) setError(errorText(res.error));
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
        setError(errorText(res.error));
        refresh();
      }
    });
  };

  const confirmDelete = () => {
    if (!socket || !deleteTarget) return;
    socket.emit('admin:delete', { adminToken: adminToken.trim(), code: deleteTarget }, (res) => {
      if ('error' in res) setError(errorText(res.error));
      else refresh();
      setDeleteTarget(null);
    });
  };

  return (
    <div className="join-screen">
      <div className="join-card admin-card" data-testid="admin-card">
        <h1>{t('ui.admin.title')}</h1>
        <label className="field">
          <span>{t('ui.admin.name')}</span>
          <input type="text" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>{t('ui.admin.roomName')}</span>
          <input
            type="text"
            value={newRoomName}
            maxLength={60}
            placeholder={t('ui.admin.roomNamePlaceholder')}
            onChange={(e) => setNewRoomName(e.target.value)}
          />
        </label>
        <label className="field">
          <span>{t('ui.admin.token')}</span>
          <input
            type="password"
            value={adminToken}
            onChange={(e) => {
              setAdminToken(e.target.value);
              localStorage.setItem('vtt-admin', e.target.value);
            }}
          />
        </label>
        <div className="join-actions" data-testid="join-actions">
          <button className="primary" onClick={create} disabled={!connected}>
            {t('ui.admin.create')}
          </button>
          <button onClick={refresh} disabled={!connected}>
            {t('ui.admin.refresh')}
          </button>
        </div>
        {error && <div className="join-error">{error}</div>}
        <div className="admin-rooms">
          {rooms.length === 0 && <div className="hint">{t('ui.admin.empty')}</div>}
          {rooms.map((r) => (
            <div className="admin-room" key={r.code} data-testid="admin-room">
              <span className="admin-room-code" title={r.code} data-testid="admin-room-code">
                {r.code}
              </span>
              {editingCode === r.code ? (
                <input
                  className="admin-room-name-input"
                  data-testid="admin-room-name-input"
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
                  data-testid="admin-room-name"
                  title={t('ui.admin.renameTitle')}
                  onDoubleClick={() => startRename(r)}
                >
                  {r.name}
                </span>
              )}
              <span className="admin-room-info">
                {t('ui.admin.playersMaps', { players: r.players, maps: r.maps })}
              </span>
              <button onClick={() => join(r.code)}>{t('ui.admin.join')}</button>
              <button className="danger" title={t('ui.admin.deleteRoom')} onClick={() => remove(r.code)}>
                ✕
              </button>
            </div>
          ))}
        </div>
        <a className="join-admin-link" href="./">
          {t('ui.admin.back')}
        </a>
        {deleteTarget && (
          <Modal onClose={() => setDeleteTarget(null)} title={t('ui.admin.confirmTitle')}>
            <p className="confirm-text">
              {t('ui.admin.confirmPre')}{' '}
              <strong>{rooms.find((r) => r.code === deleteTarget)?.name || deleteTarget}</strong> ({deleteTarget}){' '}
              {t('ui.admin.confirmPost')}
            </p>
            <div className="modal-actions spread">
              <button onClick={() => setDeleteTarget(null)}>{t('ui.admin.cancel')}</button>
              <button className="danger" onClick={confirmDelete}>
                {t('ui.admin.delete')}
              </button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}
