import { describe, expect, it } from 'vitest';
import type { EffectInstance } from 'shared';
import { acBreakdownOf } from './ac';

const acEffect = (modifiers: EffectInstance['modifiers']): EffectInstance => ({
  id: 'ef1',
  name: 'Test',
  duration: { type: 'permanent' },
  sourceId: 't1',
  modifiers,
});

describe('acBreakdownOf', () => {
  it('пусто — дефолт 13 без бонуса', () => {
    expect(acBreakdownOf('', undefined, undefined)).toEqual({
      base: 13,
      effective: 13,
      bonus: 0,
      byDefault: true,
    });
  });

  it('Щит +5 к базовому AC', () => {
    const effects = [acEffect([{ id: 'm1', target: 'ac', mode: 'add', value: 5 }])];
    expect(acBreakdownOf('13', effects, undefined)).toMatchObject({ base: 13, effective: 18, bonus: 5, byDefault: false });
  });

  it('формула 13+dex из Магического доспеха', () => {
    const effects = [acEffect([{ id: 'm1', target: 'ac', mode: 'set', value: '13+dex' }])];
    expect(acBreakdownOf('10', effects, { dex: 16 }).effective).toBe(16);
  });
});
