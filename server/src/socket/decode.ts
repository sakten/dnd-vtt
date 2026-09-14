/**
 * Декодеры socket-payload: приводят рантайм-значения к типам контракта.
 * Неверный тип даёт `undefined` (хендлер решает, молчать или ответить ошибкой),
 * исключений не бросают — payload из сети не типизирован в рантайме.
 */

/** Строка, при необходимости обрезанная до `max` символов. */
export function asString(value: unknown, max = 0): string | undefined {
  if (typeof value !== 'string') return undefined;
  return max > 0 ? value.slice(0, max) : value;
}

/** Строка с trim (пустая → `''`) и лимитом длины. */
export function asTrimmedString(value: unknown, max = 0): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return max > 0 ? trimmed.slice(0, max) : trimmed;
}

/** Строгий boolean. */
export function asBool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}
