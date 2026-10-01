import type { ModifierSpec, ValueExpr } from 'shared';
import { t, type MessageKey } from '../i18n';

/** Цели/режимы модификаторов, редактируемые формой (остальное — JSON). */
export const MODIFIER_TARGETS = [
  'attack',
  'damage',
  'ac',
  'save',
  'check',
  'speed',
  'initiative',
  'maxHp',
  'spellDc',
  'spellAttack',
  'extraActions',
  'extraBonusActions',
  'reach',
] as const;
export const MODIFIER_MODES = [
  'add',
  'multiply',
  'set',
  'advantage',
  'disadvantage',
  'resistance',
  'immunity',
  'vulnerability',
] as const;

/** Гейт по выбору при касте: форма правит только безусловные модификаторы. */
type GatedModifier = ModifierSpec | { if: ValueExpr; then: ModifierSpec };

const parseModifierValue = (raw: string): number | string | undefined => {
  const text = raw.trim();
  if (!text) return undefined;
  return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : text;
};

/** Редактор модификаторов эффекта (общий для эффектов записи и `weaponAttack.hitEffect`). */
export default function EffectModifiersEditor<T extends GatedModifier>({
  modifiers,
  onChange,
}: {
  modifiers: T[] | undefined;
  onChange: (modifiers: T[] | undefined) => void;
}) {
  const list = modifiers ?? [];
  const patch = (index: number, entry: Partial<ModifierSpec>) => {
    const next = [...list];
    next[index] = { ...(next[index] as ModifierSpec), ...entry } as T;
    onChange(next);
  };
  const remove = (index: number) => onChange(list.filter((_, i) => i !== index));
  const add = () => onChange([...(list as T[]), { target: 'damage', mode: 'add', value: 1 } as T]);
  return (
    <>
      {list.map((entry, index) => {
        if (typeof entry !== 'object' || 'if' in entry) return null;
        const mod = entry as ModifierSpec;
        return (
          <div className="field-row constructor-modifier" key={index}>
            <select
              value={mod.target}
              onChange={(e) => patch(index, { target: e.target.value as ModifierSpec['target'] })}
            >
              {MODIFIER_TARGETS.map((target) => (
                <option key={target} value={target}>
                  {t(`ui.constructor.mtarget.${target}` as MessageKey)}
                </option>
              ))}
            </select>
            <select value={mod.mode} onChange={(e) => patch(index, { mode: e.target.value as ModifierSpec['mode'] })}>
              {MODIFIER_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {t(`ui.constructor.mmode.${mode}` as MessageKey)}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder={t('ui.constructor.modifierValue')}
              value={mod.value === undefined ? '' : String(mod.value)}
              onChange={(e) => patch(index, { value: parseModifierValue(e.target.value) })}
            />
            <button type="button" onClick={() => remove(index)}>
              {t('ui.constructor.remove')}
            </button>
          </div>
        );
      })}
      <button type="button" onClick={add}>
        {t('ui.constructor.addModifier')}
      </button>
    </>
  );
}
