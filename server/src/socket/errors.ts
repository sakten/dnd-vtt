import type { ConnCtx } from './context';

/** Коды серверных ошибок; текст рендерится здесь (задел под i18n, единая точка). */
export type ErrorCode =
  | 'reactionPending'
  | 'reactionSpent'
  | 'incapacitated'
  | 'immobile'
  | 'notYourTurn'
  | 'actionSpent'
  | 'noActions'
  | 'noWeapon'
  | 'spellNotPrepared'
  | 'spellNotInStatblock'
  | 'noAreaPoint'
  | 'outOfRange'
  | 'noSlot'
  | 'noResource'
  | 'checkFailed'
  | 'badRoll';

export interface ErrorParams {
  /** Футы для `outOfRange`. */
  feet?: number;
  /** Название способности для `noResource`. */
  name?: string;
}

const ERROR_TEXT: Record<ErrorCode, string> = {
  reactionPending: 'Ожидание реакции',
  reactionSpent: 'Реакция уже потрачена',
  incapacitated: 'Существо недееспособно',
  immobile: 'Существо не может двигаться (состояние)',
  notYourTurn: 'Сейчас не ваш ход',
  actionSpent: 'Действие уже потрачено',
  noActions: 'Недостаточно действий',
  noWeapon: 'Не выбрано оружие',
  spellNotPrepared: 'Заклинание не выбрано в листе',
  spellNotInStatblock: 'Заклинание не выбрано в статблоке',
  noAreaPoint: 'Не выбрана точка области',
  outOfRange: 'Вне дистанции',
  noSlot: 'Нет ячейки нужного круга',
  noResource: 'Недостаточно ресурса',
  checkFailed: 'Не удалось выполнить проверку',
  badRoll: 'Не удалось распознать бросок',
};

/** Текст ошибки по коду и параметрам. */
export function errorText(code: ErrorCode, params: ErrorParams = {}): string {
  if (code === 'outOfRange') return `${ERROR_TEXT[code]}: ${Math.round(params.feet ?? 0)} фт`;
  if (code === 'noResource') return `${ERROR_TEXT[code]}: ${params.name ?? ''}`.trim();
  return ERROR_TEXT[code];
}

/** Отправляет ошибку игроку в чат (единая точка для хендлеров). */
export function fail(ctx: ConnCtx, code: ErrorCode, params?: ErrorParams) {
  ctx.socket.emit('chat:error', errorText(code, params));
}
