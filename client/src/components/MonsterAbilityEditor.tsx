import { useState } from 'react';
import {
  ABILITIES,
  actionTargeting,
  CONDITION_KEYS,
  DAMAGE_TYPES,
  MONSTER_ABILITIES,
  type AbilityKey,
  type ActionCost,
  type ActionDef,
  type AreaSpec,
  type ConditionKey,
  type EffectDuration,
  type MonsterAbilityAttack,
  type MonsterAbilityDef,
  type MonsterAbilityEffect,
} from 'shared';
import { t, type MessageKey } from '../i18n';
import { abilityName, conditionLabel, damageLabel } from '../i18n/domain';
import { spellDisplayName } from '../i18n/names';
import { spellLevelLabel } from '../lib/spellText';
import { newId } from '../lib/id';
import { useSpells } from '../lib/useSpells';
import { Field } from './Field';
import SpellPicker from './SpellPicker';

interface Props {
  actions: ActionDef[];
  onChange: (list: ActionDef[]) => void;
  readOnly?: boolean;
}

const COSTS: { key: ActionCost; label: MessageKey }[] = [
  { key: 'action', label: 'ui.ability.costAction' },
  { key: 'bonus', label: 'ui.ability.costBonus' },
  { key: 'reaction', label: 'ui.ability.costReaction' },
  { key: 'free', label: 'ui.ability.costFree' },
];

const SHAPES: { key: AreaSpec['shape']; label: MessageKey }[] = [
  { key: 'sphere', label: 'ui.aim.shape.sphere' },
  { key: 'cone', label: 'ui.aim.shape.cone' },
  { key: 'cube', label: 'ui.aim.shape.cube' },
  { key: 'line', label: 'ui.aim.shape.line' },
  { key: 'cylinder', label: 'ui.aim.shape.cylinder' },
];

const DURATIONS: { key: string; label: MessageKey; duration: EffectDuration }[] = [
  { key: 'turnSource', label: 'ui.ability.duration.turnSource', duration: { type: 'endOfTurn', of: 'source' } },
  { key: 'turnTarget', label: 'ui.ability.duration.turnTarget', duration: { type: 'endOfTurn', of: 'target' } },
  { key: 'untilSaveEnd', label: 'ui.ability.duration.untilSaveEnd', duration: { type: 'untilSave', ability: 'con', dc: 0, timing: 'end' } },
  { key: 'untilSaveStart', label: 'ui.ability.duration.untilSaveStart', duration: { type: 'untilSave', ability: 'con', dc: 0, timing: 'start' } },
  { key: 'round1', label: 'ui.ability.duration.round1', duration: { type: 'rounds', rounds: 1 } },
  { key: 'minute', label: 'ui.ability.duration.minute', duration: { type: 'rounds', rounds: 10 } },
  { key: 'permanent', label: 'ui.ability.duration.permanent', duration: { type: 'permanent' } },
];

const durationKey = (duration: EffectDuration): string =>
  DURATIONS.find((d) => JSON.stringify(d.duration) === JSON.stringify(duration))?.key ?? 'turnTarget';

/** Триггеры автосрабатывания способности (пусто — обычная, кнопкой). */
const TRIGGERS: { key: '' | 'takeDamage' | 'death'; label: MessageKey }[] = [
  { key: '', label: 'ui.ability.triggerNone' },
  { key: 'takeDamage', label: 'ui.ability.triggerDamage' },
  { key: 'death', label: 'ui.ability.triggerDeath' },
];

const SIDES: { key: 'any' | 'hostile' | 'ally'; label: MessageKey }[] = [
  { key: 'any', label: 'ui.ability.sideAny' },
  { key: 'hostile', label: 'ui.ability.sideHostile' },
  { key: 'ally', label: 'ui.ability.sideAlly' },
];

const triggerLabel = (trigger: 'takeDamage' | 'death'): MessageKey =>
  trigger === 'death' ? 'ui.ability.triggerDeath' : 'ui.ability.triggerDamage';

const costSummary = (a: ActionDef): string => {
  if (a.ability?.trigger) return t(triggerLabel(a.ability.trigger));
  const parts = a.costs.map((c) => t(COSTS.find((x) => x.key === c)?.label ?? 'ui.ability.costAction'));
  if (a.legendaryCost) parts.push(t('ui.action.legendaryCost', { n: a.legendaryCost }));
  if (a.spellKey) parts.push(t('ui.ability.spell'));
  return parts.join(', ');
};

