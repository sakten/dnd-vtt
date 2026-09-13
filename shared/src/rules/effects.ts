import {
  abilityMod,
  damageTypeName,
  type AbilityKey,
  type AttackRangeType,
  type DamageDefense,
  type EffectDuration,
  type EffectInstance,
  type Modifier,
  type ModifierTarget,
} from '../types';
import { conditionName } from './conditions';

/** Контекст применения модификатора (фильтры attackType/ability/skill/damageType). */
export interface ModifierContext {
  attackType?: 'melee' | 'ranged';
  rangeType?: AttackRangeType;
  ability?: AbilityKey;
  skill?: string;
  damageType?: string;
  /** Цель действия (для эффектов с filter.targetId — Hex/Hunter's Mark). */
  targetId?: string;
}

/** Слагаемые, кости и режим d20, собранные с модификаторов. */
export interface RollParts {
  flat: number;
  dice: string[];
  mode?: 'a' | 'd';
}

const ABILITY_KEYS: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/** Строка-значение — кость ('1d4', '-2d6+1'), а не формула. */
export function isDiceValue(value: number | string): boolean {
  return typeof value === 'string' && /\d*d\d+/.test(value);
}

/** Числовое значение модификатора: число или формула ('13+dex', '-2', '5'). */
export function evalModifierValue(
  value: number | string,
  abilities?: Partial<Record<AbilityKey, number>>
): number {
  if (typeof value === 'number') return Math.round(value);
  const expr = value.replace(/\s+/g, '').toLowerCase();
  if (!expr || isDiceValue(expr)) return 0;
  let total = 0;
  const terms = expr.match(/[+-]?[^+-]+/g) ?? [];
  for (const term of terms) {
    const sign = term.startsWith('-') ? -1 : 1;
    const body = term.replace(/^[+-]/, '');
    if (/^\d+$/.test(body)) {
      total += sign * Number(body);
      continue;
    }
    if ((ABILITY_KEYS as string[]).includes(body)) {
      total += sign * abilityMod(abilities?.[body as AbilityKey] ?? 10);
      continue;
    }
    return 0;
  }
  return total;
}

export function modifierMatches(mod: Modifier, ctx: ModifierContext = {}): boolean {
  const f = mod.filter;
  if (!f) return true;
  if (f.attackType && f.attackType !== ctx.attackType) return false;
  if (f.rangeType && f.rangeType !== ctx.rangeType) return false;
  if (f.ability && f.ability !== ctx.ability) return false;
  if (f.skill && f.skill !== ctx.skill) return false;
  if (f.damageType && f.damageType !== ctx.damageType) return false;
  if (f.targetId && f.targetId !== ctx.targetId) return false;
  return true;
}

/** Все модификаторы эффектов под указанную цель (attack/damage/ac/save/…). */
export function collectModifiers(
  effects: EffectInstance[] | undefined,
  target: ModifierTarget,
  ctx: ModifierContext = {}
): Modifier[] {
  const out: Modifier[] = [];
  for (const effect of effects ?? []) {
    for (const mod of effect.modifiers) {
      if (mod.target !== target) continue;
      if (!modifierMatches(mod, ctx)) continue;
      out.push(mod);
    }
  }
  return out;
}

function rollBias(mods: Modifier[]): { adv: number; dis: number } {
  let adv = 0;
  let dis = 0;
  for (const mod of mods) {
    if (mod.mode === 'advantage') adv += 1;
    else if (mod.mode === 'disadvantage') dis += 1;
  }
  return { adv, dis };
}

/** Слагаемые и кости (`add`) плюс преимущество/помеха с модификаторов. */
export function rollParts(mods: Modifier[], abilities?: Partial<Record<AbilityKey, number>>): RollParts {
  let flat = 0;
  const dice: string[] = [];
  for (const mod of mods) {
    if (mod.mode !== 'add' || mod.value === undefined) continue;
    if (isDiceValue(mod.value)) dice.push(String(mod.value).trim().toLowerCase());
    else flat += evalModifierValue(mod.value, abilities);
  }
  const { adv, dis } = rollBias(mods);
  return { flat, dice, mode: adv > dis ? 'a' : dis > adv ? 'd' : undefined };
}

