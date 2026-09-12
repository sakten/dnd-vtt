import type { Spell } from './rules/spells';
import raw from './data/spells.json';

export interface SpellData {
  attribution: string;
  count: number;
  spells: Spell[];
}

/** Данные заклинаний 5e.tools (Ф5). Ленивая загрузка на клиенте: `import('shared/spellsData')`. */
const spellData = raw as unknown as SpellData;

export default spellData;
