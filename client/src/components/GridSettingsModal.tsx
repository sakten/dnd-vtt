import { useEffect, useState } from 'react';
import type { GridSettings } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { CheckboxRow, Field } from './Field';
import Modal from './Modal';

export default function GridSettingsModal() {
  const grid = useGameStore((s) => s.scene.grid);
  const updateGrid = useGameStore((s) => s.updateGrid);
  const close = useGameStore((s) => s.setGridModalOpen);
  const [draft, setDraft] = useState<GridSettings | null>(null);

  useEffect(() => {
    setDraft({ ...grid });
  }, [grid]);

  const value = draft ?? grid;
  const setValue = (patch: Partial<GridSettings>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  };

  return (
    <Modal onClose={() => close(false)} title="Настройки сетки">
      <Field label="Размер клетки, px">
        <input
          type="number"
          min={10}
          max={300}
          value={value.size}
          onChange={(e) => setValue({ size: Number(e.target.value) || 50 })}
        />
      </Field>
      <CheckboxRow checked={value.visible} onChange={(visible) => setValue({ visible })}>
        Показывать сетку
      </CheckboxRow>
      <CheckboxRow checked={value.snap} onChange={(snap) => setValue({ snap })}>
        Привязка токенов к сетке
      </CheckboxRow>
      <Field label="Цвет">
        <input type="color" value={value.color} onChange={(e) => setValue({ color: e.target.value })} />
      </Field>
      <Field label={`Прозрачность: ${Math.round(value.opacity * 100)}%`}>
        <input
          type="range"
          min={0.05}
          max={1}
          step={0.05}
          value={value.opacity}
          onChange={(e) => setValue({ opacity: Number(e.target.value) })}
        />
      </Field>
      <div className="field-row">
        <Field label="Сдвиг X">
          <input type="number" value={value.offsetX} onChange={(e) => setValue({ offsetX: Number(e.target.value) || 0 })} />
        </Field>
        <Field label="Сдвиг Y">
          <input type="number" value={value.offsetY} onChange={(e) => setValue({ offsetY: Number(e.target.value) || 0 })} />
        </Field>
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
    </Modal>
  );
}
