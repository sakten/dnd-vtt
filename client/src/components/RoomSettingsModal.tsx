import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { CheckboxRow } from './Field';
import Modal from './Modal';

/** Конфиг комнаты (только реальный DM): режим тестов с правами ведущего у всех. */
export default function RoomSettingsModal() {
  const testMode = useGameStore((s) => s.testMode);
  const apply = useGameStore((s) => s.setRoomSettings);
  const close = useGameStore((s) => s.setRoomSettingsOpen);
  const [draft, setDraft] = useState(testMode);

  useEffect(() => {
    setDraft(testMode);
  }, [testMode]);

  return (
    <Modal onClose={() => close(false)} title="Настройки комнаты">
      <CheckboxRow checked={draft} onChange={setDraft}>
        Режим тестов
      </CheckboxRow>
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
    </Modal>
  );
}
