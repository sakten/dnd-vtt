export type Role = 'dm' | 'player';

export type Faction = 'ally' | 'enemy' | 'neutral';

export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export type SkillLevel = 0 | 1 | 2;

export const MAX_CLASSES = 2;
/** Верхняя граница числа атак/оружия (список динамический, не фиксированный). */
export const MAX_ATTACKS = 10;
/** Верхняя граница числа выбранных заклинаний в листе. */
export const MAX_SHEET_SPELLS = 200;
/** Верхняя граница числа выборов способностей (фиты/манёвры/метамагия). */
export const MAX_FEATURE_CHOICES = 100;
export const MAX_CONDITIONS = 20;
export const MAX_EFFECTS = 20;
export const MAX_MODIFIERS = 20;
/** Базовая скорость существа, футы. */
export const DEFAULT_SPEED = 30;

/** Класс брони по умолчанию, если у токена/листа поле AC не заполнено. */
export const DEFAULT_AC = 13;

export const DEFAULT_ABILITIES: Record<AbilityKey, number> = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
};

export function abilityMod(value: number): number {
  return Math.floor((value - 10) / 2);
}

export function clampCells(n: number): number {
  return Math.min(4, Math.max(1, Math.round(n || 1)));
}

/** Числовой стат из строки: пусто/мусор → 0, иначе целое >= 0. */
export function statNumber(value: string | number | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/** AC и Макс. ХП задаются только парой: оба заполнены или оба пусты. */
export function statsPaired(ac: string, hpMax: string): boolean {
  return statNumber(ac) > 0 === statNumber(hpMax) > 0;
}
