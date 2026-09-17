import { describe, expect, it } from 'vitest';
import { bonusPart } from './sheet';

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
