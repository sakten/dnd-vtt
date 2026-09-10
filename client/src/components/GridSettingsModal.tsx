import { useEffect, useState } from 'react';
import type { GridSettings } from 'shared';
import { useGameStore } from '../store/useGameStore';

export default function GridSettingsModal() {
  const grid = useGameStore((s) => s.scene.grid);
  const updateGrid = useGameStore((s) => s.updateGrid);
  const close = useGameStore((s) => s.setGridModalOpen);
  const open = useGameStore((s) => s.gridModalOpen);

  const [draft, setDraft] = useState<GridSettings | null>(null);

  useEffect(() => {
    if (open) setDraft({ ...grid });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- сбрасываем черновик только при открытии
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const value = draft ?? grid;
  const setValue = (patch: Partial<GridSettings>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  };

  return (
    <div className="modal-backdrop" onMouseDown={() => close(false)}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <h3>Настройки сетки</h3>
        <label className="field">
          <span>Размер клетки, px</span>
          <input
            type="number"
            min={10}
            max={300}
            value={value.size}
            onChange={(e) => setValue({ size: Number(e.target.value) || 50 })}
          />
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={value.visible}
            onChange={(e) => setValue({ visible: e.target.checked })}
          />
          Показывать сетку
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={value.snap}
            onChange={(e) => setValue({ snap: e.target.checked })}
          />
          Привязка токенов к сетке
        </label>
        <label className="field">
          <span>Цвет</span>
          <input type="color" value={value.color} onChange={(e) => setValue({ color: e.target.value })} />
        </label>
        <label className="field">
          <span>Прозрачность: {Math.round(value.opacity * 100)}%</span>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={value.opacity}
            onChange={(e) => setValue({ opacity: Number(e.target.value) })}
          />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Сдвиг X</span>
            <input
              type="number"
              value={value.offsetX}
              onChange={(e) => setValue({ offsetX: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="field">
            <span>Сдвиг Y</span>
            <input
              type="number"
              value={value.offsetY}
              onChange={(e) => setValue({ offsetY: Number(e.target.value) || 0 })}
            />
          </label>
        </div>
        <div className="modal-actions">
          <button
            className="primary"
            onClick={() => {
              if (draft) updateGrid(draft);
              close(false);
            }}
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
