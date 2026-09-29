import type { AutomationDef, AutomationDice, AutomationEffect, AutomationPayload, AutomationUtility, GrantedAction, ZoneDef } from '../../domain/automation';
import type { AbilityKey } from '../../domain/core';
import type { ConditionKey, Modifier, TriggerEvent, TriggerInstance } from '../../domain/effects';
import { ABILITIES, DAMAGE_TYPES, SKILLS } from '../../labels';
import { CONDITION_KEYS } from '../conditions';
import type { Spell } from '../spells';
import { spellCantripDice, spellDamageExpression, spellMaxRounds, spellUpcastAt, wallAreaOf, WALL_DIMS } from '../spellCast';
import { addDiceExpression, scaledDice, upcastSteps } from './helpers';
import type {
  ActionSpec,
  AutomationSpec,
  AutomationSpecCopy,
  ChoiceSpec,
  DamageSpec,
  EffectSpec,
  EffectTriggerSpec,
  EffectTriggers,
  Gated,
  LoadoutSpec,
  ModifierSpec,
  PayloadSpec,
  TriggerAction,
  TriggerList,
  UsesSpec,
  UtilitySpec,
  ValueExpr,
  WeaponAttackSpec,
  ZoneSpec,
} from './spec';
import { AUTOMATION_SPECS } from './specs';
import type { AutomationOptions } from './variants';

/** Контекст компиляции: заклинание + опции каста (R16, `AUTOMATION.md` §7). */
export interface CompileInput {
  spell: Spell;
  opts: AutomationOptions;
}

interface CompileCtx extends CompileInput {
  spec: AutomationSpec;
  castLevel: number;
  characterLevel: number;
}

/** Выбор варианта при касте: `opts.variant` (если допустим), иначе default/первый. */
function choiceValue(spec: AutomationSpec, opts: AutomationOptions, id?: string): string | undefined {
  const choice = id ? spec.choices?.find((c) => c.id === id) : spec.choices?.[0];
  if (!choice) return undefined;
  if (opts.variant && choice.options.includes(opts.variant)) return opts.variant;
  return choice.default ?? choice.options[0];
}

/** Резолв `ValueExpr`: строка/число либо `undefined` (поле будет опущено). */
function resolveValue(ctx: CompileCtx, expr: ValueExpr | undefined): string | number | undefined {
  if (expr === undefined) return undefined;
  if (typeof expr === 'string' || typeof expr === 'number') return expr;
  if ('concat' in expr) {
    const parts: (string | number)[] = [];
    for (const item of expr.concat) {
      const value = resolveValue(ctx, item);
      if (value === undefined) return undefined;
      parts.push(value);
    }
    return parts.join('');
  }
  if ('add' in expr) {
    const base = resolveValue(ctx, expr.add[0]);
    const extra = resolveValue(ctx, expr.add[1]);
    if (extra === undefined) return base;
    if (base === undefined) return extra;
    return addDiceExpression(String(base), String(extra));
  }
  if ('sum' in expr) {
    let total = 0;
    for (const item of expr.sum) {
      const value = resolveValue(ctx, item);
      total += typeof value === 'number' ? value : value !== undefined ? Number(value) || 0 : 0;
    }
    return total;
  }
  if ('includes' in expr) {
    const value = resolveValue(ctx, expr.includes.of);
    return value !== undefined && expr.includes.values.includes(String(value)) ? '1' : '';
  }
  if ('tiers' in expr) {
    const tier = [...expr.tiers].filter((t) => ctx.castLevel >= t.above).pop();
    return tier?.value;
  }
  if ('perLevel' in expr) {
    const above = expr.perLevel.above === 'spell' ? ctx.spell.level : expr.perLevel.above;
    const value = expr.perLevel.base + expr.perLevel.per * Math.max(0, ctx.castLevel - above);
    return expr.perLevel.optional && value === 0 ? undefined : value;
  }
  if ('spellMod' in expr) {
    return Math.max(expr.spellMod.min ?? Number.NEGATIVE_INFINITY, expr.spellMod.base + Math.round(ctx.opts.spellMod ?? 0));
  }
  if ('scale' in expr) {
    const base = resolveValue(ctx, expr.scale.dice);
    if (base === undefined) return undefined;
    const extra = expr.scale.by === 'upcast' ? ctx.spell.upcast?.dice : expr.scale.by.dice;
    return scaledDice(String(base), extra, upcastSteps(ctx.spell, ctx.castLevel));
  }
  if ('mapped' in expr) {
    const key = resolveValue(ctx, expr.mapped.of);
    const mapped = key !== undefined ? expr.mapped.values[String(key)] : undefined;
    if (mapped !== undefined) return mapped;
    return expr.mapped.fallback !== undefined ? resolveValue(ctx, expr.mapped.fallback) : undefined;
  }
  if ('join' in expr) {
    const parts: (string | number)[] = [];
    for (const item of expr.join.parts) {
      const value = resolveValue(ctx, item);
      if (value !== undefined) parts.push(value);
    }
    return parts.length ? parts.join(expr.join.sep) : undefined;
  }
  let value: string | number | undefined;
  switch (expr.ref) {
    case 'cantrip':
      value = spellCantripDice(ctx.spell, ctx.characterLevel);
      break;
    case 'damage':
      value = ctx.spell.damage?.dice?.[0];
      break;
    case 'part': {
      const list = (ctx.spell.damage?.parts ?? []).filter((p) => p.role === expr.part);
      const part = expr.index !== undefined ? list[expr.index] : list[0];
      value = part?.dice;
      break;
    }
    case 'upcastDice':
      value = spellUpcastAt(ctx.spell, ctx.castLevel).dice;
      break;
    case 'spellDamage':
      value = spellDamageExpression(ctx.spell, ctx.castLevel, ctx.characterLevel) ?? undefined;
      break;
    case 'upcastAttack':
      value = spellUpcastAt(ctx.spell, ctx.castLevel).attack;
      break;
    case 'upcastFlat':
      value = spellUpcastAt(ctx.spell, ctx.castLevel).flat;
      break;
    case 'type0':
      value = ctx.spell.damage?.types?.[0];
      break;
    case 'spellMod':
      value = ctx.opts.spellMod;
      break;
    case 'castLevel':
      value = ctx.castLevel;
      break;
    case 'characterLevel':
      value = ctx.characterLevel;
      break;
    case 'choice': {
      const choice = expr.choice ? ctx.spec.choices?.find((c) => c.id === expr.choice) : ctx.spec.choices?.[0];
      value = choiceValue(ctx.spec, ctx.opts, expr.choice);
      // `optional` — поле только при явно выбранном варианте этого выбора
      // (вариант другого выбора его не включает).
      const explicit = ctx.opts.variant !== undefined && choice?.options.includes(ctx.opts.variant) === true;
      if (value !== undefined && expr.optional && !explicit) value = undefined;
      break;
    }
  }
  if (value === undefined && expr.fallback !== undefined) return resolveValue(ctx, expr.fallback);
  return value;
}

