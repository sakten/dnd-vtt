import { describe, expect, it } from 'vitest';
import spellsRaw from '../data/spells.json';
import type { AutomationSpec, AutomationSpecCopy } from './automation';
import { compileSpec, resolveSpec, validateSpec } from './automation/compile';
import type { Spell } from './spells';

const SPELLS = (spellsRaw as unknown as { spells: Spell[] }).spells;

describe('AutomationSpec (R16, пилот loadout)', () => {
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
      primary: 'summon',
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
