import { DAMAGE_TYPES, MAX_ATTACKS, emptyAttack, type AttackEntry } from 'shared';
import { Field } from './Field';

interface Props {
  attacks: AttackEntry[];
  onChange: (attacks: AttackEntry[]) => void;
  title?: string;
  itemLabel?: string;
  namePlaceholder?: string;
}

/** Редактор атак/оружия (общий для токена и карточки персонажа). */
export default function AttacksForm({
  attacks,
  onChange,
  title = 'Атаки',
  itemLabel = 'Атака',
  namePlaceholder = 'Например: Укус',
}: Props) {
  const setAttack = (index: number, patch: Partial<AttackEntry>) =>
    onChange(attacks.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  const addAttack = () => {
    if (attacks.length < MAX_ATTACKS) onChange([...attacks, emptyAttack()]);
  };
  const removeAttack = (index: number) => {
    if (attacks.length > 1) onChange(attacks.filter((_, i) => i !== index));
  };

  return (
    <div className="attacks-form">
      <div className="sheet-section-title">
        {title} ({attacks.length}/{MAX_ATTACKS})
      </div>
      {attacks.map((attack, i) => (
        <div className="weapon-block" key={i}>
          <div className="weapon-head">
            <span>{itemLabel} {i + 1}</span>
            {attacks.length > 1 && (
              <button type="button" className="weapon-remove" onClick={() => removeAttack(i)}>
                Удалить
              </button>
            )}
          </div>
          <Field label="Название">
            <input
              type="text"
              value={attack.name}
              maxLength={40}
              placeholder={namePlaceholder}
              onChange={(e) => setAttack(i, { name: e.target.value })}
            />
          </Field>
          <div className="field-row">
            <Field label="Формула попадания">
              <input
                type="text"
                value={attack.hit}
                placeholder="d20+5"
                onChange={(e) => setAttack(i, { hit: e.target.value })}
              />
            </Field>
            <Field label="Формула урона">
              <input
                type="text"
                value={attack.damage}
                placeholder="d6+3"
                onChange={(e) => setAttack(i, { damage: e.target.value })}
              />
            </Field>
            <Field label="Тип урона">
              <select
                value={attack.damageType ?? ''}
                onChange={(e) => setAttack(i, { damageType: e.target.value || undefined })}
              >
                <option value="">—</option>
                {DAMAGE_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="field-row">
            <Field label="Дистанция">
              <select
                value={attack.rangeType}
                onChange={(e) => setAttack(i, { rangeType: e.target.value as AttackEntry['rangeType'] })}
              >
                <option value="melee">Ближняя</option>
                <option value="ranged">Дальняя</option>
                <option value="none">Без дальности</option>
              </select>
            </Field>
            {attack.rangeType === 'melee' && (
              <Field label="Досягаемость, фт">
                <input
                  type="number"
                  min={0}
                  value={attack.rangeNormal}
                  onChange={(e) => setAttack(i, { rangeNormal: Number(e.target.value) })}
                />
              </Field>
            )}
            {attack.rangeType === 'ranged' && (
              <>
                <Field label="Обычная, фт">
                  <input
                    type="number"
                    min={0}
                    value={attack.rangeNormal}
                    onChange={(e) => setAttack(i, { rangeNormal: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Дальняя, фт">
                  <input
                    type="number"
                    min={0}
                    value={attack.rangeLong}
                    onChange={(e) => setAttack(i, { rangeLong: Number(e.target.value) })}
                  />
                </Field>
              </>
            )}
          </div>
        </div>
      ))}
      <button type="button" className="weapon-add" onClick={addAttack} disabled={attacks.length >= MAX_ATTACKS}>
        + Добавить атаку
      </button>
    </div>
  );
}
