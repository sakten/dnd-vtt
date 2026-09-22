import { cellCenter, crossesWalls, gridOfMap, pointCell, tokenCells, type ErrorPayload, type Token } from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { handleMovementZones } from './zones';

/**
 * Проверка точки телепорта (Misty Step): не дальше `feet`, внутри карты,
 * свободна подошвой кастера и видна ему (стены/закрытые двери блокируют).
 */
export function teleportIssue(
  room: Room,
  mapId: string,
  caster: Token,
  origin: { x: number; y: number },
  feet: number
): ErrorPayload | undefined {
  const map = room.scene.maps.find((m) => m.id === mapId);
  if (!map) return { code: 'teleportNoSpace' };
  const grid = gridOfMap(map, room.scene.grid);
  const distance = (Math.hypot(origin.x - caster.x, origin.y - caster.y) / grid.size) * 5;
  if (distance > feet) return { code: 'outOfRange', params: { feet: Math.round(distance) } };
  if (map.width > 0 && (origin.x < 0 || origin.y < 0 || origin.x > map.width || origin.y > map.height)) {
    return { code: 'teleportNoSpace' };
  }
  if (crossesWalls(caster, origin, map.walls, 'sight')) return { code: 'noClearPath' };
  // Точка назначения должна быть ровно свободна (без «подбора» соседней клетки).
  const cell = pointCell(origin, grid);
  const dest = cellCenter(cell.cx, cell.cy, grid);
  const occupied = new Set(
    map.tokens.filter((t) => t.id !== caster.id).flatMap((t) => tokenCells(t, map.grid))
  );
  const destCells = tokenCells({ x: dest.x, y: dest.y, w: caster.w, h: caster.h }, map.grid);
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
