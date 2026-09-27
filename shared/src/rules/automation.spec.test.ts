import { describe, expect, it } from 'vitest';
import spellsRaw from '../data/spells.json';
import type { AutomationDef } from '../domain/automation';
import type { AutomationOptions, AutomationSpec, AutomationSpecCopy } from './automation';
import { AUTOMATION_SPELLS } from './automation';
import {
  bladeBarrierDef,
  blindnessDeafnessDef,
  boomingBladeDef,
  breathSpellDef,
  commandDef,
  compositeDamageDef,
  conjureMinorElementalsDef,
  cordonOfArrowsDef,
  elementalBaneDef,
  elementalWeaponDef,
  enhanceAbilityDef,
  fireShieldDef,
  flameArrowsDef,
  flameBladeDef,
  greenFlameBladeDef,
  guardianOfFaithDef,
  healingSpiritDef,
  magicStoneDef,
  magicWeaponDef,
  protectionFromEnergyDef,
  resistanceDef,
  shadowBladeDef,
  shillelaghDef,
  skillEmpowermentDef,
  spiritShroudDef,
  trueStrikeDef,
  wallOfFireDef,
  wallOfForceDef,
  wallOfIceDef,
  wallOfLightDef,
  wallOfSandDef,
  wallOfStoneDef,
  wallOfThornsDef,
  zephyrStrikeDef,
} from './automation/builders';
import { compileSpec, resolveSpec, validateSpec } from './automation/compile';
import { AUTOMATION_SPECS } from './automation/specs';
import type { Spell } from './spells';

const SPELLS = (spellsRaw as unknown as { spells: Spell[] }).spells;

/** Билдеры пилота: эталон, с которым компилятор спеков обязан совпадать побайтно. */
const BUILDERS: Record<string, (spell: Spell, opts: AutomationOptions) => AutomationDef | undefined> = {
  'TCE:Green-Flame Blade': greenFlameBladeDef,
  'TCE:Booming Blade': boomingBladeDef,
  'XPHB:True Strike': trueStrikeDef,
  'XPHB:Shillelagh': shillelaghDef,
  'XPHB:Magic Weapon': magicWeaponDef,
  'XPHB:Elemental Weapon': elementalWeaponDef,
  'XGE:Flame Arrows': flameArrowsDef,
  'XGE:Shadow Blade': shadowBladeDef,
  'XGE:Magic Stone': (spell) => magicStoneDef(spell),
  'XPHB:Flame Blade': flameBladeDef,
  'XPHB:Resistance': resistanceDef,
  'XGE:Elemental Bane': elementalBaneDef,
  'XGE:Zephyr Strike': (spell) => zephyrStrikeDef(spell),
  'XPHB:Mirror Image': () => AUTOMATION_SPELLS['XPHB:Mirror Image'],
  'XPHB:Guardian of Faith': (spell) => guardianOfFaithDef(spell),
  'XPHB:Cordon of Arrows': cordonOfArrowsDef,
  'XGE:Healing Spirit': healingSpiritDef,
  'XPHB:Protection from Energy': protectionFromEnergyDef,
  'XPHB:Blindness/Deafness': blindnessDeafnessDef,
  'XPHB:Fire Shield': fireShieldDef,
  "XPHB:Dragon's Breath": breathSpellDef,
  'XPHB:Command': commandDef,
  'XPHB:Enhance Ability': enhanceAbilityDef,
  'XGE:Skill Empowerment': skillEmpowermentDef,
  'TCE:Spirit Shroud': spiritShroudDef,
  'XPHB:Conjure Minor Elementals': conjureMinorElementalsDef,
  'XPHB:Destructive Wave': compositeDamageDef,
  'XPHB:Wall of Fire': wallOfFireDef,
  'XPHB:Blade Barrier': bladeBarrierDef,
  'XGE:Wall of Sand': wallOfSandDef,
  'XPHB:Wall of Thorns': wallOfThornsDef,
  'XPHB:Wall of Ice': wallOfIceDef,
  'XPHB:Wall of Force': wallOfForceDef,
  'XPHB:Wall of Stone': wallOfStoneDef,
  'XGE:Wall of Light': wallOfLightDef,
};

