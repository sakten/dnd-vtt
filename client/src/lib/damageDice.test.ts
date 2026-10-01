import { describe, expect, it } from 'vitest';
import { damageDiceText, parseDamageDiceText } from './damageDice';

describe('damageDice (текст костей с типами урона)', () => {
  it('текст: один тип — суффикс каждой кости, несколько — без суффиксов', () => {
    expect(damageDiceText({ dice: ['8d6'], types: ['fire'] })).toBe('8d6fire');
    expect(damageDiceText({ dice: ['8d6', '2d8'], types: ['fire', 'radiant'] })).toBe('8d6 + 2d8');
    expect(damageDiceText({ dice: ['2d6'], types: [] })).toBe('2d6');
  });

  it('разбор: тип из суффикса, без суффикса — прежний, битый текст — как есть', () => {
    expect(parseDamageDiceText('10d6cold', ['fire'])).toEqual({ dice: ['10d6'], types: ['cold'] });
    expect(parseDamageDiceText('8d6', ['fire'])).toEqual({ dice: ['8d6'], types: ['fire'] });
    expect(parseDamageDiceText('1d6 + 2d8radiant', [])).toEqual({ dice: ['1d6', '2d8'], types: ['radiant'] });
    expect(parseDamageDiceText('abc', ['fire'])).toEqual({ dice: ['abc'], types: ['fire'] });
  });
});
