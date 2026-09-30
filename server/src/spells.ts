import { automationForSpell, type Spell, type SpellDef } from 'shared';
import spellData from 'shared/spellsData';
import type { Room } from './roomTypes';

/** Каталог заклинаний (Ф6): сервер — источник правды по механике. */
const byKey = new Map<string, SpellDef>(spellData.spells.map((s) => [s.key, s]));

/** Заклинание комнаты: сначала кастомы (`CUSTOM:`, R16 срез 5), затем канон. */
export function findSpellDef(room: Room | undefined, key: string): SpellDef | undefined {
  return room?.customSpecs.find((s) => s.key === key) ?? byKey.get(key);
}

export function findSpell(key: string, room?: Room): Spell | undefined {
  return findSpellDef(room, key);
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
