import type { AutomationDef, AutomationDice, AutomationEffect, AutomationPayload, GrantedAction, ZoneDef } from '../../domain/automation';
import type { AbilityKey } from '../../domain/core';
import type { ConditionKey, Modifier } from '../../domain/effects';
import type { Spell } from '../spells';
import { spellCantripDice, spellDamageExpression, spellUpcastAt, wallAreaOf, WALL_DIMS } from '../spellCast';
import { addDiceExpression, scaledDice, upcastSteps } from './builders';
import type {
  ActionSpec,
  AutomationSpec,
  AutomationSpecCopy,
  DamageSpec,
  EffectSpec,
  LoadoutSpec,
  ModifierSpec,
  PayloadSpec,
  UsesSpec,
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
    return expr.perLevel.base + expr.perLevel.per * Math.max(0, ctx.castLevel - above);
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
    case 'choice':
      value = choiceValue(ctx.spec, ctx.opts, expr.choice);
      if (value !== undefined && expr.optional && ctx.opts.variant === undefined) value = undefined;
      break;
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
  const filter = { weapon: true, unarmed: false, ...(loadout.ranged ? { attackType: 'ranged' as const } : {}) };
  const modifiers: AutomationEffect['modifiers'] = [];
  if (loadout.attack !== undefined) {
    modifiers.push({ target: 'attack', mode: 'add', value: mustValue(ctx, loadout.attack, 'loadout.attack'), filter });
  }
  if (loadout.damage !== undefined) {
    modifiers.push({ target: 'damage', mode: 'add', value: mustValue(ctx, loadout.damage, 'loadout.damage'), filter });
  }
  return { modifiers, ...(loadout.magic ? { magicWeapon: true } : {}) };
}

function compileAction(ctx: CompileCtx, action: ActionSpec): GrantedAction {
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
    ...(targeting ? { targeting: { ...targeting } } : {}),
    ...(action.utility ? { utility: { ...action.utility } } : {}),
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
  return { misdirect: { charges: uses.charges, die: uses.die, threshold: uses.threshold } };
}

