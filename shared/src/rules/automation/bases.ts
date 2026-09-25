/**
 * SPELL_BASES: единственный реестр констант правил, которых нет в данных 5e.tools
 * (плоские числа и особые кости заклинаний). Новые исключения — сюда, не инлайн
 * в билдеры/каталог (R16).
 */
export const SPELL_BASES = {
  /** Heal: 70 HP, +10 за круг выше 6-го (в источнике только `{@scaledice 70|6-9|10}`). */
  heal: { flat: 70, perLevel: 10, above: 6 },
  /** False Life: временные хиты `2к4 + 4`, +5 за круг выше 1-го. */
  falseLife: { dice: '2d4', flat: 4, perLevel: 5, above: 1 },
  /** Resistance: −1к4 получаемого урона выбранного типа (заряд раз в ход). */
  resistance: { damageReduceDice: '1d4' },
  /** Mirror Image: 3 образа, бросок d6 (образ гибнет при ≥3). */
  mirrorImage: { misdirect: { charges: 3, die: 'd6', threshold: 3 } },
  /** Elemental Bane: +2к6 выбранного типа (первый урон этим типом за ход). */
  elementalBane: { extraDice: '2d6' },
  /** Heroes' Feast: +2к10 к максимуму HP (бросается при наложении). */
  heroesFeast: { maxHpDice: '2d10' },
  /** Bless / Bane / Guidance: бонусная кость d4 (у Bane — со знаком минус). */
  d4Bonus: '1d4',
} as const;
