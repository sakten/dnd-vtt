import { cellCenter, crossesWalls, gridOfMap, pointCell, tokenCells, type ErrorPayload, type Token } from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { handleMovementZones } from './zones';

/**
 * Проверка точки телепорта (Misty Step, Scatter): не дальше `feet` от `from`
 * (по умолчанию — сам перемещаемый), внутри карты, свободна подошвой и видна.
 */
export function teleportIssue(
  room: Room,
  mapId: string,
  mover: Token,
  origin: { x: number; y: number },
  feet: number,
  from?: Token
): ErrorPayload | undefined {
  const map = room.scene.maps.find((m) => m.id === mapId);
  if (!map) return { code: 'teleportNoSpace' };
  const grid = gridOfMap(map, room.scene.grid);
  const anchor = from ?? mover;
  const distance = (Math.hypot(origin.x - anchor.x, origin.y - anchor.y) / grid.size) * 5;
  if (distance > feet) return { code: 'outOfRange', params: { feet: Math.round(distance) } };
  if (map.width > 0 && (origin.x < 0 || origin.y < 0 || origin.x > map.width || origin.y > map.height)) {
    return { code: 'teleportNoSpace' };
  }
  if (crossesWalls(anchor, origin, map.walls, 'sight')) return { code: 'noClearPath' };
  // Точка назначения должна быть ровно свободна (без «подбора» соседней клетки).
  const cell = pointCell(origin, grid);
  const dest = cellCenter(cell.cx, cell.cy, grid);
  const occupied = new Set(
    map.tokens.filter((t) => t.id !== mover.id).flatMap((t) => tokenCells(t, map.grid))
  );
  const destCells = tokenCells({ x: dest.x, y: dest.y, w: mover.w, h: mover.h }, map.grid);
  if (destCells.some((key) => occupied.has(key))) return { code: 'teleportNoSpace' };
  return undefined;
}

/** Перемещает кастера в точку (центр клетки); вход в зоны учитывается, атак по возможности нет. */
export function executeTeleport(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  caster: Token,
  origin: { x: number; y: number }
): void {
  const map = ctx.manager.findMap(room, mapId);
  if (!map) return;
  const grid = gridOfMap(map, room.scene.grid);
  const cell = pointCell(origin, grid);
  const dest = cellCenter(cell.cx, cell.cy, grid);
  caster.x = dest.x;
  caster.y = dest.y;
  handleMovementZones(ctx, room, mapId);
  ctx.emitToken(room, 'token:update', mapId, caster);
}
