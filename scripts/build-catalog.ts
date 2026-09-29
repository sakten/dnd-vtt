import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { materializeSpell, type Spell } from 'shared';
import { MATERIALIZED_AUTOMATION_SCHEMA } from 'shared/automationSchema';

/**
 * R16 шаг 4: собирает канонический каталог `SpellDef = meta + automation` в
 * `shared/src/data/catalog.json` из `spells.json` + `AUTOMATION_SPECS` (деривация —
 * `generatedAutomation`). Это источник `shared/spellsData`; после `npm run spells`
 * (обновление меты) каталог перегенерировать. Замки: `automation.materialize.test.ts`
 * (байт-равенство компиляции), `automation.schema.test.ts` (структура, ajv),
 * deploy-тест (hash файла). Запуск: `npm run catalog`.
 */

const dir = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(readFileSync(resolve(dir, '../shared/src/data/spells.json'), 'utf8')) as {
  attribution: string;
  count: number;
  spells: Spell[];
};
const spells = raw.spells.map((spell) => materializeSpell(spell));

const ajv = new Ajv2020({ allErrors: true, strict: false });
const check = ajv.compile(MATERIALIZED_AUTOMATION_SCHEMA);
const invalid: string[] = [];
for (const record of spells) {
  if (record.automation && !check(record.automation)) {
    invalid.push(`${record.key}: ${ajv.errorsText(check.errors, { separator: '; ' })}`);
  }
}
if (invalid.length) throw new Error(`catalog.json: не прошли схему:\n${invalid.slice(0, 10).join('\n')}`);

const body = JSON.stringify({ attribution: raw.attribution, count: spells.length, spells });
const outPath = resolve(dir, '../shared/src/data/catalog.json');
writeFileSync(outPath, body);
const hash = createHash('sha256').update(body).digest('hex').slice(0, 16);
console.log(`catalog.json: ${spells.length} записей со спеком, hash ${hash} → ${outPath}`);
