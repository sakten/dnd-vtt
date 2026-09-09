import type { DiceRollResult } from 'shared';

export interface FormattedRoll {
  detail: string;
  crit: 'crit' | 'fail' | null;
}

export function formatRoll(roll: DiceRollResult): FormattedRoll {
  const parts = roll.dice.map((d) => d.values.join(' + '));
  let detail = parts.join(' + ');
  if (roll.modifier > 0) detail += ` + ${roll.modifier}`;
  else if (roll.modifier < 0) detail += ` - ${Math.abs(roll.modifier)}`;

  const anyD20 = roll.dice.some((d) => d.sides === 20 && d.values.includes(20));
  const anyD1 = roll.dice.some((d) => d.sides === 20 && d.values.includes(1));

  return { detail, crit: anyD20 ? 'crit' : anyD1 ? 'fail' : null };
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
