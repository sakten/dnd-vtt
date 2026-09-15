import type { ActionDef } from './actions';
import type { AbilityKey, Faction } from './core';
import type { DamageDefense } from './damage';
import type { ConditionInstance, EffectInstance } from './effects';

export interface TokenFields {
  name: string;
  description: string;
  imageUrl: string;
  cells: number;
  round: boolean;
  initiativeBonus: string;
  isPlayerToken: boolean;
  owner: string;
  attacks: AttackEntry[];
  ac: string;
  hpMax: string;
  /** DM-галка: показывать AC/HP этого токена игрокам. */
  showStats: boolean;
  /** Сопротивления/иммунитеты/уязвимости к типам урона. */
  damageDefenses: DamageDefense[];
  /** Статблок монстра: у токена и в библиотеке (раздаётся при выставлении). */
  statblock?: TokenStatblock;
}

export interface LibraryItem extends TokenFields {
  id: string;
}

export interface Token extends TokenFields {
  id: string;
  libraryItemId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  scale: number;
  rotation: number;
  z: number;
  visible: boolean;
  ownerId: string;
  lockedBy: string | null;
  hpCurrent: number;
  /** Временные хиты. */
  hpTemp: number;
  /** Отношение к игрокам (для таргетинга союзник/враг). */
  faction: Faction;
  /** Скорость в футах; у персонажей зеркалится из листа. */
  speed: number;
  conditions: ConditionInstance[];
  effects: EffectInstance[];
}

/** Данные монстра, которые DM вводит вручную (позже — бестиарий). */
export interface TokenStatblock {
  abilities: Record<AbilityKey, number>;
  /** Явные бонусы спасбросков; пусто — считаются из характеристик. */
  saves?: Partial<Record<AbilityKey, number>>;
  spellcasting?: {
    ability: AbilityKey;
    dc?: number;
    attack?: number;
    /** Ячейки монстра: уровень 1–9, максимум и остаток; пусто — без учёта. */
    slots?: { level: number; max: number; current: number }[];
    /** Выбранные заклинания статблока (ключи); список ограничивает каст. */
    spells?: string[];
  };
  /** Число атак за действие (мультиатака), по умолчанию 1. */
  multiattack?: number;
  legendary?: { max: number; actions: ActionDef[] };
  /** Особые действия/способности монстра. */
  actions?: ActionDef[];
}

export type AttackRangeType = 'melee' | 'ranged' | 'none';

export interface AttackEntry {
  name: string;
  hit: string;
  damage: string;
  rangeType: AttackRangeType;
  /** Ближняя: досягаемость, футы. Дальняя: обычная дистанция, футы. */
  rangeNormal: number;
  /** Дальняя: максимальная (дальняя) дистанция, футы; 0 — без ограничения. */
  rangeLong: number;
  /** Тип урона (ключ: bludgeoning/piercing/fire/…). */
  damageType?: string;
  /** Особый вид атаки: `unarmed` — переопределяет расчётный безоружный удар. */
  kind?: 'unarmed';
}
