import { describe, expect, it } from 'vitest';
import { DiceParseError, parseDiceExpression, rollDice } from './dice';

function seq(values: number[]) {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error('rng exhausted');
    return values[i++];
  };
}

describe('parseDiceExpression', () => {
  it('парсит простой d20', () => {
    const r = parseDiceExpression('d20');
    expect(r.dice).toEqual([{ count: 1, sides: 20, keep: null, advantage: null }]);
    expect(r.modifier).toBe(0);
  });

  it('парсит количество кубиков', () => {
    expect(parseDiceExpression('2d6').dice[0].count).toBe(2);
  });

  it('игнорирует пробелы', () => {
    expect(parseDiceExpression(' d20 + 3 ').modifier).toBe(3);
  });

  it('парсит отрицательный модификатор', () => {
    expect(parseDiceExpression('2d6-1').modifier).toBe(-1);
  });

  it('парсит несколько групп кубиков', () => {
    const r = parseDiceExpression('1d4+2d6+5');
    expect(r.dice).toHaveLength(2);
    expect(r.dice[1].count).toBe(2);
    expect(r.modifier).toBe(5);
  });

  it('парсит keep highest', () => {
    expect(parseDiceExpression('4d6k3').dice[0].keep).toBe(3);
  });

  it('парсит advantage и disadvantage', () => {
    expect(parseDiceExpression('d20a').dice[0].advantage).toBe('a');
    expect(parseDiceExpression('d20d').dice[0].advantage).toBe('d');
  });

  it('бросает ошибку на неверные выражения', () => {
    expect(() => parseDiceExpression('abc')).toThrow(DiceParseError);
    expect(() => parseDiceExpression('d1')).toThrow(DiceParseError);
    expect(() => parseDiceExpression('d20k5')).toThrow(DiceParseError);
    expect(() => parseDiceExpression('5')).toThrow(DiceParseError);
    expect(() => parseDiceExpression('')).toThrow(DiceParseError);
  });
});

describe('rollDice', () => {
  it('бросает d20 максимумом', () => {
    const r = rollDice('d20', () => 0.999);
    expect(r.total).toBe(20);
    expect(r.dice[0].values).toEqual([20]);
  });

  it('считает модификатор', () => {
    const r = rollDice('d20+3', () => 0.999);
    expect(r.total).toBe(23);
    expect(r.breakdown).toBe('20 + 3');
  });

  it('суммирует 2d6', () => {
    expect(rollDice('2d6', seq([0, 0.999])).total).toBe(7);
  });

  it('keep highest отбрасывает лишнее', () => {
    const r = rollDice('4d6k3', seq([0.999, 0.999, 0.999, 0]));
    expect(r.total).toBe(18);
    expect(r.dice[0].values).toEqual([6, 6, 6]);
    expect(r.dice[0].dropped).toEqual([1]);
  });

  it('advantage берёт больший бросок', () => {
    const r = rollDice('d20a', seq([0.5, 0.9]));
    expect(r.total).toBe(19);
    expect(r.dice[0].values).toEqual([19]);
    expect(r.dice[0].dropped).toEqual([11]);
  });

  it('disadvantage берёт меньший бросок', () => {
    expect(rollDice('d20d', seq([0.5, 0.9])).total).toBe(11);
  });

  it('отрицательный модификатор', () => {
    const r = rollDice('d20-5', () => 0.999);
    expect(r.total).toBe(15);
    expect(r.breakdown).toBe('20 - 5');
  });
});
