import { describe, expect, it } from 'vitest';
import type { DiceRollResult } from 'shared';
import { useGameStore } from '../useGameStore';

const roll = (dice: DiceRollResult['dice'], total: number, expression: string): DiceRollResult => ({
  expression,
  dice,
  modifier: 0,
  total,
  breakdown: '',
  damageParts: [],
});

describe('rollAnim slice', () => {
  it('преимущество: два кубика, отброшенный помечен', () => {
    useGameStore.getState().onRollAnim({
      id: 'a',
      roll: roll([{ sides: 20, values: [18], dropped: [7], advantage: 'a', sign: 1 }], 18, 'd20a'),
    });
    expect(useGameStore.getState().rollAnim?.dice).toEqual([
      { value: 18, kept: true },
      { value: 7, kept: false },
    ]);
    useGameStore.getState().clearRollAnim();
  });

  it('обычный бросок: один взятый кубик', () => {
    useGameStore.getState().onRollAnim({
      id: 'b',
      roll: roll([{ sides: 20, values: [12], dropped: [], advantage: null, sign: 1 }], 12, 'd20'),
    });
    expect(useGameStore.getState().rollAnim?.dice).toEqual([{ value: 12, kept: true }]);
    useGameStore.getState().clearRollAnim();
  });
});
