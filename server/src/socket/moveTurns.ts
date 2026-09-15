import type { Token } from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';

/** Источник эффекта Мантии вдохновения: снимается после хода движения. */
const MANTLE_KEY = 'class:bard.glamour:mantleOfInspiration';

/**
 * Прерывание хода (Мантия вдохновения): получатели двигаются по очереди
 * в порядке инициативы, каждый — только движение, затем «Завершить ход».
 */
export function startMovementTurns(ctx: ConnCtx, room: Room, mapId: string, caster: Token, targets: Token[]): void {
  const combat = ctx.manager.combatOf(room, mapId);
  if (!combat?.active || combat.currentIndex < 0) return;
  const active = combat.entries[combat.currentIndex];
  if (!active) return;
  const ids = new Set(targets.map((t) => t.id));
  const queue = combat.entries
    .filter((e) => !!e.tokenId && ids.has(e.tokenId) && e.id !== active.id)
    .map((e) => e.id);
  if (!queue.length) return;
  combat.moveReturn = active.id;
  combat.moveQueue = queue;
  ctx.systemMessage(room, `${caster.name}: Мантия вдохновения — движение по очереди инициативы`);
  beginNextMovementTurn(ctx, room, mapId);
}

/** Завершение хода движения: следующий из очереди или возврат к прерванному ходу. */
export function finishMovementTurn(ctx: ConnCtx, room: Room, mapId: string): void {
  const combat = ctx.manager.combatOf(room, mapId);
  if (!combat) return;
  const active = combat.currentIndex >= 0 ? combat.entries[combat.currentIndex] : undefined;
  // Мантия израсходована: снимаем эффект с завершившего движение.
  if (active?.tokenId) {
    const token = ctx.manager.findToken(room, mapId, active.tokenId);
    if (token) {
      for (const effect of [...token.effects].filter((e) => e.sourceKey === MANTLE_KEY)) {
        ctx.manager.removeEffect(room, token, effect.id);
      }
      ctx.emitToken(room, 'token:update', mapId, token);
    }
  }
  if (beginNextMovementTurn(ctx, room, mapId)) return;
  const back = combat.moveReturn;
  combat.moveQueue = undefined;
  combat.moveReturn = null;
  if (back) ctx.manager.setTurnPointer(room, mapId, back);
}

function beginNextMovementTurn(ctx: ConnCtx, room: Room, mapId: string): boolean {
  const combat = ctx.manager.combatOf(room, mapId);
  if (!combat?.moveQueue?.length) return false;
  const next = combat.moveQueue.shift()!;
  ctx.manager.beginMovementTurn(room, mapId, next);
  const entry = combat.entries.find((e) => e.id === next);
  ctx.systemMessage(room, `Ход движения: ${entry?.name ?? '?'} — подвиньтесь и завершите ход`);
  return true;
}
