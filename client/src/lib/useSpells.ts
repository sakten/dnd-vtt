import { useEffect, useMemo, useState } from 'react';
import type { Spell } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { loadSpells } from './spells';

/**
 * Данные заклинаний: канон (ленивый чанк) + кастомы комнаты (`CUSTOM:`, R16 срез 5);
 * один кэш на сессию, null — канон ещё грузится.
 */
export function useSpells(): Spell[] | null {
  const [spells, setSpells] = useState<Spell[] | null>(null);
  const customSpecs = useGameStore((s) => s.customSpecs);
  useEffect(() => {
    let alive = true;
    loadSpells().then((list) => {
      if (alive) setSpells(list);
    });
    return () => {
      alive = false;
    };
  }, []);
  return useMemo(() => {
    if (!spells) return null;
    if (!customSpecs.length) return spells;
    const known = new Set(spells.map((s) => s.key));
    const extra = customSpecs.filter((s) => !known.has(s.key));
    return extra.length ? [...spells, ...extra] : spells;
  }, [spells, customSpecs]);
}

/** Карта заклинаний по ключу (данные грузятся лениво). */
export function useSpellByKey(): Map<string, Spell> {
  const spells = useSpells();
  return useMemo(() => new Map((spells ?? []).map((s) => [s.key, s])), [spells]);
}
