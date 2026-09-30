import type { Spell } from '../spells';
import { WALL_DIMS } from '../spellCast';
import { resolveSpec } from './compile';
import { generatedAutomation } from './generate';
import { AUTOMATION_SPECS } from './specs';
import type { AutomationSpec, AutomationSpecCopy } from './spec';

/**
 * Механическая часть канонической записи (R16 шаг 4): спек без `key`/`name` —
 * они берутся из meta записи. Ссылки `{ ref: ... }`/`{ from: 'spell' }` остаются:
 * компилятор резолвит их из meta (`compileSpec(meta + automation)`).
 */
export type MaterializedAutomation = Omit<AutomationSpec, 'key' | 'name'>;

/**
 * Каноническая запись заклинания (R16 шаг 4): `SpellDef = meta + automation`.
 * Data-флаг `Spell.automation: 'full' | 'manual'` снят — его роль играет
 * наличие спека в записи (деривация из данных — только режим генерации `catalog`).
 */
export type SpellDef = Spell & { automation: MaterializedAutomation };

/** Носитель автоматизации для потребителей: запись или meta-объект (совместимость). */
export type SpellAuto = Spell & { automation?: MaterializedAutomation };

/**
 * Собирает каноническую запись заклинания из meta и спека `AUTOMATION_SPECS`.
 * Копии (`extends`) сливаются — канон хранит слитую запись; габариты стен
 * (`WALL_DIMS` по ключу) разворачиваются в литералы записи. Заклинания без спека
 * получают сгенерированный спек из данных (`generatedAutomation`): деривация
 * (атака/спас/авто) со ссылками `spellDamage`/`spellAttackCount` и ручные записи.
 */
export function materializeSpell(
  spell: Spell,
  registry: Record<string, AutomationSpec | AutomationSpecCopy> = AUTOMATION_SPECS
): SpellDef {
  const spec = registry[spell.key];
  if (!spec) return { ...spell, automation: generatedAutomation(spell) };
  return { ...spell, automation: materializeAutomation(spec, spell, registry) };
}

/** Спек одной записи: `extends` слит, `WALL_DIMS` развёрнут, `key`/`name` сняты. */
export function materializeAutomation(
  spec: AutomationSpec | AutomationSpecCopy,
  spell: Spell,
  registry: Record<string, AutomationSpec | AutomationSpecCopy> = AUTOMATION_SPECS
): MaterializedAutomation {
  const resolved = resolveSpec(spec, registry);
  if (resolved.key !== spell.key) {
    throw new Error(`Materialize: ключ спека ${resolved.key} ≠ ключа заклинания ${spell.key}`);
  }
  if (resolved.name !== spell.name) {
    throw new Error(`Materialize: имя спека ${resolved.name} ≠ имени заклинания ${spell.name}`);
  }
  const clone = structuredClone(resolved);
  const area = clone.zone?.area;
  if (area && 'wall' in area && 'from' in area.wall) {
    const dims = WALL_DIMS[spell.key];
    if (!dims) throw new Error(`Materialize: нет WALL_DIMS для стены ${spell.key}`);
    area.wall = { ...dims };
  }
  const { key: _key, name: _name, ...automation } = clone;
  return automation;
}
