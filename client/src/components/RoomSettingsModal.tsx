import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';

/** Конфиг комнаты (только реальный DM): режим тестов с правами ведущего у всех. */
export default function RoomSettingsModal() {
  const testMode = useGameStore((s) => s.testMode);
  const apply = useGameStore((s) => s.setRoomSettings);
  const close = useGameStore((s) => s.setRoomSettingsOpen);
  const open = useGameStore((s) => s.roomSettingsOpen);
  const [draft, setDraft] = useState(testMode);

  useEffect(() => {
    if (open) setDraft(testMode);
  }, [open, testMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <div className="modal-backdrop" onMouseDown={() => close(false)}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <h3>Настройки комнаты</h3>
        <label className="checkbox-row">
          <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
          Режим тестов
        </label>
        <p className="hint">
          Все участники получают права ведущего внутри комнаты: карты, сетка, туман, бой, чужие токены и их
          статы. Управление комнатами в админке остаётся у ведущего.
        </p>
        <div className="modal-actions">
          <button
            className="primary"
            onClick={() => {
              apply(draft);
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
