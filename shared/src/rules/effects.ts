import { abilityMod, type AbilityKey } from '../domain/core';
import type { DamageDefense } from '../domain/damage';
import type {
  ConditionInstance,
  ConditionKey,
  EffectDuration,
  EffectInstance,
  Modifier,
  ModifierTarget,
  Restrictions,
} from '../domain/effects';
import type { AttackRangeType } from '../domain/token';
import { DAMAGE_TYPES } from '../labels';
import { isIncapacitated } from './conditions';

/** Контекст применения модификатора (фильтры attackType/ability/skill/damageType). */
export interface ModifierContext {
  attackType?: 'melee' | 'ranged';
  rangeType?: AttackRangeType;
  ability?: AbilityKey;
  skill?: string;
  damageType?: string;
  /** Цель действия (для эффектов с filter.targetId — Hex/Hunter's Mark). */
  targetId?: string;
  /** Направление модификатора атаки (Reckless Attack и подобные). */
  direction?: 'self' | 'against';
  /** Бросок атаки оружием (true) или заклинанием (false/undefined). */
  weapon?: boolean;
  /** Спасбросок против конкретного состояния (Protection from Poison). */
  condition?: ConditionKey;
  /** Спасбросок против заклинаний/магических эффектов (Circle of Power). */
  magical?: boolean;
  /** Тип существа атакующего (Protection from Evil and Good). */
  attackerType?: string;
}

/** Слагаемые, кости и режим d20, собранные с модификаторов. */
export interface RollParts {
  flat: number;
  dice: string[];
  mode?: 'a' | 'd';
}

const ABILITY_KEYS: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

const DAMAGE_TYPE_KEYS = new Set(DAMAGE_TYPES.map((type) => type.key));

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
  if (f.direction && f.direction !== ctx.direction) return false;
  if (f.weapon !== undefined && f.weapon !== ctx.weapon) return false;
  if (f.condition && f.condition !== ctx.condition) return false;
  if (f.conditions && (!ctx.condition || !f.conditions.includes(ctx.condition))) return false;
  if (f.magical !== undefined && f.magical !== ctx.magical) return false;
  if (f.creatureTypes && (!ctx.attackerType || !f.creatureTypes.includes(ctx.attackerType))) return false;
  return true;
}

/**
 * Изгнан ли носитель (Banishment): токен скрыт с карты и не является целью/
 * помехой, пока эффект с точкой возврата активен.
 */
export function isBanished(token: { effects?: EffectInstance[] } | null | undefined): boolean {
  return !!token?.effects?.some((e) => e.banish);
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
  return { flat, dice, mode: rollMode(adv, dis) };
}

/**
 * Режим d20 по правилам 5e: источники не сальдируются — если есть и
 * преимущество, и помеха, бросок обычный (один d20), сколько бы их ни было.
 */
export function rollMode(advantage: number, disadvantage: number): 'a' | 'd' | undefined {
  if (advantage > 0 && disadvantage > 0) return undefined;
  if (advantage > 0) return 'a';
  if (disadvantage > 0) return 'd';
  return undefined;
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
  return { flat, dice, mode: rollMode(adv, dis) };
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
  const self = rollParts(collectModifiers(attackerEffects, 'attack', { ...ctx, direction: 'self' }), attackerAbilities);
  let adv = self.mode === 'a' ? 1 : 0;
  let dis = self.mode === 'd' ? 1 : 0;
  const defenderBias = rollBias(
    collectModifiers(defenderEffects, 'attack', { ...ctx, direction: 'against' }).filter((m) => m.mode !== 'add')
  );
  adv += defenderBias.adv;
  dis += defenderBias.dis;
  return { flat: self.flat, dice: self.dice, mode: rollMode(adv, dis) };
}

const BOOLEAN_RESTRICTIONS = [
  'noActions',
  'noBonus',
  'noReactions',
  'noOpportunityAttacks',
  'ignoresOpportunityAttacks',
  'oneAttackOnly',
  'actionOrBonusOnly',
  'noSpells',
] as const;

/**
 * Суммарные ограничения экономики/действий: недееспособность запрещает
 * действия/бонусы/реакции, эффекты добавляют точечные (`restrictions`).
 */
