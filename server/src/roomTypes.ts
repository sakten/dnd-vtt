import type { CharacterSheet, ChatMessage, LibraryItem, Player, PlayerResources, Scene } from 'shared';

export interface RoomPlayer extends Player {
  socketId: string | null;
}

export interface Room {
  code: string;
  name: string;
  scene: Scene;
  library: LibraryItem[];
  sheets: Record<string, CharacterSheet>;
  chat: ChatMessage[];
  players: RoomPlayer[];
  nextZ: number;
  resources: Record<string, PlayerResources>;
  controllers: Record<string, string>;
}

/**
 * Формат на диске. Совпадает с Room, кроме рантайм-only полей игроков
 * (socketId/isConnected) и легаси-опциональности (name/resources/controllers).
 * Выводится из Room, чтобы новое поле не забывалось в одном из шейпов.
 */
export type PersistedRoom = Omit<Room, 'name' | 'players' | 'resources' | 'controllers'> & {
  name?: string;
  players: Pick<Player, 'id' | 'name' | 'role'>[];
  resources?: Record<string, PlayerResources>;
  controllers?: Record<string, string>;
};

/** Снимок рантайм-комнаты для записи на диск. */
export function toPersistedRoom(room: Room): PersistedRoom {
  return {
    code: room.code,
    name: room.name,
    scene: room.scene,
    library: room.library,
    sheets: room.sheets,
    chat: room.chat,
    players: room.players.map((p) => ({ id: p.id, name: p.name, role: p.role })),
    nextZ: room.nextZ,
    resources: room.resources,
    controllers: room.controllers,
  };
}
