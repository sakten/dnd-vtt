import { EFFECTS_SPECS } from './effects';
import { CATALOG_SPECS } from './catalog';
import { MANUAL_SPECS } from './manual';
import { SUMMONS_SPECS } from './summons';
import { WEAPONS_SPECS } from './weapons';
import { ZONES_SPECS } from './zones';
import { WALLS_SPECS } from './walls';
import { HOOKS_SPECS } from './hooks';
import { CHOICES_SPECS } from './choices';
import { MOVEMENT_SPECS } from './movement';
import { SELECTION_SPECS } from './selection';
import { VISION_SPECS } from './vision';
import { SMITES_SPECS } from './smites';
import { HP_SPECS } from './hp';
import { REPEAT_SPECS } from './repeat';
import type { AutomationSpec } from '../spec';

const MODULES: Record<string, AutomationSpec>[] = [
  EFFECTS_SPECS,
  CATALOG_SPECS,
  MANUAL_SPECS,
  SUMMONS_SPECS,
  WEAPONS_SPECS,
  ZONES_SPECS,
  WALLS_SPECS,
  HOOKS_SPECS,
  CHOICES_SPECS,
  MOVEMENT_SPECS,
  SELECTION_SPECS,
  VISION_SPECS,
  SMITES_SPECS,
  HP_SPECS,
  REPEAT_SPECS,
];

/**
 * Реестр спеков (R16): декларативные описания заклинаний (`AutomationSpec`),
 * компилируются в `AutomationDef` (`compileSpec`); равенство вывода — замок
 * `automation.spec.test.ts`, поведение — `automation.spec.behavior.test.ts`.
 *
 * Карта модулей (поиск: `grep "'КЛЮЧ':"` по папке `specs/`):
 * - `effects` — баффы/контроль/состояния; `catalog` — утилиты и малые зоны;
 * - `manual` — ручные записи (плашка/действия мастера), `summons` — призывы шаблонов;
 * - `weapons` — loadout (оружие и атаки); `zones` — зоны/ауры; `walls` — стены;
 * - `hooks` — реактивные перехваты/защита (блок `triggers` эффектов); `choices` — carrier'ы выбора при касте;
 * - `movement` — телепорты/перемещение; `selection` — метки/цели/цепи;
 * - `vision` — свет, сенсы, тьма; `smites` — смайты; `hp` — поток HP и лечение;
 * - `repeat` — лучи/повторы/триггеры эффектов; `factories` — общие фабрики и константы.
 */
export const AUTOMATION_SPECS: Record<string, AutomationSpec> = {};
for (const specs of MODULES) {
  for (const [key, spec] of Object.entries(specs)) {
    if (Object.hasOwn(AUTOMATION_SPECS, key)) throw new Error(`Duplicate automation spec key: ${key}`);
    AUTOMATION_SPECS[key] = spec;
  }
}
