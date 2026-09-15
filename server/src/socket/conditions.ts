import { conditionName } from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { pushSaveMessage } from './effects';
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

  const conditions = ctx.manager.tickConditions(room, token, phase);
  for (const save of conditions.saves) {
    pushSaveMessage(ctx, room, `${save.name} · ${token.name}`, save.roll, save.success);
  }
  for (const name of conditions.removed) {
    ctx.systemMessage(room, `${token.name}: состояние «${name}» окончено`);
  }

  const effects = ctx.manager.tickEffects(room, token, phase);
  for (const save of effects.saves) {
    pushSaveMessage(ctx, room, `${save.name} · ${token.name}`, save.roll, save.success);
  }
  for (const name of effects.removed) {
    ctx.systemMessage(room, `${token.name}: эффект «${name}» окончен`);
  }
  for (const esc of effects.escalated) {
    ctx.systemMessage(room, `${token.name}: «${esc.name}» — ${conditionName(esc.condition)}`);
  }

  // Зоны: аура, вход/выход, startOfTurn/endOfTurn.
  tickZones(ctx, room, mapId, token, phase);

  if (conditions.changed || effects.changed) ctx.emitToken(room, 'token:update', mapId, token);
}
