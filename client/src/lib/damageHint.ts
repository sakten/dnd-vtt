import { DAMAGE_TYPES } from 'shared';

export interface DamageHint {
  /** Начало набранной части типа (только её и заменяем). */
  start: number;
  /** Позиция каретки (конец набранной части). */
  caret: number;
  partial: string;
  options: string[];
}

/**
 * Подсказка типа урона после терма: `1d6fi` → fire, `+3fo` → force.
 * Без набранных букв или без вариантов — undefined (обычный текст не трогаем).
 */
export function damageTypeHint(input: string, caret = input.length): DamageHint | undefined {
  const at = Math.max(0, Math.min(caret, input.length));
  const match = /(\d*d\d+|[+-]\d+)([a-z]+)$/i.exec(input.slice(0, at));
  if (!match) return undefined;
  const partial = match[2]!.toLowerCase();
  // d20 — бросок атаки/проверки: суффикс типа урона не подсказываем (у `a`/`d` своё значение — преимущество/помеха).
  const dice = [...input.slice(0, at - partial.length).matchAll(/d(\d+)/gi)];
  if (Number(dice[dice.length - 1]?.[1]) === 20) return undefined;
  const options = DAMAGE_TYPES.map((d) => d.key)
    .filter((key) => key.startsWith(partial) && key !== partial)
    .sort();
  if (!options.length) return undefined;
  return { start: at - partial.length, caret: at, partial, options };
}

/** Дописывает выбранный тип вместо набранной части: `d20fi` → `d20fire`. */
export function applyDamageHint(input: string, hint: DamageHint, option: string): { text: string; caret: number } {
  return {
    text: input.slice(0, hint.start) + option + input.slice(hint.caret),
    caret: hint.start + option.length,
  };
}