/** Обязательное значение: не резолвилось — ошибка компиляции (а не молчаливое поле). */
function mustValue(ctx: CompileCtx, expr: ValueExpr, label: string): string | number {
  const value = resolveValue(ctx, expr);
  if (value === undefined) throw new Error(`AutomationSpec ${ctx.spec.key}: не резолвится ${label}`);
  return value;
}

function compileLoadout(ctx: CompileCtx, loadout: LoadoutSpec): Partial<AutomationEffect> {
  if (loadout.kind === 'weaponOverride') {
    return {
      weaponOverride: {
        weapons: [...loadout.weapons],
        dice: String(mustValue(ctx, loadout.dice, 'loadout.dice')),
        damageType: String(mustValue(ctx, loadout.damageType, 'loadout.damageType')),
        abilityMod: Number(mustValue(ctx, loadout.abilityMod, 'loadout.abilityMod')),
      },
    };
  }
  if (loadout.kind === 'shadowBlade') {
    return {
      shadowBlade: { dice: String(mustValue(ctx, loadout.dice, 'loadout.dice')), inHand: loadout.inHand },
    };
  }
  const filter = { weapon: true, unarmed: false };
  const modifiers: AutomationEffect['modifiers'] = [];
  if (loadout.attack !== undefined) {
    modifiers.push({ target: 'attack', mode: 'add', value: mustValue(ctx, loadout.attack, 'loadout.attack'), filter });
  }
  if (loadout.damage !== undefined) {
    modifiers.push({ target: 'damage', mode: 'add', value: mustValue(ctx, loadout.damage, 'loadout.damage'), filter });
  }
  return { modifiers, ...(loadout.magic ? { magicWeapon: true } : {}) };
}

/** Блок `selection`: всплеск вокруг цели (Ice Knife) с резолвом кости/типа. */
function compileBurst(
  ctx: CompileCtx,
  burst: NonNullable<AutomationSpec['burst']>
): NonNullable<AutomationDef['burst']> {
  const dice = burst.dice !== undefined ? resolveValue(ctx, burst.dice) : undefined;
  return {
    rangeFeet: burst.rangeFeet,
    damageType: String(mustValue(ctx, burst.damageType, 'burst.damageType')),
    ...(dice !== undefined ? { dice: String(dice) } : {}),
    ...(burst.save ? { save: { ...burst.save } } : {}),
    ...(burst.includePrimary ? { includePrimary: true } : {}),
  };
}

/** Блок `utility`: кости провала/вспышки резолвятся, остальное — pass-through. */
function compileUtility(ctx: CompileCtx, utility: UtilitySpec): AutomationUtility {
  const { blockedDamage, fromBurst, dice, ...rest } = utility;
  return {
    ...rest,
    ...(dice !== undefined ? { dice: String(mustValue(ctx, dice, 'utility.dice')) } : {}),
    ...(blockedDamage ? { blockedDamage: compileDamage(ctx, blockedDamage) } : {}),
    ...(fromBurst
      ? {
          fromBurst: {
            feet: fromBurst.feet,
            save: { ...fromBurst.save },
            ...(fromBurst.damage ? { damage: compileDamage(ctx, fromBurst.damage) } : {}),
          },
        }
      : {}),
  };
}

function compileAction(ctx: CompileCtx, action: ActionSpec): GrantedAction {
  // Ссылка на базовое действие каталога (Рывок/Отход): своя механика не нужна.
  if (action.baseActionId) {
    return {
      id: action.id,
      name: action.name,
      cost: action.cost,
      baseActionId: action.baseActionId,
      ...(action.shrinkFeet !== undefined ? { shrinkFeet: action.shrinkFeet } : {}),
      ...(action.endsEffect ? { endsEffect: true } : {}),
    };
  }
  if (!action.primary) throw new Error(`AutomationSpec ${ctx.spec.key}: action.${action.id} без primary/baseActionId`);
  const dice = action.damage ? resolveValue(ctx, action.damage.dice) : undefined;
  const area =
    action.area === undefined
      ? undefined
      : 'from' in action.area
        ? (ctx.spell.areaSpec ?? action.area.fallback)
        : action.area;
  const targeting =
    action.targeting && 'fromArea' in action.targeting
      ? area
        ? { kind: 'area' as const, area, range: Math.max(5, area.size) }
        : undefined
      : action.targeting;
  const damage =
    action.damage && dice !== undefined
      ? {
          damage: {
            dice: String(dice),
            ...(action.damage.types?.length
              ? { types: action.damage.types.map((t) => String(mustValue(ctx, t, `action.${action.id}.damage.types`))) }
              : {}),
            ...(action.damage.abilityMod ? { abilityMod: true } : {}),
          },
        }
      : {};
  const def: AutomationDef = {
    key: action.defKey ?? (action.subKey ? `${ctx.spec.key}:${action.subKey}` : ctx.spec.key),
    name: action.defName ?? action.name,
    resolution: action.primary,
    ...(action.attack ? { attack: { ...action.attack } } : {}),
    ...(action.save ? { save: { ...action.save } } : {}),
    ...(area ? { area } : {}),
    ...damage,
    ...(action.count !== undefined ? { count: action.count } : {}),
    ...(action.lifesteal ? { lifesteal: true } : {}),
    ...(action.banishOnFail ? { banishOnFail: true } : {}),
    ...(action.requiresCreatureTypes?.length ? { requiresCreatureTypes: [...action.requiresCreatureTypes] } : {}),
    ...(action.effects?.length ? { effects: action.effects.map((e) => compileEffect(ctx, e)) } : {}),
    ...(action.retarget ? { retarget: true } : {}),
    ...(targeting ? { targeting: { ...targeting } } : {}),
    ...(action.utility ? { utility: compileUtility(ctx, action.utility) } : {}),
  };
  return {
    id: action.id,
    name: action.name,
    cost: action.cost,
    def,
    ...(action.shrinkFeet !== undefined ? { shrinkFeet: action.shrinkFeet } : {}),
    ...(action.endsEffect ? { endsEffect: true } : {}),
  };
}

function compileUses(ctx: CompileCtx, uses: UsesSpec): Partial<AutomationEffect> {
  if (uses.kind === 'charges') {
    return {
      charges: { count: Number(mustValue(ctx, uses.count, 'uses.count')), ...(uses.on ? { on: uses.on } : {}) },
    };
  }
  if (uses.kind === 'consumeOnAttack') return { consumeOnAttackRoll: true };
  if (uses.kind === 'consumeOnSave') return { consumeOnSave: true };
  return { misdirect: { charges: uses.charges, die: uses.die, threshold: uses.threshold } };
}

/** Резолв `Leveled<T>`: ближайшая ступень `above` (включительно) либо fallback. */
function resolveLeveled<T>(ctx: CompileCtx, value: T | { levels: { above: number; value: T }[]; fallback?: T }): T | undefined {
  if (value && typeof value === 'object' && 'levels' in (value as object)) {
    const leveled = value as { levels: { above: number; value: T }[]; fallback?: T };
    const tier = leveled.levels.filter((t) => ctx.castLevel >= t.above).pop();
    return tier ? tier.value : leveled.fallback;
  }
  return value as T;
}

