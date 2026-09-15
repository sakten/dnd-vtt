import type { ActionCost, ActionTargeting } from './actions';
import type { AutomationDef, AutomationEffect } from './automation';

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
}

/** Механика черты: кнопка, пассивка или слот выбора. */
export type FeatureTrait = 'active' | 'passive' | 'choice';

export interface FeatureMechanics {
  trait: FeatureTrait;
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
