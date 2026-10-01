import type { ReactNode } from 'react';
import {
  CONDITION_KEYS,
  DAMAGE_TYPES,
  type AbilityKey,
  type ConditionKey,
  type EffectTriggerSpec,
  type EffectTriggers,
  type TriggerAction,
  type ValueExpr,
} from 'shared';
import { t, type MessageKey } from '../i18n';
import { abilityName, conditionLabel, damageLabel } from '../i18n/domain';
import { Field } from './Field';

/** Реактивные события эффекта (`EffectTriggers`), редактируемые формой. */
const REACTIVE_EVENTS = [
  'targetedByAttack',
  'damaged',
  'hpReachedZero',
  'healReceived',
  'deathSave',
  'ownAttackRoll',
  'ownSpellCast',
  'ownDamageDealt',
  'willingMove',
  'saveSucceeded',
] as const;
type ReactiveEvent = (typeof REACTIVE_EVENTS)[number];

/** Операции триггеров с параметрами, редактируемыми формой (остальное — JSON). */
const TRIGGER_OPS = [
  'damage',
  'reduce',
  'extraDamage',
  'redirect',
  'endEffect',
  'repeatSave',
  'preventHeal',
  'maximizeHeal',
  'survive',
  'rollMode',
  'noDamageOnSuccess',
  'cancel',
  'reactionWard',
  'reactionSaveCondition',
  'save',
] as const;
type TriggerOpKind = (typeof TRIGGER_OPS)[number];

const blankOp = (kind: TriggerOpKind): TriggerAction => {
  switch (kind) {
    case 'damage':
      return { damage: { damageType: 'fire', to: 'source' } };
    case 'reduce':
      return { reduce: { dice: '1d4', types: [] } };
    case 'extraDamage':
      return { extraDamage: { dice: '1d6', damageType: 'force' } };
    case 'redirect':
      return { redirect: 'linked' };
    case 'endEffect':
      return { endEffect: true };
    case 'repeatSave':
      return { repeatSave: {} };
    case 'preventHeal':
      return { preventHeal: true };
    case 'maximizeHeal':
      return { maximizeHeal: true };
    case 'survive':
      return { survive: { hp: 1 } };
    case 'rollMode':
      return { rollMode: 'advantage' };
    case 'noDamageOnSuccess':
      return { noDamageOnSuccess: true };
    case 'cancel':
      return { cancel: true };
    case 'reactionWard':
      return { reaction: { kind: 'ward', types: [] } };
    case 'reactionSaveCondition':
      return { reaction: { kind: 'saveCondition', ability: 'wis', feet: 5, condition: 'charmed' } };
    case 'save':
      return { save: { ability: 'wis' } };
  }
};

const opKind = (op: TriggerAction): TriggerOpKind => {
  if ('save' in op) return 'save';
  if ('damage' in op) return 'damage';
  if ('reduce' in op) return 'reduce';
  if ('extraDamage' in op) return 'extraDamage';
  if ('redirect' in op) return 'redirect';
  if ('endEffect' in op) return 'endEffect';
  if ('repeatSave' in op) return 'repeatSave';
  if ('preventHeal' in op) return 'preventHeal';
  if ('maximizeHeal' in op) return 'maximizeHeal';
  if ('survive' in op) return 'survive';
  if ('rollMode' in op) return 'rollMode';
  if ('noDamageOnSuccess' in op) return 'noDamageOnSuccess';
  if ('cancel' in op) return 'cancel';
  if ('reaction' in op) return op.reaction.kind === 'ward' ? 'reactionWard' : 'reactionSaveCondition';
  return 'damage';
};

const literalText = (value: ValueExpr | undefined): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

const toggleType = (types: ValueExpr[], key: string): ValueExpr[] =>
  types.some((type) => type === key) ? types.filter((type) => type !== key) : [...types, key];

const ABILITY_KEYS: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

const isGated = (entry: unknown): boolean => typeof entry === 'object' && entry !== null && 'if' in entry;

