import { describe, expect, it } from 'vitest';
import spellsData from 'shared/spellsData';
import { SPELL_ICONS } from './spellIcons';

describe('иконки заклинаний (снимок)', () => {
  it('у каждого заклинания есть иконка', () => {
    const icons = new Set(Object.keys(SPELL_ICONS).map((key) => key.toLowerCase()));
    const missing = spellsData.spells.map((spell) => spell.name.toLowerCase()).filter((name) => !icons.has(name));
    expect(missing).toEqual([]);
  });

  it('нет иконок без заклинаний', () => {
    const names = new Set(spellsData.spells.map((spell) => spell.name.toLowerCase()));
    const orphans = Object.keys(SPELL_ICONS).filter((key) => !names.has(key.toLowerCase()));
    expect(orphans).toEqual([]);
  });
});
