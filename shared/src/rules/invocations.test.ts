import { describe, expect, it } from 'vitest';
import { creatureSizeOf, sizeAtMost } from '../domain/token';
import type { CharacterSheet } from '../domain/sheet';
import invocationsData from '../invocationsData';
import spellsData from '../spellsData';
import { automationForSpell } from './automation';
import { spellRangeFeet } from './spellCast';
import {
  INVOCATION_MECHANICS,
  INVOCATION_PACT_KEYS,
  effectiveSpellRangeFeet,
  eldritchBlastMods,
  familiarFormAvailable,
  invocationAtWillSpells,
  invocationAutomated,
  invocationIssue,
  invocationLimit,
  invocationSenses,
  warlockLevelOf,
} from './invocations';

const inv = (name: string) => invocationsData.invocations.find((i) => i.name === name)!;

const sheet = (overrides: Partial<CharacterSheet> = {}): CharacterSheet =>
  ({
    name: 'Тест',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
    proficiencyBonus: '2',
    saves: {},
    skills: {},
    attacks: [],
    classes: [{ className: 'warlock', level: 5 }],
    spells: [],
    hpMax: '30',
    ac: '14',
    speed: 30,
    senses: [],
    damageDefenses: [],
    ...overrides,
  }) as CharacterSheet;

const ctx = (warlockLevel: number, chosen: string[], cantrips: { key: string; damage: boolean; attack: boolean }[] = []) => ({
  warlockLevel,
  chosen: new Set(chosen),
  cantrips,
});

describe('инвокации: ограничения и предпосылки', () => {
  it('лимит по уровню варлока', () => {
    expect(invocationLimit(0, invocationsData.limits)).toBe(0);
    expect(invocationLimit(1, invocationsData.limits)).toBe(1);
    expect(invocationLimit(2, invocationsData.limits)).toBe(3);
    expect(invocationLimit(20, invocationsData.limits)).toBe(10);
    expect(warlockLevelOf(sheet({ classes: [{ className: 'warlock', level: 7 }, { className: 'rogue', level: 2 }] }))).toBe(7);
  });

  it('уровень и кантрип у Agonizing Blast', () => {
    expect(invocationIssue(inv('Agonizing Blast'), ctx(1, [], [{ key: 'XPHB:Eldritch Blast', damage: true, attack: true }]))).toBe('level');
    expect(invocationIssue(inv('Agonizing Blast'), ctx(2, []))).toBe('cantrip');
    expect(
      invocationIssue(inv('Agonizing Blast'), ctx(2, [], [{ key: 'XPHB:Eldritch Blast', damage: true, attack: true }]))
    ).toBeUndefined();
  });

  it('Repelling Blast требует кантрип с атакой, а не просто урон', () => {
    expect(invocationIssue(inv('Repelling Blast'), ctx(2, [], [{ key: 'x', damage: true, attack: false }]))).toBe('cantrip');
    expect(invocationIssue(inv('Repelling Blast'), ctx(2, [], [{ key: 'x', damage: true, attack: true }]))).toBeUndefined();
  });

  it('цепочки пактов и инвокаций', () => {
    expect(invocationIssue(inv('Thirsting Blade'), ctx(5, []))).toBe('pact');
    expect(invocationIssue(inv('Thirsting Blade'), ctx(5, [INVOCATION_PACT_KEYS.blade]))).toBeUndefined();
    expect(invocationIssue(inv('Devouring Blade'), ctx(12, [INVOCATION_PACT_KEYS.blade]))).toBe('requires');
    expect(
      invocationIssue(inv('Devouring Blade'), ctx(12, [INVOCATION_PACT_KEYS.blade, 'XPHB:Thirsting Blade']))
    ).toBeUndefined();
  });
});

