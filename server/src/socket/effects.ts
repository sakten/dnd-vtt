import type { DiceRollResult, Token } from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { pushSaveMessage as pushSaveRoll } from './messages';
import { removeConcSummonsOf, summonSourceIds } from './summons';
import { removeZonesOfSource } from './zones';

/** Сообщение-бросок спасброска в чат от имени системы (обёртка над `messages`). */
export function pushSaveMessage(
  ctx: ConnCtx,
  room: Room,
  subject: string,
  roll: DiceRollResult,
  success: boolean,
  author = 'Система'
) {
  return pushSaveRoll(ctx, room, { author, subject, roll, success });
}

/**
 * Проверка концентрации при получении урона (СЛ 10 или половина урона).
 * Провал — эффекты концентрации снимаются, в чат уходит бросок и системка.
 */
export function rollConcentrationOnDamage(ctx: ConnCtx, room: Room, token: Token, damage: number) {
  if (!Number.isFinite(damage) || damage <= 0) return;
  const result = ctx.manager.concentrationCheck(room, token, damage);
  if (!result) return;
  pushSaveMessage(ctx, room, `Концентрация: ${result.names.join(', ')}`, result.roll, result.success);
  if (!result.success) {
    for (const changed of result.changed) ctx.emitToken(room, 'token:update', changed.mapId, changed.token);
    removeZonesOfSource(ctx, room, token.id);
    removeConcSummonsOf(ctx, room, summonSourceIds(room, token));
    ctx.systemMessage(room, {
      code: 'concentration.broken',
      params: { name: token.name, effects: result.names.join(', ') },
    });
  }
}
