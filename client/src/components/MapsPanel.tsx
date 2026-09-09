import { useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { readImageSize, uploadImage } from '../lib/api';

export default function MapsPanel() {
  const maps = useGameStore((s) => s.scene.maps);
  const activeMapId = useGameStore((s) => s.viewMapId);
  const role = useGameStore((s) => s.role);
  const addMap = useGameStore((s) => s.addMap);
  const removeMap = useGameStore((s) => s.removeMap);
  const renameMap = useGameStore((s) => s.renameMap);
  const switchMap = useGameStore((s) => s.switchMap);
  const bringMap = useGameStore((s) => s.bringMap);
  const fileRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const isDm = role === 'dm';

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const url = await uploadImage(file);
      const size = await readImageSize(url);
      addMap(file.name.replace(/\.[^.]+$/, ''), url, size.width, size.height);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Не удалось загрузить карту');
    }
  };

  const commitRename = () => {
    if (editingId && editValue.trim()) renameMap(editingId, editValue.trim());
    setEditingId(null);
  };

  return (
    <div className="maps-panel">
      <div className="maps-panel-header">
        <span>Карты</span>
        {isDm && (
          <button className="icon maps-add" title="Добавить карту" onClick={() => fileRef.current?.click()}>
            +
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
      </div>
      <div className="maps-panel-list">
        {maps.length === 0 && <div className="hint">Добавьте карту</div>}
        {maps.map((m) => (
          <div
            key={m.id}
            className={`map-item ${m.id === activeMapId ? 'active' : ''}`}
            title="Переключиться на эту карту (только у вас)"
            onClick={() => switchMap(m.id)}
          >
            <img src={m.url} alt={m.name} draggable={false} />
            {editingId === m.id ? (
              <input
                className="map-name-input"
                value={editValue}
                autoFocus
                maxLength={60}
                onChange={(e) => setEditValue(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setEditingId(null);
                }}
                onBlur={commitRename}
              />
            ) : (
              <span
                className="map-name"
                title={isDm ? 'Двойной клик — переименовать' : undefined}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (isDm) {
                    setEditingId(m.id);
                    setEditValue(m.name);
                  }
                }}
              >
                {m.name}
              </span>
            )}
            {isDm && (
              <button
                className="map-bring"
                title="Перенести всех игроков на эту карту"
                onClick={(e) => {
                  e.stopPropagation();
                  bringMap(m.id);
                }}
              >
                Все
              </button>
            )}
            {isDm && (
              <button
                className="map-remove"
                title="Удалить карту"
                onClick={(e) => {
                  e.stopPropagation();
                  removeMap(m.id);
                }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
