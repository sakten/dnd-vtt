import {
  ABILITIES,
  DEFAULT_ABILITIES,
  abilityMod,
  type AbilityKey,
  type ActionCost,
  type ActionDef,
  type TokenStatblock,
} from 'shared';
import { newId } from '../lib/id';

interface Props {
  value: TokenStatblock | undefined;
  onChange: (value: TokenStatblock) => void;
}

const COSTS: { key: ActionCost; name: string }[] = [
  { key: 'action', name: 'Действие' },
  { key: 'bonus', name: 'Бонусное' },
  { key: 'reaction', name: 'Реакция' },
  { key: 'legendary', name: 'Легендарное' },
  { key: 'free', name: 'Свободное' },
];

const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** Статблок монстра: характеристики, спасброски, мультиатака, заклинания, действия. */
export default function StatblockForm({ value, onChange }: Props) {
  const sb: TokenStatblock = value ?? { abilities: { ...DEFAULT_ABILITIES } };
  const actions = sb.actions ?? [];

  const setAbility = (key: AbilityKey, n: number) =>
    onChange({ ...sb, abilities: { ...sb.abilities, [key]: Math.min(30, Math.max(0, n)) } });

  const setSave = (key: AbilityKey, raw: string) => {
    const saves = { ...(sb.saves ?? {}) };
    if (raw.trim() === '') delete saves[key];
    else saves[key] = Math.round(Number(raw) || 0);
    onChange({ ...sb, saves: Object.keys(saves).length ? saves : undefined });
  };

  const setSpellcasting = (patch: Partial<NonNullable<TokenStatblock['spellcasting']>> | null) => {
    if (patch === null) {
      const next = { ...sb };
      delete next.spellcasting;
      onChange(next);
      return;
    }
    const base: NonNullable<TokenStatblock['spellcasting']> = sb.spellcasting ?? { ability: 'wis' };
    onChange({ ...sb, spellcasting: { ...base, ...patch } });
  };

  const setActions = (list: ActionDef[]) => {
    const next = { ...sb };
    if (list.length) next.actions = list;
    else delete next.actions;
    onChange(next);
  };
  const updateAction = (index: number, patch: Partial<ActionDef>) =>
    setActions(actions.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  const addAction = () =>
    setActions([...actions, { id: newId(), name: '', source: 'monster', costs: ['action'] }]);
  const removeAction = (index: number) => setActions(actions.filter((_, i) => i !== index));

  return (
    <div className="statblock-form">
      <div className="sheet-section-title">Характеристики</div>
      <div className="ability-grid">
        {ABILITIES.map((a) => (
          <label className="field" key={a.key}>
            <span>
              {a.name} <em className="ability-mod">{fmt(abilityMod(sb.abilities[a.key] ?? 10))}</em>
            </span>
            <input
              type="number"
              min={0}
              max={30}
              value={sb.abilities[a.key] ?? 10}
              onChange={(e) => setAbility(a.key, Number(e.target.value))}
            />
          </label>
        ))}
      </div>

      <div className="sheet-section-title">Спасброски (явный бонус; пусто — из характеристик)</div>
      <div className="saves-grid">
        {ABILITIES.map((a) => (
          <label className="field" key={a.key}>
            <span>{a.name}</span>
            <input
              type="text"
              placeholder="—"
              value={sb.saves?.[a.key] ?? ''}
              onChange={(e) => setSave(a.key, e.target.value)}
            />
          </label>
        ))}
      </div>

      <div className="field-row">
        <label className="field">
          <span>Мультиатака (атак за действие)</span>
          <input
            type="number"
            min={1}
            max={10}
            value={sb.multiattack ?? 1}
            onChange={(e) => onChange({ ...sb, multiattack: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })}
          />
        </label>
        <label className="field">
          <span>Пул легендарных действий</span>
          <input
            type="number"
            min={0}
            max={9}
            value={sb.legendary?.max ?? 0}
            onChange={(e) => {
              const max = Math.min(9, Math.max(0, Number(e.target.value) || 0));
              const legendaryActions = sb.legendary?.actions ?? [];
              const next = { ...sb };
              if (max > 0 || legendaryActions.length) next.legendary = { max, actions: legendaryActions };
              else delete next.legendary;
              onChange(next);
            }}
          />
        </label>
      </div>

      <div className="sheet-section-title">Заклинания</div>
      <div className="field-row">
        <label className="field">
          <span>Характеристика</span>
          <select
            value={sb.spellcasting?.ability ?? ''}
            onChange={(e) =>
              e.target.value
                ? setSpellcasting({ ability: e.target.value as AbilityKey })
                : setSpellcasting(null)
            }
          >
            <option value="">—</option>
            {ABILITIES.map((a) => (
              <option key={a.key} value={a.key}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        {sb.spellcasting && (
          <>
            <label className="field">
              <span>Сложность (DC)</span>
              <input
                type="number"
                min={0}
                max={40}
                value={sb.spellcasting.dc ?? ''}
                onChange={(e) => setSpellcasting({ dc: Number(e.target.value) || 0 })}
              />
            </label>
            <label className="field">
              <span>Атака</span>
              <input
                type="number"
                min={0}
                max={40}
                value={sb.spellcasting.attack ?? ''}
                onChange={(e) => setSpellcasting({ attack: Number(e.target.value) || 0 })}
              />
            </label>
          </>
        )}
      </div>

      <div className="sheet-section-title">Действия (название + стоимость)</div>
      {actions.map((action, i) => (
        <div className="statblock-action" key={action.id}>
          <input
            type="text"
            placeholder="Название"
            maxLength={40}
            value={action.name}
            onChange={(e) => updateAction(i, { name: e.target.value })}
          />
          <select
            value={action.costs[0] ?? 'action'}
            onChange={(e) => updateAction(i, { costs: [e.target.value as ActionCost] })}
          >
            {COSTS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="button" className="weapon-remove" onClick={() => removeAction(i)}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="weapon-add" onClick={addAction}>
        + Добавить действие
      </button>
    </div>
  );
}
