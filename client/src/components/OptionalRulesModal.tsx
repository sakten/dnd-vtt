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
