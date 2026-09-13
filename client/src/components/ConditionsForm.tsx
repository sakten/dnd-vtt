import { useState } from 'react';
import {
  CONDITION_KEYS,
  conditionDescription,
  conditionName,
  type ConditionInstance,
  type ConditionKey,
} from 'shared';
import ConditionIcon from './ConditionIcon';

interface Props {
  value: ConditionInstance[];
  onChange: (value: ConditionInstance[]) => void;
}

/** Управление состояниями токена: список, длительность, пикер добавления. */
export default function ConditionsForm({ value, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [customName, setCustomName] = useState('');

  const update = (index: number, patch: Partial<ConditionInstance>) =>
    onChange(value.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));

  const add = (key: ConditionKey, name?: string) => {
    const condition: ConditionInstance = {
      key,
      name: name?.trim() || conditionName(key),
      rounds: null,
    };
    if (key === 'exhaustion') condition.level = 1;
    onChange([...value, condition]);
    setPickerOpen(false);
    setQuery('');
    setCustomName('');
  };

  const options = CONDITION_KEYS.filter((k) => k !== 'custom').filter((k) =>
    conditionName(k).toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div className="conditions-form">
      <div className="sheet-section-title">Состояния ({value.length})</div>

      {value.map((c, i) => (
        <div className="condition-row" key={`${c.key}-${i}`}>
          <span className={`condition-name cond-${c.key}`} title={conditionDescription(c.key)}>
            <ConditionIcon condition={c.key} className="condition-glyph" />
            <span className="condition-label">{c.name}</span>
          </span>
          {c.key === 'exhaustion' ? (
            <select
              className="condition-level"
              value={c.level ?? 1}
              onChange={(e) => update(i, { level: Number(e.target.value) })}
              title="Уровень истощения"
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="number"
              min={0}
              className="condition-rounds"
              placeholder="∞"
              title="Осталось раундов (пусто — до снятия)"
              value={c.rounds ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                update(i, { rounds: v.trim() === '' ? null : Math.max(0, Math.round(Number(v) || 0)) });
              }}
            />
          )}
          <button type="button" className="condition-remove" onClick={() => remove(i)} title="Снять">
            ✕
          </button>
        </div>
      ))}

      {!pickerOpen ? (
        <button type="button" className="condition-add-btn" onClick={() => setPickerOpen(true)}>
          + Добавить состояние
        </button>
      ) : (
        <div className="condition-picker">
          <div className="condition-picker-head">
            <input
              type="text"
              placeholder="Поиск состояния…"
              value={query}
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="button" className="condition-picker-close" onClick={() => setPickerOpen(false)}>
              ✕
            </button>
          </div>
          <div className="condition-picker-grid">
            {options.map((k) => (
              <button
                type="button"
                key={k}
                className={`condition-picker-item cond-${k}`}
                title={conditionDescription(k)}
                onClick={() => add(k)}
              >
                <ConditionIcon condition={k} className="condition-glyph" />
                <span>{conditionName(k)}</span>
              </button>
            ))}
            {options.length === 0 && <span className="condition-picker-empty">Ничего не найдено</span>}
          </div>
          <div className="condition-picker-custom">
            <input
              type="text"
              placeholder="Своё состояние"
              maxLength={40}
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
            <button type="button" disabled={!customName.trim()} onClick={() => add('custom', customName)}>
              Добавить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