/** Элемент списка с гейтом `{ if, then }`: гейт пуст — элемент опускается. */
function compileGated<TIn, TOut>(
  ctx: CompileCtx,
  entry: TIn | { if: ValueExpr; then: TIn },
  compile: (value: TIn) => TOut
): TOut | undefined {
  if (entry && typeof entry === 'object' && 'if' in entry && 'then' in entry) {
    return resolveValue(ctx, entry.if) ? compile(entry.then) : undefined;
  }
  return compile(entry as TIn);
}

function compileModifier(ctx: CompileCtx, spec: ModifierSpec): Omit<Modifier, 'id'> {
  const { value, filter, ...rest } = spec;
  const out: Omit<Modifier, 'id'> = { ...rest };
  if (value !== undefined) out.value = mustValue(ctx, value, 'modifier.value');
  if (filter) {
    const { damageType, ability, skill, ...restFilter } = filter;
    out.filter = {
      ...restFilter,
      ...(damageType !== undefined ? { damageType: String(mustValue(ctx, damageType, 'modifier.filter.damageType')) } : {}),
      ...(ability !== undefined ? { ability: String(mustValue(ctx, ability, 'modifier.filter.ability')) as AbilityKey } : {}),
      ...(skill !== undefined ? { skill: String(mustValue(ctx, skill, 'modifier.filter.skill')) } : {}),
    };
  }
  return out;
}

/** Обрыв эффекта собственными действиями носителя (`triggers.own*`). */
const BREAK_ON_EVENTS: (keyof EffectTriggers)[] = ['ownAttackRoll', 'ownSpellCast', 'ownDamageDealt'];

/**
 * Блок `triggers`: события × операции → runtime-триггеры (R16, `AUTOMATION.md` §3.2).
 * Одна операция каждого вида на эффект: дубль — ошибка компиляции, а не тихая перезапись.
 */
function compileTriggers(ctx: CompileCtx, triggers: EffectTriggers, effectId: string): Partial<AutomationEffect> {
  const out: TriggerInstance[] = [];
  const used = new Set<string>();
  const pushOnce = (op: string, trigger: TriggerInstance, at: string) => {
    if (used.has(op)) throw new Error(`AutomationSpec ${ctx.spec.key}: ${at} — операция ${op} уже задана`);
    used.add(op);
    out.push(trigger);
  };
  const actionsOf = (name: keyof EffectTriggers): Gated<TriggerAction>[] => {
    const list = triggers[name] as TriggerList | undefined;
    if (!list) return [];
    return Array.isArray(list) ? list : [list];
  };
  /** Компилирует операции события: гейты `{ if, then }` решаются здесь (как у прочих блоков). */
  const event = (
    name: keyof EffectTriggers,
    build: (action: TriggerAction, at: string) => { op: string; trigger: TriggerInstance } | undefined
  ) => {
    actionsOf(name).forEach((entry, index) => {
      const at = `triggers.${name}[${index}]`;
      const result = compileGated(ctx, entry, (action) => build(action, at));
      if (result) pushOnce(result.op, result.trigger, at);
    });
  };

  event('targetedByAttack', (action, at) => {
    if (!('save' in action)) throw new Error(`AutomationSpec ${ctx.spec.key}: ${at} — только save`);
    const { ability, dc, onFail, onSuccess } = action.save;
    const cancels = (onFail ?? []).some((op) => 'cancel' in op && op.cancel);
    if (ability !== 'wis' || dc !== undefined || onSuccess || !cancels) {
      throw new Error(
        `AutomationSpec ${ctx.spec.key}: ${at} — поддержан только спас WIS с onFail cancel (Sanctuary)`
      );
    }
    return { op: 'sanctuary', trigger: { on: 'targetedByAttack', save: { ability: 'wis' } } };
  });

  event('damaged', (action, at) => {
    if ('reduce' in action) {
      return {
        op: 'reduce',
        trigger: {
          on: 'damaged',
          reduce: {
            dice: String(mustValue(ctx, action.reduce.dice, at)),
            types: action.reduce.types.map((t) => String(mustValue(ctx, t, at))),
          },
        },
      };
    }
    if ('damage' in action) {
      if (action.damage.to !== 'source') {
        throw new Error(`AutomationSpec ${ctx.spec.key}: ${at} — damaged принимает damage to:'source'`);
      }
      return {
        op: 'retaliate',
        trigger: {
          on: 'damaged',
          damage: {
            to: 'source',
            damageType: String(mustValue(ctx, action.damage.damageType, at)),
            ...(action.damage.dice ? { dice: String(mustValue(ctx, action.damage.dice, at)) } : {}),
            ...(action.damage.amount !== undefined ? { amount: Number(mustValue(ctx, action.damage.amount, at)) } : {}),
          },
        },
      };
    }
    if ('extraDamage' in action) {
      const { dice, damageType, from, oncePerTurn } = action.extraDamage;
      const payload = { dice: String(mustValue(ctx, dice, at)), damageType: String(mustValue(ctx, damageType, at)) };
      if (oncePerTurn && !from) {
        return { op: 'elementalBane', trigger: { on: 'damaged', extraDamage: { ...payload, oncePerTurn: true } } };
      }
      if (from === 'source' && !oncePerTurn) {
        return { op: 'takesExtraDamage', trigger: { on: 'damaged', extraDamage: { ...payload, from: 'source' } } };
      }
      throw new Error(`AutomationSpec ${ctx.spec.key}: ${at} — extraDamage: либо oncePerTurn, либо from:'source'`);
    }
    if ('endEffect' in action) return { op: 'wakeOnDamage', trigger: { on: 'damaged', endEffect: true } };
    if ('repeatSave' in action) {
      return { op: 'repeatSave', trigger: { on: 'damaged', repeatSave: { ...action.repeatSave } } };
    }
    if ('redirect' in action) return { op: 'damageLink', trigger: { on: 'damaged', redirect: 'linked' } };
    if ('reaction' in action) {
      if (action.reaction.kind === 'ward') {
        return {
          op: 'ward',
          trigger: {
            on: 'damaged',
            reaction: { kind: 'ward', types: action.reaction.types.map((t) => String(mustValue(ctx, t, at))) },
          },
        };
      }
      return {
        op: 'damageReaction',
        trigger: {
          on: 'damaged',
          reaction: {
            kind: 'saveCondition',
            ability: String(mustValue(ctx, action.reaction.ability, at)) as AbilityKey,
            feet: action.reaction.feet,
            condition: action.reaction.condition,
          },
        },
      };
    }
    throw new Error(`AutomationSpec ${ctx.spec.key}: ${at} — операция недопустима для damaged`);
  });

  event('hpReachedZero', (action, at) => {
    if (!('survive' in action) || action.survive.hp !== 1) {
      throw new Error(`AutomationSpec ${ctx.spec.key}: ${at} — поддержан только survive { hp: 1 }`);
    }
    return { op: 'deathWard', trigger: { on: 'hpReachedZero', survive: { hp: 1 } } };
  });

  event('healReceived', (action, at) => {
    if ('preventHeal' in action) return { op: 'noHeal', trigger: { on: 'healReceived', preventHeal: true } };
    if ('maximizeHeal' in action) {
      return { op: 'maximizeHealing', trigger: { on: 'healReceived', maximizeHeal: true } };
    }
    throw new Error(`AutomationSpec ${ctx.spec.key}: ${at} — только preventHeal/maximizeHeal`);
  });

  event('deathSave', (action, at) => {
    if ('rollMode' in action && action.rollMode === 'advantage') {
      return { op: 'deathSaveAdvantage', trigger: { on: 'deathSave', rollMode: 'advantage' } };
    }
    throw new Error(`AutomationSpec ${ctx.spec.key}: ${at} — только rollMode 'advantage'`);
  });

  event('saveSucceeded', (action, at) => {
    if ('noDamageOnSuccess' in action) {
      return { op: 'saveNoDamage', trigger: { on: 'saveSucceeded', noDamageOnSuccess: true } };
    }
    throw new Error(`AutomationSpec ${ctx.spec.key}: ${at} — только noDamageOnSuccess`);
  });

  event('willingMove', (action, at) => {
    if (!('damage' in action) || action.damage.to !== 'self') {
      throw new Error(`AutomationSpec ${ctx.spec.key}: ${at} — willingMove принимает damage to:'self'`);
    }
    if (action.damage.dice === undefined) {
      throw new Error(`AutomationSpec ${ctx.spec.key}: ${at} — willingMove требует dice`);
    }
    return {
      op: 'willingMove',
      trigger: {
        on: 'willingMove',
        damage: {
          to: 'self',
          dice: String(mustValue(ctx, action.damage.dice, at)),
          damageType: String(mustValue(ctx, action.damage.damageType, at)),
          feet: action.damage.feet ?? 5,
        },
      },
    };
  });

  for (const name of BREAK_ON_EVENTS) {
    event(name, (action, at) => {
      if (!('endEffect' in action)) throw new Error(`AutomationSpec ${ctx.spec.key}: ${at} — поддержан только endEffect`);
      return { op: name, trigger: { on: name as TriggerEvent, endEffect: true } };
    });
  }

  const triggerSlot = (on: 'startOfTurn' | 'endOfTurn', entry: Gated<EffectTriggerSpec> | undefined) => {
    if (entry === undefined) return;
    const payload = compileGated(ctx, entry, (t) => {
      const tempHp = t.tempHp !== undefined ? Number(mustValue(ctx, t.tempHp, `effect.${effectId}.triggers`)) : undefined;
      const damage = t.damage ? compileDamage(ctx, t.damage) : undefined;
      return { ...(tempHp ? { tempHp } : {}), ...(damage ? { damage } : {}) };
    });
    if (payload && Object.keys(payload).length) out.push({ on, turn: payload });
  };
  triggerSlot('startOfTurn', triggers.startOfTurn);
  triggerSlot('endOfTurn', triggers.endOfTurn);
  return out.length ? { triggers: out } : {};
}

