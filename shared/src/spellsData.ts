import type { SpellDef } from './rules/automation/materialize';
import raw from './data/catalog.json';
import cbtRaw from './data/cbt/spells.json';

export interface SpellData {
  attribution: string;
  count: number;
  spells: SpellDef[];
}

/**
 * Канонические записи заклинаний (R16 шаг 4): meta + спек автоматизации
 * (`npm run catalog` из `spells.json` + спеки). Ленивая загрузка на клиенте:
 * `import('shared/spellsData')`. Ручной third-party каталог добавляется поверх.
 */
const catalog = raw as unknown as SpellData;
const cbt = cbtRaw as unknown as SpellData;
const spellData: SpellData = {
  ...catalog,
  count: catalog.spells.length + cbt.spells.length,
  spells: [...catalog.spells, ...cbt.spells],
};

export default spellData;
