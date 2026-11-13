import { describe, expect, it } from 'vitest';
import { arcaneRecoveryBudget } from './resources';

describe('arcaneRecoveryBudget', () => {
  it('половина уровня волшебника, округление вверх', () => {
    expect(arcaneRecoveryBudget(1)).toBe(1);
    expect(arcaneRecoveryBudget(2)).toBe(1);
    expect(arcaneRecoveryBudget(3)).toBe(2);
    expect(arcaneRecoveryBudget(8)).toBe(4);
    expect(arcaneRecoveryBudget(20)).toBe(10);
  });

  it('уровень клампится в 1..20', () => {
    expect(arcaneRecoveryBudget(0)).toBe(1);
    expect(arcaneRecoveryBudget(25)).toBe(10);
  });
});