function compileEffect(ctx: CompileCtx, effect: EffectSpec): AutomationEffect {
  const loadout = effect.loadout ? compileLoadout(ctx, effect.loadout) : {};
  const gated = (effect.modifiers ?? [])
    .map((entry) => compileGated(ctx, entry, (m) => compileModifier(ctx, m)))
    .filter((m): m is Omit<Modifier, 'id'> => m !== undefined);
  const modifiers = [...gated, ...(loadout.modifiers ?? [])];
  const variant = effect.variant !== undefined ? resolveValue(ctx, effect.variant) : undefined;
  const conditions = (effect.conditions ?? [])
    .map((entry) => compileGated(ctx, entry, (c) => String(mustValue(ctx, c, `effect.${effect.id}.conditions`)) as ConditionKey))
    .filter((c): c is ConditionKey => c !== undefined);
  const conditionImmunities = (effect.conditionImmunities ?? [])
    .map((entry) =>
      compileGated(ctx, entry, (c) => String(mustValue(ctx, c, `effect.${effect.id}.conditionImmunities`)) as ConditionKey)
    )
    .filter((c): c is ConditionKey => c !== undefined);
  const escape = effect.escape
    ? {
        ...(effect.escape.kind ? { kind: effect.escape.kind } : {}),
        ability: String(mustValue(ctx, effect.escape.ability, `effect.${effect.id}.escape`)) as AbilityKey,
        ...(effect.escape.skill !== undefined
          ? { skill: String(mustValue(ctx, effect.escape.skill, `effect.${effect.id}.escape.skill`)) }
          : {}),
        ...(effect.escape.dc !== undefined ? { dc: effect.escape.dc } : {}),
        ...(effect.escape.label ? { label: effect.escape.label } : {}),
        ...(effect.escape.iconKey ? { iconKey: effect.escape.iconKey } : {}),
      }
    : undefined;
  const escalate = effect.escalate
    ? {
        condition: String(mustValue(ctx, effect.escalate.condition, `effect.${effect.id}.escalate`)) as ConditionKey,
        ...(effect.escalate.duration !== undefined ? { duration: effect.escalate.duration } : {}),
      }
    : undefined;
  const targets = effect.targets !== undefined ? Number(mustValue(ctx, effect.targets, `effect.${effect.id}.targets`)) : undefined;
  const duration = resolveLeveled(ctx, effect.duration);
  if (!duration) throw new Error(`AutomationSpec ${ctx.spec.key}: effect.${effect.id} без duration`);
  const concentration = effect.concentration !== undefined ? resolveLeveled(ctx, effect.concentration) : undefined;
  const turnDodge =
    effect.turnDodge !== undefined
      ? compileGated(ctx, effect.turnDodge, (v) => ({
          ability: String(mustValue(ctx, v.ability, `effect.${effect.id}.turnDodge`)) as AbilityKey,
        }))
      : undefined;
  const triggerFields = effect.triggers ? compileTriggers(ctx, effect.triggers, effect.id) : {};
  const senses =
    effect.senses !== undefined ? compileGated(ctx, effect.senses, (list) => list.map((s) => ({ ...s }))) : undefined;
  const seesInvisible =
    effect.seesInvisible !== undefined ? compileGated(ctx, effect.seesInvisible, (value) => value) : undefined;
  return {
    name: effect.name,
    duration,
    ...(concentration ? { concentration: true } : {}),
    ...(effect.to ? { to: effect.to } : {}),
    ...(targets !== undefined ? { targets } : {}),
    modifiers,
    ...(conditions.length ? { conditions } : {}),
    ...(conditionImmunities.length ? { conditionImmunities } : {}),
    ...(effect.conditionImmunitiesFrom
      ? {
          conditionImmunitiesFrom: {
            conditions: [...effect.conditionImmunitiesFrom.conditions],
            types: [...effect.conditionImmunitiesFrom.types],
          },
        }
      : {}),
    ...(effect.immuneToSpeedReduction ? { immuneToSpeedReduction: true } : {}),
    ...(effect.ignoresDifficultTerrain ? { ignoresDifficultTerrain: true } : {}),
    ...(escape ? { escape } : {}),
    ...(escalate ? { escalate } : {}),
    ...(effect.banish ? { banish: true } : {}),
    ...(effect.light ? { light: { ...effect.light } } : {}),
    ...(effect.markTarget ? { markTarget: true } : {}),
    ...(effect.mark ? { mark: true } : {}),
    ...(senses?.length ? { senses } : {}),
    ...(seesInvisible ? { seesInvisible: true } : {}),

    ...(variant !== undefined ? { variant: String(variant) } : {}),
    ...(effect.uses ? compileUses(ctx, effect.uses) : {}),
    ...(effect.tempHp !== undefined ? { tempHp: Number(mustValue(ctx, effect.tempHp, `effect.${effect.id}.tempHp`)) } : {}),
    ...(effect.dominates ? { dominates: true } : {}),
    ...triggerFields,
    ...(effect.selfOnFail ? { selfOnFail: true } : {}),
    ...(effect.maxHpBonus ? { maxHpBonus: { ...effect.maxHpBonus } } : {}),
    ...(effect.turnDodge ? (turnDodge ? { turnDodge } : {}) : {}),
    ...(effect.markSaved ? { markSaved: true } : {}),
    ...(effect.restrictions ? { restrictions: { ...effect.restrictions } } : {}),
    ...(effect.onEnd ? { onEnd: compileEffect(ctx, effect.onEnd) } : {}),
    ...(effect.movement?.zephyrStrike ? { zephyrStrike: { ...effect.movement.zephyrStrike } } : {}),
    ...(effect.actions?.length ? { actions: effect.actions.map((a) => compileAction(ctx, a)) } : {}),
    ...loadout,
  };
}

