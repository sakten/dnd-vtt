import type { AbilityKey } from './core';
import type { AttackRangeType } from './token';

export type ConditionKey =
  | 'blinded'
  | 'charmed'
  | 'deafened'
  | 'exhaustion'
  | 'frightened'
  | 'grappled'
  | 'incapacitated'
  | 'invisible'
  | 'paralyzed'
  | 'petrified'
  | 'poisoned'
  | 'prone'
  | 'restrained'
  | 'stunned'
  | 'unconscious'
  | 'dead'
  | 'custom';

export interface ConditionInstance {
  key: ConditionKey;
  name: string;
  /** Осталось раундов; null — до снятия/бессрочно. */
  rounds?: number | null;
  /** Уровень истощения (для key='exhaustion'), 1..6. */
  level?: number;
  /** Повторный спасбросок для снятия. */
  save?: { ability: AbilityKey; dc: number; timing: 'start' | 'end' };
  /** Кто наложил состояние. */
  sourceId?: string;
  /** Ключ заклинания-источника (для иконки). */
  sourceKey?: string;
  /** id эффекта, наложившего состояние (снимается вместе с ним). */
  effectId?: string;
}

export type ModifierTarget =
  | 'attack'
  | 'damage'
  | 'ac'
  | 'save'
  | 'check'
  | 'speed'
  | 'initiative'
  | 'maxHp'
  | 'spellDc'
  | 'spellAttack'
  | 'extraActions'
  | 'extraBonusActions';

export type ModifierMode =
  | 'add'
  | 'multiply'
  | 'set'
  | 'advantage'
  | 'disadvantage'
  | 'resistance'
  | 'immunity'
  | 'vulnerability';

export interface ModifierFilter {
  attackType?: 'melee' | 'ranged';
  ability?: AbilityKey;
  skill?: string;
  damageType?: string;
  rangeType?: AttackRangeType;
  /** Модификатор действует только против конкретного токена (Hex/Hunter's Mark). */
  targetId?: string;
}

export interface Modifier {
  id: string;
  target: ModifierTarget;
  mode: ModifierMode;
  /** Число, формула ('13+dex') или кость ('1d4'); нужно для add/set/multiply. */
  value?: number | string;
  filter?: ModifierFilter;
}

export type EffectDuration =
  | { type: 'rounds'; rounds: number }
  | { type: 'untilSave'; ability: AbilityKey; dc: number; timing: 'start' | 'end' }
  | { type: 'endOfTurn'; of: 'source' | 'target' }
  | { type: 'concentration' }
  | { type: 'permanent' };

export interface EffectInstance {
  id: string;
  name: string;
  /** Ключ источника (заклинание/способность). */
  sourceKey?: string;
  /** id существа-источника. */
  sourceId?: string;
  concentration?: boolean;
  duration: EffectDuration;
  modifiers: Modifier[];
  /** Ключи накладываемых состояний. */
  conditions?: ConditionKey[];
}
