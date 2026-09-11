import { randomBytes, randomUUID } from 'node:crypto';
import type {
  ChatMessage,
  CombatState,
  DiceRollResult,
  InitiativeEntry,
  LibraryItem,
  MapInfo,
  RoomState,
  Token,
  TokenFields,
} from 'shared';
import {
  clampCells,
  DEFAULT_GRID,
  DEFAULT_SPEED,
  defaultFog,
  emptyCombatState,
  initiativeBonus,
  normalizeAttacks,
  rollDice,
  statNumber,
  statsPaired,
} from 'shared';
import { cancelRoomSave, loadPersistedRooms, removeRoomFile, removeRoomUploadDir, removeRoomUploads, saveRoomNow, saveRoomSoon } from './store';
import { toPersistedRoom, type Room } from './roomTypes';
import { hydrateRoom } from './roomNormalize';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Все upload-ссылки, на которые ссылается состояние комнаты (карты, токены, библиотека). */
export function roomUploadUrls(room: Room): string[] {
  return [
    ...room.library.map((i) => i.imageUrl),
    ...room.scene.maps.flatMap((m) => [m.url, ...m.tokens.map((t) => t.imageUrl)]),
  ];
}

export class RoomManager {
  private rooms = new Map<string, Room>();

  async init() {
    const persisted = await loadPersistedRooms();
    for (const p of persisted) {
      try {
        this.rooms.set(p.code, hydrateRoom(p));
      } catch (e) {
        console.warn(`Не удалось загрузить комнату ${p?.code ?? '?'}:`, e);
      }
    }
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
    const room = this.rooms.get(code);
    if (!room) return false;
    this.rooms.delete(code);
    cancelRoomSave(code);
    removeRoomFile(code);
    removeRoomUploadDir(code);
    removeRoomUploads(roomUploadUrls(room));
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
      resources: {},
      controllers: {},
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
      combat: emptyCombatState(),
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
    const ac = (input.ac ?? '').slice(0, 10);
    const hpMax = (input.hpMax ?? '').slice(0, 10);
    const paired = statsPaired(ac, hpMax);
    const item: LibraryItem = {
      ...input,
      id: randomUUID(),
      name: input.name.slice(0, 60),
      cells: clampCells(input.cells),
      round: input.round === true,
      description: (input.description ?? '').slice(0, 200),
      initiativeBonus: (input.initiativeBonus ?? '').slice(0, 10),
      isPlayerToken: input.isPlayerToken === true,
      owner: (input.owner ?? '').slice(0, 40),
      attacks: normalizeAttacks(input.attacks),
      ac: paired ? ac : '',
      hpMax: paired ? hpMax : '',
      showStats: input.showStats === true,
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
    if (typeof patch.isPlayerToken === 'boolean') item.isPlayerToken = patch.isPlayerToken;
    if (typeof patch.owner === 'string') item.owner = patch.owner.slice(0, 40);
    if (Array.isArray(patch.attacks)) item.attacks = normalizeAttacks(patch.attacks);
    if (typeof patch.ac === 'string' && typeof patch.hpMax === 'string') {
      if (statsPaired(patch.ac, patch.hpMax)) {
        item.ac = patch.ac.slice(0, 10);
        item.hpMax = patch.hpMax.slice(0, 10);
      }
    } else if (typeof patch.ac === 'string') {
      const ac = patch.ac.slice(0, 10);
      if (statsPaired(ac, item.hpMax)) item.ac = ac;
    } else if (typeof patch.hpMax === 'string') {
      const hp = patch.hpMax.slice(0, 10);
      if (statsPaired(item.ac, hp)) item.hpMax = hp;
    }
    if (typeof patch.showStats === 'boolean') item.showStats = patch.showStats;
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
    item: LibraryItem,
    x: number,
    y: number,
    ownerId: string
  ): Token | null {
    const map = this.findMap(room, mapId);
    if (!map) return null;
    const cells = clampCells(item.cells || 1);
    const controllerId = Object.keys(room.controllers).find((pid) => room.controllers[pid] === item.id);
    const controllerSheet = controllerId ? room.sheets[controllerId] : undefined;
    const token: Token = {
      ...item,
      id: randomUUID(),
      libraryItemId: item.id,
      name: item.name.slice(0, 40),
      description: (item.description ?? '').slice(0, 200),
      initiativeBonus: (item.initiativeBonus ?? '').slice(0, 10),
      isPlayerToken: item.isPlayerToken === true,
      owner: (item.owner ?? '').slice(0, 40),
      attacks: normalizeAttacks(item.attacks),
      ac: (item.ac ?? '').slice(0, 10),
      hpMax: (item.hpMax ?? '').slice(0, 10),
      showStats: item.showStats === true,
      hpCurrent: statNumber(item.hpMax),
      x,
      y,
      w: cells * room.scene.grid.size,
      h: cells * room.scene.grid.size,
      cells,
      round: item.round === true,
      scale: 1,
      rotation: 0,
      z: ++room.nextZ,
      visible: true,
      ownerId,
      lockedBy: null,
      hpTemp: 0,
      faction: item.isPlayerToken === true ? 'ally' : 'neutral',
      speed: controllerSheet?.speed ?? DEFAULT_SPEED,
      conditions: [],
      effects: [],
    };
    map.tokens.push(token);
    this.saveSoon(room);
    return token;
  }

  characterName(room: Room, mapId: string, playerId: string): string {
    const libId = room.controllers[playerId];
    if (!libId) return '';
    const placed = this.findMap(room, mapId)?.tokens.find((t) => t.libraryItemId === libId);
    if (placed) return placed.name;
    return room.library.find((i) => i.id === libId)?.name ?? '';
  }

  controlsToken(room: Room, mapId: string, playerId: string, token: Token): boolean {
    const libId = room.controllers[playerId];
    if (libId && token.libraryItemId === libId) return true;
    if (token.owner) {
      const name = this.characterName(room, mapId, playerId);
      if (name && token.owner === name) return true;
    }
    return false;
  }

  clearControllersForItem(room: Room, libraryItemId: string): string[] {
    const cleared: string[] = [];
    for (const [pid, lid] of Object.entries(room.controllers)) {
      if (lid === libraryItemId) {
        delete room.controllers[pid];
        cleared.push(pid);
      }
    }
    if (cleared.length) this.saveSoon(room);
    return cleared;
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
    return initiativeBonus(token, room.players, room.sheets);
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
    map.combat = {
      ...emptyCombatState(),
      active: true,
      entries,
      round: entries.length ? 1 : 0,
      currentIndex: entries.length ? 0 : -1,
    };
    this.saveSoon(room);
  }

  endCombat(room: Room, mapId: string) {
    const map = room.scene.maps.find((m) => m.id === mapId);
    if (!map) return;
    map.combat = emptyCombatState();
    this.saveSoon(room);
  }

  clearCombat(room: Room, mapId: string) {
    const map = room.scene.maps.find((m) => m.id === mapId);
    if (!map) return;
    map.combat = { ...emptyCombatState(), active: true };
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
    saveRoomSoon(() => toPersistedRoom(room));
  }

  saveNow(room: Room) {
    return saveRoomNow(toPersistedRoom(room));
  }

  toState(room: Room): RoomState {
    return {
      code: room.code,
      name: room.name,
      scene: room.scene,
      library: room.library,
      players: room.players.map((p) => {
        const res = room.resources[p.id];
        const sheet = room.sheets[p.id];
        return {
          id: p.id,
          name: p.name,
          role: p.role,
          isConnected: p.isConnected,
          hpCurrent: res ? res.hp.current : null,
          hpMax: res ? res.hp.max : null,
          classKey: sheet?.classes?.[0]?.className ?? null,
        };
      }),
      chat: room.chat,
      controllers: room.controllers,
    };
  }
}