function compileWeaponAttack(ctx: CompileCtx, spec: WeaponAttackSpec): NonNullable<AutomationDef['weaponAttack']> {
  const out: NonNullable<AutomationDef['weaponAttack']> = {};
  const rider = resolveValue(ctx, spec.riderDice);
  if (rider !== undefined) out.riderDice = String(rider);
  if (spec.replace) out.replace = true;
  if (spec.anyWeapon) out.anyWeapon = true;
  if (spec.spellAbility) out.spellAbility = true;
  if (spec.secondary) {
    const dice = resolveValue(ctx, spec.secondary.dice);
    out.secondary = {
      rangeFeet: spec.secondary.rangeFeet,
      damageType: spec.secondary.damageType,
      ...(dice !== undefined ? { dice: String(dice) } : {}),
      ...(spec.secondary.save ? { save: { ...spec.secondary.save } } : {}),
      ...(spec.secondary.includePrimary ? { includePrimary: true } : {}),
    };
  }
  if (spec.hitEffect) {
    const hit = spec.hitEffect;
    out.hitEffect = {
      name: hit.name,
      duration: hit.duration,
      ...(hit.to ? { to: hit.to } : {}),
      modifiers: (hit.modifiers ?? []).map((m) => ({ ...m })),
      ...(hit.conditions?.length ? { conditions: [...hit.conditions] } : {}),
      ...(hit.triggers ? compileTriggers(ctx, hit.triggers, 'hitEffect') : {}),
    };
  }
  return out;
}

/** Урон payload'а: одиночная часть или составной (кости + типы в строку). */
function compileDamage(ctx: CompileCtx, spec: DamageSpec): AutomationDice {
  if ('parts' in spec) {
    const parts = spec.parts.map((p) => ({
      dice: String(mustValue(ctx, p.dice, 'damage.parts.dice')),
      type: String(mustValue(ctx, p.type, 'damage.parts.type')),
    }));
    return {
      dice: parts.map((p) => `${p.dice}${p.type}`).join(' + '),
      types: [...new Set(parts.map((p) => p.type))],
    };
  }
  return {
    dice: String(mustValue(ctx, spec.dice, 'damage.dice')),
    ...(spec.types?.length ? { types: spec.types.map((t) => String(mustValue(ctx, t, 'damage.types'))) } : {}),
    ...(spec.abilityMod ? { abilityMod: true } : {}),
  };
}

/** Компиляция payload спека (урон/лечение/эффекты триггера): кости — из `ValueExpr`. */
function compilePayload(ctx: CompileCtx, payload: PayloadSpec): AutomationPayload {
  return {
    ...(payload.save ? { save: { ...payload.save } } : {}),
    ...(payload.damage ? { damage: compileDamage(ctx, payload.damage) } : {}),
    ...(payload.heal ? { heal: { dice: String(mustValue(ctx, payload.heal.dice, 'payload.heal')) } } : {}),
    ...(payload.successDamage
      ? {
          successDamage: {
            dice: String(mustValue(ctx, payload.successDamage.dice, 'payload.successDamage')),
            ...(payload.successDamage.types ? { types: [...payload.successDamage.types] } : {}),
          },
        }
      : {}),
    ...(payload.effects?.length ? { effects: payload.effects.map((e) => compileEffect(ctx, e)) } : {}),
    ...(payload.endConditions?.length ? { endConditions: [...payload.endConditions] } : {}),
    ...(payload.healTo !== undefined ? { healTo: payload.healTo } : {}),
    ...(payload.containment ? { containment: payload.containment } : {}),
  };
}

/** Компиляция блока `zone`: pass-through полей + `ValueExpr` в зарядах и триггерах. */
function compileZone(ctx: CompileCtx, zone: ZoneSpec): ZoneDef {
  const triggers = zone.triggers
    ? Object.fromEntries(
        Object.entries(zone.triggers)
          .filter(([, payload]) => payload !== undefined)
          .map(([slot, payload]) => [slot, compilePayload(ctx, payload!)])
      )
    : undefined;
  let area = zone.area && !('wall' in zone.area) ? zone.area : undefined;
  if (zone.area && 'wall' in zone.area) {
    const dimsSpec = zone.area.wall;
    const dims = 'from' in dimsSpec ? WALL_DIMS[ctx.spell.key] : dimsSpec;
    if (!dims) throw new Error(`AutomationSpec ${ctx.spec.key}: нет габаритов стены`);
    area = wallAreaOf(dims, ctx.opts.variant);
  }
  if (!area) throw new Error(`AutomationSpec ${ctx.spec.key}: не определена область`);
  const wall = zone.wall
    ? (() => {
        const { breach, ...rest } = zone.wall;
        return { ...rest, ...(breach ? { breach: compilePayload(ctx, breach) } : {}) };
      })()
    : undefined;
  return {
    area,
    origin: zone.origin ?? 'point',
    duration: zone.duration!,
    ...(zone.actions?.length ? { actions: zone.actions.map((a) => compileAction(ctx, a)) } : {}),
    ...(zone.anchor ? { anchor: zone.anchor } : {}),
    ...(zone.containment ? { containment: zone.containment } : {}),
    ...(zone.side ? { side: zone.side } : {}),
    ...(zone.light ? { light: { ...zone.light } } : {}),
    ...(zone.enterOncePerTurn ? { enterOncePerTurn: true } : {}),
    ...(zone.movable ? { movable: true } : {}),
    ...(zone.onCreate ? { onCreate: compilePayload(ctx, zone.onCreate) } : {}),
    ...(zone.charges !== undefined ? { charges: Number(mustValue(ctx, zone.charges, 'zone.charges')) } : {}),
    ...(zone.dealtLimit !== undefined ? { dealtLimit: zone.dealtLimit } : {}),
    ...(zone.excludeCreatureTypes?.length ? { excludeCreatureTypes: [...zone.excludeCreatureTypes] } : {}),
    ...(zone.aura ? { aura: compilePayload(ctx, zone.aura) } : {}),
    ...(zone.excludeSource ? { excludeSource: true } : {}),
    ...(triggers ? { triggers } : {}),
    ...(wall ? { wall } : {}),
    ...(zone.flags ? { flags: { ...zone.flags } } : {}),
  };
}