/**
 * Редактор триггеров эффекта (общий для эффектов записи и `weaponAttack.hitEffect`):
 * тёрн-слоты и реактивные события; вложенное/гейты — JSON.
 */
export default function EffectTriggersEditor({
  triggers,
  onChange,
}: {
  triggers: EffectTriggers | undefined;
  onChange: (triggers: EffectTriggers | undefined) => void;
}) {
  const current = triggers ?? {};
  const update = (next: EffectTriggers) => onChange(Object.keys(next).length ? next : undefined);
  const setEventOps = (event: ReactiveEvent, ops: TriggerAction[]) => {
    const next: EffectTriggers = { ...current };
    const wasArray = Array.isArray(next[event]);
    if (ops.length) next[event] = wasArray || ops.length > 1 ? ops : ops[0]!;
    else delete next[event];
    update(next);
  };
  const setTurnSlot = (slot: 'startOfTurn' | 'endOfTurn', spec: EffectTriggerSpec | null) => {
    const next: EffectTriggers = { ...current };
    if (spec) next[slot] = spec;
    else delete next[slot];
    update(next);
  };
  const eventList = (event: ReactiveEvent): (TriggerAction | { if: ValueExpr; then: TriggerAction })[] => {
    const entry = current[event];
    if (!entry) return [];
    return Array.isArray(entry) ? entry : [entry];
  };
  const patchOp = (event: ReactiveEvent, opIndex: number, op: TriggerAction) => {
    const list = [...eventList(event)];
    list[opIndex] = op;
    setEventOps(event, list as TriggerAction[]);
  };
  const removeOp = (event: ReactiveEvent, opIndex: number) => {
    setEventOps(
      event,
      eventList(event).filter((_, i) => i !== opIndex) as TriggerAction[]
    );
  };
  const addOp = (event: ReactiveEvent, kind: TriggerOpKind) => {
    setEventOps(event, [...eventList(event), blankOp(kind)] as TriggerAction[]);
  };
  /** Параметры операции триггера, редактируемые формой (вложенное/гейты — JSON). */
  const opParams = (event: ReactiveEvent, opIndex: number, op: TriggerAction): ReactNode => {
    const set = (next: TriggerAction) => patchOp(event, opIndex, next);
    switch (opKind(op)) {
      case 'damage': {
        const dmg = (op as { damage: { damageType: ValueExpr; to: 'source' | 'self' } }).damage;
        return (
          <>
            <select
              value={literalText(dmg.damageType)}
              onChange={(e) => set({ damage: { ...dmg, damageType: e.target.value } })}
            >
              {!literalText(dmg.damageType) && <option value="">{t('ui.constructor.triggerRaw')}</option>}
              {DAMAGE_TYPES.map((damage) => (
                <option key={damage.key} value={damage.key}>
                  {damageLabel(damage.key)}
                </option>
              ))}
            </select>
            <select
              value={dmg.to}
              onChange={(e) => set({ damage: { ...dmg, to: e.target.value as 'source' | 'self' } })}
            >
              <option value="source">{t('ui.constructor.triggerTo.source')}</option>
              <option value="self">{t('ui.constructor.triggerTo.self')}</option>
            </select>
          </>
        );
      }
      case 'reduce': {
        const red = (op as { reduce: { dice: ValueExpr; types: ValueExpr[] } }).reduce;
        return (
          <>
            <input
              type="text"
              placeholder="1d4"
              value={literalText(red.dice)}
              disabled={!literalText(red.dice)}
              onChange={(e) => set({ reduce: { ...red, dice: e.target.value.trim() } })}
            />
            {DAMAGE_TYPES.map((damage) => {
              const checked = red.types.some((type) => type === damage.key);
              return (
                <button
                  type="button"
                  key={damage.key}
                  className={`ability-type${checked ? ' on' : ''}`}
                  onClick={() => set({ reduce: { ...red, types: toggleType(red.types, damage.key) } })}
                >
                  {damageLabel(damage.key)}
                </button>
              );
            })}
          </>
        );
      }
      case 'extraDamage': {
        const extra = (
          op as { extraDamage: { dice: ValueExpr; damageType: ValueExpr; from?: 'source'; oncePerTurn?: boolean } }
        ).extraDamage;
        return (
          <>
            <input
              type="text"
              placeholder="1d6"
              value={literalText(extra.dice)}
              onChange={(e) => set({ extraDamage: { ...extra, dice: e.target.value.trim() } })}
            />
            <select
              value={literalText(extra.damageType)}
              onChange={(e) => set({ extraDamage: { ...extra, damageType: e.target.value } })}
            >
              {DAMAGE_TYPES.map((damage) => (
                <option key={damage.key} value={damage.key}>
                  {damageLabel(damage.key)}
                </option>
              ))}
            </select>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={extra.oncePerTurn === true}
                onChange={(e) => set({ extraDamage: { ...extra, oncePerTurn: e.target.checked || undefined } })}
              />
              <span>{t('ui.constructor.triggerOncePerTurn')}</span>
            </label>
            <select
              value={extra.from ?? ''}
              onChange={(e) =>
                set({ extraDamage: { ...extra, from: (e.target.value || undefined) as 'source' | undefined } })
              }
            >
              <option value="">{t('ui.constructor.triggerFrom.self')}</option>
              <option value="source">{t('ui.constructor.triggerFrom.source')}</option>
            </select>
          </>
        );
      }
      case 'survive': {
        // Тип фиксирует `hp: 1` (Death Ward) — значение не редактируется.
        return <input type="number" min={1} value={1} disabled />;
      }
      case 'reactionWard': {
        const ward = (op as { reaction: { kind: 'ward'; types: ValueExpr[] } }).reaction;
        return (
          <>
            {DAMAGE_TYPES.map((damage) => {
              const checked = ward.types.some((type) => type === damage.key);
              return (
                <button
                  type="button"
                  key={damage.key}
                  className={`ability-type${checked ? ' on' : ''}`}
                  onClick={() => set({ reaction: { kind: 'ward', types: toggleType(ward.types, damage.key) } })}
                >
                  {damageLabel(damage.key)}
                </button>
              );
            })}
          </>
        );
      }
      case 'reactionSaveCondition': {
        const reaction = (
          op as { reaction: { kind: 'saveCondition'; ability: ValueExpr; feet: number; condition: ConditionKey } }
        ).reaction;
        return (
          <>
            <select
              value={literalText(reaction.ability)}
              onChange={(e) => set({ reaction: { ...reaction, ability: e.target.value } })}
            >
              {ABILITY_KEYS.map((key) => (
                <option key={key} value={key}>
                  {abilityName(key)}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              value={reaction.feet}
              onChange={(e) => set({ reaction: { ...reaction, feet: Number(e.target.value) || 0 } })}
            />
            <select
              value={reaction.condition}
              onChange={(e) => set({ reaction: { ...reaction, condition: e.target.value as ConditionKey } })}
            >
              {CONDITION_KEYS.map((key) => (
                <option key={key} value={key}>
                  {conditionLabel(key)}
                </option>
              ))}
            </select>
          </>
        );
      }
      case 'save': {
        const save = (op as { save: { ability: AbilityKey; onFail?: TriggerAction[]; onSuccess?: TriggerAction[] } })
          .save;
        return (
          <>
            <select value={save.ability} onChange={(e) => set({ save: { ...save, ability: e.target.value as AbilityKey } })}>
              {ABILITY_KEYS.map((key) => (
                <option key={key} value={key}>
                  {abilityName(key)}
                </option>
              ))}
            </select>
            {(save.onFail?.length || save.onSuccess?.length) && (
              <span className="hint">{t('ui.constructor.triggerNested')}</span>
            )}
          </>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="constructor-triggers">
      <div className="constructor-chip-title">{t('ui.constructor.triggers')}</div>
      {REACTIVE_EVENTS.map((event) => {
        const list = eventList(event);
        const enabled = list.length > 0;
        return (
          <div className="constructor-trigger-event" key={event}>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEventOps(event, e.target.checked ? [blankOp('damage')] : [])}
              />
              <span>{t(`ui.constructor.triggerEvent.${event}` as MessageKey)}</span>
            </label>
            {enabled && (
              <>
                {list.map((entry, opIndex) => {
                  if (isGated(entry)) {
                    return (
                      <p className="hint" key={opIndex}>
                        {t('ui.constructor.triggerGated')}
                      </p>
                    );
                  }
                  const op = entry as TriggerAction;
                  return (
                    <div className="field-row constructor-trigger-op" key={opIndex}>
                      <select
                        value={opKind(op)}
                        onChange={(e) => patchOp(event, opIndex, blankOp(e.target.value as TriggerOpKind))}
                      >
                        {TRIGGER_OPS.map((kind) => (
                          <option key={kind} value={kind}>
                            {t(`ui.constructor.triggerOp.${kind}` as MessageKey)}
                          </option>
                        ))}
                      </select>
                      {opParams(event, opIndex, op)}
                      <button type="button" onClick={() => removeOp(event, opIndex)}>
                        {t('ui.constructor.remove')}
                      </button>
                    </div>
                  );
                })}
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) addOp(event, e.target.value as TriggerOpKind);
                  }}
                >
                  <option value="">{t('ui.constructor.triggerAdd')}</option>
                  {TRIGGER_OPS.map((kind) => (
                    <option key={kind} value={kind}>
                      {t(`ui.constructor.triggerOp.${kind}` as MessageKey)}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        );
      })}
      {(['startOfTurn', 'endOfTurn'] as const).map((slot) => {
        const entry = current[slot];
        const spec = entry && !isGated(entry) ? (entry as EffectTriggerSpec) : undefined;
        return (
          <div className="constructor-trigger-event" key={slot}>
            <label className="checkbox-row">
              <input type="checkbox" checked={!!spec} onChange={(e) => setTurnSlot(slot, e.target.checked ? {} : null)} />
              <span>{t(`ui.constructor.usage.${slot}` as MessageKey)}</span>
            </label>
            {spec && (
              <div className="field-row">
                <Field label={t('ui.constructor.triggerTempHp')}>
                  <input
                    type="text"
                    value={literalText(spec.tempHp)}
                    disabled={spec.tempHp !== undefined && !literalText(spec.tempHp)}
                    onChange={(e) => setTurnSlot(slot, { ...spec, tempHp: e.target.value.trim() || undefined })}
                  />
                </Field>
                {spec.damage && 'dice' in spec.damage && (
                  <>
                    <Field label={t('ui.constructor.damageDice')}>
                      <input
                        type="text"
                        value={literalText(spec.damage.dice)}
                        disabled={!literalText(spec.damage.dice)}
                        onChange={(e) =>
                          setTurnSlot(slot, {
                            ...spec,
                            damage: {
                              ...(spec.damage as { dice: ValueExpr; types?: ValueExpr[] }),
                              dice: e.target.value.trim(),
                            },
                          })
                        }
                      />
                    </Field>
                    {DAMAGE_TYPES.map((damage) => {
                      const types = (spec.damage as { types?: ValueExpr[] }).types ?? [];
                      const checked = types.some((type) => type === damage.key);
                      return (
                        <button
                          type="button"
                          key={damage.key}
                          className={`ability-type${checked ? ' on' : ''}`}
                          onClick={() =>
                            setTurnSlot(slot, {
                              ...spec,
                              damage: {
                                ...(spec.damage as { dice: ValueExpr; types?: ValueExpr[] }),
                                types: toggleType(types, damage.key),
                              },
                            })
                          }
                        >
                          {damageLabel(damage.key)}
                        </button>
                      );
                    })}
                  </>
                )}
                {spec.damage && 'parts' in spec.damage && (
                  <span className="hint">{t('ui.constructor.triggerGated')}</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