/** Суммирует части броска; преимущество/помеха взаимно гасятся. */
export function combineRollParts(parts: RollParts[]): RollParts {
  let flat = 0;
  const dice: string[] = [];
  let adv = 0;
  let dis = 0;
  for (const part of parts) {
    flat += part.flat;
    dice.push(...part.dice);
    if (part.mode === 'a') adv += 1;
    else if (part.mode === 'd') dis += 1;
  }
  return { flat, dice, mode: adv > dis ? 'a' : dis > adv ? 'd' : undefined };
}

/** Дописывает слагаемые и кости к выражению броска (преимущество — отдельно). */
export function withRollParts(expression: string, parts: RollParts): string {
  let out = expression;
  if (parts.flat) out += parts.flat > 0 ? `+${parts.flat}` : `${parts.flat}`;
  for (const die of parts.dice) out += die.startsWith('-') ? die : `+${die}`;
  return out;
}

/**
 * Бонусы атакующего к попаданию с учётом эффектов на защитнике: модификаторы
 * `attack` на цели читаются как «атаки по ней» (Blur — помеха, Faerie Fire — преимущество).
 */
export function attackRollParts(
  attackerEffects: EffectInstance[] | undefined,
  defenderEffects: EffectInstance[] | undefined,
  ctx: ModifierContext,
  attackerAbilities?: Partial<Record<AbilityKey, number>>
): RollParts {
  const self = rollParts(collectModifiers(attackerEffects, 'attack', ctx), attackerAbilities);
  let adv = self.mode === 'a' ? 1 : 0;
  let dis = self.mode === 'd' ? 1 : 0;
  const defenderBias = rollBias(collectModifiers(defenderEffects, 'attack', ctx).filter((m) => m.mode !== 'add'));
  adv += defenderBias.adv;
  dis += defenderBias.dis;
  return { flat: self.flat, dice: self.dice, mode: adv > dis ? 'a' : dis > adv ? 'd' : undefined };
}

/** Бонусы/помехи к спасброску (модификаторы на самом бросающем). */
export function saveRollParts(
  effects: EffectInstance[] | undefined,
  ability: AbilityKey,
  abilities?: Partial<Record<AbilityKey, number>>
): RollParts {
  return rollParts(collectModifiers(effects, 'save', { ability }), abilities);
}

/** Бонусы к урону от эффектов атакующего. */
export function damageRollParts(
  effects: EffectInstance[] | undefined,
  ctx: ModifierContext,
  abilities?: Partial<Record<AbilityKey, number>>
): RollParts {
  return rollParts(collectModifiers(effects, 'damage', ctx), abilities);
}

/**
 * Применяет модификаторы к числу: `set` — нижняя граница (max, для AC/Barkskin),
 * затем `add`, затем `multiply` (например, Haste ×2 к скорости).
 */
export function modifiedValue(
  base: number,
  effects: EffectInstance[] | undefined,
  target: ModifierTarget,
  ctx: ModifierContext = {},
  abilities?: Partial<Record<AbilityKey, number>>
): number {
  const mods = collectModifiers(effects, target, ctx);
  let value = Math.round(base);
  for (const mod of mods) {
    if (mod.mode === 'set') value = Math.max(value, evalModifierValue(mod.value ?? 0, abilities));
  }
  for (const mod of mods) {
    if (mod.mode === 'add') {
      value += mod.value !== undefined && isDiceValue(mod.value) ? 0 : evalModifierValue(mod.value ?? 0, abilities);
    }
  }
  for (const mod of mods) {
    if (mod.mode === 'multiply') value = Math.round(value * evalModifierValue(mod.value ?? 0, abilities));
  }
  return value;
}

/** Защиты (сопротивления/иммунитеты/уязвимости), наложенные эффектами. */
export function effectDefenses(effects: EffectInstance[] | undefined): DamageDefense[] {
  const out: DamageDefense[] = [];
  for (const effect of effects ?? []) {
    for (const mod of effect.modifiers) {
      if (mod.mode !== 'resistance' && mod.mode !== 'immunity' && mod.mode !== 'vulnerability') continue;
      const damageType = mod.filter?.damageType;
      if (!damageType) continue;
      out.push({ id: `${mod.id}:${mod.mode}`, type: mod.mode, damageType });
    }
  }
  return out;
}