/** Компиляция спека в рантайм-формат `AutomationDef` (движок не меняется). */
export function compileSpec(spec: AutomationSpec, input: CompileInput): AutomationDef {
  const errors = validateSpec(spec);
  if (errors.length) throw new Error(`AutomationSpec ${spec.key}: ${errors.join('; ')}`);
  const ctx: CompileCtx = {
    ...input,
    spec,
    castLevel: input.opts.castLevel ?? Math.max(1, input.spell.level),
    characterLevel: input.opts.characterLevel ?? 1,
  };
  const concentration = spec.concentration !== undefined ? resolveLeveled(ctx, spec.concentration) : undefined;
  // Спецификация без своего лимита наследует правило данных: ровно 1 минута → 10 раундов
  // (раньше это довешивал `automationForSpell` после компиляции — теперь запись самодостаточна).
  const specMaxRounds = spec.maxRounds !== undefined ? resolveLeveled(ctx, spec.maxRounds) : undefined;
  const maxRounds = specMaxRounds !== undefined ? specMaxRounds : spellMaxRounds(input.spell);
  const area =
    spec.area === undefined ? undefined : 'from' in spec.area ? (input.spell.areaSpec ?? spec.area.fallback) : spec.area;
  return {
    key: spec.key,
    name: spec.name,
    resolution: spec.primary,
    ...(concentration ? { concentration: true } : {}),
    ...(maxRounds !== undefined ? { maxRounds } : {}),
    ...(area ? { area } : {}),
    ...(spec.save ? { save: { ...spec.save } } : {}),
    ...(spec.shape ? { shape: { ...spec.shape } } : {}),
    ...(spec.force ? { force: { ...spec.force } } : {}),
    ...(spec.halfOnMiss ? { halfOnMiss: true } : {}),
    ...(spec.damage ? { damage: compileDamage(ctx, spec.damage) } : {}),
    ...(spec.successDamage ? { successDamage: compileDamage(ctx, spec.successDamage) } : {}),
    ...(spec.undeadTempHp ? { undeadTempHp: true } : {}),
    ...(spec.heal
      ? {
          heal: {
            dice: String(mustValue(ctx, spec.heal.dice, 'heal.dice')),
            ...(spec.heal.types !== undefined
              ? { types: spec.heal.types.map((t) => String(mustValue(ctx, t, 'heal.types'))) }
              : {}),
            ...(spec.heal.abilityMod ? { abilityMod: true } : {}),
          },
        }
      : {}),
    ...(spec.maxHpFromDamage ? { maxHpFromDamage: true } : {}),
    ...(spec.lifesteal ? { lifesteal: true } : {}),
    ...(spec.lifeTransfer ? { lifeTransfer: { ...spec.lifeTransfer } } : {}),
    ...(spec.attack ? { attack: { ...spec.attack } } : {}),
    ...(spec.count !== undefined ? { count: spec.count } : {}),
    ...(spec.targets !== undefined ? { targets: spec.targets } : {}),
    ...(spec.autoTargets ? { autoTargets: { ...spec.autoTargets } } : {}),
    ...(spec.chain ? { chain: { jumps: Number(mustValue(ctx, spec.chain.jumps, 'chain.jumps')), feet: spec.chain.feet } } : {}),
    ...(spec.burst ? { burst: compileBurst(ctx, spec.burst) } : {}),
    ...(spec.targeting ? { targeting: { ...spec.targeting } } : {}),
    ...(spec.utility ? { utility: compileUtility(ctx, spec.utility) } : {}),
    ...(spec.movement?.teleportAfter ? { teleportAfter: { ...spec.movement.teleportAfter } } : {}),
    ...(spec.excludeCreatureTypes?.length ? { excludeCreatureTypes: [...spec.excludeCreatureTypes] } : {}),
    ...(spec.requiresCreatureTypes?.length ? { requiresCreatureTypes: [...spec.requiresCreatureTypes] } : {}),
    ...(spec.saveAdvantageInCombat ? { saveAdvantageInCombat: true } : {}),
    ...(spec.side ? { side: spec.side } : {}),
    ...(spec.endConditions?.length ? { endConditions: [...spec.endConditions] } : {}),
    // `effects: []` тоже валиден (SG: пустой массив после мержа добавок) — отличие от `undefined`.
    ...(spec.effects !== undefined ? { effects: spec.effects.map((e) => compileEffect(ctx, e)) } : {}),
    ...(spec.saveSuccess?.length ? { saveSuccess: spec.saveSuccess.map((e) => compileEffect(ctx, e)) } : {}),
    ...(spec.zone ? { zone: compileZone(ctx, spec.zone) } : {}),
    ...(spec.weaponAttack ? { weaponAttack: compileWeaponAttack(ctx, spec.weaponAttack) } : {}),
  };
}

/** Шаг пути патча: элементы массивов — по `id`, иначе числовой индекс. */
function stepPath(container: unknown, segment: string, path: string): unknown {
  if (Array.isArray(container)) {
    const byId = container.find((el) => el && typeof el === 'object' && (el as { id?: unknown }).id === segment);
    if (byId) return byId;
    const index = Number(segment);
    if (Number.isInteger(index) && index >= 0 && index < container.length) return container[index];
    throw new Error(`AutomationSpec patch ${path}: нет элемента ${segment}`);
  }
  if (container && typeof container === 'object' && segment in (container as Record<string, unknown>)) {
    return (container as Record<string, unknown>)[segment];
  }
  throw new Error(`AutomationSpec patch ${path}: нет узла ${segment}`);
}

function assignPath(container: unknown, segment: string, value: unknown, path: string): void {
  if (Array.isArray(container)) {
    const index = container.findIndex((el) => el && typeof el === 'object' && (el as { id?: unknown }).id === segment);
    if (index >= 0) {
      container[index] = value;
      return;
    }
    const numeric = Number(segment);
    if (Number.isInteger(numeric) && numeric >= 0 && numeric < container.length) {
      container[numeric] = value;
      return;
    }
    throw new Error(`AutomationSpec patch ${path}: нет элемента ${segment}`);
  }
  if (!container || typeof container !== 'object' || !(segment in (container as Record<string, unknown>))) {
    throw new Error(`AutomationSpec patch ${path}: нет узла ${segment}`);
  }
  (container as Record<string, unknown>)[segment] = value;
}

