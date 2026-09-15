import { describe, expect, it } from 'vitest';
import { parseSaveBonus } from './saves';

describe('parseSaveBonus', () => {
  it('пустое поле — undefined (бонус из характеристик)', () => {
    expect(parseSaveBonus('')).toBeUndefined();
    expect(parseSaveBonus('   ')).toBeUndefined();
  });

  it('числа, включая отрицательные', () => {
    expect(parseSaveBonus('5')).toBe(5);
    expect(parseSaveBonus('+2')).toBe(2);
    expect(parseSaveBonus('-1')).toBe(-1);
    expect(parseSaveBonus('-1.6')).toBe(-2);
  });

  it('промежуточный ввод не превращается в 0', () => {
    expect(parseSaveBonus('-')).toBeUndefined();
    expect(parseSaveBonus('- 1')).toBeUndefined();
    expect(parseSaveBonus('abc')).toBeUndefined();
  });
});
