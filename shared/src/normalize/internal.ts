import { DEFAULT_ABILITIES, type AbilityKey } from '../domain/core';

let fallbackIdCounter = 0;
/** id с fallback для небезопасного контекста (http-LAN), где нет crypto.randomUUID. */
export function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    fallbackIdCounter += 1;
    return `id-${Date.now().toString(36)}-${fallbackIdCounter.toString(36)}`;
  }
}

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function isAbilityKey(value: unknown): value is AbilityKey {
  return typeof value === 'string' && value in DEFAULT_ABILITIES;
}

export const SPELL_KEY_RE = /^[A-Za-z][A-Za-z0-9]{1,9}:/;
