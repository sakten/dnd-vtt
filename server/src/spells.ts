import type { Spell } from 'shared';
import spellData from 'shared/spellsData';

/** Каталог заклинаний (Ф6): сервер — источник правды по механике. */
const byKey = new Map<string, Spell>(spellData.spells.map((s) => [s.key, s]));

export function findSpell(key: string): Spell | undefined {
  return byKey.get(key);
}

export function findSpellByName(name: string): Spell | undefined {
  const target = name.toLowerCase();
  return spellData.spells.find((s) => s.name.toLowerCase() === target);
}
