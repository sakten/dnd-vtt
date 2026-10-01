import {
  CONDITION_KEYS,
  DEFAULT_SENSE_RANGES,
  SENSE_TYPES,
  SKILLS,
  type AbilityKey,
  type ConditionKey,
  type EffectDuration,
  type EffectSpec,
  type LightSource,
  type LoadoutSpec,
  type Restrictions,
  type Sense,
  type UsesSpec,
  type ValueExpr,
} from 'shared';
import { t, type MessageKey } from '../i18n';
import { abilityName, conditionLabel, senseLabel, skillName } from '../i18n/domain';
import { newId } from '../lib/id';
import EffectModifiersEditor from './EffectModifiersEditor';
import EffectTriggersEditor from './EffectTriggersEditor';
import { Field } from './Field';

const ABILITY_KEYS: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

const literalText = (value: ValueExpr | undefined): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

/** Значение-ссылка (`{ref}`/`tiers`/`concat`) показывается «из данных»; литерал правится полем. */
export function ExprField({
  value,
  onChange,
  placeholder,
}: {
  value: ValueExpr | undefined;
  onChange: (value: ValueExpr | undefined) => void;
  placeholder?: string;
}) {
  if (typeof value === 'string' || typeof value === 'number') {
    return (
      <input
        type="text"
        placeholder={placeholder}
        value={String(value)}
        onChange={(e) => {
          const text = e.target.value.trim();
          if (!text) {
            onChange(undefined);
            return;
          }
          onChange(/^-?\d+$/.test(text) ? Number(text) : text);
        }}
      />
    );
  }
  return <span className="hint">{t('ui.constructor.fromData')}</span>;
}

type LoadoutKind = LoadoutSpec['kind'];

const blankLoadout = (kind: LoadoutKind): LoadoutSpec => {
  if (kind === 'augment') return { kind: 'augment', magic: true };
  if (kind === 'weaponOverride') return { kind: 'weaponOverride', weapons: [], dice: '1d8', damageType: 'force', abilityMod: 0 };
  return { kind: 'shadowBlade', dice: '2d8', inHand: true };
};

const blankUses = (kind: UsesSpec['kind']): UsesSpec => {
  if (kind === 'charges') return { kind: 'charges', count: 1 };
  if (kind === 'misdirect') return { kind: 'misdirect', charges: 3, die: 'd6', threshold: 6 };
  return { kind };
};

const literalSenses = (value: EffectSpec['senses']): Sense[] | undefined =>
  Array.isArray(value) ? value : undefined;

const literalTurnDodge = (value: EffectSpec['turnDodge']): ValueExpr | undefined =>
  value && typeof value === 'object' && !('if' in value) ? value.ability : undefined;

const literalBooleans = (value: unknown): boolean | undefined => {
  if (value === true || value === false) return value;
  return undefined;
};

/** Ограничения экономики эффекта, редактируемые формой (`noActionsFromEffect` — служебный). */
const RESTRICTION_CHECKS = [
  'noActions',
  'noBonus',
  'noReactions',
  'noOpportunityAttacks',
  'ignoresOpportunityAttacks',
  'oneAttackOnly',
  'actionOrBonusOnly',
  'noSpells',
] as const;
type RestrictionKey = (typeof RESTRICTION_CHECKS)[number];

const withRestriction = (current: Restrictions | undefined, patch: Partial<Restrictions>): Restrictions | undefined => {
  const next: Record<string, unknown> = { ...(current ?? {}), ...patch };
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined || value === false) delete next[key];
  }
  return Object.keys(next).length ? (next as Restrictions) : undefined;
};