/** СЛ спасброска концентрации при уроне: 10 или половина урона. */
export function concentrationDc(damage: number): number {
  return Math.max(10, Math.floor(Math.max(0, damage) / 2));
}

/** Эффекты концентрации существа-источника (`sourceId`). */
export function concentratingEffects(
  effects: EffectInstance[] | undefined,
  sourceId?: string
): EffectInstance[] {
  return (effects ?? []).filter((e) => e.concentration && (!sourceId || e.sourceId === sourceId));
}

/** Есть ли у существа активная концентрация. */
export function hasConcentration(effects: EffectInstance[] | undefined, sourceId?: string): boolean {
  return concentratingEffects(effects, sourceId).length > 0;
}

/** Короткое описание длительности для чипов и тултипов. */
export function effectDurationText(duration: EffectDuration): string {
  switch (duration.type) {
    case 'rounds':
      return `${duration.rounds} раунд.`;
    case 'untilSave':
      return `до спасброска (${duration.timing === 'start' ? 'начало' : 'конец'} хода)`;
    case 'endOfTurn':
      return duration.of === 'target' ? 'до конца хода цели' : 'до конца хода источника';
    case 'concentration':
      return 'концентрация';
    case 'permanent':
      return 'до снятия';
  }
}

function signedValue(value: number | string | undefined): string {
  if (value === undefined) return '';
  if (typeof value === 'number') return value >= 0 ? `+${value}` : `${value}`;
  return value.startsWith('-') ? value : `+${value}`;
}

/** Человекочитаемая суть эффекта для тултипа: состояния и модификаторы. */
export function effectSummary(effect: EffectInstance): string | undefined {
  const parts: string[] = [];
  for (const key of effect.conditions ?? []) parts.push(conditionName(key));
  for (const mod of effect.modifiers) {
    const v = signedValue(mod.value);
    switch (mod.mode) {
      case 'advantage':
        parts.push(
          mod.target === 'attack'
            ? 'атаки по цели с преимуществом'
            : mod.target === 'save'
              ? 'преимущество на спасброски'
              : mod.target === 'check'
                ? 'преимущество на проверки'
                : 'преимущество'
        );
        break;
      case 'disadvantage':
        parts.push(
          mod.target === 'attack'
            ? 'атаки по цели с помехой'
            : mod.target === 'save'
              ? 'помеха на спасброски'
              : mod.target === 'check'
                ? 'помеха на проверки'
                : 'помеха'
        );
        break;
      case 'add': {
        const target =
          mod.target === 'attack'
            ? 'к атакам'
            : mod.target === 'damage'
              ? mod.filter?.targetId
                ? 'к урону по метке'
                : 'к урону'
              : mod.target === 'save'
                ? 'к спасброскам'
                : mod.target === 'check'
                  ? 'к проверкам'
                  : mod.target === 'ac'
                    ? 'к AC'
                    : mod.target === 'speed'
                      ? 'фт скорости'
                      : mod.target === 'initiative'
                        ? 'к инициативе'
                        : mod.target === 'maxHp'
                          ? 'к максимуму HP'
                          : mod.target === 'extraActions'
                            ? 'доп. действие'
                            : mod.target === 'extraBonusActions'
                              ? 'доп. бонусное действие'
                              : mod.target === 'spellAttack'
                                ? 'к атаке заклинанием'
                                : mod.target === 'spellDc'
                                  ? 'к СЛ заклинаний'
                                  : '';
        parts.push(target ? `${v} ${target}` : v);
        break;
      }
      case 'multiply':
        parts.push(
          `×${mod.value ?? 0}${mod.target === 'speed' ? ' к скорости' : mod.target === 'ac' ? ' к AC' : ''}`
        );
        break;
      case 'set':
        parts.push(mod.target === 'ac' ? `AC не ниже ${mod.value ?? 0}` : `= ${mod.value ?? 0}`);
        break;
      case 'resistance':
      case 'immunity':
      case 'vulnerability': {
        const label =
          mod.mode === 'resistance' ? 'сопротивление' : mod.mode === 'immunity' ? 'иммунитет' : 'уязвимость';
        const type = damageTypeName(mod.filter?.damageType);
        parts.push(type ? `${label}: ${type}` : label);
        break;
      }
    }
  }
  return parts.length ? parts.join(', ') : undefined;
}
