import type { BestiaryEntry } from '../domain/bestiary';
import type { ClassLevel } from '../domain/sheet';
import type { TokenShape } from '../domain/token';
import { MAX_SHAPE_FORMS } from '../domain/core';

/**
 * Wild Shape (XPHB 2024) и Circle of the Moon: таблицы уровней, лимиты форм
 * и проверки пригодности зверя. Скейл пула/AC — на стороне трансформации.
 */

export interface WildShapeLimit {
  /** Максимальный CR формы (числом: 0.25, 0.5, 1, 2…). */
  maxCr: number;
  /** Сколько форм знает друид (Beast Shapes: 4/6/8). */
  known: number;
  /** Разрешены формы с Fly Speed (с 8 уровня). */
  fly: boolean;
  /** Circle of the Moon: CR = ⌊уровень/3⌋, temp HP ×3, AC 13+WIS. */
  moon: boolean;
}

/** Уровень друида из классов листа (0 — нет druid). */
export function druidLevelOf(classes: ClassLevel[] | undefined): number {
  if (!Array.isArray(classes)) return 0;
  for (const cls of classes) {
    if (cls?.className === 'druid') return Math.max(0, Math.round(cls.level || 0));
  }
  return 0;
}

/** Круг луны выбран в листе. */
export function hasMoonCircle(classes: ClassLevel[] | undefined): boolean {
  return !!classes?.some((cls) => cls?.className === 'druid' && cls.subclass === 'moon');
}

/** Таблица Beast Shapes: undefined — Wild Shape ещё недоступен (уровень < 2). */
export function wildShapeLimit(druidLevel: number, moon = false): WildShapeLimit | undefined {
  if (druidLevel < 2) return undefined;
  const base =
    druidLevel >= 8
      ? { known: 8, maxCr: 1, fly: true }
      : druidLevel >= 4
        ? { known: 6, maxCr: 0.5, fly: false }
        : { known: 4, maxCr: 0.25, fly: false };
  const moonCr = Math.floor(druidLevel / 3);
  const maxCr = moon && moonCr > base.maxCr ? moonCr : base.maxCr;
  return { ...base, maxCr, moon };
}

/** Temp HP формы: дикий облик — уровень друида, круг луны — трижды уровень. */
export function wildShapeTempHp(druidLevel: number, moon = false): number {
  return Math.max(0, Math.round(moon ? druidLevel * 3 : druidLevel));
}

/**
 * Каст в форме (XPHB): разрешён только в Wild Shape по Beast Spells (друиду 18+);
 * из Polymorph кастовать нельзя независимо от класса.
 */
export function shapeAllowsSpellcast(
  shape: Pick<TokenShape, 'kind'> | undefined,
  classes: ClassLevel[] | undefined
): boolean {
  if (!shape) return true;
  return shape.kind === 'wildShape' && druidLevelOf(classes) >= 18;
}

/** CR строкой каталога (`0`, `1/8`, `1/2`, `13`) в число. */
export function crValue(cr: string): number {
  const text = String(cr ?? '').trim();
  const fraction = /^(\d+)\s*\/\s*(\d+)$/.exec(text);
  if (fraction) {
    const denom = Number(fraction[2]);
    return denom ? Number(fraction[1]) / denom : 0;
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : 0;
}

export type ShapeFormIssue = 'shapeNoBeast' | 'shapeTooBig' | 'shapeNoFly';

/** Пригодность зверя для Wild Shape: только Beast, лимит CR, полёт по уровню. */
export function wildShapeFormIssue(entry: BestiaryEntry, limit: WildShapeLimit): ShapeFormIssue | undefined {
  if (entry.type !== 'beast') return 'shapeNoBeast';
  if (crValue(entry.cr) > limit.maxCr + 1e-9) return 'shapeTooBig';
  if (!limit.fly && entry.fly === true) return 'shapeNoFly';
  return undefined;
}

/** Пригодность зверя для Polymorph: любой Beast не выше CR цели (полёт можно). */
export function polymorphFormIssue(entry: BestiaryEntry, maxCr: number): 'shapeNoBeast' | 'shapeTooBig' | undefined {
  if (entry.type !== 'beast') return 'shapeNoBeast';
  return crValue(entry.cr) > maxCr + 1e-9 ? 'shapeTooBig' : undefined;
}

/** Лимит известных форм: по таблице уровня, но не больше `MAX_SHAPE_FORMS`. */
export function knownShapeLimit(druidLevel: number, moon = false): number {
  return Math.min(MAX_SHAPE_FORMS, wildShapeLimit(druidLevel, moon)?.known ?? 0);
}
