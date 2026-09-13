import { DAMAGE_TYPES, MAX_ATTACKS, emptyAttack, type AttackEntry } from 'shared';

interface Props {
  attacks: AttackEntry[];
  onChange: (attacks: AttackEntry[]) => void;
  title?: string;
}

/** Редактор атак/оружия (общий для токена и карточки персонажа). */
export default function AttacksForm({ attacks, onChange, title = 'Атаки' }: Props) {
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
            <span>Атака {i + 1}</span>
            {attacks.length > 1 && (
              <button type="button" className="weapon-remove" onClick={() => removeAttack(i)}>
                Удалить
              </button>
            )}
          </div>
          <label className="field">
            <span>Название</span>
            <input
              type="text"
              value={attack.name}
              maxLength={40}
              placeholder="Например: Укус"
              onChange={(e) => setAttack(i, { name: e.target.value })}
            />
          </label>
          <div className="field-row">
            <label className="field">
              <span>Формула попадания</span>
              <input
                type="text"
                value={attack.hit}
                placeholder="d20+5"
                onChange={(e) => setAttack(i, { hit: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Формула урона</span>
              <input
                type="text"
                value={attack.damage}
                placeholder="d6+3"
                onChange={(e) => setAttack(i, { damage: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Тип урона</span>
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
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Дистанция</span>
              <select
                value={attack.rangeType}
                onChange={(e) => setAttack(i, { rangeType: e.target.value as AttackEntry['rangeType'] })}
              >
                <option value="melee">Ближняя</option>
                <option value="ranged">Дальняя</option>
                <option value="none">Без дальности</option>
              </select>
            </label>
            {attack.rangeType === 'melee' && (
              <label className="field">
                <span>Досягаемость, фт</span>
                <input
                  type="number"
                  min={0}
                  value={attack.rangeNormal}
                  onChange={(e) => setAttack(i, { rangeNormal: Number(e.target.value) })}
                />
              </label>
            )}
            {attack.rangeType === 'ranged' && (
              <>
                <label className="field">
                  <span>Обычная, фт</span>
                  <input
                    type="number"
                    min={0}
                    value={attack.rangeNormal}
                    onChange={(e) => setAttack(i, { rangeNormal: Number(e.target.value) })}
                  />
                </label>
                <label className="field">
                  <span>Дальняя, фт</span>
                  <input
                    type="number"
                    min={0}
                    value={attack.rangeLong}
                    onChange={(e) => setAttack(i, { rangeLong: Number(e.target.value) })}
                  />
                </label>
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
