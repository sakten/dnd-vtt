import type { BestiaryEntry } from 'shared';

let cache: BestiaryEntry[] | null = null;
let pending: Promise<BestiaryEntry[]> | null = null;

/** Ленивая загрузка каталога существ (отдельный чанк). Кэшируется на время сессии. */
export async function loadBestiary(): Promise<BestiaryEntry[]> {
  if (cache) return cache;
  if (!pending) {
    pending = import('shared/bestiaryData').then((mod) => {
      cache = mod.default.entries;
      return cache;
    });
  }
  return pending;
}
