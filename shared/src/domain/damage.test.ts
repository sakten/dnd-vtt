import { describe, expect, it } from 'vitest';
import { applyDamageToParts, type DamageDefense } from './damage';

const defense = (type: DamageDefense['type'], damageType: string): DamageDefense => ({
  id: `${type}:${damageType}`,
  type,
  damageType,
});

describe('applyDamageToParts', () => {
  it('иммунитет к огню режет только огненную часть', () => {
    const result = applyDamageToParts(
      [
        { damageType: 'slashing', amount: 13 },
        { damageType: 'fire', amount: 5 },
      ],
      [defense('immunity', 'fire')]
    );
    expect(result.amount).toBe(13);
    expect(result.note).toBe('immunity');
  });

  it('сопротивление каждой части считается отдельно, округление вниз', () => {
    const result = applyDamageToParts(
      [
        { damageType: 'slashing', amount: 13 },
        { damageType: 'fire', amount: 5 },
      ],
      [defense('resistance', 'fire')]
    );
    expect(result.amount).toBe(13 + 2);
    expect(result.note).toBe('resistance');
  });

  it('часть без типа защиты не трогают', () => {
    const result = applyDamageToParts([{ amount: 10 }], [defense('immunity', 'fire')]);
    expect(result).toEqual({ amount: 10 });
  });

  it('без защит сумма частей сохраняется', () => {
    const result = applyDamageToParts([{ damageType: 'fire', amount: 4 }, { amount: 9 }], undefined);
    expect(result.amount).toBe(13);
  });
});
