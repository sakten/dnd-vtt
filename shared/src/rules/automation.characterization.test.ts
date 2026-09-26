import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import spellsRaw from '../data/spells.json';
import {
  AUTOMATION_ADDITIONS,
  AUTOMATION_SPELLS,
  SPELL_VARIANTS,
  automationForSpell,
  spellAutomated,
  spellDamageParts,
  spellTempHp,
} from './automation';
import type { Spell } from './spells';

/**
 * Характеризационный замок автоматизации: фиксирует канонический вид каталога
 * и всех производных спек (база/апкаст/высокий уровень/варианты). Служит
 * страховкой при структурных рефакторингах (R16): перенос кода не должен
 * менять ни один байт механики. При осознанной правке механики обновить
 * константы: `VTT_UPDATE_BASELINE=1 npx vitest run src/rules/automation.characterization.test.ts`.
 */
const SPELLS = (spellsRaw as unknown as { count: number; spells: Spell[] }).spells;

/** Стабильная сериализация: ключи сортируются, undefined-поля опускаются. */
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

const hash = (value: unknown) => createHash('sha256').update(stable(value)).digest('hex').slice(0, 16);

const cases: [string, unknown][] = [];
for (const spell of SPELLS) {
  const base = Math.max(1, spell.level);
  cases.push([`${spell.key}@${base}/17`, automationForSpell(spell, { castLevel: base, characterLevel: 17 })]);
  const up = Math.min(9, base + 1);
  if (up !== base) {
    cases.push([`${spell.key}@${up}/17`, automationForSpell(spell, { castLevel: up, characterLevel: 17 })]);
  }
  cases.push([`${spell.key}#parts`, spellDamageParts(spell)]);
  const tempHp = spellTempHp(spell, base, 17);
  if (tempHp) cases.push([`${spell.key}#tempHp`, tempHp]);
}
for (const [key, variant] of Object.entries(SPELL_VARIANTS)) {
  const spell = SPELLS.find((s) => s.key === key);
  if (!spell) continue;
  const castLevel = Math.max(1, spell.level);
  for (const option of variant.options) {
    cases.push([
      `${key}@${castLevel}/${option}`,
      automationForSpell(spell, { castLevel, characterLevel: 17, variant: option }),
    ]);
  }
}

const actual = {
  catalog: hash(AUTOMATION_SPELLS),
  additions: hash(AUTOMATION_ADDITIONS),
  derived: hash(cases.map(([name, def]) => `${name}=${stable(def)}`).join('\n')),
  green: SPELLS.filter((s) => spellAutomated(s)).length,
  red: SPELLS.filter((s) => !spellAutomated(s)).length,
};

const EXPECTED = {
  catalog: 'e78af02f50934142',
  additions: '1b3ac2b7685ff142',
  derived: '77919e71f80fe527',
  green: 239,
  red: 181,
};

describe('характеризация автоматизации', () => {
  it('каталог и производные спеки не менялись с момента среза', () => {
    if (process.env.VTT_UPDATE_BASELINE === '1') {
      console.log(JSON.stringify(actual, null, 2));
      return;
    }
    expect(actual).toEqual(EXPECTED);
  });
});