function parentOfPath(root: Record<string, unknown>, path: string): { parent: unknown; last: string } {
  const segments = path.split('.');
  let current: unknown = root;
  for (let i = 0; i < segments.length - 1; i += 1) {
    current = stepPath(current, segments[i]!, segments.slice(0, i + 1).join('.'));
  }
  return { parent: current, last: segments[segments.length - 1]! };
}

function setByPath(root: Record<string, unknown>, path: string, value: unknown): void {
  const { parent, last } = parentOfPath(root, path);
  assignPath(parent, last, value, path);
}

function removeByPath(root: Record<string, unknown>, path: string): void {
  const { parent, last } = parentOfPath(root, path);
  if (Array.isArray(parent)) {
    const index = parent.findIndex((el) => el && typeof el === 'object' && (el as { id?: unknown }).id === last);
    const numeric = index >= 0 ? index : Number(last);
    if (Number.isInteger(numeric) && numeric >= 0 && numeric < parent.length) {
      parent.splice(numeric, 1);
      return;
    }
    throw new Error(`AutomationSpec patch ${path}: нечего удалять (${last})`);
  }
  if (parent && typeof parent === 'object' && last in (parent as Record<string, unknown>)) {
    delete (parent as Record<string, unknown>)[last];
    return;
  }
  throw new Error(`AutomationSpec patch ${path}: нечего удалять (${last})`);
}

/**
 * Резолв спека: копия `extends` разворачивается в базовый спек + `patch`/`remove`
 * (R16 шаг 4, `AUTOMATION.md` §5). Неизвестные база/путь — ошибка.
 */
export function resolveSpec(
  spec: AutomationSpec | AutomationSpecCopy,
  registry: Record<string, AutomationSpec | AutomationSpecCopy> = AUTOMATION_SPECS
): AutomationSpec {
  if (!('extends' in spec) || !spec.extends) return spec as AutomationSpec;
  const base = registry[spec.extends];
  if (!base) throw new Error(`AutomationSpec ${spec.key}: база ${spec.extends} не найдена`);
  const resolved = structuredClone(resolveSpec(base, registry));
  resolved.key = spec.key;
  resolved.name = spec.name;
  for (const [path, value] of Object.entries(spec.patch ?? {})) {
    setByPath(resolved as unknown as Record<string, unknown>, path, structuredClone(value));
  }
  for (const path of spec.remove ?? []) removeByPath(resolved as unknown as Record<string, unknown>, path);
  return resolved;
}

/**
 * Словари значений выборов: опция вне словаря — ошибка компиляции (кастомные
 * значения опций не вводятся, копии только сужают/переставляют набор).
 * `mode`/`effect`/`command` словаря не имеют — допустимые значения задаёт базовый спек.
 */
const CHOICE_OPTION_VOCABULARY: Partial<Record<ChoiceSpec['param'], ReadonlySet<string>>> = {
  damageType: new Set([...DAMAGE_TYPES.map((d) => d.key), 'weapon']),
  condition: new Set<string>(CONDITION_KEYS),
  ability: new Set(ABILITIES.map((a) => a.key)),
  skill: new Set(SKILLS.map((s) => s.key)),
};

/**
 * Скелет валидатора (R16, `AUTOMATION.md` §6): недопустимые комбинации `primary` ×
 * блоки — ошибка компиляции, а не молчаливо игнорируемое поле. Матрица расширяется
 * по мере миграции батчей.
 */