export function restrictionsFor(
  conditions: ConditionInstance[] | undefined,
  effects: EffectInstance[] | undefined
): Restrictions {
  const out: Restrictions = {};
  if (isIncapacitated(conditions)) {
    out.noActions = true;
    out.noBonus = true;
    out.noReactions = true;
  }
  for (const effect of effects ?? []) {
    const added = effect.restrictions;
    if (!added) continue;
    for (const key of BOOLEAN_RESTRICTIONS) {
      if (added[key]) out[key] = true;
    }
    if (added.noActions) out.noActionsFromEffect = true;
    if (added.spellFailureChance) {
      out.spellFailureChance = Math.max(out.spellFailureChance ?? 0, added.spellFailureChance);
    }
  }
  return out;
}

/** Бонусы/помехи к спасброску (модификаторы на самом бросающем). */
export function saveRollParts(
  effects: EffectInstance[] | undefined,
  ability: AbilityKey,
  abilities?: Partial<Record<AbilityKey, number>>,
  condition?: ConditionKey,
  magical?: boolean
): RollParts {
  return rollParts(collectModifiers(effects, 'save', { ability, condition, magical }), abilities);
}

/** Слагаемые, кости и режим проверки характеристики/навыка от эффектов (Enhance Ability). */
export function checkRollParts(
  effects: EffectInstance[] | undefined,
  ctx: ModifierContext,
  abilities?: Partial<Record<AbilityKey, number>>
): RollParts {
  return rollParts(collectModifiers(effects, 'check', ctx), abilities);
}

/** Итоговый режим d20 из частей эффектов и пользовательского выбора Adv/Dis (взаимно гасятся). */
export function combineRollMode(parts: RollParts, userMode?: 'a' | 'd' | null): 'a' | 'd' | undefined {
  const adv = (parts.mode === 'a' ? 1 : 0) + (userMode === 'a' ? 1 : 0);
  const dis = (parts.mode === 'd' ? 1 : 0) + (userMode === 'd' ? 1 : 0);
  return rollMode(adv, dis);
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
    if (mod.mode === 'multiply') {
      // Дробные множители (Slow/Spirit Guardians — 0.5) не округляются до 1: округляется только итог.
      const factor = typeof mod.value === 'number' ? mod.value : evalModifierValue(mod.value ?? 0, abilities);
      value = Math.round(value * factor);
    }
  }
  return value;
}

/** Защиты (сопротивления/иммунитеты/уязвимости), наложенные эффектами. */
/** Состояния, к которым у носителя есть иммунитет от эффектов (Freedom of Movement, Heroism). */
export function conditionImmunities(effects: EffectInstance[] | undefined): Set<ConditionKey> {
  const out = new Set<ConditionKey>();
  for (const effect of effects ?? []) {
    for (const key of effect.conditionImmunities ?? []) out.add(key);
  }
  return out;
}

/** Иммунитет к состоянию только от существа указанного типа (Protection from Evil and Good). */
export function immuneFromSource(
  effects: EffectInstance[] | undefined,
  condition: ConditionKey,
  sourceType: string | undefined
): boolean {
  if (!sourceType) return false;
  return (effects ?? []).some(
    (e) =>
      e.conditionImmunitiesFrom?.conditions.includes(condition) === true &&
      e.conditionImmunitiesFrom.types.includes(sourceType)
  );
}

/** Магические эффекты не снижают скорость (Freedom of Movement). */
export function immuneToSpeedReduction(effects: EffectInstance[] | undefined): boolean {
  return (effects ?? []).some((e) => e.immuneToSpeedReduction === true);
}

/** Оружейные атаки носителя считаются магическими (Magic Weapon). */
export function magicWeaponAttacks(effects: EffectInstance[] | undefined): boolean {
  return (effects ?? []).some((e) => e.magicWeapon === true);
}

const MAGICAL_PHYSICAL: Record<string, string> = {
  slashing: 'magicalSlashing',
  piercing: 'magicalPiercing',
  bludgeoning: 'magicalBludgeoning',
};

/** Тип физического урона магического оружия: `slashing` → `magicalSlashing` (прочие — как есть). */
export function magicalDamageType(type: string | undefined): string | undefined {
  return type ? MAGICAL_PHYSICAL[type] ?? type : type;
}

/** Сложная местность и клетки союзников не замедляют (Freedom of Movement). */
export function ignoresDifficultTerrain(effects: EffectInstance[] | undefined): boolean {
  return (effects ?? []).some((e) => e.ignoresDifficultTerrain === true);
}

/** Носитель эффектов видит невидимых существ (See Invisibility). */
export function seesInvisible(effects: EffectInstance[] | undefined): boolean {
  return (effects ?? []).some((e) => e.seesInvisible === true);
}

