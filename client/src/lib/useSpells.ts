import { useEffect, useMemo, useState } from 'react';
import type { Spell } from 'shared';
import { loadSpells } from './spells';

/** Данные заклинаний (ленивый чанк), один кэш на сессию; null — ещё грузятся. */
export function useSpells(): Spell[] | null {
  const [spells, setSpells] = useState<Spell[] | null>(null);
  useEffect(() => {
    let alive = true;
    loadSpells().then((list) => {
      if (alive) setSpells(list);
    });
    return () => {
      alive = false;
    };
  }, []);
  return spells;
}

/** Карта заклинаний по ключу (данные грузятся лениво). */
export function useSpellByKey(): Map<string, Spell> {
  const spells = useSpells();
  return useMemo(() => new Map((spells ?? []).map((s) => [s.key, s])), [spells]);
}
