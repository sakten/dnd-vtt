import { isCriticalFail, isCriticalHit, type DiceRollResult } from 'shared';

export type RollCrit = 'crit' | 'fail' | null;

export function formatRoll(roll: DiceRollResult): RollCrit {
  if (isCriticalHit(roll)) return 'crit';
  if (isCriticalFail(roll)) return 'fail';
  return null;
}
