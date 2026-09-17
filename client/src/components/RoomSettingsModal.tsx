import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { t } from '../i18n';
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
    <Modal onClose={() => close(false)} title={t('ui.roomSettings.title')}>
      <CheckboxRow checked={draft} onChange={setDraft}>
        {t('ui.roomSettings.testMode')}
      </CheckboxRow>
      <p className="hint">{t('ui.roomSettings.hint')}</p>
      <div className="modal-actions">
        <button
          className="primary"
          onClick={() => {
            apply(draft);
            close(false);
          }}
        >
          {t('ui.common.done')}
        </button>
      </div>
    </Modal>
  );
}