describe('инвокации: механики движка', () => {
  it('at-will заклинания, сенсы и модификаторы Blast', () => {
    const s = sheet({
      invocations: ['XPHB:Armor of Shadows', 'XPHB:Devil\'s Sight', 'XPHB:Agonizing Blast', 'XPHB:Repelling Blast'],
    });
    expect(invocationAtWillSpells(s)).toEqual(['XPHB:Mage Armor']);
    expect(invocationSenses(s)).toEqual([{ type: 'devilsight', range: 120 }]);
    expect(eldritchBlastMods(s)).toEqual({ agonizing: true, repelling: true, spear: false });
  });

  it('каждый ключ механики существует в каталоге', () => {
    const keys = new Set(invocationsData.invocations.map((i) => i.key));
    for (const key of Object.keys(INVOCATION_MECHANICS)) expect(keys.has(key), key).toBe(true);
  });
});

describe('формы фамильяра', () => {
  it('особые формы Pact of the Chain — только с инвокацией', () => {
    expect(familiarFormAvailable('XMM:Quasit', true, false)).toBe(false);
    expect(familiarFormAvailable('XMM:Quasit', true, true)).toBe(true);
    expect(familiarFormAvailable('XMM:Imp', false, true)).toBe(true);
    expect(familiarFormAvailable('XMM:Imp', false, false)).toBe(false);
    expect(familiarFormAvailable('XMM:Owl', true, false)).toBe(true);
  });
});

describe('маркер автоматизации инвокаций', () => {
  it('механизированные — да, остальные — красный маркер', () => {
    expect(invocationAutomated("XPHB:Devil's Sight")).toBe(true);
    expect(invocationAutomated('XPHB:Eldritch Mind')).toBe(true);
    expect(invocationAutomated('XPHB:Pact of the Chain')).toBe(true);
    expect(invocationAutomated('XPHB:Agonizing Blast')).toBe(true);
    expect(invocationAutomated('XPHB:Pact of the Blade')).toBe(false);
    expect(invocationAutomated('XPHB:Thirsting Blade')).toBe(false);
    expect(invocationAutomated('XPHB:Witch Sight')).toBe(false);
  });

  it('at-will зависит от автоматизации заклинания', () => {
    expect(invocationAutomated('XPHB:Armor of Shadows', { spellAutomated: () => true })).toBe(true);
    expect(invocationAutomated('XPHB:Armor of Shadows', { spellAutomated: () => false })).toBe(false);
    expect(invocationAutomated('XPHB:Mask of Many Faces', { spellAutomated: () => false })).toBe(false);
  });
});

describe('размеры существ', () => {
  it('клетки → категория: 1×1 normal, 2×2 large, 3×3/4×4 huge', () => {
    expect([creatureSizeOf(1), creatureSizeOf(2), creatureSizeOf(3), creatureSizeOf(4)]).toEqual([
      'normal',
      'large',
      'huge',
      'huge',
    ]);
    expect(sizeAtMost(2, 'large')).toBe(true);
    expect(sizeAtMost(3, 'large')).toBe(false);
    expect(sizeAtMost(4, 'huge')).toBe(true);
  });
});

describe('Eldritch Blast: инвокации', () => {
  const eb = spellsData.spells.find((s) => s.key === 'XPHB:Eldritch Blast')!;

  it('Agonizing — +CHA к урону, Repelling — толчок, Spear — 300 фт', () => {
    const base = automationForSpell(eb, { characterLevel: 5 });
    expect(base.damage?.dice).toBe('1d10');
    expect(base.force).toBeUndefined();

    const boosted = automationForSpell(eb, {
      characterLevel: 5,
      invocations: ['XPHB:Agonizing Blast', 'XPHB:Repelling Blast', 'XPHB:Eldritch Spear'],
    });
    expect(boosted.damage?.dice).toBe('1d10');
    expect(boosted.damage?.abilityMod).toBe(true);
    expect(boosted.force).toEqual({ kind: 'push', feet: 10, maxSize: 'large' });
    expect(effectiveSpellRangeFeet(eb, ['XPHB:Eldritch Spear'])).toBe(300);
    expect(effectiveSpellRangeFeet(eb, [])).toBe(spellRangeFeet(eb));
  });
});
