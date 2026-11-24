import { abilityMod } from '../domain/core';
import type { FeatureChoice } from '../domain/feature';
import type { CharacterSheet, ClassLevel } from '../domain/sheet';
import { clampLevel } from './classes';

/** Элементарное родство драконьего чародея (XPHB): выбор типа урона на 6 уровне. */
export const ELEMENTAL_AFFINITY_KEY = 'sorcerer.draconic:elementalAffinity';
export const ELEMENTAL_AFFINITY_TYPES = ['acid', 'cold', 'fire', 'lightning', 'poison'] as const;
export type ElementalAffinityType = (typeof ELEMENTAL_AFFINITY_TYPES)[number];

/** Уровень чародея-драконьего происхождения (0 — подкласс не выбран). */
export function draconicSorcererLevel(classes: ClassLevel[]): number {
  const entry = classes.find((c) => c.className === 'sorcerer' && c.subclass === 'draconic');
  return entry ? clampLevel(entry.level) : 0;
}

export function elementalAffinityAvailable(classes: ClassLevel[]): boolean {
  return draconicSorcererLevel(classes) >= 6;
}

/** Выбранный тип стихии из слотов `FeatureChoice` (`kind: 'featureOption'`). */
export function elementalAffinityType(choices?: FeatureChoice[]): ElementalAffinityType | undefined {
  const chosen = (choices ?? []).find(
    (c) => c.kind === 'featureOption' && c.key === ELEMENTAL_AFFINITY_KEY
  )?.list;
  return ELEMENTAL_AFFINITY_TYPES.find((type) => type === chosen);
}

/** Прибавка к одному броску урона заклинания выбранной стихии: мод. Харизмы. */
export interface ElementalAffinityBonus {
  damageType: ElementalAffinityType;
  amount: number;
}

export function elementalAffinityBonus(
  sheet: Pick<CharacterSheet, 'classes' | 'choices' | 'abilities'>
): ElementalAffinityBonus | undefined {
  if (!elementalAffinityAvailable(sheet.classes)) return undefined;
  const damageType = elementalAffinityType(sheet.choices);
  if (!damageType) return undefined;
  const amount = abilityMod(sheet.abilities.cha ?? 10);
  return amount > 0 ? { damageType, amount } : undefined;
}

/** Драконья устойчивость: +3 HP на 3 ур. и +1 за каждый следующий уровень чародея. */
export function draconicResilienceHpBonus(classes: ClassLevel[]): number {
  const level = draconicSorcererLevel(classes);
  return level >= 3 ? level : 0;
}