/** Элемент списка с гейтом `{ if, then }`: гейт пуст — элемент опускается. */
function compileGated<T>(ctx: CompileCtx, entry: T | { if: ValueExpr; then: T }, compile: (value: T) => T): T | undefined {
  if (entry && typeof entry === 'object' && 'if' in entry && 'then' in entry) {
    return resolveValue(ctx, entry.if) ? compile(entry.then) : undefined;
  }
  return compile(entry as T);
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
  const targets = effect.targets !== undefined ? Number(mustValue(ctx, effect.targets, `effect.${effect.id}.targets`)) : undefined;
  return {
    name: effect.name,
    duration: effect.duration,
    ...(effect.concentration ? { concentration: true } : {}),
    ...(effect.to ? { to: effect.to } : {}),
    ...(targets !== undefined ? { targets } : {}),
    modifiers,
    ...(conditions.length ? { conditions } : {}),
    ...(effect.light ? { light: { ...effect.light } } : {}),
    ...(variant !== undefined ? { variant: String(variant) } : {}),
    ...(effect.uses ? compileUses(ctx, effect.uses) : {}),
    ...(effect.damageReduce
      ? {
          damageReduce: {
            dice: String(mustValue(ctx, effect.damageReduce.dice, `effect.${effect.id}.damageReduce.dice`)),
            types: effect.damageReduce.types.map((t) => String(mustValue(ctx, t, `effect.${effect.id}.damageReduce.types`))),
          },
        }
      : {}),
    ...(effect.elementalBane
      ? {
          elementalBane: {
            damageType: String(mustValue(ctx, effect.elementalBane.damageType, `effect.${effect.id}.elementalBane`)),
            dice: String(mustValue(ctx, effect.elementalBane.dice, `effect.${effect.id}.elementalBane`)),
          },
        }
      : {}),
    ...(effect.takesExtraDamage
      ? {
          takesExtraDamage: {
            dice: String(mustValue(ctx, effect.takesExtraDamage.dice, `effect.${effect.id}.takesExtraDamage`)),
            damageType: String(mustValue(ctx, effect.takesExtraDamage.damageType, `effect.${effect.id}.takesExtraDamage`)),
          },
        }
      : {}),
    ...(effect.restrictions ? { restrictions: { ...effect.restrictions } } : {}),
    ...(effect.retaliate
      ? {
          retaliate: {
            damageType: String(mustValue(ctx, effect.retaliate.damageType, `effect.${effect.id}.retaliate`)),
            ...(effect.retaliate.dice ? { dice: effect.retaliate.dice } : {}),
            ...(effect.retaliate.amount !== undefined ? { amount: effect.retaliate.amount } : {}),
          },
        }
      : {}),
    ...(effect.zephyrStrike ? { zephyrStrike: { ...effect.zephyrStrike } } : {}),
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
      ...(hit.onWillingMove
        ? {
            onWillingMove: {
              dice: String(mustValue(ctx, hit.onWillingMove.dice, 'weaponAttack.hitEffect.onWillingMove')),
              damageType: hit.onWillingMove.damageType,
              feet: hit.onWillingMove.feet,
            },
          }
        : {}),
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
  return {
    key: spec.key,
    name: spec.name,
    resolution: spec.primary,
    ...(spec.concentration ? { concentration: true } : {}),
    ...(spec.maxRounds !== undefined ? { maxRounds: spec.maxRounds } : {}),
    ...(spec.save ? { save: { ...spec.save } } : {}),
    ...(spec.damage ? { damage: compileDamage(ctx, spec.damage) } : {}),
    ...(spec.attack ? { attack: { ...spec.attack } } : {}),
    ...(spec.count !== undefined ? { count: spec.count } : {}),
    ...(spec.targeting ? { targeting: { ...spec.targeting } } : {}),
    ...(spec.excludeCreatureTypes?.length ? { excludeCreatureTypes: [...spec.excludeCreatureTypes] } : {}),
    ...(spec.effects?.length ? { effects: spec.effects.map((e) => compileEffect(ctx, e)) } : {}),
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
 * Скелет валидатора (R16, `AUTOMATION.md` §6): недопустимые комбинации `primary` ×
 * блоки — ошибка компиляции, а не молчаливо игнорируемое поле. Матрица расширяется
 * по мере миграции батчей.
 */
export function validateSpec(spec: AutomationSpec): string[] {
  const errors: string[] = [];
  if (spec.primary === 'effect' && !spec.effects?.length && !spec.zone) errors.push('effect без effects/zone');
  if (spec.primary === 'attack' && !spec.attack && !spec.weaponAttack) {
    errors.push('attack без attack/weaponAttack');
  }
  if (spec.primary !== 'attack' && spec.weaponAttack) errors.push('weaponAttack допустим только с attack');
  if (spec.effects?.length && !['attack', 'save', 'auto', 'effect'].includes(spec.primary)) {
    errors.push('effects допустимы только для attack/save/auto/effect');
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
  const refs: ValueExpr[] = [];
  const pushGated = <T>(entry: T | { if: ValueExpr; then: T }, push: (value: T) => void) => {
    if (entry && typeof entry === 'object' && 'if' in entry && 'then' in entry) {
      refs.push(entry.if);
      push(entry.then);
    } else {
      push(entry as T);
    }
  };
  const collectEffect = (effect: EffectSpec) => {
    if (effect.variant !== undefined) refs.push(effect.variant);
    for (const entry of effect.conditions ?? []) pushGated(entry, (c) => refs.push(c));
    for (const entry of effect.modifiers ?? []) {
      pushGated(entry, (m) => {
        if (m.value !== undefined) refs.push(m.value);
        if (m.filter?.damageType !== undefined) refs.push(m.filter.damageType);
        if (m.filter?.ability !== undefined) refs.push(m.filter.ability);
        if (m.filter?.skill !== undefined) refs.push(m.filter.skill);
      });
    }
    if (effect.retaliate) refs.push(effect.retaliate.damageType);
    if (effect.uses?.kind === 'charges') refs.push(effect.uses.count);
    if (effect.damageReduce) refs.push(effect.damageReduce.dice, ...effect.damageReduce.types);
    if (effect.elementalBane) refs.push(effect.elementalBane.damageType, effect.elementalBane.dice);
    if (effect.takesExtraDamage) refs.push(effect.takesExtraDamage.dice, effect.takesExtraDamage.damageType);
    if (effect.targets !== undefined) refs.push(effect.targets);
    if (effect.loadout) {
      const l = effect.loadout;
      if (l.kind === 'weaponOverride') refs.push(l.dice, l.damageType, l.abilityMod);
      else if (l.kind === 'shadowBlade') refs.push(l.dice);
      else {
        if (l.attack !== undefined) refs.push(l.attack);
        if (l.damage !== undefined) refs.push(l.damage);
      }
    }
    for (const action of effect.actions ?? []) {
      if (action.damage) {
        refs.push(action.damage.dice);
        for (const t of action.damage.types ?? []) refs.push(t);
      }
    }
  };
  for (const effect of spec.effects ?? []) collectEffect(effect);
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
  if (spec.damage) pushDamageRefs(spec.damage);
  if (spec.zone) {
    if (spec.zone.charges !== undefined) refs.push(spec.zone.charges);
    collectPayload(spec.zone.onCreate);
    collectPayload(spec.zone.aura);
    collectPayload(spec.zone.wall?.breach);
    for (const payload of Object.values(spec.zone.triggers ?? {})) collectPayload(payload);
  }
  const wa = spec.weaponAttack;
  if (wa) {
    if (wa.riderDice !== undefined) refs.push(wa.riderDice);
    if (wa.secondary?.dice !== undefined) refs.push(wa.secondary.dice);
    if (wa.hitEffect?.onWillingMove) refs.push(wa.hitEffect.onWillingMove.dice);
  }
  const checkRef = (expr: ValueExpr) => {
    if (typeof expr === 'string' || typeof expr === 'number') return;
    if ('concat' in expr) {
      for (const item of expr.concat) checkRef(item);
      return;
    }
    if ('add' in expr) {
      checkRef(expr.add[0]);
      checkRef(expr.add[1]);
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
