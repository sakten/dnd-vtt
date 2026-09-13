import { randomBytes, randomUUID } from 'node:crypto';
import type {
  ActionCost,
  AbilityKey,
  ChatMessage,
  CombatState,
  DamageDefense,
  DiceRollResult,
  InitiativeEntry,
  LibraryItem,
  MapInfo,
  RoomState,
  Token,
  TokenFields,
  TurnState,
} from 'shared';
import {
  abilityMod,
  attacksPerAction,
  clampCells,
  DEFAULT_GRID,
  DEFAULT_SPEED,
  defaultFog,
  emptyCombatState,
  emptyTurnState,
  initiativeBonus,
  conditionName,
  exhaustionRollPenalty,
  exhaustionSpeedPenalty,
  normalizeAttacks,
  normalizeDamageDefenses,
  rollDice,
  sheetProficiencyBonus,
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
        const room = hydrateRoom(p);
        this.rooms.set(p.code, room);
        for (const map of room.scene.maps) this.ensureActiveTurn(room, map.id);
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
      damageDefenses: normalizeDamageDefenses(input.damageDefenses),
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
    if (Array.isArray(patch.damageDefenses)) item.damageDefenses = normalizeDamageDefenses(patch.damageDefenses);
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
      damageDefenses: normalizeDamageDefenses(item.damageDefenses),
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
    if (entries.length) this.beginTurn(room, mapId, entries[0].id);
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

  /** Максимум передвижения и легендарных действий для записи инициативы. */
  private turnResources(room: Room, entry: InitiativeEntry): { speed: number; legendaryMax: number } {
    const token = entry.tokenId ? this.findTokenById(room, entry.tokenId) : null;
    if (!token) return { speed: DEFAULT_SPEED, legendaryMax: 0 };
    const controllerId = Object.keys(room.controllers).find((pid) => room.controllers[pid] === token.libraryItemId);
    const sheetSpeed = controllerId ? room.sheets[controllerId]?.speed : undefined;
    const base = sheetSpeed ?? token.speed ?? DEFAULT_SPEED;
    return {
      speed: Math.max(0, base + exhaustionSpeedPenalty(token.conditions)),
      legendaryMax: token.statblock?.legendary?.max ?? 0,
    };
  }

  /** Начинает/сбрасывает ход записи, сохраняя концентрацию заклинателя. */
  beginTurn(room: Room, mapId: string, entryId: string) {
    const combat = this.combatOf(room, mapId);
    if (!combat) return;
    const entry = combat.entries.find((e) => e.id === entryId);
    if (!entry) return;
    const { speed, legendaryMax } = this.turnResources(room, entry);
    const prev = combat.turns[entry.id];
    combat.turns[entry.id] = {
      ...emptyTurnState(speed),
      legendaryRemaining: legendaryMax,
      legendaryMax,
      concentrationId: prev?.concentrationId ?? null,
    };
  }

  /** Завершает текущий ход, переходя к следующему по инициативе. */
  endTurn(room: Room, mapId: string) {
    this.advanceTurn(room, mapId, 1);
  }

  advanceTurn(room: Room, mapId: string, delta: number) {
    const combat = this.combatOf(room, mapId);
    if (!combat || !combat.active || combat.entries.length === 0) return;
    const n = combat.entries.length;
    let idx = combat.currentIndex < 0 ? (delta > 0 ? 0 : n - 1) : combat.currentIndex + delta;
    if (idx >= n) {
      idx -= n;
      combat.round = Math.max(1, combat.round) + 1;
    } else if (idx < 0) {
      idx += n;
      combat.round = Math.max(1, combat.round - 1);
    }
    combat.round = Math.max(1, combat.round);
    combat.currentIndex = idx;
    this.beginTurn(room, mapId, combat.entries[idx].id);
    this.saveSoon(room);
  }

  /** DM задаёт активную запись по id или индексу. */
  setTurn(room: Room, mapId: string, target: { id?: string; index?: number }) {
    const combat = this.combatOf(room, mapId);
    if (!combat || combat.entries.length === 0) return;
    let idx = -1;
    if (typeof target.id === 'string') idx = combat.entries.findIndex((e) => e.id === target.id);
    else if (typeof target.index === 'number') idx = Math.round(target.index);
    if (idx < 0 || idx >= combat.entries.length) return;
    combat.round = Math.max(1, combat.round);
    combat.currentIndex = idx;
    this.beginTurn(room, mapId, combat.entries[idx].id);
    this.saveSoon(room);
  }

  /** Число атак за действие: Extra Attack по листу или multiattack монстра. */
  attacksPerToken(room: Room, token: Token): number {
    const controllerId = Object.keys(room.controllers).find((pid) => room.controllers[pid] === token.libraryItemId);
    const sheet = controllerId ? room.sheets[controllerId] : undefined;
    if (sheet) return attacksPerAction(sheet.classes);
    return Math.max(1, token.statblock?.multiattack ?? 1);
  }

  /** Эффективная скорость токена: из листа персонажа либо своя у монстра. */
  tokenSpeed(room: Room, token: Token): number {
    const controllerId = Object.keys(room.controllers).find((pid) => room.controllers[pid] === token.libraryItemId);
    const sheet = controllerId ? room.sheets[controllerId] : undefined;
    return sheet?.speed ?? token.speed ?? DEFAULT_SPEED;
  }

  /** Модификатор характеристики токена: из листа персонажа или статблока монстра. */
  abilityModForToken(room: Room, token: Token, ability: AbilityKey): number {
    const controllerId = Object.keys(room.controllers).find((pid) => room.controllers[pid] === token.libraryItemId);
    const sheet = controllerId ? room.sheets[controllerId] : undefined;
    const score = sheet ? sheet.abilities[ability] : token.statblock?.abilities?.[ability];
    return abilityMod(score ?? 10);
  }

  /** Добавляет передвижение на текущий ход (Рывок). */
  grantExtraMovement(room: Room, mapId: string, token: Token, feet: number) {
    const turn = this.turnForToken(room, mapId, token);
    if (!turn) return;
    turn.movementMax += Math.max(0, Math.round(feet));
    this.saveSoon(room);
  }

  /** Ресурсы хода токена, если он сейчас активен в бою карты; иначе null. */
  turnForToken(room: Room, mapId: string, token: Token): TurnState | null {
    const combat = this.combatOf(room, mapId);
    if (!combat?.active) return null;
    const active = combat.entries[combat.currentIndex];
    if (!active || active.tokenId !== token.id) return null;
    return combat.turns[active.id] ?? null;
  }

  /** Активен ли токен в бою карты (вне боя — всегда true). */
  isActiveToken(room: Room, mapId: string, tokenId: string): boolean {
    const combat = this.combatOf(room, mapId);
    if (!combat?.active) return true;
    const active = combat.entries[combat.currentIndex];
    return !active || active.tokenId === tokenId;
  }

  /** Доступна ли атака: есть запас мультиатаки или свободное действие. */
  canAttack(room: Room, mapId: string, token: Token): boolean {
    const turn = this.turnForToken(room, mapId, token);
    if (!turn) return true;
    return turn.attacksRemaining > 0 || !turn.actionUsed || turn.extraActions > 0;
  }

  /** Списывает атаку (запас мультиатаки либо действие). */
  consumeAttack(room: Room, mapId: string, token: Token): boolean {
    const turn = this.turnForToken(room, mapId, token);
    if (!turn) return true;
    if (turn.attacksRemaining > 0) {
      turn.attacksRemaining -= 1;
    } else if (turn.extraActions > 0) {
      turn.extraActions -= 1;
      turn.attacksRemaining = Math.max(0, this.attacksPerToken(room, token) - 1);
    } else if (!turn.actionUsed) {
      turn.actionUsed = true;
      turn.attacksRemaining = Math.max(0, this.attacksPerToken(room, token) - 1);
    } else {
      return false;
    }
    this.saveSoon(room);
    return true;
  }

  /** Списывает слот действия (action/bonus/reaction) для токена. */
  spendSlot(room: Room, mapId: string, token: Token, slot: ActionCost): boolean {
    const turn = this.turnForToken(room, mapId, token);
    if (!turn) return true;
    switch (slot) {
      case 'action':
        if (turn.extraActions > 0) turn.extraActions -= 1;
        else if (!turn.actionUsed) turn.actionUsed = true;
        else return false;
        break;
      case 'bonus':
        if (turn.extraBonusActions > 0) turn.extraBonusActions -= 1;
        else if (!turn.bonusActionUsed) turn.bonusActionUsed = true;
        else return false;
        break;
      case 'reaction':
        if (!turn.reactionUsed) turn.reactionUsed = true;
        else return false;
        break;
      default:
        return true;
    }
    this.saveSoon(room);
    return true;
  }

  /** Есть ли у игрока ресурс в нужном количестве. */
  hasResource(room: Room, playerId: string, key: string, amount = 1): boolean {
    const item = room.resources[playerId]?.resources.find((r) => r.key === key);
    return !!item && item.current >= amount;
  }

  /** Списывает ресурс игрока; false — если ресурса нет или не хватает. */
  spendResource(room: Room, playerId: string, key: string, amount = 1): boolean {
    const item = room.resources[playerId]?.resources.find((r) => r.key === key);
    if (!item || item.current < amount) return false;
    item.current -= amount;
    this.saveSoon(room);
    return true;
  }

  /** Списывает ячейку заклинания круга (обычную, иначе pact). null — нет ячейки. */
  spendSpellSlot(room: Room, playerId: string, level: number): 'slot' | 'pact' | null {
    const res = room.resources[playerId];
    if (!res || level < 1) return null;
    const slot = res.spellSlots.find((s) => s.level === level && s.current > 0);
    if (slot) {
      slot.current -= 1;
      this.saveSoon(room);
      return 'slot';
    }
    if (res.pact.level === level && res.pact.current > 0) {
      res.pact.current -= 1;
      this.saveSoon(room);
      return 'pact';
    }
    return null;
  }

  /** id игрока-контролёра токена (персонажа/призыва). */
  controllerOfToken(room: Room, token: Token): string | undefined {
    return Object.keys(room.controllers).find((pid) => room.controllers[pid] === token.libraryItemId);
  }

  /** Защиты токена: у персонажа — из листа контролёра, у монстра — из токена. */
  damageDefensesForToken(room: Room, token: Token): DamageDefense[] {
    const controllerId = this.controllerOfToken(room, token);
    const sheet = controllerId ? room.sheets[controllerId] : undefined;
    if (sheet) return sheet.damageDefenses ?? [];
    return token.damageDefenses ?? [];
  }

  /** Бонус спасброска токена: мод. характеристики (+профишенси у персонажа). */
  saveBonusForToken(room: Room, token: Token, ability: AbilityKey): number {
    const controllerId = this.controllerOfToken(room, token);
    const sheet = controllerId ? room.sheets[controllerId] : undefined;
    if (sheet) {
      const mod = abilityMod(sheet.abilities[ability] ?? 10);
      return sheet.saves[ability] ? mod + sheetProficiencyBonus(sheet) : mod;
    }
    const sb = token.statblock;
    const explicit = sb?.saves?.[ability];
    if (typeof explicit === 'number') return explicit;
    return abilityMod(sb?.abilities?.[ability] ?? 10);
  }

  /**
   * Тик состояний в начале/конце хода носителя: повторный спасбросок (start/end)
   * и уменьшение длительности (раунды). Возвращает события для рассылки.
   */
  tickConditions(
    room: Room,
    token: Token,
    phase: 'start' | 'end'
  ): { changed: boolean; saves: { name: string; roll: DiceRollResult; success: boolean }[]; removed: string[] } {
    const saves: { name: string; roll: DiceRollResult; success: boolean }[] = [];
    const removed: string[] = [];
    let changed = false;
    const kept = token.conditions.filter((cond) => {
      let remove = false;
      if (cond.save && cond.save.timing === phase) {
        const bonus = this.saveBonusForToken(room, token, cond.save.ability) + exhaustionRollPenalty(token.conditions);
        const roll = rollDice(`d20+${bonus}`);
        const success = roll.total >= cond.save.dc;
        saves.push({ name: cond.name, roll, success });
        if (success) remove = true;
      }
      if (!remove && phase === 'start' && cond.rounds != null) {
        cond.rounds -= 1;
        if (cond.rounds <= 0) {
          remove = true;
          removed.push(cond.name);
        }
      }
      if (remove) changed = true;
      return !remove;
    });
    token.conditions = kept;
    if (changed) this.saveSoon(room);
    return { changed, saves, removed };
  }

  /** Фиксирует потраченное передвижение бойца (предупреждение, не блокировка). */
  setMovement(room: Room, mapId: string, tokenId: string, used: number, diagonals?: number) {
    const combat = this.combatOf(room, mapId);
    if (!combat || !Number.isFinite(used)) return;
    const entry = combat.entries.find((e) => e.tokenId === tokenId);
    if (!entry) return;
    const turn = combat.turns[entry.id];
    if (!turn) return;
    turn.movementUsed = Math.max(0, Math.round(used));
    if (typeof diagonals === 'number' && Number.isFinite(diagonals)) {
      turn.diagonalsUsed = Math.max(0, Math.round(diagonals));
    }
    this.saveSoon(room);
  }

  private restoreActive(combat: CombatState, entryId: string | undefined) {
    if (entryId) {
      const idx = combat.entries.findIndex((e) => e.id === entryId);
      if (idx >= 0) {
        combat.currentIndex = idx;
        return;
      }
    }
    if (combat.entries.length === 0) combat.currentIndex = -1;
    else combat.currentIndex = Math.min(combat.entries.length - 1, Math.max(0, combat.currentIndex));
  }

  /**
   * Гарантирует активную запись и её ресурсы хода: лечит легаси-бой без
   * `currentIndex`/`turns` и добор токенов уже начатого боя.
   */
  private ensureActiveTurn(room: Room, mapId: string) {
    const combat = this.combatOf(room, mapId);
    if (!combat || !combat.active || combat.entries.length === 0) return;
    if (combat.currentIndex < 0 || combat.currentIndex >= combat.entries.length) {
      combat.currentIndex = 0;
      combat.round = Math.max(1, combat.round);
    }
    const entry = combat.entries[combat.currentIndex];
    if (!combat.turns[entry.id]) this.beginTurn(room, mapId, entry.id);
  }

  addTokenToCombat(room: Room, mapId: string, token: Token) {
    const combat = this.combatOf(room, mapId);
    if (!combat) return;
    const activeId = combat.entries[combat.currentIndex]?.id;
    const entry = this.makeEntry(room, token);
    const at = combat.entries.findIndex((e) => e.initiative < entry.initiative);
    if (at < 0) combat.entries.push(entry);
    else combat.entries.splice(at, 0, entry);
    this.restoreActive(combat, activeId);
    this.ensureActiveTurn(room, mapId);
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
    const combat = map.combat;
    const existing = new Set(combat.entries.map((e) => e.tokenId));
    const additions = map.tokens.filter((t) => !existing.has(t.id)).map((t) => this.makeEntry(room, t));
    if (additions.length === 0) return;
    const activeId = combat.entries[combat.currentIndex]?.id;
    combat.entries = [...combat.entries, ...additions].sort((a, b) => b.initiative - a.initiative);
    this.restoreActive(combat, activeId);
    this.ensureActiveTurn(room, mapId);
    this.saveSoon(room);
  }

  removeTokenFromCombat(room: Room, mapId: string, tokenId: string) {
    const combat = this.combatOf(room, mapId);
    if (!combat) return;
    const activeId = combat.entries[combat.currentIndex]?.id;
    const removed = combat.entries.filter((e) => e.tokenId === tokenId);
    if (removed.length === 0) return;
    combat.entries = combat.entries.filter((e) => e.tokenId !== tokenId);
    for (const e of removed) delete combat.turns[e.id];
    const activeRemoved = !!activeId && removed.some((e) => e.id === activeId);
    this.restoreActive(combat, activeRemoved ? undefined : activeId);
    if (combat.active && combat.entries.length) this.beginTurn(room, mapId, combat.entries[combat.currentIndex].id);
    this.saveSoon(room);
  }

  removeCombatant(room: Room, mapId: string, id: string) {
    const combat = this.combatOf(room, mapId);
    if (!combat) return;
    const activeId = combat.entries[combat.currentIndex]?.id;
    const before = combat.entries.length;
    combat.entries = combat.entries.filter((e) => e.id !== id);
    if (combat.entries.length === before) return;
    delete combat.turns[id];
    const activeRemoved = activeId === id;
    this.restoreActive(combat, activeRemoved ? undefined : activeId);
    if (combat.active && combat.entries.length) this.beginTurn(room, mapId, combat.entries[combat.currentIndex].id);
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
    const activeId = entries[combat.currentIndex]?.id;
    const [entry] = entries.splice(from, 1);
    entries.splice(to, 0, entry);
    this.restoreActive(combat, activeId);
    this.saveSoon(room);
  }

  rollCombat(room: Room, mapId: string, id?: string) {
    const combat = this.combatOf(room, mapId);
    if (!combat) return;
    if (id) {
      const entry = combat.entries.find((e) => e.id === id);
      if (entry) this.reRollEntry(room, entry);
    } else {
      const activeId = combat.entries[combat.currentIndex]?.id;
      for (const entry of combat.entries) this.reRollEntry(room, entry);
      combat.entries.sort((a, b) => b.initiative - a.initiative);
      this.restoreActive(combat, activeId);
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

  /** Зеркалит HP/AC/скорость персонажа игрока в его токены на всех картах. */
  syncSheetToTokens(room: Room, playerId: string): { mapId: string; token: Token }[] {
    const libId = room.controllers[playerId];
    if (!libId) return [];
    const sheet = room.sheets[playerId];
    const res = room.resources[playerId];
    if (!sheet && !res) return [];
    const changed: { mapId: string; token: Token }[] = [];
    for (const map of room.scene.maps) {
      for (const token of map.tokens) {
        if (token.libraryItemId !== libId) continue;
        if (res && res.hp.max > 0) {
          token.hpMax = String(res.hp.max);
          token.hpCurrent = res.hp.current;
          token.hpTemp = res.hp.temp;
        }
        if (sheet) {
          token.ac = sheet.ac;
          token.speed = sheet.speed;
        }
        changed.push({ mapId: map.id, token });
      }
    }
    return changed;
  }

  /** Навешивает «Без сознания»/«Мёртв»/ничего по состоянию HP (прочие состояния сохраняются). */
  private applyDownState(token: Token, downed: boolean, dead: boolean) {
    const rest = token.conditions.filter((c) => c.key !== 'unconscious' && c.key !== 'dead');
    if (dead) rest.push({ key: 'dead', name: conditionName('dead'), rounds: null });
    else if (downed) rest.push({ key: 'unconscious', name: conditionName('unconscious'), rounds: null });
    token.conditions = rest;
  }

  /** Помечает все токены персонажа мёртвыми/живыми (по итогу death-сейвов). */
  markControlledTokensDead(room: Room, playerId: string, dead: boolean): { mapId: string; token: Token }[] {
    const libId = room.controllers[playerId];
    if (!libId) return [];
    const changed: { mapId: string; token: Token }[] = [];
    for (const map of room.scene.maps) {
      for (const token of map.tokens) {
        if (token.libraryItemId !== libId) continue;
        this.applyDownState(token, !dead, dead);
        changed.push({ mapId: map.id, token });
      }
    }
    if (changed.length) this.saveSoon(room);
    return changed;
  }

  /**
   * Изменяет HP токена с учётом канона: у персонажа HP живёт в PlayerResources
   * и зеркалится в токены, у монстров — прямо в токене. HP может уходить в минус.
   * Лечение сбрасывает death-сейвы; урон лежачему добавляет провал (крит — 2);
   * HP ≤ 0 → «Без сознания»/«Мёртв». Возвращает изменившиеся токены для рассылки.
   */
  adjustTokenHp(
    room: Room,
    mapId: string,
    token: Token,
    delta: number,
    opts: { crit?: boolean } = {}
  ): { mapId: string; token: Token }[] {
    const controllerId = this.controllerOfToken(room, token);
    const res = controllerId ? room.resources[controllerId] : undefined;
    if (controllerId && res && res.hp.max > 0) {
      const before = res.hp.current;
      let next = before + delta;
      next = Math.min(res.hp.max, next);
      res.hp.current = next;
      if (delta > 0) {
        res.hp.deathSuccesses = 0;
        res.hp.deathFailures = 0;
      } else if (delta < 0 && before <= 0) {
        res.hp.deathFailures = Math.min(3, res.hp.deathFailures + (opts.crit ? 2 : 1));
      }
      this.saveSoon(room);
      const changed = this.syncSheetToTokens(room, controllerId);
      for (const c of changed) {
        this.applyDownState(c.token, res.hp.current <= 0 && res.hp.deathFailures < 3, res.hp.deathFailures >= 3);
      }
      return changed;
    }
    const max = statNumber(token.hpMax);
    let next = token.hpCurrent + delta;
    if (max > 0) next = Math.min(max, next);
    token.hpCurrent = next;
    this.applyDownState(token, next <= 0, next <= 0);
    this.saveSoon(room);
    return [{ mapId, token }];
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
