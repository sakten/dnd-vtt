export type DamageDefenseType = 'resistance' | 'immunity' | 'vulnerability';

/** Защита юнита: сопротивление/иммунитет/уязвимость к типу урона. */
export interface DamageDefense {
  id: string;
  type: DamageDefenseType;
  damageType: string;
}

export const MAX_DEFENSES = 20;

export interface DamageDefenseResult {
  amount: number;
  note?: DamageDefenseType;
}

/**
 * Применяет защиты цели к урону: иммунитет → 0; сопротивление/уязвимость
 * взаимно гасятся, иначе половина/двойной. Без типа урона — без изменений.
 */
export function applyDamageDefenses(
  amount: number,
  damageType: string | undefined,
  defenses: DamageDefense[] | undefined
): DamageDefenseResult {
  if (!damageType || amount <= 0 || !defenses?.length) return { amount };
  const matches = defenses.filter((d) => d.damageType === damageType);
  if (!matches.length) return { amount };
  if (matches.some((d) => d.type === 'immunity')) return { amount: 0, note: 'immunity' };
  const resistant = matches.some((d) => d.type === 'resistance');
  const vulnerable = matches.some((d) => d.type === 'vulnerability');
  if (resistant && vulnerable) return { amount };
  if (resistant) return { amount: Math.floor(amount / 2), note: 'resistance' };
  if (vulnerable) return { amount: amount * 2, note: 'vulnerability' };
  return { amount };
}
