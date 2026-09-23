import { IMMUNITY_CONDITION_KEYS, type ConditionKey } from 'shared';
import { conditionLabel } from '../i18n/domain';
import ConditionIcon from './ConditionIcon';

interface Props {
  value: ConditionKey[];
  onChange: (value: ConditionKey[]) => void;
  readOnly?: boolean;
}

/** Иммунитеты к состояниям (статблок монстра): чекбоксы канонических состояний. */
export default function ConditionImmunitiesForm({ value, onChange, readOnly }: Props) {
  const toggle = (key: ConditionKey, on: boolean) => {
    const next = on ? [...value, key] : value.filter((k) => k !== key);
    onChange(IMMUNITY_CONDITION_KEYS.filter((k) => next.includes(k)));
  };

  return (
    <div className="cond-immunity-grid">
      {IMMUNITY_CONDITION_KEYS.map((key) => (
        <label key={key} className="checkbox-row cond-immunity-item">
          <input
            type="checkbox"
            checked={value.includes(key)}
            disabled={readOnly}
            onChange={(e) => toggle(key, e.target.checked)}
          />
          <ConditionIcon condition={key} className="cond-immunity-icon" />
          <span>{conditionLabel(key)}</span>
        </label>
      ))}
    </div>
  );
}
