import { randomUUID } from 'node:crypto';
import { rollLabelText, type ChatMessage, type DiceRollResult, type Token } from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';

/** Сообщение-бросок спасброска в чат от имени системы. */
export function pushSaveMessage(
  ctx: ConnCtx,
  room: Room,
  subject: string,
  roll: DiceRollResult,
  success: boolean,
  author = 'Система'
) {
  const params = {
    subject,
    saveOutcome: (success ? 'success' : 'fail') as 'success' | 'fail',
  };
  const message: ChatMessage = {
    id: randomUUID(),
    kind: 'roll',
    author,
    roll,
    label: ctx.cleanLabel(rollLabelText('save', params)),
    rollKind: 'save',
    labelParams: params,
    ts: Date.now(),
  };
  ctx.manager.addMessage(room, message);
  ctx.broadcastAll('chat:message', message);
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
    ctx.systemMessage(room, `${token.name}: концентрация прервана (${result.names.join(', ')})`);
  }
}
