import { randomUUID } from 'node:crypto';
import type { DiceRollResult } from 'shared';
import type { ConnCtx } from './context';
import { playerScope } from './guards';

/** Личная настройка: шанс 0–100 показать анимацию d20 при своих атаках и проверках. */
export function rollAnimChanceOf(ctx: ConnCtx, playerId: string | null): number {
  if (!playerId) return 0;
  const room = ctx.getRoom();
  const player = room?.players.find((p) => p.id === playerId);
  const value = player?.rollAnimChance ?? 0;
  return Math.max(0, Math.min(100, value));
}

/**
 * Показ анимации уже сделанного сервером броска: с заданным шансом отправляем
 * результат лично бросающему. Ничего не ждёт — игра идёт как обычно.
 */
export function maybeRollAnim(ctx: ConnCtx, roll: DiceRollResult, playerId?: string | null): void {
  const id = playerId ?? ctx.playerId;
  if (!id) return;
  const room = ctx.getRoom();
  if (!room) return;
  const chance = rollAnimChanceOf(ctx, id);
  if (chance <= 0) return;
  if (chance < 100 && Math.random() * 100 >= chance) return;
  ctx.emitTo(room, id, 'roll:anim', { id: randomUUID(), roll });
}

export function registerRollAnimHandlers(ctx: ConnCtx) {
  ctx.on('player:rollAnimChance', ({ value }) => {
    const scope = playerScope(ctx);
    if (!scope || typeof value !== 'number' || !Number.isFinite(value)) return;
    const player = scope.room.players.find((p) => p.id === ctx.playerId);
    if (!player) return;
    player.rollAnimChance = Math.max(0, Math.min(100, Math.round(value)));
    ctx.notifyPlayers(scope.room);
  });
}
