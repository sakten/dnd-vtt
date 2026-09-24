import type { AbilityKey } from '../domain/core';
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
  if (!input.effects?.some((e) => e.weaponOverride)) return { attacks, hands: input.hands, context };
  return {
    attacks: attacks.map((attack) => applyWeaponOverrides(attack, input.effects, context)),
    hands: input.hands,
    context,
  };
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
