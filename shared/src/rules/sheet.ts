import type { SkillLevel } from '../domain/core';

/**
 * Бонус владения/экспертизы как часть формулы броска: числа («+3», «+6»)
 * и кости («+d4», «+2d4» — домашние правила с костью владения).
 * Экспертиза (уровень 2) удваивает бонус: число ×2, кость ×2 по количеству.
 */
export function bonusPart(pb: string, level: SkillLevel | 0): string {
  if (level === 0) return '';
  const trimmed = pb.trim();
  if (!trimmed) return '';
  if (level === 1) return `+${trimmed}`;
  const num = trimmed.match(/^(\d+)$/);
  if (num) return `+${Number(num[1]) * 2}`;
  const die = trimmed.match(/^(\d*)d(\d+)$/i);
  if (die) {
    const count = die[1] ? Number(die[1]) : 1;
    return `+${count * 2}d${die[2]}`;
  }
  return `+${trimmed}`;
}

/** Знак модификатора в формуле: `+3` / `-2` (ноль — `+0`). */
export function fmtMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/** Формула броска d20: `d20±мод`. */
export function d20Expr(mod: number): string {
  return `d20${fmtMod(mod)}`;
}

/** Формула проверки/спасброска: `d20±мод` + владение/экспертиза (`bonusPart`). */
export function d20Check(mod: number, pb: string, level: SkillLevel | 0): string {
  return `d20${fmtMod(mod)}${bonusPart(pb, level)}`;
}
