import { randomBytes, randomUUID } from 'node:crypto';
import type {
  CharacterSheet,
  ChatMessage,
  LibraryItem,
  MapInfo,
  Player,
  RoomState,
  Scene,
  Token,
} from 'shared';
import { loadPersistedRooms, removeRoomFile, saveRoomNow, saveRoomSoon, type PersistedRoom } from './store';

export interface RoomPlayer extends Player {
  socketId: string | null;
}

export interface Room {
  code: string;
  scene: Scene;
  library: LibraryItem[];
  sheets: Record<string, CharacterSheet>;
  chat: ChatMessage[];
  players: RoomPlayer[];
  nextZ: number;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class RoomManager {
  private rooms = new Map<string, Room>();

  async init() {
    const persisted = await loadPersistedRooms();
    for (const p of persisted) {
      const scene = p.scene as Scene;
      if (!Array.isArray(scene.maps)) {
        const legacy = scene as unknown as {
          map: { url: string; width: number; height: number } | null;
          tokens?: Token[];
        };
        const maps: MapInfo[] = legacy.map
          ? [
              {
                id: randomUUID(),
                name: 'Карта 1',
                url: legacy.map.url,
                width: legacy.map.width,
                height: legacy.map.height,
                tokens: legacy.tokens ?? [],
                fog: { size: scene.grid.size, offsetX: scene.grid.offsetX, offsetY: scene.grid.offsetY, hidden: [] },
              },
            ]
          : [];
        scene.maps = maps;
        scene.activeMapId = maps[0]?.id ?? null;
      }
      for (const map of scene.maps) {
        if (!Array.isArray(map.tokens)) map.tokens = [];
        if (!map.fog || typeof map.fog !== 'object') {
          map.fog = { size: scene.grid.size, offsetX: scene.grid.offsetX, offsetY: scene.grid.offsetY, hidden: [] };
        }
        if (!Array.isArray(map.fog.hidden)) map.fog.hidden = [];
        for (const token of map.tokens) {
          if (typeof token.cells !== 'number') token.cells = 1;
          if (typeof token.round !== 'boolean') token.round = false;
          if (typeof token.description !== 'string') token.description = '';
        }
      }
      for (const item of p.library ?? []) {
        if (typeof item.cells !== 'number') item.cells = 1;
        if (typeof item.round !== 'boolean') item.round = false;
        if (typeof item.description !== 'string') item.description = '';
      }
      this.rooms.set(p.code, {
        code: p.code,
        scene,
        library: Array.isArray(p.library) ? p.library : [],
        sheets: p.sheets && typeof p.sheets === 'object' ? p.sheets : {},
        chat: p.chat ?? [],
        players: p.players.map((pl) => ({ ...pl, isConnected: false, socketId: null })),
        nextZ: p.nextZ ?? 0,
      });
    }
  }

  has(code: string) {
    return this.rooms.has(code);
  }

  listRooms() {
    return [...this.rooms.values()].map((r) => ({
      code: r.code,
      players: r.players.length,
      maps: r.scene.maps.length,
    }));
  }

  deleteRoom(code: string): boolean {
    if (!this.rooms.has(code)) return false;
    this.rooms.delete(code);
    removeRoomFile(code);
    return true;
  }

  get(code: string) {
    return this.rooms.get(code);
  }

  create(dmName: string): Room {
    const code = this.generateCode();
    const room: Room = {
      code,
      scene: {
        maps: [],
        activeMapId: null,
        grid: { size: 50, color: '#ffffff', opacity: 0.35, visible: true, offsetX: 0, offsetY: 0, snap: true },
      },
      library: [],
      sheets: {},
      chat: [],
      players: [],
      nextZ: 0,
    };
    this.rooms.set(code, room);
    return room;
  }

  findMap(room: Room, id: string): MapInfo | null {
    return room.scene.maps.find((m) => m.id === id) ?? null;
  }

  private generateCode(): string {
    let code = '';
    do {
      const bytes = randomBytes(12);
      code = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
    } while (this.rooms.has(code));
    return code;
  }

  addMap(room: Room, input: { name: string; url: string; width: number; height: number }): MapInfo {
    const map: MapInfo = {
      ...input,
      id: randomUUID(),
      tokens: [],
      fog: { size: room.scene.grid.size, offsetX: room.scene.grid.offsetX, offsetY: room.scene.grid.offsetY, hidden: [] },
    };
    room.scene.maps.push(map);
    room.scene.activeMapId = map.id;
    this.saveSoon(room);
    return map;
  }

  removeMap(room: Room, id: string) {
    room.scene.maps = room.scene.maps.filter((m) => m.id !== id);
    if (room.scene.activeMapId === id) room.scene.activeMapId = room.scene.maps[0]?.id ?? null;
    this.saveSoon(room);
  }

  renameMap(room: Room, id: string, name: string) {
    const map = room.scene.maps.find((m) => m.id === id);
    if (!map) return;
    map.name = name;
    this.saveSoon(room);
  }

  addLibraryItem(
    room: Room,
    input: { name: string; url: string; cells: number; round: boolean; description: string }
  ): LibraryItem {
    const item: LibraryItem = {
      id: randomUUID(),
      name: input.name,
      url: input.url,
      cells: Math.min(4, Math.max(1, Math.round(input.cells ?? 1))),
      round: input.round ?? false,
      description: input.description ?? '',
    };
    room.library.push(item);
    this.saveSoon(room);
    return item;
  }

  updateLibraryItem(room: Room, id: string, patch: Partial<LibraryItem>) {
    const item = room.library.find((i) => i.id === id);
    if (!item) return;
    if (patch.name !== undefined) item.name = patch.name;
    if (patch.description !== undefined) item.description = patch.description;
    if (patch.round !== undefined) item.round = patch.round;
    if (patch.cells !== undefined) item.cells = Math.min(4, Math.max(1, Math.round(patch.cells)));
    this.saveSoon(room);
  }

  removeLibraryItem(room: Room, id: string) {
    room.library = room.library.filter((i) => i.id !== id);
    this.saveSoon(room);
  }

  addMessage(room: Room, message: ChatMessage) {
    room.chat.push(message);
    if (room.chat.length > 300) room.chat.splice(0, room.chat.length - 300);
    this.saveSoon(room);
  }

  addToken(
    room: Room,
    mapId: string,
    input: {
      name: string;
      imageUrl: string;
      x: number;
      y: number;
      cells?: number;
      round?: boolean;
      description?: string;
      ownerId: string;
    }
  ): Token | null {
    const map = this.findMap(room, mapId);
    if (!map) return null;
    const cells = Math.min(4, Math.max(1, Math.round(input.cells ?? 1)));
    const token: Token = {
      id: randomUUID(),
      name: input.name,
      description: input.description ?? '',
      imageUrl: input.imageUrl,
      x: input.x,
      y: input.y,
      w: cells * room.scene.grid.size,
      h: cells * room.scene.grid.size,
      cells,
      round: input.round ?? false,
      scale: 1,
      rotation: 0,
      z: ++room.nextZ,
      visible: true,
      ownerId: input.ownerId,
      lockedBy: null,
    };
    map.tokens.push(token);
    this.saveSoon(room);
    return token;
  }

  findToken(room: Room, mapId: string, id: string) {
    return this.findMap(room, mapId)?.tokens.find((t) => t.id === id);
  }

  removeToken(room: Room, mapId: string, id: string) {
    const map = this.findMap(room, mapId);
    if (!map) return;
    map.tokens = map.tokens.filter((t) => t.id !== id);
    this.saveSoon(room);
  }

  clearLocks(room: Room, playerId: string) {
    for (const map of room.scene.maps) {
      for (const token of map.tokens) {
        if (token.lockedBy === playerId) token.lockedBy = null;
      }
    }
  }

  saveSoon(room: Room) {
    saveRoomSoon(() => this.toPersisted(room));
  }

  saveNow(room: Room) {
    return saveRoomNow(this.toPersisted(room));
  }

  toState(room: Room): RoomState {
    return {
      code: room.code,
      scene: room.scene,
      library: room.library,
      players: room.players.map((p) => ({ id: p.id, name: p.name, role: p.role, isConnected: p.isConnected })),
      chat: room.chat,
    };
  }

  private toPersisted(room: Room): PersistedRoom {
    return {
      code: room.code,
      scene: room.scene,
      library: room.library,
      sheets: room.sheets,
      chat: room.chat,
      players: room.players.map((p) => ({ id: p.id, name: p.name, role: p.role })),
      nextZ: room.nextZ,
    };
  }
}