/** Лечение носителя берёт максимум костей (Beacon of Hope). */
export function maximizeHealing(effects: EffectInstance[] | undefined): boolean {
  return (effects ?? []).some((e) => e.maximizeHealing === true);
}

/** Преимущество на спасброски от смерти (Beacon of Hope). */
export function deathSaveAdvantage(effects: EffectInstance[] | undefined): boolean {
  return (effects ?? []).some((e) => e.deathSaveAdvantage === true);
}

/** Успешный спасбросок отменяет урон целиком вместо половины (Circle of Power). */
export function saveNoDamage(effects: EffectInstance[] | undefined): boolean {
  return (effects ?? []).some((e) => e.saveNoDamage === true);
}

/** Ответный урон атакующему (Armor of Agathys) из эффектов носителя. */
export function retaliationOf(
  effects: EffectInstance[] | undefined
): { damageType: string; amount: number } | undefined {
  for (const effect of effects ?? []) {
    if (effect.retaliate) return effect.retaliate;
  }
  return undefined;
}

/** Warding Bond: токены-источники, на которые переносится урон носителя. */
export function damageLinks(effects: EffectInstance[] | undefined): string[] {
  const out: string[] = [];
  for (const effect of effects ?? []) {
    const id = effect.damageLink?.tokenId;
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

/** Eyebite: цель уже успешно спаслась против этого каста (метка на эффекте). */
export function savedAgainst(
  effects: EffectInstance[] | undefined,
  sourceId: string,
  key: string
): boolean {
  return (effects ?? []).some(
    (e) => e.saveMarker === true && e.sourceId === sourceId && e.sourceKey === key
  );
}

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

/** Структурная часть текста для i18n: ключ каталога клиента и параметры подстановки. */
export interface EffectTextPart {
  key: string;
  params?: Record<string, string | number>;
}

/** Части длительности эффекта для i18n (`domain.effect.duration.*`). */
export function effectDurationParts(duration: EffectDuration): EffectTextPart {
  switch (duration.type) {
    case 'rounds':
      return { key: 'domain.effect.duration.rounds', params: { n: duration.rounds } };
    case 'untilSave':
      return {
        key: duration.timing === 'start' ? 'domain.effect.duration.untilSaveStart' : 'domain.effect.duration.untilSaveEnd',
      };
    case 'endOfTurn':
      return {
        key:
          duration.of === 'target'
            ? 'domain.effect.duration.endOfTurnTarget'
            : 'domain.effect.duration.endOfTurnSource',
      };
    case 'concentration':
      return { key: 'domain.effect.duration.concentration' };
    case 'permanent':
      return { key: 'domain.effect.duration.permanent' };
  }
}

/** Структурная суть эффекта для тултипа (i18n): состояния и модификаторы. */
export function effectSummaryParts(effect: EffectInstance): EffectTextPart[] {
  if (effect.hidden) return [];
  const parts: EffectTextPart[] = [];
  for (const key of effect.conditions ?? []) parts.push({ key: `domain.condition.${key}` });
  for (const key of effect.conditionImmunities ?? []) {
    parts.push({ key: 'domain.effect.immuneTo', params: { condition: key } });
  }
  if (effect.conditionImmunitiesFrom) {
    parts.push({
      key: 'domain.effect.immuneFrom',
      params: {
        conditions: effect.conditionImmunitiesFrom.conditions.join(','),
        types: effect.conditionImmunitiesFrom.types.join(','),
      },
    });
  }
  if (effect.immuneToSpeedReduction) parts.push({ key: 'domain.effect.noSpeedReduction' });
  if (effect.ignoresDifficultTerrain) parts.push({ key: 'domain.effect.ignoreDifficult' });
  if (effect.triggers?.startOfTurn?.damage) {
    parts.push({
      key: 'domain.effect.startOfTurnDamage',
      params: { dice: effect.triggers.startOfTurn.damage.dice },
    });
  }
  if (effect.triggers?.startOfTurn?.tempHp) {
    parts.push({ key: 'domain.effect.startOfTurnTempHp', params: { amount: effect.triggers.startOfTurn.tempHp } });
  }
  if (effect.misdirect) {
    parts.push({ key: 'domain.effect.mirrorImages', params: { charges: effect.misdirect.charges } });
  }
  if (effect.magicWeapon) parts.push({ key: 'domain.effect.magicWeapon' });
  if (effect.damageLink) parts.push({ key: 'domain.effect.damageLink' });
  if (effect.maximizeHealing) parts.push({ key: 'domain.effect.maxHeal' });
  if (effect.deathSaveAdvantage) parts.push({ key: 'domain.effect.deathSaveAdv' });
  if (effect.saveNoDamage) parts.push({ key: 'domain.effect.saveNoDamage' });
  if (effect.sanctuary) parts.push({ key: 'domain.effect.sanctuary' });
  if (effect.retaliate) {
    parts.push({
      key: 'domain.effect.retaliate',
      params: { damage: effect.retaliate.amount, type: effect.retaliate.damageType },
    });
  }
  for (const mod of effect.modifiers) {
    switch (mod.mode) {
      case 'advantage':
        if (mod.target === 'save' && mod.filter?.magical) {
          parts.push({ key: 'domain.effect.advSavesMagical' });
          break;
        }
        if (mod.target === 'save' && mod.filter?.conditions?.length) {
          parts.push({
            key: 'domain.effect.advSavesConditions',
            params: { conditions: mod.filter.conditions.join(',') },
          });
          break;
        }
        parts.push({
          key:
            mod.target === 'attack'
              ? 'domain.effect.advAttackAgainst'
              : mod.target === 'save'
                ? 'domain.effect.advSaves'
                : mod.target === 'check'
                  ? 'domain.effect.advChecks'
                  : 'domain.effect.adv',
        });
        break;
      case 'disadvantage':
        if (mod.target === 'save' && mod.filter?.conditions?.length) {
          parts.push({
            key: 'domain.effect.disSavesConditions',
            params: { conditions: mod.filter.conditions.join(',') },
          });
          break;
        }
        parts.push({
          key:
            mod.target === 'attack'
              ? 'domain.effect.disAttackAgainst'
              : mod.target === 'save'
                ? 'domain.effect.disSaves'
                : mod.target === 'check'
                  ? 'domain.effect.disChecks'
                  : 'domain.effect.dis',
        });
        break;
      case 'add': {
        const raw = mod.value;
        // Типизированные кости (`1d6necrotic`): тип уходит отдельной частью сводки.
        const typed = typeof raw === 'string' ? /^(.*?\d+d\d+)([a-z]+)$/.exec(raw.trim().toLowerCase()) : null;
        const base = typed ? typed[1]! : raw;
        const value =
          base === undefined
            ? ''
            : typeof base === 'number'
              ? base >= 0
                ? `+${base}`
                : `${base}`
              : base.startsWith('-')
                ? base
                : `+${base}`;
        const target =
          mod.target === 'attack'
            ? 'addAttack'
            : mod.target === 'damage'
              ? mod.filter?.targetId
                ? 'addDamageMark'
                : 'addDamage'
              : mod.target === 'save'
                ? 'addSave'
                : mod.target === 'check'
                  ? 'addCheck'
                  : mod.target === 'ac'
                    ? 'addAc'
                    : mod.target === 'speed'
                      ? 'addSpeed'
                      : mod.target === 'initiative'
                        ? 'addInitiative'
                        : mod.target === 'maxHp'
                          ? 'addMaxHp'
                          : mod.target === 'extraActions'
                            ? 'addExtraAction'
                            : mod.target === 'extraBonusActions'
                              ? 'addExtraBonus'
                              : mod.target === 'spellAttack'
                                ? 'addSpellAttack'
                                : mod.target === 'spellDc'
                                  ? 'addSpellDc'
                                  : mod.target === 'reach'
                                    ? 'addReach'
                                    : 'add';
        parts.push({ key: `domain.effect.${target}`, params: { value } });
        if (typed) parts.push({ key: `domain.damage.${typed[2]}` as EffectTextPart['key'] });
        break;
      }
      case 'multiply':
        parts.push({
          key:
            mod.target === 'speed'
              ? 'domain.effect.multiplySpeed'
              : mod.target === 'ac'
                ? 'domain.effect.multiplyAc'
                : 'domain.effect.multiply',
          params: { value: mod.value ?? 0 },
        });
        break;
      case 'set':
        parts.push({
          key: mod.target === 'ac' ? 'domain.effect.setAc' : 'domain.effect.set',
          params: { value: mod.value ?? 0 },
        });
        break;
      case 'resistance':
      case 'immunity':
      case 'vulnerability': {
        const type = mod.filter?.damageType;
        parts.push(
          type && DAMAGE_TYPE_KEYS.has(type)
            ? { key: `domain.effect.${mod.mode}`, params: { type } }
            : { key: `domain.effect.${mod.mode}Plain` }
        );
        break;
      }
    }
  }
  return parts;
}
