/** Спасбросок статблока из текста поля: пусто/недописанное — undefined («из характеристик»). */
export function parseSaveBonus(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return undefined;
  return Math.round(n);
}
