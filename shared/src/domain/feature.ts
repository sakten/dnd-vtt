import type { ActionCost, ActionTargeting } from './actions';
import type { AutomationDef, AutomationEffect } from './automation';
import type { AbilityKey } from './core';

/** Черта класса/подкласса из сгенерированного каталога 5e.tools (R8.8). */
export interface FeatureDef {
  /** `класс[:подкласс]:camelName` — совпадает с ключом ресурса CLASSES, если черта тратит ресурс. */
  key: string;
  name: string;
  className: string;
  subclass?: string;
  level: number;
  source: string;
  description: string;
}

/** Вид выбора персонажа (`CharacterSheet.choices`): фиты, инвокации, манёвры и т.п. */
export type FeatureChoiceKind =
  | 'feat'
  | 'invocation'
  | 'maneuver'
  | 'metamagic'
  | 'fightingStyle'
  | 'pactBoon'
  | 'infusion'
  | 'featureOption';

export interface FeatureChoice {
  kind: FeatureChoiceKind;
  key: string;
  /** Способность выбора (Magic Initiate: int/wis/cha и т.п.). */
  ability?: AbilityKey;
  /** Выбранные заклинания черты (ключи). */
  spells?: string[];
  /** Единственное заклинание черты 1+ круга (Magic Initiate). */
  spell?: string;
  /** Выбранный список/вариант (класс списка заклинаний и т.п.). */
  list?: string;
}

/** Механика черты: кнопка, пассивка или слот выбора. */
export type FeatureTrait = 'active' | 'passive' | 'choice';

export interface FeatureMechanics {
  trait: FeatureTrait;
  /** Имя кнопки-переопределение (если механика уточняет, что делает черта). */
  name?: string;
  /** Активные: стоимость/таргетинг (приоритетнее FEATURE_META). */
  costs?: ActionCost[];
  targeting?: ActionTargeting;
  resourceKey?: string;
  resourceAmount?: number;
  /** Пассивные: постоянные эффекты на носителя (накладываются скрытыми). */
  effects?: AutomationEffect[];
  /** Активные: автоматизация, если для неё нет строки в `AUTOMATION_ACTIONS`. */
  automation?: AutomationDef;
  /** Пассивка уже реализована ядром (Extra Attack и т.п.) — эффекты не нужны. */
  native?: boolean;
}
