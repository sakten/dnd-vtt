import { useEffect, useState } from 'react';
import type { SpellDef } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { t } from '../i18n';
import { blankRecord } from '../lib/spellConstructor';
import { CheckboxRow } from './Field';
import Modal from './Modal';
import SpellConstructorModal from './SpellConstructorModal';

/** Состояние конструктора: черновик, фиксация ключа и стартовый экран. */
interface EditorState {
  record: SpellDef;
  lockedKey: boolean;
  start: 'wizard' | 'base' | 'form';
}

/** Экспорт записи 1:1: скачивание JSON кастомного заклинания целиком. */
function downloadSpell(def: SpellDef) {
  const blob = new Blob([JSON.stringify(def, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${def.key.replace(/[/\\:*?"<>|]+/g, '_')}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Конфиг комнаты (только реальный DM): режим тестов и кастомные заклинания комнаты. */
export default function RoomSettingsModal() {
  const testMode = useGameStore((s) => s.testMode);
  const customSpecs = useGameStore((s) => s.customSpecs);
  const apply = useGameStore((s) => s.setRoomSettings);
  const importCustom = useGameStore((s) => s.importCustomSpell);
  const removeCustom = useGameStore((s) => s.removeCustomSpell);
  const close = useGameStore((s) => s.setRoomSettingsOpen);
  const [draft, setDraft] = useState(testMode);
  const [customJson, setCustomJson] = useState('');
  const [editor, setEditor] = useState<EditorState | null>(null);

  useEffect(() => {
    setDraft(testMode);
  }, [testMode]);

  return (
    <Modal onClose={() => close(false)} title={t('ui.roomSettings.title')}>
      <CheckboxRow checked={draft} onChange={setDraft}>
        {t('ui.roomSettings.testMode')}
      </CheckboxRow>
      <p className="hint">{t('ui.roomSettings.hint')}</p>

      <section className="room-custom">
        <h4>{t('ui.roomSettings.customTitle')}</h4>
        <p className="hint">{t('ui.roomSettings.customHint')}</p>
        {customSpecs.length === 0 ? (
          <p className="hint">{t('ui.roomSettings.customEmpty')}</p>
        ) : (
          <ul className="room-custom-list">
            {customSpecs.map((spell) => (
              <li key={spell.key}>
                <span className="room-custom-name" title={spell.key}>
                  {spell.name}
                </span>
                <button type="button" onClick={() => setEditor({ record: spell, lockedKey: true, start: 'form' })}>
                  {t('ui.roomSettings.customEdit')}
                </button>
                <button type="button" onClick={() => downloadSpell(spell)}>
                  {t('ui.roomSettings.customExport')}
                </button>
                <button type="button" onClick={() => removeCustom(spell.key)}>
                  {t('ui.roomSettings.customRemove')}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="primary"
          onClick={() =>
            setEditor({
              record: blankRecord('attack', t('ui.constructor.defaultName')),
              lockedKey: false,
              start: 'wizard',
            })
          }
        >
          {t('ui.roomSettings.customCreate')}
        </button>
        <textarea
          className="room-custom-json"
          placeholder={t('ui.roomSettings.customPlaceholder')}
          value={customJson}
          onChange={(e) => setCustomJson(e.target.value)}
        />
        <button type="button" disabled={!customJson.trim()} onClick={() => importCustom(customJson)}>
          {t('ui.roomSettings.customImport')}
        </button>
      </section>

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

      {editor && (
        <SpellConstructorModal
          initial={editor.record}
          lockedKey={editor.lockedKey}
          start={editor.start}
          onClose={() => setEditor(null)}
        />
      )}
    </Modal>
  );
}
