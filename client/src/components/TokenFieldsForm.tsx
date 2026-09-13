import { emptyAttacks, statNumber, statsPaired, type TokenFields } from 'shared';
import { useGameStore } from '../store/useGameStore';
import AttacksForm from './AttacksForm';
import DamageDefensesForm from './DamageDefensesForm';

interface Props {
  value: TokenFields;
  onChange: (patch: Partial<TokenFields>) => void;
  hpCurrent?: number;
  onHpCurrentChange?: (value: number) => void;
}

/** Редактор полей токена/предмета библиотеки (используется в панели библиотеки). */
export default function TokenFieldsForm({ value, onChange, hpCurrent, onHpCurrentChange }: Props) {
  const isDm = useGameStore((s) => s.role === 'dm');
  const attacks = value.attacks ?? emptyAttacks();

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

      <AttacksForm attacks={attacks} onChange={(list) => onChange({ attacks: list })} />

      <DamageDefensesForm
        value={value.damageDefenses ?? []}
        onChange={(damageDefenses) => onChange({ damageDefenses })}
      />
    </>
  );
}
