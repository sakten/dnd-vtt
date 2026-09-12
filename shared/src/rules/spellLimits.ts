import type { AbilityKey, CharacterSheet, ClassLevel } from '../types';
import raw from '../data/spellcasting.json';
import { CLASSES, PACT_SLOTS, clampLevel, proficiencyBonus } from './classes';

/**
 * Лимиты заклинаний классов (Ф5/Ф6). Данные сгенерированы из 5e.tools
 * (`scripts/build-spells.ts` → `shared/src/data/spellcasting.json`).
 */

export type CasterProgression = 'full' | '1/2' | 'pact' | 'artificer' | 'third' | 'none';

export interface SpellcastingClass {
  ability: AbilityKey | null;
  casterProgression: string;
  cantrips: number[] | null;
  prepared: number[] | null;
  change: string | null;
}

const INFO = raw as unknown as Record<string, SpellcastingClass>;

/**
 * Третьи кастеры (EK/AT) по 2024: характеристика Интеллект, список — волшебника,
 * прогрессии известных заклинаний в данных 5e.tools только текстом — заданы вручную.
 * TODO: сверить таблицы с PHB24.
 */
interface ThirdCaster {
  ability: AbilityKey;
  list: string;
  cantrips: number[];
  prepared: number[];
}

const THIRD_CASTERS: Record<string, ThirdCaster> = {
  'fighter.eldritchKnight': {
    ability: 'int',
    list: 'wizard',
    cantrips: [0, 0, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
    prepared: [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13],
  },
  'rogue.arcaneTrickster': {
    ability: 'int',
    list: 'wizard',
    cantrips: [0, 0, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
    prepared: [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13],
  },
};

/** Информация о третьем кастере подкласса; null — не третье-кастер. */
export function thirdCaster(className: string, subclass?: string): ThirdCaster | null {
  return subclass ? THIRD_CASTERS[`${className}.${subclass}`] ?? null : null;
}

/** Класс, чей список заклинаний использовать (EK/AT берут список волшебника). */
export function spellListClass(className: string, subclass?: string): string {
  return thirdCaster(className, subclass)?.list ?? className;
}

/** Информация о кастере класса; null — класс не кастует. */
export function spellcastingClass(className: string): SpellcastingClass | null {
  return INFO[className] ?? null;
}

/** Базовая характеристика заклинаний класса. */
export function spellcastingAbility(className: string, subclass?: string): AbilityKey | null {
  return thirdCaster(className, subclass)?.ability ?? INFO[className]?.ability ?? null;
}

function tableAt(list: number[] | null | undefined, level: number): number {
  if (!list) return 0;
  return list[clampLevel(level) - 1] ?? 0;
}

/** Максимум кантрипов, известных классу на уровне. */
export function cantripsMax(className: string, level: number, subclass?: string): number {
  const third = thirdCaster(className, subclass);
  return third ? tableAt(third.cantrips, level) : tableAt(INFO[className]?.cantrips, level);
}

/** Максимум известных/подготовленных заклинаний 1+ круга на уровне класса. */
export function spellsMax(className: string, level: number, subclass?: string): number {
  const third = thirdCaster(className, subclass);
  return third ? tableAt(third.prepared, level) : tableAt(INFO[className]?.prepared, level);
}

function isThirdCaster(className: string, subclass?: string): boolean {
  if (!subclass) return false;
  const def = CLASSES[className];
  return def?.caster === 'none' && def.subclasses[subclass]?.caster === 'third';
}

/** Максимальный круг заклинаний, доступный классу на его уровне (изучение/подготовка). */
export function maxSpellLevel(className: string, level: number, subclass?: string): number {
  const lvl = clampLevel(level);
  const info = INFO[className];
  const progression = info?.casterProgression ?? (isThirdCaster(className, subclass) ? 'third' : 'none');
  switch (progression) {
    case 'full':
      return Math.min(9, Math.ceil(lvl / 2));
    case 'pact':
      return PACT_SLOTS[lvl - 1]?.level ?? 0;
    case '1/2':
    case 'artificer':
      return lvl >= 17 ? 5 : lvl >= 13 ? 4 : lvl >= 9 ? 3 : lvl >= 5 ? 2 : 1;
    case 'third':
      return lvl >= 19 ? 4 : lvl >= 13 ? 3 : lvl >= 7 ? 2 : lvl >= 3 ? 1 : 0;
    default:
      return 0;
  }
}

/** Сложность спасброска от заклинаний: 8 + профишенси + мод. характеристики. */
export function spellSaveDc(proficiency: number, abilityMod: number): number {
  return 8 + proficiency + abilityMod;
}

/** Бонус атаки заклинанием: профишенси + мод. характеристики. */
export function spellAttackBonus(proficiency: number, abilityMod: number): number {
  return proficiency + abilityMod;
}

/** Числовой профишенси-бонус листа: из строки, иначе — по суммарному уровню. */
export function sheetProficiencyBonus(sheet: CharacterSheet): number {
  const trimmed = sheet.proficiencyBonus?.trim() ?? '';
  const n = Number(trimmed);
  if (trimmed !== '' && Number.isFinite(n)) return Math.round(n);
  const total = sheet.classes.reduce((acc, c) => acc + clampLevel(c.level), 0);
  return proficiencyBonus(total);
}

/** Классы листа, которые кастуют (включая третьих кастеров EK/AT). */
export function casterClasses(classes: ClassLevel[]): ClassLevel[] {
  return classes.filter((c) => !!spellcastingClass(c.className) || isThirdCaster(c.className, c.subclass));
}