export function validateSpec(spec: AutomationSpec): string[] {
  const errors: string[] = [];
  if (spec.primary === 'effect' && !spec.effects?.length && !spec.zone) errors.push('effect без effects/zone');
  if (spec.shape && spec.primary !== 'save') errors.push('shape допустим только с save');
  if (spec.primary === 'attack' && !spec.attack && !spec.weaponAttack) {
    errors.push('attack без attack/weaponAttack');
  }
  if (!['attack', 'auto'].includes(spec.primary) && spec.weaponAttack) {
    errors.push('weaponAttack допустим только с attack/auto (смайты — райдер после попадания)');
  }
  if (spec.effects?.length && !['attack', 'save', 'auto', 'effect', 'utility'].includes(spec.primary)) {
    errors.push('effects допустимы только для attack/save/auto/effect/utility (Far Step — носитель)');
  }
  if (spec.weaponAttack && (spec.weaponAttack.riderDice === undefined && !spec.weaponAttack.secondary && !spec.weaponAttack.hitEffect && !spec.weaponAttack.anyWeapon && !spec.weaponAttack.spellAbility && !spec.weaponAttack.replace)) {
    errors.push('weaponAttack без стратегии');
  }
  const effectIds = new Set<string>();
  for (const effect of spec.effects ?? []) {
    if (effectIds.has(effect.id)) errors.push(`дублирующийся id эффекта ${effect.id}`);
    effectIds.add(effect.id);
  }
  if (spec.zone && (!spec.zone.area || !spec.zone.duration)) errors.push('zone без area/duration');
  const choiceIds = new Set((spec.choices ?? []).map((c) => c.id));
  for (const choice of spec.choices ?? []) {
    const vocabulary = CHOICE_OPTION_VOCABULARY[choice.param];
    if (!vocabulary) continue;
    for (const option of choice.options) {
      if (!vocabulary.has(option)) errors.push(`выбор ${choice.id}: недопустимое значение ${option}`);
    }
  }
  const refs: ValueExpr[] = [];
  const pushGated = <T>(entry: T | { if: ValueExpr; then: T }, push: (value: T) => void) => {
    if (entry && typeof entry === 'object' && 'if' in entry && 'then' in entry) {
      refs.push(entry.if);
      push(entry.then);
    } else {
      push(entry as T);
    }
  };
  const collectTriggerAction = (action: TriggerAction) => {
    if ('save' in action) {
      if (action.save.dc !== undefined) refs.push(action.save.dc);
      for (const op of action.save.onFail ?? []) collectTriggerAction(op);
      for (const op of action.save.onSuccess ?? []) collectTriggerAction(op);
      return;
    }
    if ('damage' in action) {
      if (action.damage.dice !== undefined) refs.push(action.damage.dice);
      refs.push(action.damage.damageType);
      if (action.damage.amount !== undefined) refs.push(action.damage.amount);
      return;
    }
    if ('reduce' in action) {
      refs.push(action.reduce.dice, ...action.reduce.types);
      return;
    }
    if ('extraDamage' in action) {
      refs.push(action.extraDamage.dice, action.extraDamage.damageType);
      return;
    }
    if ('reaction' in action) {
      if (action.reaction.kind === 'ward') refs.push(...action.reaction.types);
      else refs.push(action.reaction.ability);
    }
  };
  const collectTriggerSlot = (entry?: Gated<EffectTriggerSpec>) => {
    if (!entry) return;
    pushGated(entry, (t) => {
      if (t.tempHp !== undefined) refs.push(t.tempHp);
      if (t.damage) {
        if ('parts' in t.damage) {
          for (const part of t.damage.parts) refs.push(part.dice, part.type);
        } else {
          refs.push(t.damage.dice);
          for (const type of t.damage.types ?? []) refs.push(type);
        }
      }
    });
  };
  const collectTriggers = (triggers?: EffectTriggers) => {
    if (!triggers) return;
    const events: (keyof EffectTriggers)[] = [
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
    ];
    for (const name of events) {
      const list = triggers[name] as TriggerList | undefined;
      if (!list) continue;
      for (const entry of Array.isArray(list) ? list : [list]) pushGated(entry, collectTriggerAction);
    }
    collectTriggerSlot(triggers.startOfTurn);
    collectTriggerSlot(triggers.endOfTurn);
  };
  const collectEffect = (effect: EffectSpec) => {
    if (effect.variant !== undefined) refs.push(effect.variant);
    for (const entry of effect.conditions ?? []) pushGated(entry, (c) => refs.push(c));
    if (effect.senses !== undefined) pushGated(effect.senses, () => undefined);
    if (effect.seesInvisible !== undefined) pushGated(effect.seesInvisible, () => undefined);
    for (const entry of effect.conditionImmunities ?? []) pushGated(entry, (c) => refs.push(c));
    if (effect.escape) {
      refs.push(effect.escape.ability);
      if (effect.escape.skill !== undefined) refs.push(effect.escape.skill);
    }
    if (effect.escalate) refs.push(effect.escalate.condition);
    for (const entry of effect.modifiers ?? []) {
      pushGated(entry, (m) => {
        if (m.value !== undefined) refs.push(m.value);
        if (m.filter?.damageType !== undefined) refs.push(m.filter.damageType);
        if (m.filter?.ability !== undefined) refs.push(m.filter.ability);
        if (m.filter?.skill !== undefined) refs.push(m.filter.skill);
      });
    }
    collectTriggers(effect.triggers);
    if (effect.tempHp !== undefined) refs.push(effect.tempHp);
    if (effect.uses?.kind === 'charges') refs.push(effect.uses.count);
    if (effect.turnDodge) pushGated(effect.turnDodge, (v) => refs.push(v.ability));
    if (effect.targets !== undefined) refs.push(effect.targets);
    if (effect.onEnd) collectEffect(effect.onEnd);
    if (effect.loadout) {
      const l = effect.loadout;
      if (l.kind === 'weaponOverride') refs.push(l.dice, l.damageType, l.abilityMod);
      else if (l.kind === 'shadowBlade') refs.push(l.dice);
      else {
        if (l.attack !== undefined) refs.push(l.attack);
        if (l.damage !== undefined) refs.push(l.damage);
      }
    }
    for (const action of effect.actions ?? []) collectAction(action);
  };
  for (const effect of spec.effects ?? []) collectEffect(effect);
  for (const effect of spec.saveSuccess ?? []) collectEffect(effect);
  const pushDamageRefs = (damage: DamageSpec) => {
    if ('parts' in damage) {
      for (const part of damage.parts) refs.push(part.dice, part.type);
    } else {
      refs.push(damage.dice);
      for (const t of damage.types ?? []) refs.push(t);
    }
  };
  const collectPayload = (payload?: PayloadSpec) => {
    if (!payload) return;
    if (payload.damage) pushDamageRefs(payload.damage);
    if (payload.heal) refs.push(payload.heal.dice);
    if (payload.successDamage) refs.push(payload.successDamage.dice);
    for (const effect of payload.effects ?? []) collectEffect(effect);
  };
  function collectUtility(utility?: UtilitySpec) {
    if (!utility) return;
    if (utility.dice !== undefined) refs.push(utility.dice);
    if (utility.blockedDamage) pushDamageRefs(utility.blockedDamage);
    if (utility.fromBurst?.damage) pushDamageRefs(utility.fromBurst.damage);
  }
  /** Действие и его вложенные эффекты; `baseActionId` несовместим с payload (compileAction его не читает). */
  function collectAction(action: ActionSpec) {
    if (
      action.baseActionId &&
      (action.primary !== undefined ||
        action.attack ||
        action.count !== undefined ||
        action.save ||
        action.damage ||
        action.effects?.length ||
        action.utility ||
        action.area ||
        action.targeting ||
        action.lifesteal ||
        action.banishOnFail ||
        action.requiresCreatureTypes?.length ||
        action.retarget)
    ) {
      errors.push(`action.${action.id}: baseActionId несовместим с payload (payload молча теряется)`);
    }
    if (action.damage) {
      refs.push(action.damage.dice);
      for (const t of action.damage.types ?? []) refs.push(t);
    }
    collectUtility(action.utility as UtilitySpec | undefined);
    for (const nested of action.effects ?? []) collectEffect(nested);
  }
  if (spec.damage) pushDamageRefs(spec.damage);
  if (spec.successDamage) pushDamageRefs(spec.successDamage);
  if (spec.heal) {
    refs.push(spec.heal.dice);
    for (const type of spec.heal.types ?? []) refs.push(type);
  }
  collectUtility(spec.utility);
  if (spec.chain) refs.push(spec.chain.jumps);
  if (spec.burst) {
    if (spec.burst.dice !== undefined) refs.push(spec.burst.dice);
    refs.push(spec.burst.damageType);
  }
  if (spec.zone) {
    if (spec.zone.charges !== undefined) refs.push(spec.zone.charges);
    for (const action of spec.zone.actions ?? []) collectAction(action);
    collectPayload(spec.zone.onCreate);
    collectPayload(spec.zone.aura);
    collectPayload(spec.zone.wall?.breach);
    for (const payload of Object.values(spec.zone.triggers ?? {})) collectPayload(payload);
  }
  const wa = spec.weaponAttack;
  if (wa) {
    if (wa.riderDice !== undefined) refs.push(wa.riderDice);
    if (wa.secondary?.dice !== undefined) refs.push(wa.secondary.dice);
    collectTriggers(wa.hitEffect?.triggers);
  }
  const checkRef = (expr: ValueExpr) => {
    if (typeof expr === 'string' || typeof expr === 'number') return;
    if ('concat' in expr) {
      for (const item of expr.concat) checkRef(item);
      return;
    }
    if ('join' in expr) {
      for (const item of expr.join.parts) checkRef(item);
      return;
    }
    if ('add' in expr) {
      checkRef(expr.add[0]);
      checkRef(expr.add[1]);
      return;
    }
    if ('sum' in expr) {
      for (const item of expr.sum) checkRef(item);
      return;
    }
    if ('includes' in expr) {
      checkRef(expr.includes.of);
      return;
    }
    if ('tiers' in expr) return;
    if ('perLevel' in expr) return;
    if ('spellMod' in expr) return;
    if ('scale' in expr) {
      checkRef(expr.scale.dice);
      return;
    }
    if ('mapped' in expr) {
      checkRef(expr.mapped.of);
      if (expr.mapped.fallback !== undefined) checkRef(expr.mapped.fallback);
      return;
    }
    if (expr.ref === 'choice' && expr.choice && !choiceIds.has(expr.choice)) {
      errors.push(`ссылка на неизвестный выбор ${expr.choice}`);
    }
    if (expr.fallback !== undefined) checkRef(expr.fallback);
  };
  for (const ref of refs) checkRef(ref);
  return errors;
}
