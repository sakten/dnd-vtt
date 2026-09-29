import { describe, expect, it } from 'vitest';
import spellsRaw from '../data/spells.json';
import { AUTOMATION_SPECS, automationForSpell, compileSpec, materializeSpell } from './automation';
import type { Spell } from './spells';
import { WALL_DIMS } from './spellCast';

/**
 * Замок прототипа материализации (R16 шаг 4, срез 1): каноническая запись
 * `SpellDef = meta + automation` из `spells.json` + `AUTOMATION_SPECS` даёт
 * байт-в-байт тот же `AutomationDef`, что и старый путь `automationForSpell`
 * (свип по кругам/уровням/вариантам/spellMod). Ничего не переключает: записи
 * со спеком проверяются через `compileSpec`, остальные 258 пока без `automation`
 * (fallback каталог/призывы/деривация/manual — разворачиваются отдельными срезами).
 */
const SPELLS = (spellsRaw as unknown as { spells: Spell[] }).spells;

/** Стабильная сериализация: ключи сортируются, `undefined`-поля опускаются. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .filter((key) => obj[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${stable(obj[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

const CAST_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const CHARACTER_LEVELS = [1, 5, 11, 17, 20];
const SPELL_MODS = [0, 4];

/** Компиляция записи без опоры на `WALL_DIMS` по ключу: габариты стен обязаны быть в записи. */
function compileWithoutWallDims<T>(spellKey: string, fn: () => T): T {
  const saved = WALL_DIMS[spellKey];
  delete WALL_DIMS[spellKey];
  try {
    return fn();
  } finally {
    if (saved) WALL_DIMS[spellKey] = saved;
  }
}

describe('материализация SpellDef (R16 шаг 4, срез 1)', () => {
  it('meta переносится без изменений; automation есть у всех 420 записей', () => {
    let registrySpecs = 0;
    for (const spell of SPELLS) {
      const record = materializeSpell(spell);
      const { automation, ...recordMeta } = record;
      const { automation: _legacy, ...meta } = spell as Spell & { automation?: unknown };
      expect(stable(recordMeta)).toBe(stable(meta));
      expect(automation).toBeDefined();
      if (AUTOMATION_SPECS[spell.key]) registrySpecs += 1;
      const area = automation!.zone?.area;
      if (area && 'wall' in area) expect('from' in area.wall).toBe(false);
    }
    expect(registrySpecs).toBe(Object.keys(AUTOMATION_SPECS).length);
    expect(SPELLS).toHaveLength(420);
  });

  it('compileSpec(meta + automation) == старый automationForSpell: полный свип', { timeout: 120000 }, () => {
    const failures: string[] = [];
    let checks = 0;
    let expected = 0;
    for (const spell of SPELLS) {
      const record = materializeSpell(spell);
      const automation = record.automation;
      if (!automation) continue;
      const spec = { ...automation, key: spell.key, name: spell.name };
      const variants: (string | undefined)[] = [undefined, ...(automation.choices?.[0]?.options ?? [])];
      for (const castLevel of CAST_LEVELS) {
        for (const characterLevel of CHARACTER_LEVELS) {
          for (const variant of variants) {
            for (const spellMod of SPELL_MODS) {
              expected += 1;
              const opts = { castLevel, characterLevel, spellMod, ...(variant ? { variant } : {}) };
              const oldDef = automationForSpell(record, opts);
              // Стеновые записи компилируются без ключей `WALL_DIMS`: габариты уже в записи.
              const newDef = compileWithoutWallDims(spell.key, () => compileSpec(spec, { spell, opts }));
              const params = `${spell.key}@${castLevel}/${characterLevel}${variant ? `/${variant}` : ''}#mod${spellMod}`;
              if (stable(oldDef) !== stable(newDef)) failures.push(params);
              checks += 1;
            }
          }
        }
      }
    }
    expect(checks).toBe(expected);
    expect(expected).toBeGreaterThan(10000);
    expect(failures.slice(0, 10)).toEqual([]);
  });
});
