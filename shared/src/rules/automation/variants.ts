import type { ChoiceSpec } from './spec';
import type { MaterializedAutomation, SpellAuto } from './materialize';

export interface AutomationOptions {
  /** Модификатор заклинательной характеристики кастера (Heroism: временные HP за ход). */
  spellMod?: number;
  /** Круг ячейки (по умолчанию — базовый круг заклинания). */
  castLevel?: number;
  /** Уровень персонажа для скейла кантрипов. */
  characterLevel?: number;
  /** Выбранные инвокации варлока (модификаторы Eldritch Blast). */
  invocations?: string[];
  /** Выбор варианта при касте (Dragon's Breath: тип урона выдоха). */
  variant?: string;
}

/** Вариант заклинания, выбираемый при касте (Dragon's Breath: тип урона; Enhance Ability: характеристика; Eyebite: эффект). */
export interface SpellVariantDef {
  param: 'damageType' | 'ability' | 'effect' | 'skill' | 'command';
  options: string[];
}

/** Отображение параметра выбора спека в параметр UI-варианта (mode/condition — к эффекту). */
const VARIANT_PARAM: Record<ChoiceSpec['param'], SpellVariantDef['param']> = {
  damageType: 'damageType',
  ability: 'ability',
  skill: 'skill',
  command: 'command',
  condition: 'effect',
  mode: 'effect',
  effect: 'effect',
};

/** Источник выбора: каноническая запись/спек-носитель или сам спек (импорт/тесты). */
export type VariantSource = SpellAuto | { automation?: MaterializedAutomation; choices?: ChoiceSpec[] };

/**
 * Варианты каста заклинания (undefined — выбора нет): источник — `choices` канонической
 * записи (`spell.automation`); для спеков/копий (`resolveSpec` при импорте) — сам спек.
 * Показывается первый выбор; мультивыбор — задел конструктора (см. `AUTOMATION.md` §3.5).
 */
export function spellVariantDef(source: VariantSource): SpellVariantDef | undefined {
  const choice = source.automation?.choices?.[0] ?? ('choices' in source ? source.choices?.[0] : undefined);
  return choice ? { param: VARIANT_PARAM[choice.param], options: [...choice.options] } : undefined;
}
