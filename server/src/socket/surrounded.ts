import { gridOfMap, isSurrounded, SURROUNDED_NAME, SURROUNDED_SOURCE } from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';

/**
 * Авто-состояние «Окружён» (опциональное правило DM): пересчитывается при
 * движении/добавлении/удалении токенов и при включении правила. Снимает только
 * свои чипы (маркер `sourceKey`), ручные состояния не трогает.
 */
export function syncSurrounded(ctx: ConnCtx, room: Room, mapId?: string): void {
  if (!room.optionalRules.surrounded) return;
  const maps = mapId ? room.scene.maps.filter((m) => m.id === mapId) : room.scene.maps;
  for (const map of maps) {
    const grid = gridOfMap(map, room.scene.grid);
    const bounds = { width: map.width, height: map.height };
    for (const token of map.tokens) {
      const want = isSurrounded({ target: token, tokens: map.tokens, grid, walls: map.walls, bounds });
      const has = token.conditions.some((c) => c.sourceKey === SURROUNDED_SOURCE);
      if (want === has) continue;
      token.conditions = want
        ? [...token.conditions, { key: 'surrounded', name: SURROUNDED_NAME, sourceKey: SURROUNDED_SOURCE }]
        : token.conditions.filter((c) => c.sourceKey !== SURROUNDED_SOURCE);
      ctx.emitToken(room, 'token:update', map.id, token);
    }
  }
}

/** Снятие авто-состояний «Окружён» при выключении правила. */
export function clearSurrounded(ctx: ConnCtx, room: Room): void {
  for (const map of room.scene.maps) {
    for (const token of map.tokens) {
      if (!token.conditions.some((c) => c.sourceKey === SURROUNDED_SOURCE)) continue;
      token.conditions = token.conditions.filter((c) => c.sourceKey !== SURROUNDED_SOURCE);
      ctx.emitToken(room, 'token:update', map.id, token);
    }
  }
}
