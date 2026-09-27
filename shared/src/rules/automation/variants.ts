import type { ChoiceSpec } from './spec';
import { AUTOMATION_SPECS } from './specs';

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

/** Варианты каста заклинания (undefined — выбора нет): источник — `AutomationSpec.choices`. */
export function spellVariantDef(spellKey: string): SpellVariantDef | undefined {
  const choice = AUTOMATION_SPECS[spellKey]?.choices?.[0];
  return choice ? { param: VARIANT_PARAM[choice.param], options: [...choice.options] } : undefined;
}