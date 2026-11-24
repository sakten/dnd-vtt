import { useEffect, useState } from 'react';
import type { OptionalRules } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { t } from '../i18n';
import { CheckboxRow } from './Field';
import Modal from './Modal';

/** Опциональные правила комнаты (только реальный DM). */
export default function OptionalRulesModal() {
  const rules = useGameStore((s) => s.optionalRules);
  const apply = useGameStore((s) => s.setOptionalRules);
  const close = useGameStore((s) => s.setOptionalRulesOpen);
  const [draft, setDraft] = useState<OptionalRules>(rules);

  useEffect(() => {
    setDraft(rules);
  }, [rules]);

  return (
    <Modal onClose={() => close(false)} title={t('ui.rules.title')}>
      <CheckboxRow checked={draft.surrounded} onChange={(surrounded) => setDraft({ ...draft, surrounded })}>
        {t('ui.rules.surrounded')}
      </CheckboxRow>
      <p className="hint">{t('ui.rules.surroundedHint')}</p>
      <label className="field">
        <span>{t('ui.rules.fogSight')}</span>
        <input
          type="number"
          min={0}
          max={10}
          value={draft.fogSight}
          onChange={(e) =>
            setDraft({ ...draft, fogSight: Math.max(0, Math.min(10, Math.round(Number(e.target.value) || 0))) })
          }
        />
      </label>
      <p className="hint">{t('ui.rules.fogSightHint')}</p>
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