describe('AutomationSpec (R16, пилот loadout)', () => {
  it('компиляция идентична билдерам: база, апкаст, кантрип-тиры, варианты', () => {
    for (const [key, spec] of Object.entries(AUTOMATION_SPECS)) {
      const spell = SPELLS.find((s) => s.key === key);
      expect(spell, key).toBeTruthy();
      const build = BUILDERS[key];
      if (!build) throw new Error(`нет билдера ${key}`);
      const base = Math.max(1, spell!.level);
      const cases: AutomationOptions[] = [
        { castLevel: base },
        { castLevel: Math.min(9, base + 1), characterLevel: 11, spellMod: 4 },
        { castLevel: Math.min(9, base + 2), characterLevel: 17 },
        { castLevel: 7, characterLevel: 17, spellMod: 5 },
      ];
      const choice = spec.choices?.[0];
      if (choice) {
        cases.push({ castLevel: base, variant: choice.options[choice.options.length - 1] });
        cases.push({ castLevel: 5, variant: choice.options[1] });
      }
      for (const opts of cases) {
        const label = `${key} ${JSON.stringify(opts)}`;
        expect(compileSpec(spec, { spell: spell!, opts }), label).toEqual(build(spell!, opts));
      }
    }
  });

  it('копия (extends+patch) меняет механику без кода: пути по id, above:spell, remove', () => {
    const copy: AutomationSpecCopy = {
      key: 'CUSTOM:Пылающий кордон',
      name: 'Пылающий кордон',
      extends: 'XPHB:Cordon of Arrows',
      patch: {
        'zone.charges': { perLevel: { base: 6, per: 3, above: 'spell' } },
        'zone.triggers.enter.damage': { dice: '3d6', types: ['fire'] },
        'zone.triggers.endOfTurn.damage.types': ['fire'],
      },
      remove: ['zone.excludeSource'],
    };
    const spell = SPELLS.find((s) => s.key === 'XPHB:Cordon of Arrows')!;
    const def = compileSpec(resolveSpec(copy), { spell, opts: { castLevel: 4 } });
    expect(def.key).toBe('CUSTOM:Пылающий кордон');
    expect(def.zone?.charges).toBe(6 + 3 * (4 - spell.level));
    expect(def.zone?.triggers?.enter?.damage).toEqual({ dice: '3d6', types: ['fire'] });
    expect(def.zone?.triggers?.endOfTurn?.damage?.types).toEqual(['fire']);
    expect(def.zone?.triggers?.endOfTurn?.damage?.dice).toBe('2d4');
    expect(def.zone?.excludeSource).toBeUndefined();
  });

  it('копия: неизвестный путь — ошибка, а не молчаливый no-op', () => {
    const bad: AutomationSpecCopy = {
      key: 'CUSTOM:Bad',
      name: 'Bad',
      extends: 'XPHB:Cordon of Arrows',
      patch: { 'zone.nope': 1 },
    };
    expect(() => resolveSpec(bad)).toThrow();
  });

  it('валидатор: недопустимые комбинации — ошибка компиляции, а не молчание', () => {
    const bad = {
      key: 'TEST:Bad',
      name: 'Bad',
      primary: 'utility',
      effects: [{ id: 'e', name: 'E', duration: { type: 'permanent' }, modifiers: [] }],
    } as unknown as AutomationSpec;
    expect(validateSpec(bad).length).toBeGreaterThan(0);
    expect(() => compileSpec(bad, { spell: SPELLS[0]!, opts: {} })).toThrow();

    const badChoice = {
      key: 'TEST:BadChoice',
      name: 'BadChoice',
      primary: 'effect',
      choices: [{ id: 'damageType', param: 'damageType', options: ['fire'] }],
      effects: [
        {
          id: 'e',
          name: 'E',
          duration: { type: 'permanent' },
          modifiers: [],
          variant: { ref: 'choice', choice: 'missing' },
        },
      ],
    } as unknown as AutomationSpec;
    expect(validateSpec(badChoice).some((e) => e.includes('missing'))).toBe(true);
  });
});
