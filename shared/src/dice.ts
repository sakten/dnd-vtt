import type { DamagePartAmount } from './domain/damage';
import { DAMAGE_TYPES } from './labels';

export type DieSign = 1 | -1;

export interface ParsedDie {
  count: number;
  sides: number;
  keep: number | null;
  advantage: 'a' | 'd' | null;
  sign: DieSign;
  /** Тип урона из суффикса терма (`2d4fire`); нет — основной тип формулы. */
  damageType?: string;
}

export interface ParsedModifier {
  amount: number;
  damageType?: string;
}

export interface DieResult {
  sides: number;
  values: number[];
  dropped: number[];
  advantage: 'a' | 'd' | null;
  sign: DieSign;
  damageType?: string;
}

export interface DiceRollResult {
  expression: string;
  dice: DieResult[];
  modifier: number;
  total: number;
  breakdown: string;
  /** Раскладка урона по типам (для защит по частям). */
  damageParts: DamagePartAmount[];
}

export type DiceErrorCode =
  | 'rollEmpty'
  | 'rollNoDice'
  | 'rollSyntax'
  | 'rollTooLong'
  | 'rollDiceCount'
  | 'rollDieSides'
  | 'rollKeepRange'
  | 'rollValueRange';

/** Ошибка разбора выражения; текст рендерит клиент по `code` (i18n). */
export class DiceParseError extends Error {
  readonly code: DiceErrorCode;
  readonly params?: Record<string, string | number>;

  constructor(code: DiceErrorCode, params?: Record<string, string | number>) {
    super(code);
    this.name = 'DiceParseError';
    this.code = code;
    this.params = params;
  }
}

const MAX_DICE = 100;
const MAX_SIDES = 1000;
/** Лимит длины выражения: до цикла разбора (защита от O(n²) на огромных строках). */
const MAX_EXPR_LENGTH = 200;

/** Тип урона в суффиксе терма: `1d6fire`, `+3force` (только канонические ключи). */
const TYPE_PATTERN = DAMAGE_TYPES.map((d) => d.key).join('|');

export function parseDiceExpression(expr: string): {
  dice: ParsedDie[];
  modifier: number;
  modifiers: ParsedModifier[];
} {
  const s = expr.replace(/\s+/g, '').toLowerCase();
  if (s.length === 0) throw new DiceParseError('rollEmpty');
  if (s.length > MAX_EXPR_LENGTH) throw new DiceParseError('rollTooLong', { max: MAX_EXPR_LENGTH });

  const dice: ParsedDie[] = [];
  const modifiers: ParsedModifier[] = [];
  let modifier = 0;
  let totalDice = 0;
  let sawNumber = false;
  let pos = 0;

  const pushDie = (
    count: number,
    sides: number,
    keep: number | null,
    advantage: 'a' | 'd' | null,
    sign: DieSign,
    damageType: string | undefined
  ) => {
    if (count < 1 || count > MAX_DICE) throw new DiceParseError('rollDiceCount', { max: MAX_DICE });
    if (totalDice + count > MAX_DICE) throw new DiceParseError('rollDiceCount', { max: MAX_DICE });
    if (sides < 2 || sides > MAX_SIDES) throw new DiceParseError('rollDieSides', { max: MAX_SIDES });
    if (keep !== null && (keep < 1 || keep > count)) throw new DiceParseError('rollKeepRange', { max: count });
    totalDice += count;
    dice.push({ count, sides, keep, advantage, sign, ...(damageType ? { damageType } : {}) });
  };

  const pushFlat = (amount: number, damageType: string | undefined) => {
    if (!Number.isSafeInteger(amount)) throw new DiceParseError('rollValueRange');
    modifiers.push({ amount, ...(damageType ? { damageType } : {}) });
    modifier += amount;
    sawNumber = true;
  };

  while (pos < s.length) {
    const rest = s.slice(pos);
    let m = rest.match(new RegExp(`^(\\d*)d(\\d+)(${TYPE_PATTERN})?([ad])?(?:k(\\d+))?`));
    if (m) {
      pushDie(
        m[1] ? parseInt(m[1], 10) : 1,
        parseInt(m[2]!, 10),
        m[5] ? parseInt(m[5], 10) : null,
        (m[4] as 'a' | 'd' | undefined) ?? null,
        1,
        m[3]
      );
      pos += m[0].length;
      continue;
    }
    m = rest.match(new RegExp(`^([+-])(\\d*)d(\\d+)(${TYPE_PATTERN})?([ad])?(?:k(\\d+))?`));
    if (m) {
      pushDie(
        m[2] ? parseInt(m[2], 10) : 1,
        parseInt(m[3]!, 10),
        m[6] ? parseInt(m[6], 10) : null,
        (m[5] as 'a' | 'd' | undefined) ?? null,
        m[1] === '-' ? -1 : 1,
        m[4]
      );
      pos += m[0].length;
      continue;
    }
    m = rest.match(new RegExp(`^([+-])(\\d+)(${TYPE_PATTERN})?`));
    if (m) {
      pushFlat(parseInt((m[1] ?? '') + (m[2] ?? ''), 10), m[3]);
      pos += m[0].length;
      continue;
    }
    m = rest.match(new RegExp(`^(\\d+)(${TYPE_PATTERN})?`));
    if (m) {
      pushFlat(parseInt(m[1]!, 10), m[2]);
      pos += m[0].length;
      continue;
    }
    throw new DiceParseError('rollSyntax', { char: rest[0] ?? '', expr });
  }

  if (dice.length === 0 && !sawNumber) throw new DiceParseError('rollNoDice');
  return { dice, modifier, modifiers };
}

