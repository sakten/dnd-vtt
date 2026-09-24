import type { Token } from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { removeSummonsOf, summonSourceIds } from './summons';
import { endShapesOf } from './forms';
import { removeZonesOfSource } from './zones';
import { syncSurrounded } from './surrounded';

/**
 * Полное удаление токена: эффекты и их концентрация, свои зоны/призывы/формы,
 * бой и рассылка `token:remove`. Общий путь для `token:remove` и для изгнанных
 * навсегда (Banishment: экстрапланетные по истечении срока).
 */
export function removeTokenCompletely(ctx: ConnCtx, room: Room, mapId: string, token: Token): void {
  // Эффекты снимаемого токена откатываются, его концентрация и зоны гаснут на всех картах.
  for (const effect of [...token.effects]) {
    if (!ctx.manager.removeEffect(room, token, effect.id)) continue;
    // У снятой цели могла быть последняя цель каста — концентрация кастера гаснет.
    if (effect.concentration && effect.sourceId && effect.sourceKey) {
      for (const c of ctx.manager.pruneConcentration(room, effect.sourceId, effect.sourceKey)) {
        ctx.emitToken(room, 'token:update', c.mapId, c.token);
      }
    }
  }
  for (const c of ctx.manager.clearConcentration(room, token.id)) ctx.emitToken(room, 'token:update', c.mapId, c.token);
  removeZonesOfSource(ctx, room, token.id);
  removeSummonsOf(ctx, room, summonSourceIds(room, token));
  endShapesOf(ctx, room, summonSourceIds(room, token));
  ctx.manager.removeToken(room, mapId, token.id);
  ctx.broadcastAll('token:remove', { mapId, id: token.id });
  syncSurrounded(ctx, room, mapId);
  if (ctx.manager.combatOf(room, mapId)?.active) {
    ctx.manager.removeTokenFromCombat(room, mapId, token.id);
    ctx.syncCombat(room, mapId);
  }
}
