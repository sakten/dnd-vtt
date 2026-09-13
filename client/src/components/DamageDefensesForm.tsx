import { DAMAGE_TYPES, DEFENSE_TYPE_NAMES, MAX_DEFENSES, type DamageDefense, type DamageDefenseType } from 'shared';
import { newId } from '../lib/id';

interface Props {
  value: DamageDefense[];
  onChange: (value: DamageDefense[]) => void;
}

const TYPES: DamageDefenseType[] = ['resistance', 'immunity', 'vulnerability'];

/** Список защит юнита: тип защиты + тип урона. */
export default function DamageDefensesForm({ value, onChange }: Props) {
  const update = (index: number, patch: Partial<DamageDefense>) =>
    onChange(value.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  const add = () =>
    onChange([...value, { id: newId(), type: 'resistance', damageType: 'slashing' }]);
  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));

  return (
    <div className="defenses">
      <div className="sheet-section-title">Защиты от урона ({value.length}/{MAX_DEFENSES})</div>
      {value.map((d, i) => (
        <div className="defense-row" key={d.id}>
          <select
            value={d.type}
            onChange={(e) => update(i, { type: e.target.value as DamageDefenseType })}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {DEFENSE_TYPE_NAMES[t]}
              </option>
            ))}
          </select>
          <select value={d.damageType} onChange={(e) => update(i, { damageType: e.target.value })}>
            {DAMAGE_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}
              </option>
            ))}
          </select>
          <button type="button" className="defense-remove" onClick={() => remove(i)}>
            Удалить
          </button>
        </div>
      ))}
      <button type="button" className="defense-add" onClick={add} disabled={value.length >= MAX_DEFENSES}>
        + Добавить защиту
      </button>
    </div>
  );
}
