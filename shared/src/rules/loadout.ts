import type { AbilityKey } from '../domain/core';
import { abilityMod } from '../domain/core';
import type { EffectInstance } from '../domain/effects';
import type { FeatureChoice } from '../domain/feature';
import type { CharacterSheet, ClassLevel, SheetHands } from '../domain/sheet';
import type { AttackEntry } from '../domain/token';
import { proficiencyBonus } from './classes';
import { handAttackOf, type HandKey } from './hands';
import { d20Expr } from './sheet';
import { damageExpression, type WeaponContext } from './weapons';

/** Контекст оружия из листа персонажа (характеристики, классы, выборы). */
export function weaponContextOf(sheet?: CharacterSheet | null): WeaponContext {
  return {
    abilities: sheet?.abilities ?? {},
    classes: sheet?.classes ?? [],
    ...(sheet?.choices ? { choices: sheet.choices } : {}),
  };
}

/** Лоадаут актора: атаки, руки и контекст пересчёта оружия. */
export interface ActorLoadout {
  attacks: AttackEntry[];
  hands?: SheetHands;
  context: WeaponContext;
}

export interface LoadoutInput {
  /** Сохранённые атаки (листа персонажа или токена/формы) — выбирает вызывающий. */
  attacks?: AttackEntry[];
  hands?: SheetHands;
  effects?: EffectInstance[];
  abilities?: Partial<Record<AbilityKey, number>>;
  classes?: ClassLevel[];
  choices?: FeatureChoice[];
}

/** Префикс синтетических id атак Shadow Blade (`shadow:<effectId>[:thrown]`). */
export const SHADOW_BLADE_PREFIX = 'shadow:';

/** id эффекта-клинка тени из синтетической атаки (undefined — обычная запись листа). */
export function shadowBladeEffectIdOf(attack: AttackEntry): string | undefined {
  const id = attack.id;
  if (!id?.startsWith(SHADOW_BLADE_PREFIX)) return undefined;
  return id.slice(SHADOW_BLADE_PREFIX.length).replace(/:thrown$/, '');
}

/** Брошенный клинок тени (дальняя синтетическая атака) — после броска клинок исчезает. */
export function isShadowBladeThrown(attack: AttackEntry): boolean {
  return !!attack.id?.startsWith(SHADOW_BLADE_PREFIX) && !!attack.id.endsWith(':thrown');
}

/** Атаки клинка тени: ближняя 5 фт и метание 20/60 (психический, ловкость/сила). */
function shadowBladeEntries(effect: EffectInstance, context: WeaponContext): AttackEntry[] {
  const blade = effect.shadowBlade;
  if (!blade?.inHand) return [];
  const totalLevel = context.classes.reduce((acc, c) => acc + Math.max(1, c.level), 0);
  const pb = proficiencyBonus(totalLevel || 1);
  const mod = Math.max(abilityMod(context.abilities.str ?? 10), abilityMod(context.abilities.dex ?? 10));
  const melee: AttackEntry = {
    id: `${SHADOW_BLADE_PREFIX}${effect.id}`,
    name: 'Клинок тени',
    hit: d20Expr(pb + mod),
    damage: damageExpression(blade.dice, mod),
    damageType: 'psychic',
    rangeType: 'melee',
    rangeNormal: 5,
    rangeLong: 0,
  };
  return [melee, { ...melee, id: `${melee.id}:thrown`, rangeType: 'ranged', rangeNormal: 20, rangeLong: 60 }];
}

/**
 * Производный лоадаут: сохранённые атаки/руки + оружие и оверрайды от активных
 * эффектов (Shadow Blade — временный клинок в правой руке, Shillelagh — кость и
 * характеристика клуба/посоха). Чистая функция, одинаковая на клиенте и сервере,
 * поэтому порядок и индексы атак совпадают. Без таких эффектов возвращает исходные
 * значения без копирования.
 */
export function loadoutOf(input: LoadoutInput): ActorLoadout {
  const attacks = input.attacks ?? [];
  const context: WeaponContext = {
    abilities: input.abilities ?? {},
    classes: input.classes ?? [],
    ...(input.choices ? { choices: input.choices } : {}),
  };
  const effects = input.effects ?? [];
  const hasOverrides = effects.some((e) => e.weaponOverride);
  const blades = effects.filter((e) => e.shadowBlade);
  if (!hasOverrides && !blades.length) return { attacks, hands: input.hands, context };
  const mapped = hasOverrides ? attacks.map((attack) => applyWeaponOverrides(attack, effects, context)) : attacks;
  const extra = blades.flatMap((effect) => shadowBladeEntries(effect, context));
  return { attacks: extra.length ? [...mapped, ...extra] : mapped, hands: input.hands, context };
}

/**
 * Подмена атаки оружия эффектами (Shillelagh): кость, тип урона и характеристика
 * (`abilityMod` зафиксирован при касте). `offhand` — вторая рука: урон без
 * модификатора (как `weaponAttackEntry` с `offhand: true`).
 */
export function applyWeaponOverrides(
  attack: AttackEntry,
  effects: EffectInstance[] | undefined,
  context: WeaponContext,
  opts: { offhand?: boolean } = {}
): AttackEntry {
  if (!attack.weaponKey) return attack;
  let result = attack;
  for (const override of effects ?? []) {
    const o = override.weaponOverride;
    if (!o || !o.weapons.includes(attack.weaponKey)) continue;
    const totalLevel = context.classes.reduce((acc, c) => acc + Math.max(1, c.level), 0);
    const pb = proficiencyBonus(totalLevel || 1);
    const mod = opts.offhand ? Math.min(0, o.abilityMod) : o.abilityMod;
    result = {
      ...result,
      hit: d20Expr(pb + o.abilityMod),
      damage: damageExpression(o.dice, mod),
      damageType: o.damageType,
    };
  }
  return result;
}

/** Оружие в руке из лоадаута (с учётом производных от эффектов). */
export function handOf(loadout: ActorLoadout, hand: HandKey): AttackEntry | undefined {
  return handAttackOf(loadout.attacks, loadout.hands, hand);
}
