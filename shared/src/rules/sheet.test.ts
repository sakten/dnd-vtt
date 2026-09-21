import { describe, expect, it } from 'vitest';
import { bonusPart, d20Check, d20Expr, fmtMod } from './sheet';

describe('bonusPart', () => {
  it('числовое владение и экспертиза', () => {
    expect(bonusPart('2', 1)).toBe('+2');
    expect(bonusPart('2', 2)).toBe('+4');
    expect(bonusPart('3', 2)).toBe('+6');
    expect(bonusPart('2', 0)).toBe('');
    expect(bonusPart('', 1)).toBe('');
    expect(bonusPart('  ', 1)).toBe('');
  });

  it('владение костью: d4 и экспертиза 2d4', () => {
    expect(bonusPart('d4', 1)).toBe('+d4');
    expect(bonusPart('d4', 2)).toBe('+2d4');
    expect(bonusPart('1d6', 2)).toBe('+2d6');
  });
});

describe('d20-формулы', () => {
  it('fmtMod/d20Expr: знак модификатора, ноль с плюсом', () => {
    expect(fmtMod(3)).toBe('+3');
    expect(fmtMod(-2)).toBe('-2');
    expect(fmtMod(0)).toBe('+0');
    expect(d20Expr(3)).toBe('d20+3');
    expect(d20Expr(-2)).toBe('d20-2');
  });

  it('d20Check: проверка и спасбросок с владением/экспертизой, в т.ч. костью', () => {
    expect(d20Check(4, '2', 0)).toBe('d20+4');
    expect(d20Check(4, '2', 1)).toBe('d20+4+2');
    expect(d20Check(-1, '3', 2)).toBe('d20-1+6');
    expect(d20Check(5, 'd4', 2)).toBe('d20+5+2d4');
    expect(d20Check(5, '', 1)).toBe('d20+5');
  });
});
