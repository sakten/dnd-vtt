import { DEFAULT_SENSE_RANGES, MAX_SENSES, SENSE_TYPES, type Sense, type SenseType } from 'shared';
import { t } from '../i18n';
import { senseLabel } from '../i18n/domain';
import { Field } from './Field';

interface Props {
  value: Sense[];
  onChange: (senses: Sense[]) => void;
}

/** Редактор восприятия: тип (тёмное/слепое/дьявольское зрение) и дистанция в футах. */
export default function SensesForm({ value, onChange }: Props) {
  const list = value ?? [];
  const used = new Set(list.map((s) => s.type));
  const add = () => {
    const type = SENSE_TYPES.find((t) => !used.has(t));
    if (!type) return;
    onChange([...list, { type, range: DEFAULT_SENSE_RANGES[type] }]);
  };
  const update = (index: number, patch: Partial<Sense>) => {
    onChange(list.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };
  return (
    <>
      {list.map((sense, index) => (
        <div className="field-row" key={sense.type}>
          <Field label={t('ui.common.senses')}>
            <select value={sense.type} onChange={(e) => update(index, { type: e.target.value as SenseType })}>
              {SENSE_TYPES.map((st) => (
                <option key={st} value={st} disabled={st !== sense.type && used.has(st)}>
                  {senseLabel(st)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('ui.senses.range')}>
            <input
              type="number"
              min={5}
              max={1000}
              step={5}
              value={sense.range}
              onChange={(e) => update(index, { range: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
            />
          </Field>
          <button type="button" onClick={() => onChange(list.filter((_, i) => i !== index))}>
            {t('ui.common.remove')}
          </button>
        </div>
      ))}
      {list.length < MAX_SENSES && (
        <button type="button" onClick={add} disabled={used.size >= SENSE_TYPES.length}>
          {t('ui.senses.add')}
        </button>
      )}
    </>
  );
}
