import { describe, expect, it } from 'vitest';
import type { FeatureChoice } from '../domain/feature';
import { choiceSpellGrants, magicalDiscoveriesAvailable, magicalDiscoveriesSpells } from './spellChoices';

describe('Магические находки (Знание, 6)', () => {
  it('доступны барду-знанию с 6 уровня', () => {
    expect(magicalDiscoveriesAvailable([{ className: 'bard', level: 5, subclass: 'lore' }])).toBe(false);
    expect(magicalDiscoveriesAvailable([{ className: 'bard', level: 6, subclass: 'lore' }])).toBe(true);
    expect(magicalDiscoveriesAvailable([{ className: 'bard', level: 6, subclass: 'valor' }])).toBe(false);
  });

  it('выбранные заклинания выдаются как бардовские', () => {
    const choices: FeatureChoice[] = [
      { kind: 'featureOption', key: 'bard.lore:magicalDiscoveries', spells: ['XPHB:Bless', 'XPHB:Shield'] },
    ];
    expect(magicalDiscoveriesSpells(choices)).toEqual(['XPHB:Bless', 'XPHB:Shield']);
    expect(choiceSpellGrants(choices)).toEqual([
      { key: 'XPHB:Bless', className: 'bard' },
      { key: 'XPHB:Shield', className: 'bard' },
    ]);
    expect(choiceSpellGrants([])).toEqual([]);
  });
});
