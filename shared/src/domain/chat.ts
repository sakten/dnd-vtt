import type { DiceRollResult } from '../dice';
import type { DamageDefenseType } from './damage';

export interface TextMessage {
  id: string;
  kind: 'text';
  author: string;
  text: string;
  ts: number;
}

export type RollKind = 'attack' | 'damage' | 'heal' | 'save' | 'check' | 'death' | 'plain';

export interface RollLabelParams {
  /** Название атаки/спасброска/проверки (для атак — с префиксом источника). */
  subject?: string;
  distanceFeet?: number;
  hit?: 'hit' | 'miss';
  disadvantage?: 'adjacent' | 'long';
  /** Спасбросок от смерти. */
  outcome?: 'critSuccess' | 'critFail' | 'success' | 'fail';
  successes?: number;
  failures?: number;
  /** Исход обычного спасброска. */
  saveOutcome?: 'success' | 'fail';
  /** Проверка: сложность (для отображения). */
  dc?: number;
  /** Исход проверки. */
  checkOutcome?: 'success' | 'fail';
  /** Тип урона (ключ) для отображения. */
  damageType?: string;
  /** Учёт защиты цели (сопротивление/иммунитет/уязвимость). */
  damageNote?: DamageDefenseType;
  /** Штраф к броску (например, истощение), для отображения. */
  penalty?: number;
}

export interface RollMessage {
  id: string;
  kind: 'roll';
  author: string;
  roll: DiceRollResult;
  /** Готовый текст метки; legacy/fallback, генерируется из `rollKind`+`labelParams`. */
  label?: string;
  rollKind?: RollKind;
  labelParams?: RollLabelParams;
  crit?: boolean;
  ts: number;
}

export type ChatMessage = TextMessage | RollMessage;
