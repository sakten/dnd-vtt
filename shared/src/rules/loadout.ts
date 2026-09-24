import type { AbilityKey } from '../domain/core';
import type { EffectInstance } from '../domain/effects';
import type { FeatureChoice } from '../domain/feature';
import type { CharacterSheet, ClassLevel, SheetHands } from '../domain/sheet';
import type { AttackEntry } from '../domain/token';
import { handAttackOf, type HandKey } from './hands';
import type { WeaponContext } from './weapons';

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
  return { attacks, hands: input.hands, context };
}

/** Оружие в руке из лоадаута (с учётом производных от эффектов). */
export function handOf(loadout: ActorLoadout, hand: HandKey): AttackEntry | undefined {
  return handAttackOf(loadout.attacks, loadout.hands, hand);
}
