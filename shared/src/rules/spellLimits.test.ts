import { describe, expect, it } from 'vitest';
import { normalizeSheet } from '../types';
import {
  casterClasses,
  cantripsMax,
  maxSpellLevel,
  sheetProficiencyBonus,
  spellAttackBonus,
  spellListClass,
  spellSaveDc,
  spellcastingAbility,
  spellsMax,
} from './spellLimits';

describe('характеристика кастера', () => {
  it('по классам', () => {
    expect(spellcastingAbility('wizard')).toBe('int');
    expect(spellcastingAbility('cleric')).toBe('wis');
    expect(spellcastingAbility('sorcerer')).toBe('cha');
    expect(spellcastingAbility('fighter')).toBeNull();
  });
});

describe('кантрипы', () => {
  it('по таблицам классов', () => {
    expect(cantripsMax('wizard', 1)).toBe(3);
    expect(cantripsMax('wizard', 10)).toBe(5);
    expect(cantripsMax('cleric', 1)).toBe(3);
    expect(cantripsMax('bard', 1)).toBe(2);
    expect(cantripsMax('paladin', 1)).toBe(0);
  });
});

describe('известные/подготовленные', () => {
  it('по таблицам классов', () => {
    expect(spellsMax('wizard', 1)).toBe(4);
    expect(spellsMax('cleric', 5)).toBe(9);
    expect(spellsMax('sorcerer', 1)).toBe(2);
    expect(spellsMax('warlock', 1)).toBe(2);
    expect(spellsMax('paladin', 1)).toBe(2);
  });
});

describe('maxSpellLevel', () => {
  it('полные кастеры: ceil(level/2)', () => {
    expect(maxSpellLevel('wizard', 1)).toBe(1);
    expect(maxSpellLevel('wizard', 3)).toBe(2);
    expect(maxSpellLevel('wizard', 5)).toBe(3);
    expect(maxSpellLevel('wizard', 17)).toBe(9);
  });

  it('полукастеры: 1/5/9/13/17', () => {
    expect(maxSpellLevel('paladin', 1)).toBe(1);
    expect(maxSpellLevel('paladin', 4)).toBe(1);
    expect(maxSpellLevel('paladin', 5)).toBe(2);
    expect(maxSpellLevel('paladin', 9)).toBe(3);
    expect(maxSpellLevel('paladin', 13)).toBe(4);
    expect(maxSpellLevel('paladin', 17)).toBe(5);
  });

  it('третьи кастеры: 3/7/13/19', () => {
    expect(maxSpellLevel('fighter', 2, 'eldritchKnight')).toBe(0);
    expect(maxSpellLevel('fighter', 3, 'eldritchKnight')).toBe(1);
    expect(maxSpellLevel('fighter', 7, 'eldritchKnight')).toBe(2);
    expect(maxSpellLevel('fighter', 13, 'eldritchKnight')).toBe(3);
    expect(maxSpellLevel('rogue', 19, 'arcaneTrickster')).toBe(4);
    expect(maxSpellLevel('fighter', 7)).toBe(0);
  });

  it('колдун: уровень пакт-ячейки', () => {
    expect(maxSpellLevel('warlock', 1)).toBe(1);
    expect(maxSpellLevel('warlock', 3)).toBe(2);
    expect(maxSpellLevel('warlock', 5)).toBe(3);
    expect(maxSpellLevel('warlock', 11)).toBe(5);
  });
});

describe('третьи кастеры (EK/AT)', () => {
  it('характеристика, список, лимиты', () => {
    expect(spellcastingAbility('fighter', 'eldritchKnight')).toBe('int');
    expect(spellListClass('fighter', 'eldritchKnight')).toBe('wizard');
    expect(cantripsMax('fighter', 3, 'eldritchKnight')).toBe(2);
    expect(cantripsMax('fighter', 10, 'eldritchKnight')).toBe(3);
    expect(spellsMax('fighter', 3, 'eldritchKnight')).toBe(3);
    expect(spellsMax('fighter', 7, 'eldritchKnight')).toBe(5);
    expect(maxSpellLevel('fighter', 3, 'eldritchKnight')).toBe(1);
  });

  it('обычный кастер использует свой список', () => {
    expect(spellListClass('wizard')).toBe('wizard');
  });
});

describe('DC и атака', () => {  it('формулы', () => {
    expect(spellSaveDc(2, 3)).toBe(13);
    expect(spellAttackBonus(3, 4)).toBe(7);
  });

  it('профишенси листа: число или по уровню', () => {
    expect(sheetProficiencyBonus(normalizeSheet({ proficiencyBonus: '4' }))).toBe(4);
    expect(sheetProficiencyBonus(normalizeSheet({ proficiencyBonus: 'd4' }))).toBe(2);
    expect(
      sheetProficiencyBonus(normalizeSheet({ proficiencyBonus: '', classes: [{ className: 'wizard', level: 9 }] }))
    ).toBe(4);
  });
});

describe('casterClasses', () => {
  it('оставляет кастеров, включая третьих (EK/AT)', () => {
    const classes = casterClasses([
      { className: 'fighter', level: 7, subclass: 'eldritchKnight' },
      { className: 'barbarian', level: 2 },
      { className: 'wizard', level: 3 },
    ]);
    expect(classes.map((c) => c.className)).toEqual(['fighter', 'wizard']);
  });
});
