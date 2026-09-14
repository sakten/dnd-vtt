import { describe, expect, it } from 'vitest';
import { countAttackAdvantage } from './combat';
import { rollMode } from './effects';
import type { ConditionInstance } from '../types';

const cond = (key: ConditionInstance['key'], name = key): ConditionInstance => ({ key, name });

describe('countAttackAdvantage', () => {
  it('явный выбор и одиночные состояния дают режим', () => {
    expect(countAttackAdvantage({ explicit: 'a' }).mode).toBe('a');
    expect(countAttackAdvantage({ explicit: 'd' }).mode).toBe('d');
    expect(countAttackAdvantage({ attackerConditions: [cond('invisible')] }).mode).toBe('a');
    expect(countAttackAdvantage({ attackerConditions: [cond('poisoned')] }).mode).toBe('d');
  });

  it('5e: любое преимущество и любая помеха отменяют друг друга (счёт не сальдируется)', () => {
    // 2 преимущества (Невидим + явное Adv) против 1 помехи (Отравлен) → обычный бросок.
    const both = countAttackAdvantage({
      explicit: 'a',
      attackerConditions: [cond('invisible'), cond('poisoned')],
    });
    expect(both.advantage).toBe(2);
    expect(both.disadvantage).toBe(1);
    expect(both.mode).toBeUndefined();
  });

  it('принудительная помеха гасит любое преимущество', () => {
    const both = countAttackAdvantage({ explicit: 'a', forcedDisadvantage: true });
    expect(both.mode).toBeUndefined();
  });

  it('состояния цели: Сбит с ног даёт преимущество в ближнем бою и помеху в дальнем', () => {
    expect(countAttackAdvantage({ targetConditions: [cond('prone')], rangeType: 'melee' }).mode).toBe('a');
    expect(countAttackAdvantage({ targetConditions: [cond('prone')], rangeType: 'ranged' }).mode).toBe('d');
  });

  it('includeTarget=false игнорирует состояния цели', () => {
    expect(countAttackAdvantage({ targetConditions: [cond('prone')], rangeType: 'melee', includeTarget: false }).mode).toBeUndefined();
  });

  it('несколько эффектов преимущества и один эффект помехи — отмена', () => {
    const both = countAttackAdvantage({ effectMode: 'a', forcedDisadvantage: true });
    expect(both.mode).toBeUndefined();
  });
});

describe('rollMode', () => {
  it('отменяет режим при любых количествах с обеих сторон', () => {
    expect(rollMode(3, 1)).toBeUndefined();
    expect(rollMode(1, 3)).toBeUndefined();
    expect(rollMode(2, 0)).toBe('a');
    expect(rollMode(0, 2)).toBe('d');
    expect(rollMode(0, 0)).toBeUndefined();
  });
});
