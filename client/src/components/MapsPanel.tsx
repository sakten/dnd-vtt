import { useRef, useState } from 'react';
import type { GridSettings } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { t } from '../i18n';
import { useIsDm } from '../lib/control';
import { readImageSize, uploadImage } from '../lib/api';
import { detectGridFromUrl } from '../lib/gridDetectImage';
import { GRID_AUTO_CONFIDENCE } from '../lib/gridDetect';

export default function MapsPanel() {
  const maps = useGameStore((s) => s.scene.maps);
  const activeMapId = useGameStore((s) => s.viewMapId);
  const addMap = useGameStore((s) => s.addMap);
  const sceneGrid = useGameStore((s) => s.scene.grid);
  const removeMap = useGameStore((s) => s.removeMap);
  const renameMap = useGameStore((s) => s.renameMap);
  const switchMap = useGameStore((s) => s.switchMap);
  const bringMap = useGameStore((s) => s.bringMap);
  const fileRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const editingRef = useRef<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const isDm = useIsDm();

  const round1 = (v: number) => Math.round(v * 10) / 10;

  // Автовыравнивание сетки по изображению новой карты (если сетка на ней есть и уверенность высокая).
  // Возвращает сетку для новой карты; текущие карты не трогаем.
  const autoAlign = async (url: string): Promise<GridSettings | null> => {
    try {
      const found = await detectGridFromUrl(url);
      if (found && found.confidence >= GRID_AUTO_CONFIDENCE) {
        return {
          ...sceneGrid,
          size: round1(found.size),
          offsetX: round1(found.offsetX),
          offsetY: round1(found.offsetY),
        };
      }
    } catch {
      // изображение недоступно для анализа (CORS и т.п.) — оставляем сетку как есть
    }
    return null;
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const url = await uploadImage(file);
      const size = await readImageSize(url);
      // Сетку выравниваем до добавления карты и передаём её новой карте.
      const grid = await autoAlign(url);
      addMap(file.name.replace(/\.[^.]+$/, ''), url, size.width, size.height, grid ?? undefined);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t('ui.maps.uploadError'));
    }
  };

  const startRename = (id: string) => {
    setEditingId(id);
    editingRef.current = id;
  };

  const finishRename = (save: boolean) => {
    const id = editingRef.current;
    const value = editInputRef.current?.value.trim() ?? '';
    editingRef.current = null;
    setEditingId(null);
    if (save && id && value) renameMap(id, value);
  };

  return (
    <div className="maps-panel">
      <div className="maps-panel-header">
        <span>{t('ui.maps.title')}</span>
        {isDm && (
          <button className="icon maps-add" title={t('ui.maps.add')} onClick={() => fileRef.current?.click()}>
            +
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={handleFile} />
      </div>
      <div className="maps-panel-list">
        {maps.length === 0 && <div className="hint">{t('ui.maps.empty')}</div>}
        {maps.map((m) => (
          <div
            key={m.id}
            className={`map-item ${m.id === activeMapId ? 'active' : ''}`}
            data-testid="map-item"
            title={t('ui.maps.switchTitle')}
            onClick={() => switchMap(m.id)}
          >
            <img src={m.url} alt={m.name} draggable={false} />
            {editingId === m.id ? (
              <input
                className="map-name-input"
                ref={editInputRef}
                defaultValue={m.name}
                autoFocus
                maxLength={60}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    finishRename(true);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    finishRename(false);
                  }
                }}
                onBlur={() => finishRename(true)}
              />
            ) : (
              <span
                className="map-name"
                title={isDm ? t('ui.maps.renameTitle') : undefined}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (isDm) startRename(m.id);
                }}
              >
                {m.name}
              </span>
            )}
            {isDm && (
              <button
                className="map-bring"
                data-testid="map-bring"
                title={t('ui.maps.bringTitle')}
                onClick={(e) => {
                  e.stopPropagation();
                  bringMap(m.id);
                }}
              >
                {t('ui.maps.bringAll')}
              </button>
            )}
            {isDm && (
              <button
                className="map-remove"
                title={t('ui.maps.removeTitle')}
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
