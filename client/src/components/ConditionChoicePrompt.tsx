import { useGameStore } from '../store/useGameStore';
import { t } from '../i18n';
import { conditionLabel } from '../i18n/domain';
import ConditionIcon from './ConditionIcon';

/** Выбор состояния для снятия (Lesser/Greater Restoration): показывается после клика по цели. */
export default function ConditionChoicePrompt() {
  const interaction = useGameStore((s) => s.interaction);
  const choose = useGameStore((s) => s.chooseCondition);
  const cancel = useGameStore((s) => s.cancelCondition);
  const choice = interaction?.mode === 'condition' ? interaction.condition : null;
  if (!choice) return null;

  return (
    <>
      <div className="reaction-backdrop" />
      <div className="reaction-prompt condition-choice" role="dialog" aria-label={t('ui.conditionChoice.title')}>
        <div className="rp-head">
          <span className="rp-title">{t('ui.conditionChoice.title')}</span>
          <span className="rp-token">{choice.label}</span>
        </div>
        <div className="rp-options">
          {choice.options.map((key) => (
            <button key={key} className="rp-option" onClick={() => choose(key)}>
              <ConditionIcon condition={key} className="rp-icon" />
              <span className="rp-name">{conditionLabel(key)}</span>
            </button>
          ))}
          <button className="rp-option rp-ignore" onClick={cancel}>
            <span className="rp-name">{t('ui.common.cancel')}</span>
          </button>
        </div>
      </div>
    </>
  );
}
