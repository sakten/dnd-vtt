import type { TokenFields } from 'shared';

interface Props {
  value: TokenFields;
  onChange: (patch: Partial<TokenFields>) => void;
}

export default function TokenFieldsForm({ value, onChange }: Props) {
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
    </>
  );
}
