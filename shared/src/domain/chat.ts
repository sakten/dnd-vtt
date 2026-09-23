import type { DiceRollResult } from '../dice';
import type { DamageDefenseType } from './damage';

/** Структурная системная метка: код + параметры; текст рендерит клиент (i18n). */
export interface SystemText {
  code: string;
  params?: Record<string, string | number>;
}

export interface TextMessage {
  id: string;
  kind: 'text';
  author: string;
  text: string;
  system?: SystemText;
  ts: number;
}

export type RollKind = 'attack' | 'damage' | 'heal' | 'save' | 'check' | 'death' | 'plain';

/** Структурная ошибка сервера: код + параметры; текст рендерит клиент (i18n). */
export interface ErrorPayload {
  code: string;
  params?: Record<string, string | number>;
}

/** Источник преимущества/помехи броска атаки (подсказка и метка броска). */
export interface AttackSource {
  side: 'advantage' | 'disadvantage';
  /** Категория причины: выбор игрока, состояние, эффект, дистанция, невидимость, свойство оружия. */
  kind: 'explicit' | 'condition' | 'effect' | 'range' | 'unseen' | 'weapon';
  /** Ключ причины: состояние (`prone`), `adjacent`/`long`, `target`/`attacker`, `heavy`. */
  key?: string;
  /** Имя эффекта-источника (для kind `effect`). */
  name?: string;
  /** Ключ заклинания-источника (локализация имени эффекта). */
  sourceKey?: string;
}

export interface RollLabelParams {
  /** Название атаки/спасброска/проверки (для атак — с префиксом источника). */
  subject?: string;
  distanceFeet?: number;
  hit?: 'hit' | 'miss';
  disadvantage?: 'adjacent' | 'long';
  /** Источники преимуществ/помех (колонки «+»/«−» в предпросмотре и метке броска). */
  sources?: AttackSource[];
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
