import { emptyAttacks, statNumber, statsPaired, type AttackEntry, type TokenFields } from 'shared';
import { useGameStore } from '../store/useGameStore';

interface Props {
  value: TokenFields;
  onChange: (patch: Partial<TokenFields>) => void;
  hpCurrent?: number;
  onHpCurrentChange?: (value: number) => void;
}

export default function TokenFieldsForm({ value, onChange, hpCurrent, onHpCurrentChange }: Props) {
  const isDm = useGameStore((s) => s.role === 'dm');
  const attacks = value.attacks ?? emptyAttacks();
  const setAttack = (index: number, patch: Partial<AttackEntry>) => {
    onChange({ attacks: attacks.map((a, i) => (i === index ? { ...a, ...patch } : a)) });
  };

  return (
    <>
      <label className="field">
        <span>Название</span>
        <input
          type="text"
          value={value.name}
          maxLength={40}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </label>
      <label className="field">
        <span>Описание</span>
        <textarea
          value={value.description}
          rows={3}
          maxLength={200}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </label>
      <label className="field">
        <span>Бонус инициативы (например +3)</span>
        <input
          type="text"
          value={value.initiativeBonus}
          maxLength={10}
          placeholder="+0"
          onChange={(e) => onChange({ initiativeBonus: e.target.value })}
        />
      </label>
      <div className="size-row">
        <span>Размер:</span>
        {[1, 2, 3, 4].map((n) => (
          <button key={n} className={value.cells === n ? 'active' : ''} onClick={() => onChange({ cells: n })}>
            {n}×{n}
          </button>
        ))}
      </div>
      <label className="checkbox-row">
        <input type="checkbox" checked={value.round} onChange={(e) => onChange({ round: e.target.checked })} />
        Круглый токен
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={value.isPlayerToken}
          onChange={(e) =>
            onChange({ isPlayerToken: e.target.checked, ...(e.target.checked ? {} : { owner: '' }) })
          }
        />
        Это токен игрока
      </label>
      {value.isPlayerToken && (
        <label className="field">
          <span>Владелец (имя персонажа; пусто — сам персонаж)</span>
          <input
            type="text"
            value={value.owner}
            maxLength={40}
            placeholder="Например: Гэндальф"
            onChange={(e) => onChange({ owner: e.target.value })}
          />
        </label>
      )}

      <div className="field-row">
        <label className="field">
          <span>Класс брони (AC)</span>
          <input
            type="text"
            value={value.ac ?? ''}
            maxLength={10}
            placeholder="15"
            onChange={(e) => onChange({ ac: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Макс. ХП</span>
          <input
            type="text"
            value={value.hpMax ?? ''}
            maxLength={10}
            placeholder="20"
            onChange={(e) => onChange({ hpMax: e.target.value })}
          />
        </label>
      </div>

      {!statsPaired(value.ac ?? '', value.hpMax ?? '') && (
        <div className="field-warning">Укажите и AC, и Макс. ХП — или оставьте оба пустыми.</div>
      )}

      {onHpCurrentChange !== undefined && (
        <label className="field">
          <span>Текущее ХП{statNumber(value.hpMax) > 0 ? ` из ${statNumber(value.hpMax)}` : ''}</span>
          <input
            type="number"
            min={0}
            value={hpCurrent ?? 0}
            onChange={(e) => onHpCurrentChange(Math.max(0, Math.round(Number(e.target.value) || 0)))}
          />
        </label>
      )}

      {isDm && (
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={value.showStats ?? false}
            onChange={(e) => onChange({ showStats: e.target.checked })}
          />
          Показывать статы игрокам
        </label>
      )}

      <div className="sheet-section-title">Атаки (до 3)</div>
      {attacks.map((attack, i) => (
        <div className="weapon-block" key={i}>
          <label className="field">
            <span>Атака {i + 1}: название</span>
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
    </>
  );
}
