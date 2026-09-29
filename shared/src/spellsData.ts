import type { SpellDef } from './rules/automation/materialize';
import raw from './data/catalog.json';

export interface SpellData {
  attribution: string;
  count: number;
  spells: SpellDef[];
}

/**
 * Канонические записи заклинаний (R16 шаг 4): meta + спек автоматизации
 * (`npm run catalog` из `spells.json` + спеки). Ленивая загрузка на клиенте:
 * `import('shared/spellsData')`.
 */
const spellData = raw as unknown as SpellData;

export default spellData;
