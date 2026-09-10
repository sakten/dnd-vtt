export type DieSign = 1 | -1;

export interface ParsedDie {
  count: number;
  sides: number;
  keep: number | null;
  advantage: 'a' | 'd' | null;
  sign: DieSign;
}

export interface DieResult {
  sides: number;
  values: number[];
  dropped: number[];
  advantage: 'a' | 'd' | null;
  sign: DieSign;
}

export interface DiceRollResult {
  expression: string;
  dice: DieResult[];
  modifier: number;
  total: number;
  breakdown: string;
}

export class DiceParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiceParseError';
  }
}

const MAX_DICE = 100;
const MAX_SIDES = 1000;

export function parseDiceExpression(expr: string): { dice: ParsedDie[]; modifier: number } {
  const s = expr.replace(/\s+/g, '').toLowerCase();
  if (s.length === 0) throw new DiceParseError('Пустое выражение');

  const dice: ParsedDie[] = [];
  let modifier = 0;
  let pos = 0;

  const pushDie = (
    count: number,
    sides: number,
    keep: number | null,
    advantage: 'a' | 'd' | null,
    sign: DieSign
  ) => {
    if (count < 1 || count > MAX_DICE) throw new DiceParseError(`Количество кубиков должно быть от 1 до ${MAX_DICE}`);
    if (sides < 2 || sides > MAX_SIDES) throw new DiceParseError(`Граней должно быть от 2 до ${MAX_SIDES}`);
    if (keep !== null && (keep < 1 || keep > count)) throw new DiceParseError('k должно быть от 1 до количества кубиков');
    dice.push({ count, sides, keep, advantage, sign });
  };

  while (pos < s.length) {
    const rest = s.slice(pos);
    let m = rest.match(/^(\d*)d(\d+)([ad])?(?:k(\d+))?/);
    if (m) {
      pushDie(
        m[1] ? parseInt(m[1], 10) : 1,
        parseInt(m[2], 10),
        m[4] ? parseInt(m[4], 10) : null,
        (m[3] as 'a' | 'd' | undefined) ?? null,
        1
      );
      pos += m[0].length;
      continue;
    }
    m = rest.match(/^([+-])(\d*)d(\d+)([ad])?(?:k(\d+))?/);
    if (m) {
      pushDie(
        m[2] ? parseInt(m[2], 10) : 1,
        parseInt(m[3], 10),
        m[5] ? parseInt(m[5], 10) : null,
        (m[4] as 'a' | 'd' | undefined) ?? null,
        m[1] === '-' ? -1 : 1
      );
      pos += m[0].length;
      continue;
    }
    m = rest.match(/^([+-])(\d+)/);
    if (m) {
      modifier += parseInt(m[1] + m[2], 10);
      pos += m[0].length;
      continue;
    }
    throw new DiceParseError(`Не понял символ «${rest[0]}» в выражении «${expr}»`);
  }

  if (dice.length === 0) throw new DiceParseError('В выражении нет кубиков (например: d20, 2d6+3)');
  return { dice, modifier };
}

function rollOne(sides: number, rng: () => number): number {
  const v = rng();
  return Math.min(sides, Math.floor(Math.max(0, Math.min(1, v)) * sides) + 1);
}

export interface RollOptions {
  doubleDice?: boolean;
}

export function isCriticalHit(roll: DiceRollResult): boolean {
  return roll.dice.some((d) => d.sides === 20 && d.sign === 1 && d.values.includes(20));
}

export function rollDice(
  expression: string,
  rng: () => number = Math.random,
  options: RollOptions = {}
): DiceRollResult {
  const { dice, modifier } = parseDiceExpression(expression);
  const double = options.doubleDice === true;

  const results: DieResult[] = dice.map((d) => {
    const count = double ? d.count * 2 : d.count;
    const keep = double && d.keep !== null ? Math.min(d.keep * 2, count) : d.keep;
    if (d.advantage) {
      const all = Array.from({ length: count * 2 }, () => rollOne(d.sides, rng));
      const sortedIdx = all
        .map((v, i) => i)
        .sort((a, b) => (d.advantage === 'a' ? all[b] - all[a] : all[a] - all[b]));
      const keptIdx = new Set(sortedIdx.slice(0, count));
      return {
        sides: d.sides,
        values: all.filter((_, i) => keptIdx.has(i)),
        dropped: all.filter((_, i) => !keptIdx.has(i)),
        advantage: d.advantage,
        sign: d.sign,
      };
    }
    const all = Array.from({ length: count }, () => rollOne(d.sides, rng));
    if (keep === null) {
      return { sides: d.sides, values: all, dropped: [], advantage: null, sign: d.sign };
    }
    const sortedIdx = all.map((v, i) => i).sort((a, b) => all[b] - all[a]);
    const keptIdx = new Set(sortedIdx.slice(0, keep));
    return {
      sides: d.sides,
      values: all.filter((_, i) => keptIdx.has(i)),
      dropped: all.filter((_, i) => !keptIdx.has(i)),
      advantage: null,
      sign: d.sign,
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

  return { expression, dice: results, modifier, total, breakdown };
}
