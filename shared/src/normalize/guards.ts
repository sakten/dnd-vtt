/** Объект-запись (не null/массив) — общая проверка payload и данных с диска. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
