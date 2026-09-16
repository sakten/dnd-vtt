import { randomUUID } from 'node:crypto';
import {
  DEFAULT_SPEED,
  defaultFog,
  emptyCombatState,
  normalizeTokenFields,
  normalizeTokenFieldsPatch,
  statNumber,
  type ChatMessage,
  type LibraryItem,
  type MapInfo,
  type Token,
  type TokenFields,
} from 'shared';
import type { Room } from '../roomTypes';
import { controllerIdOfItem } from './helpers';

/** Зависимости домена сущностей: сохранение комнаты. */
export interface TokenDeps {
  saveSoon(room: Room): void;
}

export function findMap(room: Room, id: string): MapInfo | null {
  return room.scene.maps.find((m) => m.id === id) ?? null;
}

export function findToken(room: Room, mapId: string, id: string): Token | null {
  return findMap(room, mapId)?.tokens.find((t) => t.id === id) ?? null;
}

export function addMap(
  m: TokenDeps,
  room: Room,
  input: { name: string; url: string; width: number; height: number }
): MapInfo {
  const map: MapInfo = {
    ...input,
    id: randomUUID(),
    tokens: [],
    zones: [],    walls: [],
    vision: { los: false, darkness: false },
    fog: defaultFog(room.scene.grid),
    combat: emptyCombatState(),
  };
  room.scene.maps.push(map);
  room.scene.activeMapId = map.id;
  m.saveSoon(room);
  return map;
}

export function removeMap(m: TokenDeps, room: Room, id: string) {
  room.scene.maps = room.scene.maps.filter((mm) => mm.id !== id);
  if (room.scene.activeMapId === id) room.scene.activeMapId = room.scene.maps[0]?.id ?? null;
  m.saveSoon(room);
}

export function renameMap(m: TokenDeps, room: Room, id: string, name: string) {
  const map = findMap(room, id);
  if (!map) return;
  map.name = name;
  m.saveSoon(room);
}

export function addLibraryItem(m: TokenDeps, room: Room, input: TokenFields): LibraryItem {
  const item: LibraryItem = { ...normalizeTokenFields(input, 60), id: randomUUID() };
  room.library.push(item);
  m.saveSoon(room);
  return item;
}

export function updateLibraryItem(m: TokenDeps, room: Room, id: string, patch: Partial<LibraryItem>) {
  const item = room.library.find((i) => i.id === id);
  if (!item) return;
  Object.assign(item, normalizeTokenFieldsPatch(patch, item, { includeDm: true }));
  m.saveSoon(room);
}

export function removeLibraryItem(m: TokenDeps, room: Room, id: string) {
  room.library = room.library.filter((i) => i.id !== id);
  m.saveSoon(room);
}

export function addToken(
  m: TokenDeps,
  room: Room,
  mapId: string,
  item: LibraryItem,
  x: number,
  y: number,
  ownerId: string
): Token | null {
  const map = findMap(room, mapId);
  if (!map) return null;
  const fields = normalizeTokenFields(item);
  const controllerId = controllerIdOfItem(room, item.id);
  const controllerSheet = controllerId ? room.sheets[controllerId] : undefined;
  const token: Token = {
    ...fields,
    id: randomUUID(),
    libraryItemId: item.id,
    hpCurrent: statNumber(fields.hpMax),
    x,
    y,
    w: fields.cells * room.scene.grid.size,
    h: fields.cells * room.scene.grid.size,
    scale: 1,
    rotation: 0,
    z: ++room.nextZ,
    visible: true,
    ownerId,
    lockedBy: null,
    hpTemp: 0,
    faction: fields.isPlayerToken ? 'ally' : 'neutral',
    speed: controllerSheet?.speed ?? DEFAULT_SPEED,
    senses: controllerSheet?.senses ?? [],
    conditions: [],
    effects: [],
  };
  map.tokens.push(token);
  m.saveSoon(room);
  return token;
}

export function characterName(room: Room, mapId: string, playerId: string): string {
  const libId = room.controllers[playerId];
  if (!libId) return '';
  const placed = findMap(room, mapId)?.tokens.find((t) => t.libraryItemId === libId);
  if (placed) return placed.name;
  return room.library.find((i) => i.id === libId)?.name ?? '';
}

export function controlsToken(room: Room, mapId: string, playerId: string, token: Token): boolean {
  const libId = room.controllers[playerId];
  if (libId && token.libraryItemId === libId) return true;
  if (token.owner) {
    const name = characterName(room, mapId, playerId);
    if (name && token.owner === name) return true;
  }
  return false;
}

export function clearControllersForItem(m: TokenDeps, room: Room, libraryItemId: string): string[] {
  const cleared: string[] = [];
  for (const [pid, lid] of Object.entries(room.controllers)) {
    if (lid === libraryItemId) {
      delete room.controllers[pid];
      cleared.push(pid);
    }
  }
  if (cleared.length) m.saveSoon(room);
  return cleared;
}

export function removeToken(m: TokenDeps, room: Room, mapId: string, id: string) {
  const map = findMap(room, mapId);
  if (!map) return;
  map.tokens = map.tokens.filter((t) => t.id !== id);
  m.saveSoon(room);
}

export function clearLocks(room: Room, playerId: string) {
  for (const map of room.scene.maps) {
    for (const token of map.tokens) {
      if (token.lockedBy === playerId) token.lockedBy = null;
    }
  }
}

/** Обрезка и лимит истории чата комнаты. */
export function addMessage(m: TokenDeps, room: Room, message: ChatMessage) {
  room.chat.push(message);
  if (room.chat.length > 300) room.chat.splice(0, room.chat.length - 300);
  m.saveSoon(room);
}
