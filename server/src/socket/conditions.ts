import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { pushSaveMessage } from './messages';
import { tickEffectTriggers } from './effects';
import { removeTokenCompletely } from './tokenRemove';
import { tickZones } from './zones';

/**
 * Тик активного бойца в начале/конце его хода: состояния (спасброски, раунды)
 * и эффекты (спасброски, раунды, «до конца хода»). Вызывается из combat:*.
 */
export function tickActiveTurn(ctx: ConnCtx, room: Room, mapId: string, phase: 'start' | 'end') {
  const combat = ctx.manager.combatOf(room, mapId);
  const entry = combat?.active && combat.currentIndex >= 0 ? combat.entries[combat.currentIndex] : undefined;
  if (!entry?.tokenId) return;
  const token = ctx.manager.findToken(room, mapId, entry.tokenId);
  if (!token) return;

  // Триггеры эффектов (Heroism, смайты) — до спасбросков untilSave: урон, затем спас.
  if (phase === 'start') tickEffectTriggers(ctx, room, mapId, token);

  const conditions = ctx.manager.tickConditions(room, token, phase);
  for (const save of conditions.saves) {
    pushSaveMessage(ctx, room, { subject: `${save.name} · ${token.name}`, roll: save.roll, success: save.success });
  }
  for (const removed of conditions.removed) {
    ctx.systemMessage(room, {
      code: 'conditions.ended',
      params: { name: token.name, condition: removed.key, label: removed.name },
    });
  }

  const effects = ctx.manager.tickEffects(room, token, phase);
  for (const save of effects.saves) {
    pushSaveMessage(ctx, room, { subject: `${save.name} · ${token.name}`, roll: save.roll, success: save.success });
  }
  for (const name of effects.removed) {
    ctx.systemMessage(room, { code: 'conditions.effectEnded', params: { name: token.name, effect: name } });
  }
  for (const esc of effects.escalated) {
    ctx.systemMessage(room, {
      code: 'conditions.escalated',
      params: { name: token.name, effect: esc.name, condition: esc.condition },
    });
  }
  // Banishment: срок вышел, экстрапланетное существо не возвращается — токен удаляется.
  const vanishedIds = new Set(effects.vanished.map((v) => v.token.id));
  for (const gone of effects.vanished) {
    ctx.systemMessage(room, { code: 'automation.banishGone', params: { name: gone.token.name } });
    removeTokenCompletely(ctx, room, gone.mapId, gone.token);
  }
  // Целей у каста не осталось — концентрация кастера снята (якоря/чипы обновились).
  for (const changed of effects.pruned) {
    if (vanishedIds.has(changed.token.id)) continue;
    ctx.emitToken(room, 'token:update', changed.mapId, changed.token);
  }
  if (effects.pruned.length) ctx.syncCombat(room, mapId);

  // Активным токеном был изгнанный навсегда — дальше тикать нечего (токена нет).
  if (vanishedIds.has(token.id)) return;

  // Зоны: аура, вход/выход, startOfTurn/endOfTurn.
  tickZones(ctx, room, mapId, token, phase);

  if (conditions.changed || effects.changed) ctx.emitToken(room, 'token:update', mapId, token);
}
