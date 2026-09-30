import { CONDITION_KEYS, type ConditionKey, type EffectDuration, type EffectSpec, type ModifierSpec } from 'shared';
import { t, type MessageKey } from '../i18n';
import { conditionLabel } from '../i18n/domain';
import { newId } from '../lib/id';
import { Field } from './Field';

/** Цели/режимы/длительности эффектов, редактируемые формой (остальное — JSON). */
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
export const EFFECT_DURATIONS = ['permanent', 'concentration', 'endOfTurn', 'rounds'] as const;

interface Props {
  effects: EffectSpec[];
  onChange: (list: EffectSpec[]) => void;
  /** Имя нового эффекта (название записи). */
  defaultName: string;
  /** Подсказка под списком (например, «гейты — в JSON»). */
  hint?: string;
}

/** Список эффектов: строки (имя, цель, длительность), модификаторы и состояния. */
export default function EffectListEditor({ effects, onChange, defaultName, hint }: Props) {
  const patchEffect = (index: number, patch: Partial<EffectSpec>) => {
    const list = [...effects];
    list[index] = { ...list[index]!, ...patch };
    onChange(list);
  };
  const patchModifier = (effectIndex: number, modIndex: number, patch: Partial<ModifierSpec>) => {
    const list = [...(effects[effectIndex]!.modifiers ?? [])];
    list[modIndex] = { ...(list[modIndex] as ModifierSpec), ...patch };
    patchEffect(effectIndex, { modifiers: list });
  };
  const removeModifier = (effectIndex: number, modIndex: number) => {
    patchEffect(effectIndex, {
      modifiers: (effects[effectIndex]!.modifiers ?? []).filter((_, i) => i !== modIndex),
    });
  };
  const addModifier = (effectIndex: number) => {
    patchEffect(effectIndex, {
      modifiers: [...(effects[effectIndex]!.modifiers ?? []), { target: 'damage', mode: 'add', value: 1 } as ModifierSpec],
    });
  };
  const toggleCondition = (effectIndex: number, key: ConditionKey) => {
    const list = effects[effectIndex]!.conditions ?? [];
    const gated = list.filter((c) => typeof c !== 'string');
    const plain = list.filter((c): c is string => typeof c === 'string');
    const next = plain.includes(key) ? plain.filter((c) => c !== key) : [...plain, key];
    const merged = [...gated, ...next];
    patchEffect(effectIndex, { conditions: merged.length ? merged : undefined });
  };
  const setEffectDuration = (effectIndex: number, kind: (typeof EFFECT_DURATIONS)[number], rounds: number) => {
    const duration: EffectDuration =
      kind === 'rounds'
        ? { type: 'rounds', rounds: Math.max(1, rounds) }
        : kind === 'endOfTurn'
          ? { type: 'endOfTurn', of: 'target' }
          : { type: kind };
    patchEffect(effectIndex, { duration });
  };
  const parseModifierValue = (raw: string): number | string | undefined => {
    const text = raw.trim();
    if (!text) return undefined;
    return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : text;
  };

  return (
    <>
      {effects.map((effect, index) => {
        const leveled = typeof effect.duration === 'object' && 'levels' in effect.duration;
        const duration = leveled ? undefined : (effect.duration as EffectDuration);
        const durationKind = duration?.type ?? 'permanent';
        return (
          <div className="constructor-effect" key={effect.id}>
            <div className="field-row">
              <Field label={t('ui.constructor.effectName')}>
                <input type="text" value={effect.name} onChange={(e) => patchEffect(index, { name: e.target.value })} />
              </Field>
              <Field label={t('ui.constructor.effectTo')}>
                <select
                  value={effect.to ?? 'targets'}
                  onChange={(e) => patchEffect(index, { to: e.target.value as 'self' | 'targets' })}
                >
                  <option value="targets">{t('ui.constructor.effectTo.targets')}</option>
                  <option value="self">{t('ui.constructor.effectTo.self')}</option>
                </select>
              </Field>
              {leveled ? (
                <span className="hint">{t('ui.constructor.effectLeveled')}</span>
              ) : (
                <Field label={t('ui.constructor.duration')}>
                  <select
                    value={durationKind}
                    onChange={(e) =>
                      setEffectDuration(
                        index,
                        e.target.value as (typeof EFFECT_DURATIONS)[number],
                        duration?.type === 'rounds' ? duration.rounds : 1
                      )
                    }
                  >
                    {EFFECT_DURATIONS.map((kind) => (
                      <option key={kind} value={kind}>
                        {t(`ui.constructor.effectDuration.${kind}` as MessageKey)}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {duration?.type === 'rounds' && (
                <Field label={t('ui.constructor.effectRound')}>
                  <input
                    type="number"
                    min={1}
                    value={duration.rounds}
                    onChange={(e) => setEffectDuration(index, 'rounds', Number(e.target.value) || 1)}
                  />
                </Field>
              )}
              <button type="button" onClick={() => onChange(effects.filter((_, i) => i !== index))}>
                {t('ui.constructor.remove')}
              </button>
            </div>
            {(effect.modifiers ?? []).map((entry, mi) => {
              if (typeof entry !== 'object' || 'if' in entry) return null;
              const mod = entry as ModifierSpec;
              return (
                <div className="field-row constructor-modifier" key={mi}>
                  <select
                    value={mod.target}
                    onChange={(e) => patchModifier(index, mi, { target: e.target.value as ModifierSpec['target'] })}
                  >
                    {MODIFIER_TARGETS.map((target) => (
                      <option key={target} value={target}>
                        {t(`ui.constructor.mtarget.${target}` as MessageKey)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={mod.mode}
                    onChange={(e) => patchModifier(index, mi, { mode: e.target.value as ModifierSpec['mode'] })}
                  >
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
                    onChange={(e) => patchModifier(index, mi, { value: parseModifierValue(e.target.value) })}
                  />
                  <button type="button" onClick={() => removeModifier(index, mi)}>
                    {t('ui.constructor.remove')}
                  </button>
                </div>
              );
            })}
            <button type="button" onClick={() => addModifier(index)}>
              {t('ui.constructor.addModifier')}
            </button>
            <div className="ability-types">
              {CONDITION_KEYS.map((key) => {
                const checked = (effect.conditions ?? []).some((c) => c === key);
                return (
                  <button
                    type="button"
                    key={key}
                    className={`ability-type${checked ? ' on' : ''}`}
                    onClick={() => toggleCondition(index, key)}
                  >
                    {conditionLabel(key)}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() =>
          onChange([
            ...effects,
            { id: newId(), name: defaultName, duration: { type: 'permanent' }, to: 'targets', modifiers: [] },
          ])
        }
      >
        {t('ui.constructor.addEffect')}
      </button>
      {hint && <p className="hint">{hint}</p>}
    </>
  );
}
