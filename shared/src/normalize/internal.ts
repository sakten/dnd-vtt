import { DEFAULT_ABILITIES, type AbilityKey } from '../domain/core';

let fallbackIdCounter = 0;
/**
 * UUID v4 с fallback для небезопасного контекста (http-LAN): сначала
 * `crypto.randomUUID`, затем `getRandomValues`, в крайнем случае — счётчик.
 */
export function newId(): string {
  const c = globalThis.crypto;
  try {
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  } catch {
    // Небезопасный контекст: randomUUID есть, но бросает.
  }
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = c.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  fallbackIdCounter += 1;
  return `id-${Date.now().toString(36)}-${fallbackIdCounter.toString(36)}`;
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
