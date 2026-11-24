import {
  abilityMod,
  casterStats,
  choiceSpellGrants,
  featSpellGrants,
  grantedSpells,
  INNATE_SORCERY_ID,
  modifiedValue,
  raceSpellGrants,
  sheetMods,
  type CharacterSheet,
  type SpellStats,
  type Token,
} from 'shared';
import type { Room } from '../roomTypes';
import { sheetOfToken } from '../room/helpers';

/** Класс заклинания по ключу: свой из листа, выданный классом/подклассом, выбором или фитом. */
export function spellClassFor(sheet: CharacterSheet, spellKey: string): string | undefined {
  return (
    sheet.spells.find((s) => s.key === spellKey)?.className ??
    grantedSpells(sheet.classes).find((g) => g.key === spellKey)?.className ??
    choiceSpellGrants(sheet.choices).find((g) => g.key === spellKey)?.className ??
    featSpellGrants(sheet.choices).find((g) => g.key === spellKey)?.className ??
    raceSpellGrants(sheet.race).find((g) => g.key === spellKey)?.className
  );
}

/** Боевые характеристики кастера: лист персонажа (класс) или статблок монстра. */
export function spellStatsFor(room: Room, token: Token, className?: string): SpellStats | null {
  const { sheet } = sheetOfToken(room, token);
  if (sheet && className) {
    const stats = casterStats(sheet, className);
    if (stats) {
      // Врождённое чародейство: +1 к СЛ только для заклинаний чародея.
      const effects =
        className === 'sorcerer'
          ? token.effects
          : token.effects.filter((effect) => effect.sourceKey !== INNATE_SORCERY_ID);
      const mods = sheetMods(sheet.abilities);
      return {
        ...stats,
        dc: modifiedValue(stats.dc, effects, 'spellDc', {}, mods),
        attack: modifiedValue(stats.attack, effects, 'spellAttack', {}, mods),
      };
    }
  }
  const sc = token.statblock?.spellcasting;
  if (sc) {
    const mod = abilityMod(token.statblock?.abilities[sc.ability] ?? 10);
    return { ability: sc.ability, mod, dc: sc.dc ?? 8 + mod, attack: sc.attack ?? mod };
  }
  return null;
}

/** Боевые характеристики кастера для конкретного заклинания (класс из листа/выдач, иначе статблок). */
export function casterStatsFor(room: Room, token: Token, spellKey: string): SpellStats | null {
  const { sheet } = sheetOfToken(room, token);
  return spellStatsFor(room, token, sheet ? spellClassFor(sheet, spellKey) : undefined);
}