/** Свет источника (эффект/зона): яркий радиус, сумерки и флаг солнечного. */
export function LightFields({
  value,
  onChange,
}: {
  value: LightSource | undefined;
  onChange: (value: LightSource | undefined) => void;
}) {
  return (
    <>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked ? { bright: 20, dim: 20 } : undefined)}
        />
        <span>{t('ui.constructor.light')}</span>
      </label>
      {value && (
        <span className="field-row">
          <Field label={t('ui.constructor.lightBright')}>
            <input
              type="number"
              min={0}
              value={value.bright}
              onChange={(e) => onChange({ ...value, bright: Math.max(0, Number(e.target.value) || 0) })}
            />
          </Field>
          <Field label={t('ui.constructor.lightDim')}>
            <input
              type="number"
              min={0}
              value={value.dim}
              onChange={(e) => onChange({ ...value, dim: Math.max(0, Number(e.target.value) || 0) })}
            />
          </Field>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={value.sunlight === true}
              onChange={(e) => onChange({ ...value, sunlight: e.target.checked || undefined })}
            />
            <span>{t('ui.constructor.lightSunlight')}</span>
          </label>
        </span>
      )}
    </>
  );
}

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
  const setLoadout = (effectIndex: number, spec: LoadoutSpec | undefined) => patchEffect(effectIndex, { loadout: spec });
  const setUses = (effectIndex: number, uses: UsesSpec | undefined) => patchEffect(effectIndex, { uses });
  const toggleSense = (effectIndex: number, type: Sense['type']) => {
    const list = literalSenses(effects[effectIndex]!.senses);
    if (!list) return;
    const next = list.some((sense) => sense.type === type)
      ? list.filter((sense) => sense.type !== type)
      : [...list, { type, range: DEFAULT_SENSE_RANGES[type] ?? 60 }];
    patchEffect(effectIndex, { senses: next.length ? next : undefined });
  };
  const toggleImmunity = (effectIndex: number, key: ConditionKey) => {
    const list = effects[effectIndex]!.conditionImmunities ?? [];
    const gated = list.filter((c) => typeof c !== 'string');
    const plain = list.filter((c): c is string => typeof c === 'string');
    const next = plain.includes(key) ? plain.filter((c) => c !== key) : [...plain, key];
    patchEffect(effectIndex, { conditionImmunities: gated.length || next.length ? [...gated, ...next] : undefined });
  };
  const toggleRestriction = (effectIndex: number, key: RestrictionKey) => {
    const current = effects[effectIndex]!.restrictions ?? {};
    patchEffect(effectIndex, {
      restrictions: withRestriction(current, { [key]: current[key] ? undefined : true } as Partial<Restrictions>),
    });
  };
  const setSpellFailure = (effectIndex: number, value: number) => {
    patchEffect(effectIndex, {
      restrictions: withRestriction(effects[effectIndex]!.restrictions, {
        spellFailureChance: Number.isFinite(value) && value > 0 ? Math.min(100, Math.round(value)) : undefined,
      }),
    });
  };
  const patchEscape = (effectIndex: number, patch: Partial<NonNullable<EffectSpec['escape']>> | null) => {
    if (patch === null) {
      patchEffect(effectIndex, { escape: undefined });
      return;
    }
    patchEffect(effectIndex, { escape: { ...(effects[effectIndex]!.escape ?? { ability: 'dex' }), ...patch } });
  };
  return (
    <>
      {effects.map((effect, index) => {
        const leveled = typeof effect.duration === 'object' && 'levels' in effect.duration;
        const duration = leveled ? undefined : (effect.duration as EffectDuration);
        const durationKind = duration?.type ?? 'permanent';
        const uses = effect.uses;
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
            <EffectModifiersEditor
              modifiers={effect.modifiers}
              onChange={(modifiers) => patchEffect(index, { modifiers })}
            />
            <div className="constructor-loadout">
              <div className="constructor-chip-title">{t('ui.constructor.loadout')}</div>
              <select
                value={effect.loadout?.kind ?? ''}
                onChange={(e) =>
                  setLoadout(index, e.target.value ? blankLoadout(e.target.value as LoadoutKind) : undefined)
                }
              >
                <option value="">{t('ui.constructor.loadoutNone')}</option>
                <option value="augment">{t('ui.constructor.loadout.augment')}</option>
                <option value="weaponOverride">{t('ui.constructor.loadout.weaponOverride')}</option>
                <option value="shadowBlade">{t('ui.constructor.loadout.shadowBlade')}</option>
              </select>
              {effect.loadout?.kind === 'augment' && (
                <span className="field-row">
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={effect.loadout.magic === true}
                      onChange={(e) =>
                        setLoadout(index, { ...effect.loadout!, magic: e.target.checked || undefined } as LoadoutSpec)
                      }
                    />
                    <span>{t('ui.constructor.loadoutMagic')}</span>
                  </label>
                  <Field label={t('ui.constructor.loadoutAttack')}>
                    <ExprField
                      value={effect.loadout.attack}
                      onChange={(value) => setLoadout(index, { ...effect.loadout!, attack: value } as LoadoutSpec)}
                      placeholder="+1"
                    />
                  </Field>
                  <Field label={t('ui.constructor.loadoutDamage')}>
                    <ExprField
                      value={effect.loadout.damage}
                      onChange={(value) => setLoadout(index, { ...effect.loadout!, damage: value } as LoadoutSpec)}
                      placeholder="+1"
                    />
                  </Field>
                </span>
              )}
              {effect.loadout?.kind === 'weaponOverride' && (
                <span className="field-row">
                  <Field label={t('ui.constructor.loadoutWeapons')}>
                    <input
                      type="text"
                      placeholder="XPHB:Club, XPHB:Quarterstaff"
                      value={effect.loadout.weapons.join(', ')}
                      onChange={(e) =>
                        setLoadout(index, {
                          ...effect.loadout!,
                          weapons: e.target.value
                            .split(',')
                            .map((key) => key.trim())
                            .filter(Boolean),
                        } as LoadoutSpec)
                      }
                    />
                  </Field>
                  <Field label={t('ui.constructor.loadoutDice')}>
                    <ExprField
                      value={effect.loadout.dice}
                      onChange={(value) => setLoadout(index, { ...effect.loadout!, dice: value } as LoadoutSpec)}
                      placeholder="1d8"
                    />
                  </Field>
                  <Field label={t('ui.constructor.partType')}>
                    <ExprField
                      value={effect.loadout.damageType}
                      onChange={(value) => setLoadout(index, { ...effect.loadout!, damageType: value } as LoadoutSpec)}
                    />
                  </Field>
                  <Field label={t('ui.constructor.loadoutAbilityMod')}>
                    <ExprField
                      value={effect.loadout.abilityMod}
                      onChange={(value) => setLoadout(index, { ...effect.loadout!, abilityMod: value } as LoadoutSpec)}
                    />
                  </Field>
                </span>
              )}
              {effect.loadout?.kind === 'shadowBlade' && (
                <span className="field-row">
                  <Field label={t('ui.constructor.loadoutDice')}>
                    <ExprField
                      value={effect.loadout.dice}
                      onChange={(value) => setLoadout(index, { ...effect.loadout!, dice: value } as LoadoutSpec)}
                      placeholder="2d8"
                    />
                  </Field>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={effect.loadout.inHand === true}
                      onChange={(e) =>
                        setLoadout(index, { ...effect.loadout!, inHand: e.target.checked } as LoadoutSpec)
                      }
                    />
                    <span>{t('ui.constructor.loadoutInHand')}</span>
                  </label>
                </span>
              )}
            </div>
            <div className="constructor-uses">
              <div className="constructor-chip-title">{t('ui.constructor.uses')}</div>
              <select
                value={uses?.kind ?? ''}
                onChange={(e) => setUses(index, e.target.value ? blankUses(e.target.value as UsesSpec['kind']) : undefined)}
              >
                <option value="">{t('ui.constructor.usesNone')}</option>
                <option value="charges">{t('ui.constructor.uses.charges')}</option>
                <option value="consumeOnAttack">{t('ui.constructor.uses.consumeOnAttack')}</option>
                <option value="consumeOnSave">{t('ui.constructor.uses.consumeOnSave')}</option>
                <option value="misdirect">{t('ui.constructor.uses.misdirect')}</option>
              </select>
              {uses?.kind === 'charges' && (
                <span className="field-row">
                  <Field label={t('ui.constructor.usesCount')}>
                    <ExprField value={uses.count} onChange={(value) => setUses(index, { ...uses, count: value ?? 1 })} />
                  </Field>
                  <Field label={t('ui.constructor.usesOn')}>
                    <select
                      value={uses.on ?? ''}
                      onChange={(e) =>
                        setUses(index, {
                          ...uses,
                          on: (e.target.value || undefined) as 'rangedWeaponAttack' | undefined,
                        })
                      }
                    >
                      <option value="">{t('ui.constructor.usesOnAny')}</option>
                      <option value="rangedWeaponAttack">{t('ui.constructor.usesOnRanged')}</option>
                    </select>
                  </Field>
                </span>
              )}
              {uses?.kind === 'misdirect' && (
                <span className="field-row">
                  <Field label={t('ui.constructor.usesCount')}>
                    <input
                      type="number"
                      min={1}
                      value={uses.charges}
                      onChange={(e) => setUses(index, { ...uses, charges: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </Field>
                  <Field label={t('ui.constructor.usesDie')}>
                    <input
                      type="text"
                      value={uses.die}
                      onChange={(e) => setUses(index, { ...uses, die: e.target.value.trim() || 'd6' })}
                    />
                  </Field>
                  <Field label={t('ui.constructor.usesThreshold')}>
                    <input
                      type="number"
                      min={1}
                      value={uses.threshold}
                      onChange={(e) => setUses(index, { ...uses, threshold: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </Field>
                </span>
              )}
            </div>
            <details className="constructor-extra">
              <summary>{t('ui.constructor.extra')}</summary>
              <div className="field-row">
                <Field label={t('ui.constructor.extraTempHp')}>
                  <ExprField value={effect.tempHp} onChange={(value) => patchEffect(index, { tempHp: value })} placeholder="1d4 + 4" />
                </Field>
                <Field label={t('ui.constructor.extraTargets')}>
                  <ExprField value={effect.targets} onChange={(value) => patchEffect(index, { targets: value })} placeholder="3" />
                </Field>
                <Field label={t('ui.constructor.extraMaxHpBonus')}>
                  <input
                    type="text"
                    placeholder="2d10"
                    value={effect.maxHpBonus?.dice ?? ''}
                    onChange={(e) =>
                      patchEffect(index, { maxHpBonus: e.target.value.trim() ? { dice: e.target.value.trim() } : undefined })
                    }
                  />
                </Field>
                <Field label={t('ui.constructor.extraTurnDodge')}>
                  {literalTurnDodge(effect.turnDodge) !== undefined || effect.turnDodge === undefined ? (
                    <select
                      value={literalText(literalTurnDodge(effect.turnDodge))}
                      onChange={(e) => patchEffect(index, { turnDodge: e.target.value ? { ability: e.target.value } : undefined })}
                    >
                      <option value="">{t('ui.constructor.areaNone')}</option>
                      {ABILITY_KEYS.map((key) => (
                        <option key={key} value={key}>
                          {abilityName(key)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="hint">{t('ui.constructor.triggerGated')}</span>
                  )}
                </Field>
              </div>
              <div className="constructor-checks">
                {(['seesInvisible', 'mark', 'markTarget', 'dominates', 'banish', 'selfOnFail'] as const).map((key) => (
                  <label className="checkbox-row" key={key}>
                    <input
                      type="checkbox"
                      checked={literalBooleans(effect[key]) === true}
                      onChange={(e) =>
                        patchEffect(index, { [key]: e.target.checked || undefined } as Partial<EffectSpec>)
                      }
                    />
                    <span>{t(`ui.constructor.extra.${key}` as MessageKey)}</span>
                  </label>
                ))}
              </div>
              <div className="ability-types">
                <span className="constructor-chip-title">{t('ui.constructor.extraSenses')}</span>
                {SENSE_TYPES.map((type) => {
                  const checked = literalSenses(effect.senses)?.some((sense) => sense.type === type) === true;
                  return (
                    <button
                      type="button"
                      key={type}
                      className={`ability-type${checked ? ' on' : ''}`}
                      onClick={() => toggleSense(index, type)}
                    >
                      {senseLabel(type)}
                    </button>
                  );
                })}
              </div>
              <div className="ability-types">
                <span className="constructor-chip-title">{t('ui.constructor.extraConditionImmunities')}</span>
                {CONDITION_KEYS.map((key) => {
                  const checked = (effect.conditionImmunities ?? []).some((c) => c === key);
                  return (
                    <button
                      type="button"
                      key={key}
                      className={`ability-type${checked ? ' on' : ''}`}
                      onClick={() => toggleImmunity(index, key)}
                    >
                      {conditionLabel(key)}
                    </button>
                  );
                })}
              </div>
              <div className="field-row">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={!!effect.escape}
                    onChange={(e) => patchEscape(index, e.target.checked ? {} : null)}
                  />
                  <span>{t('ui.constructor.extraEscape')}</span>
                </label>
                {effect.escape && (
                  <>
                    <Field label={t('ui.constructor.extraEscapeKind')}>
                      <select
                        value={effect.escape.kind ?? ''}
                        onChange={(e) =>
                          patchEscape(index, { kind: (e.target.value || undefined) as 'check' | 'save' | undefined })
                        }
                      >
                        <option value="">{t('ui.constructor.areaNone')}</option>
                        <option value="check">{t('ui.constructor.escapeKind.check')}</option>
                        <option value="save">{t('ui.constructor.escapeKind.save')}</option>
                      </select>
                    </Field>
                    <Field label={t('ui.constructor.save')}>
                      <select
                        value={literalText(effect.escape.ability)}
                        onChange={(e) => patchEscape(index, { ability: e.target.value })}
                      >
                        {ABILITY_KEYS.map((key) => (
                          <option key={key} value={key}>
                            {abilityName(key)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t('ui.constructor.extraEscapeSkill')}>
                      <select
                        value={literalText(effect.escape.skill)}
                        onChange={(e) => patchEscape(index, { skill: e.target.value || undefined })}
                      >
                        <option value="">{t('ui.constructor.areaNone')}</option>
                        {SKILLS.map((skill) => (
                          <option key={skill.key} value={skill.key}>
                            {skillName(skill.key)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t('ui.constructor.extraEscapeDc')}>
                      <input
                        type="number"
                        min={0}
                        value={effect.escape.dc ?? ''}
                        onChange={(e) => patchEscape(index, { dc: Number(e.target.value) || undefined })}
                      />
                    </Field>
                  </>
                )}
              </div>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={!!effect.onEnd}
                  onChange={(e) =>
                    patchEffect(index, {
                      onEnd: e.target.checked
                        ? {
                            id: 'onEnd',
                            name: t('ui.constructor.onEndDefault'),
                            duration: { type: 'permanent' },
                            to: 'self',
                            modifiers: [],
                          }
                        : undefined,
                    })
                  }
                />
                <span>{t('ui.constructor.extraOnEnd')}</span>
              </label>
              {effect.onEnd && (
                <div className="constructor-onend">
                  <EffectListEditor
                    effects={[effect.onEnd]}
                    onChange={(list) => patchEffect(index, { onEnd: list[0] })}
                    defaultName={effect.onEnd.name}
                  />
                </div>
              )}
              <div className="field-row">
                <LightFields value={effect.light} onChange={(light) => patchEffect(index, { light })} />
              </div>
              <div className="constructor-checks">
                <span className="constructor-chip-title">{t('ui.constructor.restrictions')}</span>
                {RESTRICTION_CHECKS.map((key) => (
                  <label className="checkbox-row" key={key}>
                    <input
                      type="checkbox"
                      checked={effect.restrictions?.[key] === true}
                      onChange={() => toggleRestriction(index, key)}
                    />
                    <span>{t(`ui.constructor.restriction.${key}` as MessageKey)}</span>
                  </label>
                ))}
                <Field label={t('ui.constructor.restriction.spellFailureChance')}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={effect.restrictions?.spellFailureChance ?? ''}
                    onChange={(e) => setSpellFailure(index, Number(e.target.value))}
                  />
                </Field>
              </div>
              <p className="hint">{t('ui.constructor.extraHint')}</p>
            </details>
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

            <EffectTriggersEditor triggers={effect.triggers} onChange={(triggers) => patchEffect(index, { triggers })} />
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
