import {
  ABILITIES,
  CREATURE_TYPES,
  DEFAULT_ABILITIES,
  abilityMod,
  type AbilityKey,
  type ActionDef,
  type TokenStatblock,
} from 'shared';
import { useState } from 'react';
import { t } from '../i18n';
import { abilityName, creatureTypeLabel } from '../i18n/domain';
import { parseSaveBonus } from '../lib/saves';
import { Field } from './Field';
import MonsterAbilityEditor from './MonsterAbilityEditor';
import ConditionImmunitiesForm from './ConditionImmunitiesForm';

interface Props {
  value: TokenStatblock | undefined;
  onChange: (value: TokenStatblock) => void;
  /** Токен персонажа: данные из листа — только просмотр. */
  readOnly?: boolean;
}

const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** Статблок монстра: характеристики, спасброски, мультиатака, заклинания, действия. */
export default function StatblockForm({ value, onChange, readOnly }: Props) {
  const sb: TokenStatblock = value ?? { abilities: { ...DEFAULT_ABILITIES } };
  const actions = sb.actions ?? [];
  // Текст полей спасбросков: нужен, чтобы «-» по пути к «-1» не превращался в 0.
  const [saveText, setSaveText] = useState<Partial<Record<AbilityKey, string>>>({});

  const setAbility = (key: AbilityKey, n: number) =>
    onChange({ ...sb, abilities: { ...sb.abilities, [key]: Math.min(30, Math.max(0, n)) } });

  const saveValue = (key: AbilityKey) => {
    const text = saveText[key];
    if (text !== undefined) return text;
    const stored = sb.saves?.[key];
    return typeof stored === 'number' ? String(stored) : '';
  };

  const setSave = (key: AbilityKey, raw: string) => {
    setSaveText((t) => ({ ...t, [key]: raw }));
    const saves = { ...(sb.saves ?? {}) };
    const value = parseSaveBonus(raw);
    if (value === undefined) delete saves[key];
    else saves[key] = value;
    onChange({ ...sb, saves: Object.keys(saves).length ? saves : undefined });
  };

  const caster = !!sb.spellcasting;
  const toggleCaster = (on: boolean) => {
    if (on) {
      onChange({ ...sb, spellcasting: { ability: sb.spellcasting?.ability ?? 'wis', spells: [] } });
      return;
    }
    const next = { ...sb };
    delete next.spellcasting;
    onChange(next);
  };

  const setActions = (list: ActionDef[]) => {
    const next = { ...sb };
    if (list.length) next.actions = list;
    else delete next.actions;
    onChange(next);
  };

  return (
    <div className="statblock-form">
      <div className="sheet-section-title">{t('ui.common.abilities')}</div>
      <div className="ability-grid">
        {ABILITIES.map((a) => (
          <Field
            key={a.key}
            label={
              <>
                {abilityName(a.key)} <em className="ability-mod">{fmt(abilityMod(sb.abilities[a.key] ?? 10))}</em>
              </>
            }
          >
            <input
              type="number"
              min={0}
              max={30}
              value={sb.abilities[a.key] ?? 10}
              readOnly={readOnly}
              onChange={(e) => setAbility(a.key, Number(e.target.value))}
            />
          </Field>
        ))}
      </div>

      <div className="sheet-section-title">{t('ui.statblock.creatureType')}</div>
      <select
        className="sp-select"
        value={sb.creatureType ?? ''}
        disabled={readOnly}
        onChange={(e) => {
          const next = { ...sb };
          if (e.target.value) next.creatureType = e.target.value;
          else delete next.creatureType;
          onChange(next);
        }}
      >
        <option value="">{t('ui.statblock.creatureTypeNone')}</option>
        {CREATURE_TYPES.map((type) => (
          <option key={type.key} value={type.key}>
            {creatureTypeLabel(type.key)}
          </option>
        ))}
      </select>

      <div className="sheet-section-title">{t('ui.statblock.saves')}</div>
      <div className="saves-grid">
        {ABILITIES.map((a) => (
          <Field key={a.key} label={abilityName(a.key)}>
            <input
              type="text"
              placeholder="—"
              value={saveValue(a.key)}
              readOnly={readOnly}
              onChange={(e) => setSave(a.key, e.target.value)}
            />
          </Field>
        ))}
      </div>

      <div className="sheet-section-title">{t('ui.statblock.conditionImmunities')}</div>
      <ConditionImmunitiesForm
        value={sb.conditionImmunities ?? []}
        readOnly={readOnly}
        onChange={(list) => {
          const next = { ...sb };
          if (list.length) next.conditionImmunities = list;
          else delete next.conditionImmunities;
          onChange(next);
        }}
      />

      <div className="field-row">
        <Field label={t('ui.statblock.attackBonus')}>
          <input
            type="text"
            placeholder="+5"
            maxLength={3}
            value={sb.attackBonus ?? ''}
            readOnly={readOnly}
            onChange={(e) => onChange({ ...sb, attackBonus: e.target.value || undefined })}
          />
        </Field>
        <Field label={t('ui.statblock.saveDc')}>
          <input
            type="number"
            min={1}
            max={40}
            value={sb.saveDc ?? ''}
            readOnly={readOnly}
            onChange={(e) => onChange({ ...sb, saveDc: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
        </Field>
      </div>

      <div className="field-row">
        <Field label={t('ui.statblock.multiattack')}>
          <input
            type="number"
            min={1}
            max={10}
            value={sb.multiattack ?? 1}
            readOnly={readOnly}
            onChange={(e) => onChange({ ...sb, multiattack: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })}
          />
        </Field>
        <Field label={t('ui.statblock.legendaryPool')}>
          <input
            type="number"
            min={0}
            max={9}
            value={sb.legendary?.max ?? 0}
            readOnly={readOnly}
            onChange={(e) => {
              const max = Math.min(9, Math.max(0, Number(e.target.value) || 0));
              const legendaryActions = sb.legendary?.actions ?? [];
              const next = { ...sb };
              if (max > 0 || legendaryActions.length) next.legendary = { max, actions: legendaryActions };
              else delete next.legendary;
              onChange(next);
            }}
          />
        </Field>
      </div>

      <div className="sheet-section-title">{t('ui.common.spells')}</div>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={caster}
          disabled={readOnly}
          onChange={(e) => toggleCaster(e.target.checked)}
        />
        <span>{t('ui.statblock.caster')}</span>
      </label>

      <div className="sheet-section-title">{t('ui.ability.title')}</div>
      <MonsterAbilityEditor actions={actions} onChange={setActions} readOnly={readOnly} />
    </div>
  );
}
