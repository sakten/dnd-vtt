import { describe, expect, it } from 'vitest';
import spellsRaw from '../data/spells.json';
import type { AutomationDef } from '../domain/automation';
import type { AutomationOptions, AutomationSpec } from './automation';
import {
  boomingBladeDef,
  elementalWeaponDef,
  flameArrowsDef,
  flameBladeDef,
  greenFlameBladeDef,
  magicStoneDef,
  magicWeaponDef,
  shadowBladeDef,
  shillelaghDef,
  trueStrikeDef,
} from './automation/builders';
import { compileSpec, validateSpec } from './automation/compile';
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
        cases.push({ castLevel: base, variant: 'nope' });
      }
      for (const opts of cases) {
        const label = `${key} ${JSON.stringify(opts)}`;
        expect(compileSpec(spec, { spell: spell!, opts }), label).toEqual(build(spell!, opts));
      }
    }
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
