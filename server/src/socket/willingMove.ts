import { gridOfMap, rollDice, type Token } from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { applyDamage } from './damage';

/**
 * Триггер эффектов «добровольное перемещение» (Booming Blade): проход на ≥ `feet`
 * за один шаг/перетаскивание — урон и снятие эффекта. Толчки (`applyForcedMovement`)
 * и телепорты сюда не попадают — только `token:move`/`token:step` самих игроков.
 */
export function handleWillingMoveEffects(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  token: Token,
  fromX: number,
  fromY: number
): void {
  const moved = Math.hypot(token.x - fromX, token.y - fromY);
  if (!moved) return;
  const map = ctx.manager.findMap(room, mapId);
  if (!map) return;
  const size = gridOfMap(map, room.scene.grid).size;
  const movedCells = Math.round(moved / size);
  const triggered = token.effects.filter(
    (e) => e.onWillingMove && movedCells >= Math.max(1, Math.round(e.onWillingMove.feet / 5))
  );
  if (!triggered.length) return;
  for (const effect of triggered) {
    const spec = effect.onWillingMove;
    if (!spec) continue;
    const roll = rollDice(`${spec.dice}${spec.damageType}`);
    const source = effect.sourceId ? map.tokens.find((t) => t.id === effect.sourceId) : undefined;
    applyDamage(ctx, {
      target: token,
      mapId,
      amount: roll.total,
      damageType: spec.damageType,
      ...(roll.damageParts.length ? { parts: roll.damageParts } : {}),
      roll,
      author: source?.name ?? effect.name,
      params: { subject: `${effect.name} · ${token.name}`, damageType: spec.damageType },
    });
    ctx.manager.removeEffect(room, token, effect.id);
    ctx.emitToken(room, 'token:update', mapId, token);
  }
}
