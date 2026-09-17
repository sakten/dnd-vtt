import { gridDistanceFeet, type CharacterSheet, type MapInfo, type Token } from 'shared';
import type { Room } from '../roomTypes';

/** Все upload-ссылки, на которые ссылается состояние комнаты (карты, токены, библиотека). */
export function roomUploadUrls(room: Room): string[] {
  return [
    ...room.library.map((i) => i.imageUrl),
    ...room.scene.maps.flatMap((m) => [m.url, ...m.tokens.map((t) => t.imageUrl)]),
  ];
}

/** id игрока-контролёра токена (персонажа/призыва). */
export function controllerIdOfToken(room: Room, token: Token): string | undefined {
  return Object.keys(room.controllers).find((pid) => room.controllers[pid] === token.libraryItemId);
}

/** Контролёр токена и его лист персонажа (если есть). */
export function sheetOfToken(room: Room, token: Token): { controllerId?: string; sheet?: CharacterSheet } {
  const controllerId = controllerIdOfToken(room, token);
  return { controllerId, sheet: controllerId ? room.sheets[controllerId] : undefined };
}

/** Размер клетки карты в футах (дефолт 50). */
export function gridSizeOfMap(map: MapInfo): number {
  return map.grid.size || 50;
}

/** Размер клетки карты, на которой лежит токен (дефолт 50). */
export function gridSizeOfToken(room: Room, token: Token): number {
  const map = room.scene.maps.find((m) => m.tokens.some((t) => t.id === token.id));
  return map ? gridSizeOfMap(map) : 50;
}

/** Токены в пределах N футов друг от друга по сетке их карты. */
export function withinFeet(room: Room, a: Token, b: Token, feet: number): boolean {
  return gridDistanceFeet(a, b, gridSizeOfToken(room, a)) <= feet;
}

/** id игрока-контролёра предмета библиотеки. */
export function controllerIdOfItem(room: Room, libraryItemId: string): string | undefined {
  return Object.keys(room.controllers).find((pid) => room.controllers[pid] === libraryItemId);
}

/** Есть ли у игрока ресурс в нужном количестве. */
export function hasResourceFor(room: Room, playerId: string, key: string, amount = 1): boolean {
  const item = room.resources[playerId]?.resources.find((r) => r.key === key);
  return !!item && item.current >= amount;
}

/** Токен по id (линейный поиск по картам). */
export function findTokenById(room: Room, id: string): Token | null {
  for (const map of room.scene.maps) {
    const token = map.tokens.find((t) => t.id === id);
    if (token) return token;
  }
  return null;
}

export function tokenById(room: Room, id: string): Token | null {
  return findTokenById(room, id);
}

/** Токен и id карты, на которой он лежит. */
export function locateToken(room: Room, id: string): { mapId: string; token: Token } | null {
  for (const map of room.scene.maps) {
    const token = map.tokens.find((t) => t.id === id);
    if (token) return { mapId: map.id, token };
  }
  return null;
}
