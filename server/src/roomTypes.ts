import type { CharacterSheet, Player, PlayerResources, RoomState } from 'shared';

export interface RoomPlayer extends Player {
  socketId: string | null;
  /** Локальный id браузера, которым входили в этот аккаунт (для перехвата своей же сессии). */
  clientId?: string | null;
}

/**
 * Рантайм-комната: базовый контракт `RoomState` + серверные поля.
 * Поля `RoomState` не перечисляются повторно — новое поле состояния
 * автоматически появляется в комнате, наружу маппится только `players`.
 */
export interface Room extends Omit<RoomState, 'players'> {
  players: RoomPlayer[];
  sheets: Record<string, CharacterSheet>;
  nextZ: number;
  resources: Record<string, PlayerResources>;
}

/**
 * Формат на диске. Совпадает с Room, кроме рантайм-only полей игроков
 * (socketId/isConnected) и легаси-опциональности (name/resources/controllers).
 * Выводится из Room, чтобы новое поле не забывалось в одном из шейпов.
 */
export type PersistedRoom = Omit<Room, 'name' | 'players' | 'resources' | 'controllers'> & {
  name?: string;
  players: Pick<Player, 'id' | 'name' | 'role' | 'rollAnimChance'>[];
  resources?: Record<string, PlayerResources>;
  controllers?: Record<string, string>;
};

/** Снимок рантайм-комнаты для записи на диск: глубокий клон, не зависящий от мутаций. */
export function toPersistedRoom(room: Room): PersistedRoom {
  return structuredClone({
    code: room.code,
    name: room.name,
    scene: room.scene,
    library: room.library,
    sheets: room.sheets,
    chat: room.chat,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      rollAnimChance: p.rollAnimChance ?? 0,
    })),
    nextZ: room.nextZ,
    resources: room.resources,
    controllers: room.controllers,
    testMode: room.testMode,
    optionalRules: room.optionalRules,
  });
}
