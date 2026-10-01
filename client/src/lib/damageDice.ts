import { DAMAGE_TYPES, parseDiceExpression } from 'shared';

/**
 * Текст поля урона с типами в стиле чата (`3d6fire + 1d8radiant`) и его разбор.
 * Кости показываются с суффиксом типа, если тип один (как в каноне).
 */

const TYPE_RE = new RegExp(`(${[...DAMAGE_TYPES].map((d) => d.key).sort((a, b) => b.length - a.length).join('|')})$`, 'i');

export interface DamageDiceValue {
  dice: string[];
  types: string[];
}

/** Текст поля из костей и типов (один тип — суффикс к каждой кости). */
export function damageDiceText(value: DamageDiceValue): string {
  const single = value.types.length === 1 ? value.types[0] : undefined;
  return value.dice.map((die) => (single ? `${die}${single}` : die)).join(' + ');
}

/**
 * Разбор текста: кости без суффиксов + типы. Без типов в тексте сохраняем
 * прежние (правка костей не сбрасывает выбранный тип); битый текст отдаём
 * как есть — форма покажет ошибку костей.
 */
export function parseDamageDiceText(text: string, previousTypes: string[]): DamageDiceValue {
  const tokens = text
    .split('+')
    .map((x) => x.trim())
    .filter(Boolean);
  const dice = tokens.map((token) => token.replace(TYPE_RE, '').trim()).filter(Boolean);
  const types = new Set<string>();
  try {
    const parsed = parseDiceExpression(text);
    for (const die of parsed.dice) if (die.damageType) types.add(die.damageType);
    for (const mod of parsed.modifiers) if (mod.damageType) types.add(mod.damageType);
  } catch {
    return { dice, types: previousTypes };
  }
  return { dice, types: types.size ? [...types] : previousTypes };
}
