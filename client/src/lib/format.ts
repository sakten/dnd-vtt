import type { DiceRollResult } from 'shared';

export type RollCrit = 'crit' | 'fail' | null;

export function formatRoll(roll: DiceRollResult): RollCrit {
  const anyD20 = roll.dice.some((d) => d.sides === 20 && d.sign === 1 && d.values.includes(20));
  const anyD1 = roll.dice.some((d) => d.sides === 20 && d.sign === 1 && d.values.includes(1));
  return anyD20 ? 'crit' : anyD1 ? 'fail' : null;
}
