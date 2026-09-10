import { randomBytes, randomUUID } from 'node:crypto';
import type {
  CharacterSheet,
  ChatMessage,
  CombatState,
  DiceRollResult,
  InitiativeEntry,
  LibraryItem,
  MapInfo,
  Player,
  RoomState,
  Scene,
  Token,
  TokenFields,
} from 'shared';
import { abilityMod, clampCells, DEFAULT_GRID, defaultFog, normalizeSheet, rollDice } from 'shared';
import { cancelRoomSave, loadPersistedRooms, removeRoomFile, saveRoomNow, saveRoomSoon, type PersistedRoom } from './store';

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
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class RoomManager {
  private rooms = new Map<string, Room>();

  async init() {
    const persisted = await loadPersistedRooms();
    for (const p of persisted) {
      try {
        this.rooms.set(p.code, this.hydrateRoom(p));
      } catch (e) {
        console.warn(`Не удалось загрузить комнату ${p?.code ?? '?'}:`, e);
      }
    }
  }

  private hydrateRoom(p: PersistedRoom): Room {
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
                fog: defaultFog(scene.grid),
                combat: { active: false, entries: [] },
              },
          ]
        : [];
      scene.maps = maps;
      scene.activeMapId = maps[0]?.id ?? null;
    }
    for (const map of scene.maps) {
      if (!Array.isArray(map.tokens)) map.tokens = [];
      if (!map.fog || typeof map.fog !== 'object') {
        map.fog = defaultFog(scene.grid);
      }
      if (!Array.isArray(map.fog.hidden)) map.fog.hidden = [];
      map.combat =
        map.combat && typeof map.combat === 'object'
          ? { active: map.combat.active === true, entries: Array.isArray(map.combat.entries) ? map.combat.entries : [] }
          : { active: false, entries: [] };
      for (const token of map.tokens) {
        if (typeof token.name !== 'string') token.name = '';
        if (typeof token.imageUrl !== 'string') token.imageUrl = '';
        if (typeof token.cells !== 'number') token.cells = 1;
        if (typeof token.round !== 'boolean') token.round = false;
        if (typeof token.description !== 'string') token.description = '';
        if (typeof token.initiativeBonus !== 'string') token.initiativeBonus = '';
      }
    }
    const legacyCombat = (p as PersistedRoom & { combat?: CombatState }).combat;
    const legacyMap = scene.maps.find((m) => m.id === scene.activeMapId) ?? scene.maps[0];
    if (legacyCombat && typeof legacyCombat === 'object' && legacyMap) {
      legacyMap.combat = {
        active: legacyCombat.active === true,
        entries: Array.isArray(legacyCombat.entries) ? legacyCombat.entries : [],
      };
    }
    for (const item of p.library ?? []) {
      const legacy = item as LibraryItem & { url?: string };
      if (typeof legacy.imageUrl !== 'string') {
        legacy.imageUrl = typeof legacy.url === 'string' ? legacy.url : '';
      }
      delete legacy.url;
      if (typeof item.name !== 'string') item.name = '';
      if (typeof item.cells !== 'number') item.cells = 1;
      if (typeof item.round !== 'boolean') item.round = false;
      if (typeof item.description !== 'string') item.description = '';
      if (typeof item.initiativeBonus !== 'string') item.initiativeBonus = '';
    }
    const sheets: Record<string, CharacterSheet> = {};
    if (p.sheets && typeof p.sheets === 'object') {
      for (const [id, sheet] of Object.entries(p.sheets)) {
        sheets[id] = normalizeSheet(sheet);
      }
    }
    return {
      code: p.code,
      name:
        typeof p.name === 'string' && p.name.trim()
          ? p.name.trim().slice(0, 60)
          : `Игра ${p.code.slice(0, 6)}`,
      scene,
      library: Array.isArray(p.library) ? p.library : [],
      sheets,
      chat: p.chat ?? [],
      players: Array.isArray(p.players)
        ? p.players.map((pl) => ({ ...pl, isConnected: false, socketId: null }))
        : [],
      nextZ: p.nextZ ?? 0,
    };
  }

  has(code: string) {
    return this.rooms.has(code);
  }

  listRooms() {
    return [...this.rooms.values()].map((r) => ({
      code: r.code,
      name: r.name,
      players: r.players.length,
      maps: r.scene.maps.length,
    }));
  }

  deleteRoom(code: string): boolean {
    if (!this.rooms.has(code)) return false;
    this.rooms.delete(code);
    cancelRoomSave(code);
    removeRoomFile(code);
    return true;
  }

  renameRoom(room: Room, name: string): string {
    const trimmed = name.trim().slice(0, 60);
    if (!trimmed) return room.name;
    room.name = trimmed;
    this.saveSoon(room);
    return room.name;
  }

  get(code: string) {
    return this.rooms.get(code);
  }

  create(name?: string): Room {
    const code = this.generateCode();
    const roomName = (name ?? '').trim().slice(0, 60) || `Игра ${code.slice(0, 6)}`;
    const room: Room = {
      code,
      name: roomName,
      scene: {
        maps: [],
        activeMapId: null,
        grid: { ...DEFAULT_GRID },
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
    for (;;) {
      const bytes = randomBytes(12);
      const code = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
      if (!this.rooms.has(code)) return code;
    }
  }

  addMap(room: Room, input: { name: string; url: string; width: number; height: number }): MapInfo {
    const map: MapInfo = {
      ...input,
      id: randomUUID(),
      tokens: [],
      fog: defaultFog(room.scene.grid),
      combat: { active: false, entries: [] },
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

  addLibraryItem(room: Room, input: TokenFields): LibraryItem {
    const item: LibraryItem = {
      ...input,
      id: randomUUID(),
      name: input.name.slice(0, 60),
      cells: clampCells(input.cells),
      round: input.round === true,
      description: (input.description ?? '').slice(0, 200),
      initiativeBonus: (input.initiativeBonus ?? '').slice(0, 10),
    };
    room.library.push(item);
    this.saveSoon(room);
    return item;
  }

  updateLibraryItem(room: Room, id: string, patch: Partial<LibraryItem>) {
    const item = room.library.find((i) => i.id === id);
    if (!item) return;
    if (typeof patch.name === 'string') item.name = patch.name.slice(0, 60);
    if (typeof patch.description === 'string') item.description = patch.description.slice(0, 200);
    if (typeof patch.round === 'boolean') item.round = patch.round;
    if (typeof patch.cells === 'number') item.cells = clampCells(patch.cells);
    if (typeof patch.initiativeBonus === 'string') item.initiativeBonus = patch.initiativeBonus.slice(0, 10);
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
    fields: TokenFields,
    x: number,
    y: number,
    ownerId: string
  ): Token | null {
    const map = this.findMap(room, mapId);
    if (!map) return null;
    const cells = clampCells(fields.cells || 1);
    const token: Token = {
      ...fields,
      id: randomUUID(),
      name: fields.name.slice(0, 40),
      description: (fields.description ?? '').slice(0, 200),
      initiativeBonus: (fields.initiativeBonus ?? '').slice(0, 10),
      x,
      y,
      w: cells * room.scene.grid.size,
      h: cells * room.scene.grid.size,
      cells,
      round: fields.round === true,
      scale: 1,
      rotation: 0,
      z: ++room.nextZ,
      visible: true,
      ownerId,
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

  private findTokenById(room: Room, id: string): Token | null {
    for (const map of room.scene.maps) {
      const found = map.tokens.find((t) => t.id === id);
      if (found) return found;
    }
    return null;
  }

  private initiativeBonusFor(room: Room, token: Token): string {
    const raw = (token.initiativeBonus ?? '').trim();
    if (raw) return raw;
    const sheet = room.sheets[token.ownerId];
    if (!sheet) return '';
    const mod = abilityMod(sheet.abilities.dex ?? 10);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  }

  private rollInit(bonus: string): DiceRollResult {
    const b = bonus.trim();
    const expression = !b ? 'd20' : /^[+-]/.test(b) ? `d20${b}` : `d20+${b}`;
    try {
      return rollDice(expression);
    } catch {
      return rollDice('d20');
    }
  }

  private makeEntry(room: Room, token: Token): InitiativeEntry {
    const bonus = this.initiativeBonusFor(room, token);
    const roll = this.rollInit(bonus);
    return {
      id: randomUUID(),
      tokenId: token.id,
      name: token.name,
      imageUrl: token.imageUrl,
      initiative: roll.total,
      bonus,
      roll,
    };
  }

  private reRollEntry(room: Room, entry: InitiativeEntry) {
    const token = entry.tokenId ? this.findTokenById(room, entry.tokenId) : null;
    const bonus = token ? this.initiativeBonusFor(room, token) : entry.bonus;
    const roll = this.rollInit(bonus);
    entry.bonus = bonus;
    entry.initiative = roll.total;
    entry.roll = roll;
  }

  combatOf(room: Room, mapId: string): CombatState | null {
    return room.scene.maps.find((m) => m.id === mapId)?.combat ?? null;
  }

  startCombat(room: Room, mapId: string) {
    const map = room.scene.maps.find((m) => m.id === mapId);
    if (!map) return;
    const entries = map.tokens.map((t) => this.makeEntry(room, t));
    entries.sort((a, b) => b.initiative - a.initiative);
    map.combat = { active: true, entries };
    this.saveSoon(room);
  }

  endCombat(room: Room, mapId: string) {
    const map = room.scene.maps.find((m) => m.id === mapId);
    if (!map) return;
    map.combat = { active: false, entries: [] };
    this.saveSoon(room);
  }

  clearCombat(room: Room, mapId: string) {
    const map = room.scene.maps.find((m) => m.id === mapId);
    if (!map) return;
    map.combat = { active: true, entries: [] };
    this.saveSoon(room);
  }

  addTokenToCombat(room: Room, mapId: string, token: Token) {
    const combat = this.combatOf(room, mapId);
    if (!combat) return;
    const entry = this.makeEntry(room, token);
    const at = combat.entries.findIndex((e) => e.initiative < entry.initiative);
    if (at < 0) combat.entries.push(entry);
    else combat.entries.splice(at, 0, entry);
    this.saveSoon(room);
  }

  addCombatToken(room: Room, mapId: string, tokenId: string): boolean {
    const combat = this.combatOf(room, mapId);
    if (!combat || combat.entries.some((e) => e.tokenId === tokenId)) return false;
    const token = this.findToken(room, mapId, tokenId);
    if (!token) return false;
    this.addTokenToCombat(room, mapId, token);
    return true;
  }

  addMapTokensToCombat(room: Room, mapId: string) {
    const map = room.scene.maps.find((m) => m.id === mapId);
    if (!map) return;
    const existing = new Set(map.combat.entries.map((e) => e.tokenId));
    const additions = map.tokens.filter((t) => !existing.has(t.id)).map((t) => this.makeEntry(room, t));
    if (additions.length === 0) return;
    map.combat.entries = [...map.combat.entries, ...additions].sort((a, b) => b.initiative - a.initiative);
    this.saveSoon(room);
  }

  removeTokenFromCombat(room: Room, mapId: string, tokenId: string) {
    const combat = this.combatOf(room, mapId);
    if (!combat) return;
    const before = combat.entries.length;
    combat.entries = combat.entries.filter((e) => e.tokenId !== tokenId);
    if (combat.entries.length !== before) this.saveSoon(room);
  }

  removeCombatant(room: Room, mapId: string, id: string) {
    const combat = this.combatOf(room, mapId);
    if (!combat) return;
    combat.entries = combat.entries.filter((e) => e.id !== id);
    this.saveSoon(room);
  }

  updateCombatant(
    room: Room,
    mapId: string,
    id: string,
    patch: { name?: string; initiative?: number; bonus?: string }
  ) {
    const entry = this.combatOf(room, mapId)?.entries.find((e) => e.id === id);
    if (!entry) return;
    if (typeof patch.name === 'string') entry.name = patch.name.slice(0, 40);
    if (typeof patch.bonus === 'string') entry.bonus = patch.bonus.slice(0, 10);
    if (typeof patch.initiative === 'number' && Number.isFinite(patch.initiative)) {
      entry.initiative = Math.round(patch.initiative);
    }
    this.saveSoon(room);
  }

  moveCombatant(room: Room, mapId: string, id: string, toIndex: number) {
    const combat = this.combatOf(room, mapId);
    if (!combat) return;
    const entries = combat.entries;
    const from = entries.findIndex((e) => e.id === id);
    if (from < 0) return;
    const to = Math.min(Math.max(0, Math.round(toIndex)), entries.length - 1);
    if (from === to) return;
    const [entry] = entries.splice(from, 1);
    entries.splice(to, 0, entry);
    this.saveSoon(room);
  }

  rollCombat(room: Room, mapId: string, id?: string) {
    const combat = this.combatOf(room, mapId);
    if (!combat) return;
    if (id) {
      const entry = combat.entries.find((e) => e.id === id);
      if (entry) this.reRollEntry(room, entry);
    } else {
      for (const entry of combat.entries) this.reRollEntry(room, entry);
      combat.entries.sort((a, b) => b.initiative - a.initiative);
    }
    this.saveSoon(room);
  }

  renameCombatantByToken(room: Room, mapId: string, tokenId: string, name: string) {
    const combat = this.combatOf(room, mapId);
    if (!combat) return;
    const entry = combat.entries.find((e) => e.tokenId === tokenId);
    if (!entry) return;
    entry.name = name.slice(0, 40);
    this.saveSoon(room);
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
      name: room.name,
      scene: room.scene,
      library: room.library,
      players: room.players.map((p) => ({ id: p.id, name: p.name, role: p.role, isConnected: p.isConnected })),
      chat: room.chat,
    };
  }

  private toPersisted(room: Room): PersistedRoom {
    return {
      code: room.code,
      name: room.name,
      scene: room.scene,
      library: room.library,
      sheets: room.sheets,
      chat: room.chat,
      players: room.players.map((p) => ({ id: p.id, name: p.name, role: p.role })),
      nextZ: room.nextZ,
    };
  }
}
