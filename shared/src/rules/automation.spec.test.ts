import { describe, expect, it } from 'vitest';
import spellsRaw from '../data/spells.json';
import { AUTOMATION_SPECS, spellVariantDef } from './automation';
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

  it('выборы: мультивыбор адресуется по id, default и optional — из спека', () => {
    const spec: AutomationSpec = {
      key: 'TEST:MultiChoice',
      name: 'MultiChoice',
      primary: 'effect',
      choices: [
        { id: 'damageType', param: 'damageType', options: ['fire', 'cold'], default: 'cold' },
        { id: 'mode', param: 'effect', options: ['alpha', 'beta'], default: 'beta' },
      ],
      effects: [
        {
          id: 'e',
          name: 'E',
          duration: { type: 'permanent' },
          variant: { ref: 'choice', choice: 'mode', optional: true },
          modifiers: [
            {
              target: 'damage',
              mode: 'add',
              value: '1d6',
              filter: { damageType: { ref: 'choice', choice: 'damageType' } },
            },
          ],
        },
      ],
    };
    const input = { spell: SPELLS[0]!, opts: {} };
    const base = compileSpec(spec, input);
    expect(base.effects?.[0]?.modifiers[0]?.filter?.damageType).toBe('cold');
    expect(base.effects?.[0]?.variant).toBeUndefined();

    // Вариант второго выбора не влияет на первый; optional не включается чужим выбором.
    const byDamage = compileSpec(spec, { ...input, opts: { variant: 'fire' } });
    expect(byDamage.effects?.[0]?.modifiers[0]?.filter?.damageType).toBe('fire');
    expect(byDamage.effects?.[0]?.variant).toBeUndefined();

    const byMode = compileSpec(spec, { ...input, opts: { variant: 'alpha' } });
    expect(byMode.effects?.[0]?.modifiers[0]?.filter?.damageType).toBe('cold');
    expect(byMode.effects?.[0]?.variant).toBe('alpha');
  });

  it('копия: патч choices.<id> сужает опции и виден UI-хелперу (резолв extends)', () => {
    const copy: AutomationSpecCopy = {
      key: 'CUSTOM:Выбор урона',
      name: 'Выбор урона',
      extends: 'XPHB:Spirit Guardians',
      patch: { 'choices.damageType.options': ['fire', 'cold'] },
    };
    const registry: Record<string, AutomationSpec | AutomationSpecCopy> = {
      'XPHB:Spirit Guardians': AUTOMATION_SPECS['XPHB:Spirit Guardians']!,
      [copy.key]: copy,
    };
    expect(spellVariantDef(copy.key, registry)).toEqual({ param: 'damageType', options: ['fire', 'cold'] });
    const spell = SPELLS.find((s) => s.key === 'XPHB:Spirit Guardians')!;
    const def = compileSpec(resolveSpec(copy, registry), { spell, opts: { variant: 'cold' } });
    expect(def.damage?.types).toEqual(['cold']);
  });

  it('валидатор: значение выбора вне словаря параметра — ошибка (кастомных опций нет)', () => {
    const bad = {
      key: 'TEST:BadChoiceValue',
      name: 'BadChoiceValue',
      primary: 'save',
      save: { ability: 'dex' },
      choices: [{ id: 'damageType', param: 'damageType', options: ['fyre'] }],
      damage: { dice: '1d6', types: [{ ref: 'choice' }] },
    } as unknown as AutomationSpec;
    expect(validateSpec(bad).some((e) => e.includes('fyre'))).toBe(true);

    // Сентинел True Strike `weapon` — допустимое значение словаря типов урона.
    const weapon = {
      key: 'TEST:WeaponChoice',
      name: 'WeaponChoice',
      primary: 'effect',
      choices: [{ id: 'damageType', param: 'damageType', options: ['weapon', 'radiant'] }],
      effects: [{ id: 'e', name: 'E', duration: { type: 'permanent' }, modifiers: [] }],
    } as unknown as AutomationSpec;
    expect(validateSpec(weapon)).toEqual([]);
  });

  it('валидатор: baseActionId вместе с payload — ошибка, а не молчаливая потеря', () => {
    const action = { id: 'dash', name: 'Рывок', cost: 'bonus', baseActionId: 'dash' };
    const bad = {
      key: 'TEST:BadBaseAction',
      name: 'BadBaseAction',
      primary: 'effect',
      effects: [
        {
          id: 'e',
          name: 'E',
          duration: { type: 'permanent' },
          modifiers: [],
          actions: [{ ...action, damage: { dice: '1d6' } }],
        },
      ],
    } as unknown as AutomationSpec;
    expect(validateSpec(bad).some((e) => e.includes('baseActionId'))).toBe(true);
    expect(() => compileSpec(bad, { spell: SPELLS[0]!, opts: {} })).toThrow();

    const ok = {
      key: 'TEST:BaseAction',
      name: 'BaseAction',
      primary: 'effect',
      effects: [
        { id: 'e', name: 'E', duration: { type: 'permanent' }, modifiers: [], actions: [action] },
      ],
    } as unknown as AutomationSpec;
    expect(validateSpec(ok)).toEqual([]);
  });

  it('utility: multiplier/thenMove — зеркало AutomationUtility (Мантия вдохновения)', () => {
    const spec: AutomationSpec = {
      key: 'TEST:Mantle',
      name: 'Mantle',
      primary: 'utility',
      utility: { kind: 'tempHp', dice: '1d8', multiplier: 2, thenMove: true },
    };
    const def = compileSpec(spec, { spell: SPELLS[0]!, opts: {} });
    expect(def.utility).toEqual({ kind: 'tempHp', dice: '1d8', multiplier: 2, thenMove: true });
  });
});
