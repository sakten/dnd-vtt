import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { materializeSpell, type Spell } from 'shared';

/**
 * Прототип R16 шага 4 (срез 1, `SESSION.md` §0): собирает канонический каталог
 * `SpellDef = meta + automation` из `spells.json` + `AUTOMATION_SPECS`.
 * Ничего не переключает — пишет gitignored-артефакт `artifacts/catalog.json`;
 * байт-замок — `shared/src/rules/automation.materialize.test.ts`. Запуск: `npm run catalog`.
 */

const dir = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(readFileSync(resolve(dir, '../shared/src/data/spells.json'), 'utf8')) as {
  spells: Spell[];
};
const spells = raw.spells.map((spell) => materializeSpell(spell));
const withAutomation = spells.filter((record) => record.automation).length;
const body = `${JSON.stringify({ count: spells.length, spells }, null, 2)}\n`;
mkdirSync(resolve(dir, '../artifacts'), { recursive: true });
writeFileSync(resolve(dir, '../artifacts/catalog.json'), body);
const hash = createHash('sha256').update(body).digest('hex').slice(0, 16);
console.log(`catalog.json: ${spells.length} записей, ${withAutomation} со спеком, hash ${hash}`);
