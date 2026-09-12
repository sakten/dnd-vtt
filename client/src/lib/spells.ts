import type { Spell } from 'shared';

let cache: Spell[] | null = null;
let pending: Promise<Spell[]> | null = null;

/** Ленивая загрузка данных заклинаний (отдельный чанк). Кэшируется на время сессии. */
export async function loadSpells(): Promise<Spell[]> {
  if (cache) return cache;
  if (!pending) {
    pending = import('shared/spellsData').then((mod) => {
      cache = mod.default.spells;
      return cache;
    });
  }
  return pending;
}
