import { damageTypeColor as sharedDamageTypeColor } from 'shared';

/** Нейтральный «магический» цвет (нет типа/неизвестный). */
export const ARCANE_COLOR = '#8fb7ff';

export function damageTypeColor(type: string | undefined): string | undefined {
  return sharedDamageTypeColor(type);
}
