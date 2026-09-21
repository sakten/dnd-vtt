import { MAX_SENSES, SENSE_TYPES, type Sense, type SenseType } from '../domain/sense';
import { isRecord } from './guards';

/**
 * Нормализация восприятия: только известные типы, дистанция 0–1000 фт (нулевые отбрасываются),
 * по одному значению на тип (берётся максимум), лимит `MAX_SENSES`.
 */
export function normalizeSenses(raw: unknown): Sense[] {
  const seen = new Map<SenseType, number>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!isRecord(item)) continue;
      const type = SENSE_TYPES.includes(item.type as SenseType) ? (item.type as SenseType) : null;
      if (!type) continue;
      const range = Number(item.range);
      if (!Number.isFinite(range)) continue;
      const value = Math.max(0, Math.min(1000, Math.round(range)));
      if (value <= 0) continue;
      const prev = seen.get(type);
      if (prev === undefined || value > prev) seen.set(type, value);
    }
  }
  const out: Sense[] = [];
  for (const type of SENSE_TYPES) {
    const value = seen.get(type);
    if (value !== undefined) out.push({ type, range: value });
  }
  return out.slice(0, MAX_SENSES);
}
