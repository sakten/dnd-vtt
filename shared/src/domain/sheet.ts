import type { AbilityKey, SkillLevel } from './core';
import type { DamageDefense } from './damage';
import type { FeatureChoice } from './feature';
import type { Sense } from './sense';
import type { AttackEntry } from './token';

export interface ClassLevel {
  className: string;
  level: number;
  subclass?: string;
}

export type RestType = 'short' | 'long' | 'never';

export interface ResourceItem {
  id: string;
  key?: string;
  name: string;
  current: number;
  max: number;
  reset: RestType;
  auto?: boolean;
}

export interface PlayerResources {
  hp: {
    current: number;
    max: number;
    temp: number;
    deathSuccesses: number;
    deathFailures: number;
    /** Стабилен (Spare the Dying/3 успеха): death-сейвы не бросаются, пока не получит урон. */
    stable?: boolean;
  };
  hitDice: { die: number; current: number; max: number }[];
  spellSlots: { level: number; current: number; max: number }[];
  pact: { current: number; max: number; level: number };
  resources: ResourceItem[];
  notes: string;
}

export interface CharacterSheet {
  name: string;
  abilities: Record<AbilityKey, number>;
  proficiencyBonus: string;
  saves: Partial<Record<AbilityKey, boolean>>;
  skills: Partial<Record<string, SkillLevel>>;
  attacks: AttackEntry[];
  classes: ClassLevel[];
  /** Выбранные заклинания: ключ `источник:имя` и класс, из чьего списка взято. */
  spells: SheetSpell[];
  /** Выборы способностей (фиты, инвокации, манёвры, метамагия) — R8.8. */
  choices?: FeatureChoice[];
  /** Выбранные воззвания варлока (ключи `XPHB:…`) — R8.10. */
  invocations?: string[];
  /** Известные формы друида (ключи бестиария) — Wild Shape/Polymorph. */
  wildShape?: { known?: string[] };
  hpMax: string;
  ac: string;
  /** Базовая скорость, футы. */
  speed: number;
  /** Восприятие (тёмное/слепое/дьявольское зрение); зеркалится в токены персонажа. */
  senses: Sense[];
  /** Сопротивления/иммунитеты/уязвимости к типам урона. */
  damageDefenses: DamageDefense[];
}

export interface SheetSpell {
  key: string;
  className: string;
}