function rollOne(sides: number, rng: () => number): number {
  const v = rng();
  return Math.min(sides, Math.floor(Math.max(0, Math.min(1, v)) * sides) + 1);
}

export interface RollOptions {
  doubleDice?: boolean;
}

export function isCriticalHit(roll: DiceRollResult, minFace = 20): boolean {
  return roll.dice.some((d) => d.sides === 20 && d.sign === 1 && d.values.some((value) => value >= minFace));
}

export function isCriticalFail(roll: DiceRollResult): boolean {
  return roll.dice.some((d) => d.sides === 20 && d.sign === 1 && d.values.includes(1));
}

/**
 * Максимум выражения броска (Beacon of Hope: «максимум лечения»): каждый
 * удержанный кубик — на максимуме грани, отброшенные не считаются.
 */
export function maximizedRollTotal(roll: DiceRollResult): number {
  let total = roll.modifier;
  for (const die of roll.dice) {
    // `values` уже без отброшенных (keep highest / advantage) — максимум по числу удержанных.
    total += die.sign * die.values.length * die.sides;
  }
  return total;
}

export function rollDice(
  expression: string,
  rng: () => number = Math.random,
  options: RollOptions = {}
): DiceRollResult {
  const { dice, modifiers } = parseDiceExpression(expression);
  const modifier = modifiers.reduce((acc, m) => acc + m.amount, 0);
  const double = options.doubleDice === true;

  const results: DieResult[] = dice.map((d) => {
    const count = double ? d.count * 2 : d.count;
    const keep = double && d.keep !== null ? Math.min(d.keep * 2, count) : d.keep;
    if (d.advantage) {
      const all = Array.from({ length: count * 2 }, () => rollOne(d.sides, rng));
      const sortedIdx = all
        .map((v, i) => i)
        .sort((a, b) => (d.advantage === 'a' ? all[b]! - all[a]! : all[a]! - all[b]!));
      const keptIdx = new Set(sortedIdx.slice(0, count));
      return {
        sides: d.sides,
        values: all.filter((_, i) => keptIdx.has(i)),
        dropped: all.filter((_, i) => !keptIdx.has(i)),
        advantage: d.advantage,
        sign: d.sign,
        ...(d.damageType ? { damageType: d.damageType } : {}),
      };
    }
    const all = Array.from({ length: count }, () => rollOne(d.sides, rng));
    if (keep === null) {
      return {
        sides: d.sides,
        values: all,
        dropped: [],
        advantage: null,
        sign: d.sign,
        ...(d.damageType ? { damageType: d.damageType } : {}),
      };
    }
    const sortedIdx = all.map((v, i) => i).sort((a, b) => all[b]! - all[a]!);
    const keptIdx = new Set(sortedIdx.slice(0, keep));
    return {
      sides: d.sides,
      values: all.filter((_, i) => keptIdx.has(i)),
      dropped: all.filter((_, i) => !keptIdx.has(i)),
      advantage: null,
      sign: d.sign,
      ...(d.damageType ? { damageType: d.damageType } : {}),
    };
  });

  const diceSum = results.reduce(
    (acc, r) => acc + r.sign * r.values.reduce((a, b) => a + b, 0),
    0
  );
  const total = diceSum + modifier;

  let breakdown = '';
  for (const r of results) {
    const inner =
      r.values.length === 1 && r.dropped.length === 0 ? String(r.values[0]) : `[${r.values.join(', ')}]`;
    if (!breakdown) breakdown = r.sign === -1 ? `-${inner}` : inner;
    else breakdown += r.sign === -1 ? ` - ${inner}` : ` + ${inner}`;
  }
  if (modifier > 0) breakdown += ` + ${modifier}`;
  else if (modifier < 0) breakdown += ` - ${Math.abs(modifier)}`;

  const groups = new Map<string, DamagePartAmount>();
  const addGroup = (damageType: string | undefined, amount: number) => {
    const key = damageType ?? '';
    const current = groups.get(key);
    if (current) current.amount += amount;
    else groups.set(key, damageType ? { damageType, amount } : { amount });
  };
  results.forEach((r, i) => {
    addGroup(dice[i]!.damageType, r.sign * r.values.reduce((a, b) => a + b, 0));
  });
  for (const m of modifiers) addGroup(m.damageType, m.amount);

  return { expression, dice: results, modifier, total, breakdown, damageParts: [...groups.values()] };
}
