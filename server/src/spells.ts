import { automationForSpell, type Spell } from 'shared';
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

let zoneAuraKeys: ReadonlySet<string> | null = null;

/**
 * Ключи заклинаний, чьи эффекты на цели накладываются **только зонами-аурами**
 * (Spirit Shroud, Spirit Guardians, Hunger of Hadar и подобные). Нужны очистке
 * легаси-снимков: аура-эффект без живой зоны — осиротевший.
 */
export function zoneAuraSpellKeys(): ReadonlySet<string> {
  zoneAuraKeys ??= new Set(
    spellData.spells.filter((s) => automationForSpell(s).zone?.aura).map((s) => s.key)
  );
  return zoneAuraKeys;
}
