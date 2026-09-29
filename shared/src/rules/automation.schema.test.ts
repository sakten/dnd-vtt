import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import spellsRaw from '../data/spells.json';
import { AUTOMATION_SPECS, materializeSpell, validateSpec } from './automation';
import { AUTOMATION_SPEC_SCHEMA, MATERIALIZED_AUTOMATION_SCHEMA } from './automation/schema';
import type { Spell } from './spells';

/**
 * Замок JSON-Schema (R16 шаг 4, срез 2): структурная валидация спеков реестра
 * и материализованных записей каталога; семантика — `validateSpec` (вызывается
 * `compileSpec`). Дискриминирующие негативы — ниже: схема обязана ловить
 * неизвестные поля, битые значения и лишние `key`/`name` в записи.
 */
const ajv = new Ajv2020({ allErrors: true, strict: false });
const checkSpec = ajv.compile(AUTOMATION_SPEC_SCHEMA);
const checkMaterialized = ajv.compile(MATERIALIZED_AUTOMATION_SCHEMA);

const SPELLS = (spellsRaw as unknown as { spells: Spell[] }).spells;

function specErrors(value: unknown): string[] {
  return checkSpec(value) ? [] : (checkSpec.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`);
}

function materializedErrors(value: unknown): string[] {
  return checkMaterialized(value)
    ? []
    : (checkMaterialized.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`);
}

describe('JSON-Schema AutomationSpec (R16 шаг 4, срез 2)', () => {
  it('все спеки реестра валидны', () => {
    const bad: string[] = [];
    for (const [key, spec] of Object.entries(AUTOMATION_SPECS)) {
      const errors = specErrors(spec);
      if (errors.length) bad.push(`${key}: ${errors.slice(0, 3).join('; ')}`);
    }
    expect(bad).toEqual([]);
  });

  it('все материализованные автоматизации записей валидны', () => {
    const bad: string[] = [];
    let checked = 0;
    for (const spell of SPELLS) {
      const { automation } = materializeSpell(spell);
      if (!automation) continue;
      checked += 1;
      const errors = materializedErrors(automation);
      if (errors.length) bad.push(`${spell.key}: ${errors.slice(0, 3).join('; ')}`);
    }
    expect(checked).toBe(Object.keys(AUTOMATION_SPECS).length);
    expect(bad).toEqual([]);
  });

  it('negative: неизвестное поле, битый enum/тип и лишние key/name не проходят', () => {
    const sanctuary = AUTOMATION_SPECS['XPHB:Sanctuary']!;
    expect(specErrors({ ...sanctuary, nope: 1 }).length).toBeGreaterThan(0);
    expect(specErrors({ ...sanctuary, primary: 'nope' }).length).toBeGreaterThan(0);

    const fireballish = {
      key: 'TEST:Bad',
      name: 'Bad',
      primary: 'save',
      save: { ability: 'dex', extra: true },
      damage: { dice: { scale: { dice: '8d6', by: 'upcast' } }, types: ['fire'] },
    };
    expect(specErrors(fireballish).length).toBeGreaterThan(0);

    const badZone = { key: 'TEST:BadZone', name: 'BadZone', primary: 'save', zone: { area: { shape: 'circle', size: 10 } } };
    expect(specErrors(badZone).length).toBeGreaterThan(0);

    const { key, name, ...materialized } = sanctuary;
    expect(name).toBe('Sanctuary');
    expect(materializedErrors(materialized)).toEqual([]);
    expect(materializedErrors({ ...materialized, key })).not.toEqual([]);
    expect(materializedErrors({ ...materialized, name })).not.toEqual([]);
  });

  it('validateSpec: семантические требования primary (utility/shape)', () => {
    expect(validateSpec({ key: 'TEST:NoUtility', name: 'NoUtility', primary: 'utility' })).toContain(
      'utility без utility.kind'
    );
    expect(validateSpec({ key: 'TEST:NoShape', name: 'NoShape', primary: 'shape', save: { ability: 'wis' } })).toContain(
      'shape без shape'
    );
    expect(
      validateSpec({ key: 'TEST:ShapeBad', name: 'ShapeBad', primary: 'effect', shape: { kind: 'polymorph' } })
    ).toContain('shape допустим только с save');
  });
});
