import { useEffect, useState } from 'react';
import type { Spell } from 'shared';
import { loadSpells } from './spells';

/** Данные заклинаний (ленивый чанк), один кэш на сессию. */
export function useSpells(): Spell[] {
  const [spells, setSpells] = useState<Spell[]>([]);
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