export default function MonsterAbilityEditor({ actions, onChange, readOnly }: Props) {
  const spells = useSpells();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pickId, setPickId] = useState('');
  const [spellFor, setSpellFor] = useState<string | null>(null);
  const picking = spellFor ? actions.find((a) => a.id === spellFor) : undefined;

  const addFromLibrary = () => {
    const source = MONSTER_ABILITIES.find((a) => a.id === pickId);
    if (!source) return;
    const copy = structuredClone({ ...source, id: newId(), libraryId: source.id }) as ActionDef;
    onChange([...actions, copy]);
    setExpanded(copy.id);
    setPickId('');
  };

  const addAbility = () => {
    const item: ActionDef = { id: newId(), name: '', source: 'monster', costs: ['action'], ability: {} };
    onChange([...actions, item]);
    setExpanded(item.id);
  };

  const typeChips = (types: string[] | undefined, set: (v: string[] | undefined) => void) => (
    <div className="ability-types" title={t('ui.chat.damageHint')}>
      {DAMAGE_TYPES.map((d) => (
        <button
          key={d.key}
          type="button"
          className={`ability-type${types?.includes(d.key) ? ' on' : ''}`}
          disabled={readOnly}
          onClick={() => set(types?.includes(d.key) ? undefined : [d.key])}
        >
          {damageLabel(d.key)}
        </button>
      ))}
    </div>
  );

  return (
    <div className="ability-editor">
      <details className="ability-help">
        <summary>{t('ui.ability.helpTitle')}</summary>
        <p>{t('ui.ability.help')}</p>
      </details>

      {actions.map((a) => {
        const ability: MonsterAbilityDef = a.ability ?? {};
        const isSpell = !!a.spellKey;
        const isAttack = !!ability.attack;
        const isSave = !!ability.save;
        const targeting = actionTargeting(a);
        const kind = targeting?.kind === 'area' ? 'area' : 'creature';
        const patch = (p: Partial<ActionDef>) => onChange(actions.map((x) => (x.id === a.id ? { ...x, ...p } : x)));
        const patchAbility = (p: Partial<MonsterAbilityDef>) => patch({ ability: { ...ability, ...p } });
        const patchAttack = (p: Partial<MonsterAbilityAttack>) =>
          patchAbility({ attack: { rangeType: 'melee', ...ability.attack, ...p } });
        const patchEffects = (effects: MonsterAbilityEffect[]) =>
          patchAbility({ effects: effects.length ? effects : undefined });
        const setKind = (next: 'creature' | 'area') =>
          patch({
            targeting:
              next === 'area'
                ? { kind: 'area', range: targeting?.range ?? 30, area: targeting?.area ?? { shape: 'sphere', size: 20 } }
                : { kind: 'creature', range: targeting?.range ?? 30, targets: targeting?.targets ?? 1 },
          });
        const attackType = ability.attack?.rangeType ?? 'melee';
        const isTriggered = !isSpell && !!ability.trigger;
        const defaultRange = isAttack && attackType === 'melee' ? 5 : 30;
        const switchAttackType = (rangeType: 'melee' | 'ranged') => {
          const prevDefault = attackType === 'melee' ? 5 : 30;
          const nextDefault = rangeType === 'melee' ? 5 : 30;
          const range = targeting?.range === undefined || targeting.range === prevDefault ? nextDefault : targeting.range;
          patchAbility({ attack: { ...ability.attack, rangeType } });
          patch({ targeting: { ...(targeting ?? { kind: 'creature' }), kind, range } });
        };
        const toggleAttack = (on: boolean) => {
          if (!on) {
            patchAbility({ attack: undefined });
            return;
          }
          patchAbility({ attack: { rangeType: 'melee' } });
          patch({ targeting: { ...(targeting ?? { kind: 'creature' }), kind, range: targeting?.range ?? 5 } });
        };

        return (
          <details
            className="ability-card"
            key={a.id}
            open={expanded === a.id}
            onToggle={(e) => setExpanded((e.target as HTMLDetailsElement).open ? a.id : null)}
          >
            <summary>
              <span className="ability-name">{a.name.trim() || t('ui.ability.untitled')}</span>
              <span className="ability-cost">{costSummary(a)}</span>
            </summary>

            <div className="field-row">
              <Field label={t('ui.ability.name')}>
                <input
                  type="text"
                  maxLength={60}
                  value={a.name}
                  readOnly={readOnly}
                  onChange={(e) => patch({ name: e.target.value })}
                />
              </Field>
              {!readOnly && (
                <button type="button" className="weapon-remove" onClick={() => onChange(actions.filter((x) => x.id !== a.id))}>
                  ✕
                </button>
              )}
            </div>

            <Field label={t('ui.ability.description')}>
              <input
                type="text"
                maxLength={400}
                value={a.description ?? ''}
                readOnly={readOnly}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </Field>

            {!isSpell && (
              <div className="field-row">
                <Field label={t('ui.ability.trigger')}>
                  <select
                    value={ability.trigger ?? ''}
                    disabled={readOnly}
                    onChange={(e) => {
                      const value = e.target.value as '' | 'takeDamage' | 'death';
                      patchAbility({
                        trigger: value || undefined,
                        ...(value ? { radius: ability.radius ?? 5, side: ability.side ?? 'any' } : {}),
                      });
                    }}
                  >
                    {TRIGGERS.map((tr) => (
                      <option key={tr.key || 'none'} value={tr.key}>
                        {t(tr.label)}
                      </option>
                    ))}
                  </select>
                </Field>
                {isTriggered && (
                  <>
                    <Field label={t('ui.ability.radius')}>
                      <input
                        type="number"
                        min={0}
                        max={500}
                        value={ability.radius ?? 5}
                        readOnly={readOnly}
                        onChange={(e) =>
                          patchAbility({ radius: Math.max(0, Math.min(500, Number(e.target.value) || 0)) })
                        }
                      />
                    </Field>
                    <Field label={t('ui.ability.side')}>
                      <select
                        value={ability.side ?? 'any'}
                        disabled={readOnly}
                        onChange={(e) => patchAbility({ side: e.target.value as 'any' | 'hostile' | 'ally' })}
                      >
                        {SIDES.map((side) => (
                          <option key={side.key} value={side.key}>
                            {t(side.label)}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </>
                )}
              </div>
            )}

            {!isTriggered && (
            <div className="field-row">
              <Field label={t('ui.ability.cost')}>
                <div className="ability-costs">
                  {COSTS.map((c) => (
                    <label key={c.key} className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={a.costs.includes(c.key)}
                        disabled={readOnly || isSpell}
                        onChange={(e) =>
                          patch({
                            costs: e.target.checked ? [...a.costs, c.key] : a.costs.filter((x) => x !== c.key),
                          })
                        }
                      />
                      <span>{t(c.label)}</span>
                    </label>
                  ))}
                </div>
              </Field>
              <Field label={t('ui.ability.legendaryCost')}>
                <input
                  type="number"
                  min={0}
                  max={3}
                  value={a.legendaryCost ?? 0}
                  readOnly={readOnly}
                  onChange={(e) => {
                    const n = Math.min(3, Math.max(0, Number(e.target.value) || 0));
                    const value = isSpell ? Math.max(1, n) : n;
                    patch({ legendaryCost: value > 0 ? value : undefined });
                  }}
                />
              </Field>
              <Field label={t('ui.ability.recharge')}>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={a.recharge ?? 0}
                  readOnly={readOnly}
                  onChange={(e) => {
                    const n = Math.min(20, Math.max(0, Number(e.target.value) || 0));
                    patch({ recharge: n > 0 ? n : undefined });
                  }}
                />
              </Field>
            </div>
            )}

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={isSpell}
                disabled={readOnly}
                onChange={(e) =>
                  patch(
                    e.target.checked
                      ? { spellKey: a.spellKey ?? spells?.[0]?.key ?? '', costs: [], legendaryCost: a.legendaryCost ?? 1, ability: undefined, recharge: a.recharge }
                      : { spellKey: undefined, ability: ability.attack || ability.save || ability.damage || ability.effects ? ability : {} }
                  )
                }
              />
              <span>{t('ui.ability.spell')}</span>
            </label>
            {isSpell && (
              <Field label={t('ui.ability.spellPick')}>
                {(() => {
                  const chosen = spells?.find((s) => s.key === a.spellKey);
                  return (
                    <button
                      type="button"
                      className="ability-spell-pick"
                      disabled={readOnly}
                      onClick={() => setSpellFor(a.id)}
                    >
                      {chosen
                        ? `${spellDisplayName(chosen)} · ${spellLevelLabel(chosen.level)}`
                        : t('ui.ability.pickSpell')}
                    </button>
                  );
                })()}
              </Field>
            )}

            {!isSpell && !isTriggered && (
              <>
                <div className="field-row">
                  <Field label={t('ui.ability.range')}>
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      placeholder={String(defaultRange)}
                      value={targeting?.range ?? ''}
                      readOnly={readOnly}
                      onChange={(e) =>
                        patch({
                          targeting: {
                            ...(targeting ?? { kind: 'creature' }),
                            kind,
                            range: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)),
                          },
                        })
                      }
                    />
                  </Field>
                  <Field label={t('ui.ability.targetKind')}>
                    <select value={kind} disabled={readOnly} onChange={(e) => setKind(e.target.value as 'creature' | 'area')}>
                      <option value="creature">{t('ui.ability.targetCreature')}</option>
                      <option value="area">{t('ui.ability.targetArea')}</option>
                    </select>
                  </Field>
                  {kind === 'creature' ? (
                    <Field label={t('ui.ability.targets')}>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={targeting?.targets ?? 1}
                        readOnly={readOnly}
                        onChange={(e) =>
                          patch({
                            targeting: {
                              ...(targeting ?? { kind: 'creature' }),
                              kind: 'creature',
                              targets: Math.min(10, Math.max(1, Number(e.target.value) || 1)),
                            },
                          })
                        }
                      />
                    </Field>
                  ) : (
                    <>
                      <Field label={t('ui.ability.shape')}>
                        <select
                          value={targeting?.area?.shape ?? 'sphere'}
                          disabled={readOnly}
                          onChange={(e) =>
                            patch({
                              targeting: {
                                ...(targeting ?? { kind: 'area' }),
                                kind: 'area',
                                area: { ...(targeting?.area ?? { shape: 'sphere', size: 20 }), shape: e.target.value as AreaSpec['shape'] },
                              },
                            })
                          }
                        >
                          {SHAPES.map((s) => (
                            <option key={s.key} value={s.key}>
                              {t(s.label)}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label={t('ui.ability.size')}>
                        <input
                          type="number"
                          min={0}
                          max={1000}
                          value={targeting?.area?.size ?? 20}
                          readOnly={readOnly}
                          onChange={(e) =>
                            patch({
                              targeting: {
                                ...(targeting ?? { kind: 'area' }),
                                kind: 'area',
                                area: {
                                  ...(targeting?.area ?? { shape: 'sphere' }),
                                  size: Math.max(0, Number(e.target.value) || 0),
                                },
                              },
                            })
                          }
                        />
                      </Field>
                      {targeting?.area?.shape === 'line' && (
                        <Field label={t('ui.ability.width')}>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={targeting.area.width ?? 5}
                            readOnly={readOnly}
                            onChange={(e) =>
                              patch({
                                targeting: {
                                  ...(targeting ?? { kind: 'area' }),
                                  kind: 'area',
                                  area: { ...targeting.area!, width: Math.max(0, Number(e.target.value) || 0) },
                                },
                              })
                            }
                          />
                        </Field>
                      )}
                    </>
                  )}
                </div>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={isAttack}
                    disabled={readOnly}
                    onChange={(e) => toggleAttack(e.target.checked)}
                  />
                  <span>{t('ui.ability.attack')}</span>
                </label>
                {isAttack && ability.attack && (
                  <>
                    <div className="field-row">
                      <Field label={t('ui.ability.attackType')}>
                        <select
                          value={ability.attack.rangeType}
                          disabled={readOnly}
                          onChange={(e) => switchAttackType(e.target.value as 'melee' | 'ranged')}
                        >
                          <option value="melee">{t('ui.ability.melee')}</option>
                          <option value="ranged">{t('ui.ability.ranged')}</option>
                        </select>
                      </Field>
                      <Field label={t('ui.ability.bonus')}>
                        <input
                          type="text"
                          placeholder={t('ui.ability.fromStatblock')}
                          value={ability.attack.bonus ?? ''}
                          readOnly={readOnly}
                          onChange={(e) => patchAttack({ bonus: e.target.value || undefined })}
                        />
                      </Field>
                      <Field label={t('ui.ability.damage')}>
                        <input
                          type="text"
                          placeholder="2d6+3, 1d4fire"
                          title={t('ui.chat.damageHint')}
                          value={ability.attack.damage ?? ''}
                          readOnly={readOnly}
                          onChange={(e) => patchAttack({ damage: e.target.value || undefined })}
                        />
                      </Field>
                    </div>
                    {typeChips(ability.attack.types, (types) => patchAttack({ types }))}
                  </>
                )}

                {!isAttack && (
                  <>
                    <Field label={t('ui.ability.damage')}>
                      <input
                        type="text"
                        placeholder="2d6+3, 1d4fire"
                        title={t('ui.chat.damageHint')}
                        value={ability.damage?.dice ?? ''}
                        readOnly={readOnly}
                        onChange={(e) =>
                          patchAbility({
                            damage: e.target.value ? { ...(ability.damage ?? { dice: '' }), dice: e.target.value } : undefined,
                          })
                        }
                      />
                    </Field>
                    {ability.damage && typeChips(ability.damage.types, (types) => patchAbility({ damage: { ...ability.damage!, types } }))}
                  </>
                )}

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={isSave}
                    disabled={readOnly}
                    onChange={(e) => patchAbility({ save: e.target.checked ? { ability: 'con' } : undefined })}
                  />
                  <span>{t('ui.ability.save')}</span>
                </label>
                {isSave && ability.save && (
                  <div className="field-row">
                    <Field label={t('ui.ability.saveAbility')}>
                      <select
                        value={ability.save.ability}
                        disabled={readOnly}
                        onChange={(e) => patchAbility({ save: { ability: e.target.value as AbilityKey } })}
                      >
                        {ABILITIES.map((x) => (
                          <option key={x.key} value={x.key}>
                            {abilityName(x.key)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t('ui.ability.dc')}>
                      <input
                        type="number"
                        min={1}
                        max={40}
                        placeholder={t('ui.ability.fromStatblock')}
                        value={ability.dc ?? ''}
                        readOnly={readOnly}
                        onChange={(e) => patchAbility({ dc: e.target.value === '' ? undefined : Math.min(40, Math.max(1, Number(e.target.value))) })}
                      />
                    </Field>
                  </div>
                )}

                <Field label={t('ui.ability.effects')}>
                  <div className="ability-effects">
                    {(ability.effects ?? []).map((effect, i) => (
                      <div className="ability-effect" key={i}>
                        <select
                          value={effect.condition}
                          disabled={readOnly}
                          onChange={(e) =>
                            patchEffects(
                              (ability.effects ?? []).map((x, j) => (j === i ? { ...x, condition: e.target.value as ConditionKey } : x))
                            )
                          }
                        >
                          {CONDITION_KEYS.filter((c) => c !== 'custom' && c !== 'dead').map((c) => (
                            <option key={c} value={c}>
                              {conditionLabel(c)}
                            </option>
                          ))}
                        </select>
                        <select
                          value={durationKey(effect.duration)}
                          disabled={readOnly}
                          onChange={(e) =>
                            patchEffects(
                              (ability.effects ?? []).map((x, j) =>
                                j === i ? { ...x, duration: DURATIONS.find((d) => d.key === e.target.value)!.duration } : x
                              )
                            )
                          }
                        >
                          {DURATIONS.map((d) => (
                            <option key={d.key} value={d.key}>
                              {t(d.label)}
                            </option>
                          ))}
                        </select>
                        {!readOnly && (
                          <button
                            type="button"
                            className="weapon-remove"
                            onClick={() => patchEffects((ability.effects ?? []).filter((_, j) => j !== i))}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    {!readOnly && (
                      <button
                        type="button"
                        className="weapon-add"
                        onClick={() =>
                          patchEffects([...(ability.effects ?? []), { condition: 'poisoned', duration: { type: 'rounds', rounds: 10 } }])
                        }
                      >
                        {t('ui.ability.addEffect')}
                      </button>
                    )}
                  </div>
                </Field>
              </>
            )}
          </details>
        );
      })}

      {!readOnly && (
        <div className="ability-library">
          <select value={pickId} onChange={(e) => setPickId(e.target.value)}>
            <option value="">{t('ui.ability.pick')}</option>
            {MONSTER_ABILITIES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button type="button" className="weapon-add" disabled={!pickId || actions.length >= 50} onClick={addFromLibrary}>
            {t('ui.ability.addFromLibrary')}
          </button>
          <button type="button" className="weapon-add" onClick={addAbility}>
            {t('ui.ability.add')}
          </button>
        </div>
      )}

      {picking && spells && (
        <SpellPicker
          candidates={spells}
          title={t('ui.ability.spellPick')}
          levels={['all', 0, 1, 2, 3, 4, 5, 6]}
          stateOf={(s) => ({ added: s.key === picking.spellKey })}
          onToggle={(s) => {
            onChange(actions.map((x) => (x.id === picking.id ? { ...x, spellKey: s.key } : x)));
            setSpellFor(null);
          }}
          onClose={() => setSpellFor(null)}
        />
      )}
    </div>
  );
}
