import type { ConnCtx } from './context';

/** Коды серверных ошибок; текст рендерит клиент по коду (i18n). */
export type ErrorCode =
  | 'reactionPending'
  | 'reactionSpent'
  | 'incapacitated'
  | 'spellsBlocked'
  | 'immobile'
  | 'notYourTurn'
  | 'actionSpent'
  | 'noActions'
  | 'noWeapon'
  | 'legendaryOnly'
  | 'legendarySlotOnly'
  | 'noLegendary'
  | 'recharging'
  | 'spellNotPrepared'
  | 'spellNotInStatblock'
  | 'familiarNoAttack'
  | 'summonNoPact'
  | 'summonNoForm'
  | 'summonNoSpace'
  | 'shapeNoAbility'
  | 'shapeNoForm'
  | 'shapeNoUse'
  | 'shapeNoSpace'
  | 'shapePolymorph'
  | 'shapeCrTooHigh'
  | 'shapeInForm'
  | 'shapeNoRevert'
  | 'spellSelfOnly'
  | 'noAreaPoint'
  | 'noClearPath'
  | 'outOfRange'
  | 'noSlot'
  | 'noResource'
  | 'checkFailed'
  | 'badRoll'
  | 'doorLockedInCombat'
  | 'attackOutOfReach'
  | 'attackTooFar'
  | 'attackOutOfRange'
  | 'spellNoTarget'
  | 'spellNoAttack'
  | 'spellNoDc'
  | 'rollEmpty'
  | 'rollNoDice'
  | 'rollSyntax'
  | 'rollDiceCount'
  | 'rollDieSides'
  | 'rollKeepRange'
  | 'wrongAdminToken'
  | 'passwordRequired'
  | 'badRequest'
  | 'roomNotFound'
  | 'emptyName'
  | 'noRoom'
  | 'invalidCharacter'
  | 'tokenNotFound'
  | 'playerTokenOnly'
  | 'tokenHasOwner'
  | 'characterTaken';

export interface ErrorParams {
  /** Футы для `outOfRange`. */
  feet?: number;
  /** Ключ ресурса для `noResource`. */
  key?: string;
  name?: string;
  /** Предел CR для `shapeCrTooHigh`. */
  max?: number;
}

/** Отправляет ошибку игроку в чат (единая точка для хендлеров). */
export function fail(ctx: ConnCtx, code: ErrorCode, params?: ErrorParams) {
  const clean: Record<string, string | number> = {};
  if (params?.feet !== undefined) clean.feet = params.feet;
  if (params?.key !== undefined) clean.key = params.key;
  if (params?.name !== undefined) clean.name = params.name;
  if (params?.max !== undefined) clean.max = params.max;
  ctx.socket.emit('chat:error', Object.keys(clean).length ? { code, params: clean } : { code });
}
