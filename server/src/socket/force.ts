import { crossesWalls, sizeAtMost, type Token } from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { gridSizeOfMap } from '../rooms';
import { syncSurrounded } from './surrounded';

/**
 * Вынужденное перемещение (push/pull): шаги по клетке строго от/к источнику,
 * сплошная стена или чужой токен на пути останавливают движение.
 * `maxSize` ограничивает применимость (Repelling Blast — Large и меньше; Huge не двигается).
 */
export function applyForcedMovement(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  source: Token | null,
  target: Token,
  force: { kind: 'push' | 'pull'; feet: number; maxSize?: 'normal' | 'large' | 'huge' }
): void {
  if (!source || source.id === target.id) return;
  if (force.maxSize && !sizeAtMost(target.cells, force.maxSize)) return;
  const map = ctx.manager.findMap(room, mapId);
  if (!map) return;
  const size = gridSizeOfMap(map);
  const steps = Math.max(1, Math.round(force.feet / 5));
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const len = Math.hypot(dx, dy);
  if (!len) return;
  const sign = force.kind === 'pull' ? -1 : 1;
  const stepX = (dx / len) * size * sign;
  const stepY = (dy / len) * size * sign;
  let moved = 0;
  for (let i = 0; i < steps; i++) {
    const nx = target.x + stepX;
    const ny = target.y + stepY;
    if (nx < 0 || ny < 0 || nx > map.width || ny > map.height) break;
    if (crossesWalls({ x: target.x, y: target.y }, { x: nx, y: ny }, map.walls, 'move')) break;
    const clash = map.tokens.some(
      (t) => t.id !== target.id && Math.hypot(t.x - nx, t.y - ny) < (size * (t.cells + target.cells)) / 2
    );
    if (clash) break;
    target.x = nx;
    target.y = ny;
    moved += 1;
  }
  if (!moved) return;
  ctx.emitToken(room, 'token:update', mapId, target);
  syncSurrounded(ctx, room, mapId);
}
