import type { GridSettings, MapInfo, Token } from 'shared';
import type { GameState } from './types';

/** Активная карта комнаты (по viewMapId). */
export function activeMapOf(s: GameState): MapInfo | null {
  return s.scene.maps.find((m) => m.id === s.viewMapId) ?? null;
}

/** Сетка активной карты (без карты — дефолт комнаты). */
export function activeGridOf(s: GameState): GridSettings {
  return activeMapOf(s)?.grid ?? s.scene.grid;
}

/** Сетка карты по id (без карты — дефолт комнаты). */
export function gridOfMap(s: GameState, mapId: string | null | undefined): GridSettings {
  return s.scene.maps.find((m) => m.id === mapId)?.grid ?? s.scene.grid;
}

/** Токен по id на карте. */
export function tokenById(map: MapInfo | null | undefined, id: string | null): Token | null {
  if (!map || !id) return null;
  return map.tokens.find((t) => t.id === id) ?? null;
}

/** Токен персонажа игрока (по libraryItemId) на карте. */
export function characterTokenOf(map: MapInfo | null | undefined, charId: string | null): Token | null {
  if (!map || !charId) return null;
  return map.tokens.find((t) => t.libraryItemId === charId) ?? null;
}
