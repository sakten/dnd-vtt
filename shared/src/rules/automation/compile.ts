import type { AutomationDef, AutomationEffect, AutomationPayload, GrantedAction, ZoneDef } from '../../domain/automation';
import type { Spell } from '../spells';
import { spellCantripDice, spellDamageExpression, spellUpcastAt } from '../spellCast';
import { addDice, scaledDice, upcastSteps } from './builders';
import type {
  ActionSpec,
  AutomationSpec,
  EffectSpec,
  LoadoutSpec,
  PayloadSpec,
  UsesSpec,
  ValueExpr,
  WeaponAttackSpec,
  ZoneSpec,
} from './spec';
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
    return addDice(typeof base === 'string' ? base : undefined, expr.add[1]);
  }
  if ('tiers' in expr) {
    const tier = [...expr.tiers].filter((t) => ctx.castLevel >= t.above).pop();
    return tier?.value;
  }
  if ('perLevel' in expr) {
    return expr.perLevel.base + expr.perLevel.per * Math.max(0, ctx.castLevel - expr.perLevel.above);
  }
  if ('spellMod' in expr) {
    return Math.max(expr.spellMod.min ?? Number.NEGATIVE_INFINITY, expr.spellMod.base + Math.round(ctx.opts.spellMod ?? 0));
  }
  if ('scale' in expr) {
    const base = resolveValue(ctx, expr.scale.dice);
    if (base === undefined) return undefined;
    return scaledDice(String(base), ctx.spell.upcast?.dice, upcastSteps(ctx.spell, ctx.castLevel));
  }
  let value: string | number | undefined;
  switch (expr.ref) {
    case 'cantrip':
      value = spellCantripDice(ctx.spell, ctx.characterLevel);
      break;
    case 'damage':
      value = ctx.spell.damage?.dice?.[0];
      break;
    case 'part':
      value = ctx.spell.damage?.parts?.find((p) => p.role === expr.part)?.dice;
      break;
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
  const def: AutomationDef = {
    key: action.subKey ? `${ctx.spec.key}:${action.subKey}` : ctx.spec.key,
    name: action.defName ?? action.name,
    resolution: action.primary,
    ...(action.attack ? { attack: { ...action.attack } } : {}),
    ...(action.damage
      ? {
          damage: {
            dice: String(mustValue(ctx, action.damage.dice, `action.${action.id}.damage`)),
            ...(action.damage.types ? { types: [...action.damage.types] } : {}),
            ...(action.damage.abilityMod ? { abilityMod: true } : {}),
          },
        }
      : {}),
    ...(action.targeting ? { targeting: { ...action.targeting } } : {}),
    ...(action.utility ? { utility: { ...action.utility } } : {}),
  };
  return { id: action.id, name: action.name, cost: action.cost, def };
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

function compileEffect(ctx: CompileCtx, effect: EffectSpec): AutomationEffect {
  const loadout = effect.loadout ? compileLoadout(ctx, effect.loadout) : {};
  const modifiers = [...(effect.modifiers ?? []).map((m) => ({ ...m })), ...(loadout.modifiers ?? [])];
  const variant = effect.variant !== undefined ? String(mustValue(ctx, effect.variant, `effect.${effect.id}.variant`)) : undefined;
  return {
    name: effect.name,
    duration: effect.duration,
    ...(effect.concentration ? { concentration: true } : {}),
    ...(effect.to ? { to: effect.to } : {}),
    ...(effect.targets !== undefined ? { targets: effect.targets } : {}),
    modifiers,
    ...(effect.conditions?.length ? { conditions: [...effect.conditions] } : {}),
    ...(effect.light ? { light: { ...effect.light } } : {}),
    ...(variant ? { variant } : {}),
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
    ...(effect.restrictions ? { restrictions: { ...effect.restrictions } } : {}),
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

/** Компиляция payload спека (урон/лечение/эффекты триггера): кости — из `ValueExpr`. */
function compilePayload(ctx: CompileCtx, payload: PayloadSpec): AutomationPayload {
  return {
    ...(payload.save ? { save: { ...payload.save } } : {}),
    ...(payload.damage
      ? {
          damage: {
            dice: String(mustValue(ctx, payload.damage.dice, 'payload.damage')),
            ...(payload.damage.types ? { types: [...payload.damage.types] } : {}),
            ...(payload.damage.abilityMod ? { abilityMod: true } : {}),
          },
        }
      : {}),
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
  return {
    area: zone.area!,
    origin: zone.origin ?? 'point',
    duration: zone.duration!,
    ...(zone.actions?.length ? { actions: zone.actions.map((a) => ({ ...a })) } : {}),
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
    ...(spec.attack ? { attack: { ...spec.attack } } : {}),
    ...(spec.count !== undefined ? { count: spec.count } : {}),
    ...(spec.targeting ? { targeting: { ...spec.targeting } } : {}),
    ...(spec.effects?.length ? { effects: spec.effects.map((e) => compileEffect(ctx, e)) } : {}),
    ...(spec.zone ? { zone: compileZone(ctx, spec.zone) } : {}),
    ...(spec.weaponAttack ? { weaponAttack: compileWeaponAttack(ctx, spec.weaponAttack) } : {}),
  };
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
  const collectEffect = (effect: EffectSpec) => {
    if (effect.variant !== undefined) refs.push(effect.variant);
    if (effect.uses?.kind === 'charges') refs.push(effect.uses.count);
    if (effect.damageReduce) refs.push(effect.damageReduce.dice, ...effect.damageReduce.types);
    if (effect.elementalBane) refs.push(effect.elementalBane.damageType, effect.elementalBane.dice);
    if (effect.loadout) {
      const l = effect.loadout;
      if (l.kind === 'weaponOverride') refs.push(l.dice, l.damageType, l.abilityMod);
      else if (l.kind === 'shadowBlade') refs.push(l.dice);
      else {
        if (l.attack !== undefined) refs.push(l.attack);
        if (l.damage !== undefined) refs.push(l.damage);
      }
    }
    for (const action of effect.actions ?? []) if (action.damage) refs.push(action.damage.dice);
  };
  for (const effect of spec.effects ?? []) collectEffect(effect);
  const collectPayload = (payload?: PayloadSpec) => {
    if (!payload) return;
    if (payload.damage) refs.push(payload.damage.dice);
    if (payload.heal) refs.push(payload.heal.dice);
    if (payload.successDamage) refs.push(payload.successDamage.dice);
    for (const effect of payload.effects ?? []) collectEffect(effect);
  };
  if (spec.zone) {
    if (spec.zone.charges !== undefined) refs.push(spec.zone.charges);
    collectPayload(spec.zone.onCreate);
    collectPayload(spec.zone.aura);
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
      return;
    }
    if ('tiers' in expr) return;
    if ('perLevel' in expr) return;
    if ('spellMod' in expr) return;
    if ('scale' in expr) {
      checkRef(expr.scale.dice);
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
