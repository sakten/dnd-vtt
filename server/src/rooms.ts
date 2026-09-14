import { randomBytes, randomUUID } from 'node:crypto';
import type {
  ActionCost,
  AbilityKey,
  ChatMessage,
  CombatState,
  DamageDefense,
  DiceRollResult,
  EffectInstance,
  LibraryItem,
  MapInfo,
  RoomState,
  RollParts,
  Token,
  TokenFields,
  TurnState,
} from 'shared';
import {
  abilityMod,
  autoFailSave,
  concentrationDc,
  concentratingEffects,
  DEFAULT_GRID,
  DEFAULT_SPEED,
  defaultFog,
  effectDefenses,
  emptyCombatState,
  conditionName,
  exhaustionRollPenalty,
  modifiedValue,
  normalizeTokenFields,
  normalizeTokenFieldsPatch,
  rollDice,
  saveRollParts,
  sheetProficiencyBonus,
  statNumber,
  withAdvantage,
  withRollParts,
} from 'shared';
import { createRoomRepository, removeRoomUploadDir, removeRoomUploads, type RoomRepository } from './store';
import { toPersistedRoom, type Room } from './roomTypes';
import { hydrateRoom } from './roomNormalize';
import * as Combat from './room/combat';
import {
  controllerIdOfItem,
  controllerIdOfToken,
  findTokenById,
  hasResourceFor,
  locateToken,
  roomUploadUrls,
  tokenById,
} from './room/helpers';

export { controllerIdOfItem, controllerIdOfToken, hasResourceFor, roomUploadUrls } from './room/helpers';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class RoomManager {
  private rooms = new Map<string, Room>();

  constructor(private readonly repo: RoomRepository = createRoomRepository()) {}

  async init() {
    const persisted = await this.repo.loadAll();
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
    this.repo.remove(code);
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
      testMode: false,
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
    const item: LibraryItem = { ...normalizeTokenFields(input, 60), id: randomUUID() };
    room.library.push(item);
    this.saveSoon(room);
    return item;
  }

  updateLibraryItem(room: Room, id: string, patch: Partial<LibraryItem>) {
    const item = room.library.find((i) => i.id === id);
    if (!item) return;
    Object.assign(item, normalizeTokenFieldsPatch(patch, item, { includeDm: true }));
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

  findTokenById(room: Room, id: string): Token | null {
    return findTokenById(room, id);
  }

  /** Токен по id на любой карте комнаты. */
  tokenById(room: Room, id: string): Token | null {
    return tokenById(room, id);
  }

  /** Карта и токен по id на любой карте комнаты. */
  locateToken(room: Room, id: string): { mapId: string; token: Token } | null {
    return locateToken(room, id);
  }

  combatOf(room: Room, mapId: string): CombatState | null {
    return Combat.combatOf(room, mapId);
  }

  startCombat(room: Room, mapId: string) {
    Combat.startCombat(this, room, mapId);
  }

  endCombat(room: Room, mapId: string) {
    Combat.endCombat(this, room, mapId);
  }

  clearCombat(room: Room, mapId: string) {
    Combat.clearCombat(this, room, mapId);
  }

  beginTurn(room: Room, mapId: string, entryId: string) {
    Combat.beginTurn(room, mapId, entryId);
  }

  endTurn(room: Room, mapId: string) {
    Combat.endTurn(this, room, mapId);
  }

  advanceTurn(room: Room, mapId: string, delta: number) {
    Combat.advanceTurn(this, room, mapId, delta);
  }

  setTurn(room: Room, mapId: string, target: { id?: string; index?: number }) {
    Combat.setTurn(this, room, mapId, target);
  }

  attacksPerToken(room: Room, token: Token): number {
    return Combat.attacksPerToken(room, token);
  }

  tokenSpeed(room: Room, token: Token): number {
    return Combat.tokenSpeed(room, token);
  }

  abilitiesForToken(room: Room, token: Token): Record<AbilityKey, number> | undefined {
    return Combat.abilitiesForToken(room, token);
  }

  acForToken(room: Room, token: Token): number {
    return Combat.acForToken(room, token);
  }

  abilityModForToken(room: Room, token: Token, ability: AbilityKey): number {
    return Combat.abilityModForToken(room, token, ability);
  }

  grantExtraMovement(room: Room, mapId: string, token: Token, feet: number) {
    Combat.grantExtraMovement(this, room, mapId, token, feet);
  }

  turnForToken(room: Room, mapId: string, token: Token): TurnState | null {
    return Combat.turnForToken(room, mapId, token);
  }

  turnStateFor(room: Room, mapId: string, token: Token): TurnState | null {
    return Combat.turnStateFor(room, mapId, token);
  }

  isActiveToken(room: Room, mapId: string, tokenId: string): boolean {
    return Combat.isActiveToken(room, mapId, tokenId);
  }

  canAttack(room: Room, mapId: string, token: Token): boolean {
    return Combat.canAttack(room, mapId, token);
  }

  consumeAttack(room: Room, mapId: string, token: Token): boolean {
    return Combat.consumeAttack(this, room, mapId, token);
  }

  spendSlot(room: Room, mapId: string, token: Token, slot: ActionCost): boolean {
    return Combat.spendSlot(this, room, mapId, token, slot);
  }

  /** Есть ли у игрока ресурс в нужном количестве. */
  hasResource(room: Room, playerId: string, key: string, amount = 1): boolean {
    return hasResourceFor(room, playerId, key, amount);
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

  /** Списывает ячейку заклинания монстра из статблока; без настроенных ячеек — без учёта. */
  spendTokenSpellSlot(room: Room, token: Token, level: number): boolean {
    const sc = token.statblock?.spellcasting;
    if (!sc) return false;
    if (!sc.slots?.length) return true;
    const slot = sc.slots.find((s) => s.level === level && s.current > 0);
    if (!slot) return false;
    slot.current -= 1;
    this.saveSoon(room);
    return true;
  }

  /** id игрока-контролёра токена (персонажа/призыва). */
  controllerOfToken(room: Room, token: Token): string | undefined {
    return controllerIdOfToken(room, token);
  }

  /** Защиты токена: у персонажа — из листа, у монстра — из токена, плюс эффекты. */
  damageDefensesForToken(room: Room, token: Token): DamageDefense[] {
    const controllerId = this.controllerOfToken(room, token);
    const sheet = controllerId ? room.sheets[controllerId] : undefined;
    const base = sheet ? sheet.damageDefenses ?? [] : token.damageDefenses ?? [];
    const extra = effectDefenses(token.effects);
    return extra.length ? [...base, ...extra] : base;
  }

  /** Слагаемые/кости/режим спасброска токена: базовый бонус, эффекты, истощение. */
  savePartsForToken(room: Room, token: Token, ability: AbilityKey): RollParts {
    const parts = saveRollParts(token.effects, ability, this.abilitiesForToken(room, token));
    parts.flat += this.saveBonusForToken(room, token, ability) + exhaustionRollPenalty(token.conditions);
    return parts;
  }

  /**
   * Бросок спасброска токена против СЛ. `conditionsAutoFail` — учитывать
   * авто-провал от состояний (парализован и т.п. для Силы/Ловкости).
   */
  rollSave(
    room: Room,
    token: Token,
    ability: AbilityKey,
    dc: number,
    opts: { conditionsAutoFail?: boolean } = {}
  ): { roll: DiceRollResult; success: boolean } {
    const parts = this.savePartsForToken(room, token, ability);
    const roll = rollDice(withAdvantage(withRollParts('d20', parts), parts.mode));
    const autoFail = opts.conditionsAutoFail === true && autoFailSave(token.conditions, ability);
    return { roll, success: !autoFail && roll.total >= dc };
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
        const { roll, success } = this.rollSave(room, token, cond.save.ability, cond.save.dc);
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

  /** Накладывает эффект на токен и связанные с ним состояния. */
  applyEffect(room: Room, token: Token, effect: EffectInstance) {
    token.effects = [...token.effects.filter((e) => e.id !== effect.id), effect];
    this.changeMaxHp(room, token, effect, 1);
    if (effect.conditions?.length) {
      for (const key of effect.conditions) {
        if (token.conditions.some((c) => c.effectId === effect.id && c.key === key)) continue;
        token.conditions.push({
          key,
          name: conditionName(key),
          rounds: null,
          sourceId: effect.sourceId,
          sourceKey: effect.sourceKey,
          effectId: effect.id,
        });
      }
    }
    this.saveSoon(room);
  }

  /** Снимает эффект и его состояния с токена; false — эффекта не было. */
  removeEffect(room: Room, token: Token, effectId: string): boolean {
    const effect = token.effects.find((e) => e.id === effectId);
    if (!effect) return false;
    this.changeMaxHp(room, token, effect, -1);
    token.effects = token.effects.filter((e) => e.id !== effectId);
    token.conditions = token.conditions.filter((c) => c.effectId !== effectId);
    this.saveSoon(room);
    return true;
  }

  /**
   * Применяет/откатывает бонус к максимуму HP от эффекта (Aid и подобные):
   * у персонажа — в ресурсах (с зеркалом в токены), у монстра — в токене.
   */
  changeMaxHp(room: Room, token: Token, effect: EffectInstance, sign: 1 | -1) {
    const bonus = modifiedValue(0, [effect], 'maxHp', {}, this.abilitiesForToken(room, token));
    if (!bonus) return;
    const controllerId = this.controllerOfToken(room, token);
    const res = controllerId ? room.resources[controllerId] : undefined;
    if (controllerId && res && res.hp.max > 0) {
      res.hp.max = Math.max(1, res.hp.max + sign * bonus);
      if (sign > 0) res.hp.current += bonus;
      else res.hp.current = Math.min(res.hp.current, res.hp.max);
      this.syncSheetToTokens(room, controllerId);
    } else {
      const base = statNumber(token.hpMax);
      if (base > 0) token.hpMax = String(Math.max(1, base + sign * bonus));
      if (sign > 0) token.hpCurrent += bonus;
      else token.hpCurrent = Math.min(token.hpCurrent, statNumber(token.hpMax));
    }
  }

  /**
   * Тик эффектов в начале/конце хода носителя: повторные спасброски, раунды,
   * «до конца хода». Эффекты `endOfTurn` источника снимаются со всех токенов.
   */
  tickEffects(
    room: Room,
    token: Token,
    phase: 'start' | 'end'
  ): { changed: boolean; saves: { name: string; roll: DiceRollResult; success: boolean }[]; removed: string[] } {
    const saves: { name: string; roll: DiceRollResult; success: boolean }[] = [];
    const removed: string[] = [];
    let changed = false;

    const kept = token.effects.filter((effect) => {
      let remove = false;
      const d = effect.duration;
      if (d.type === 'untilSave' && d.timing === phase) {
        const { roll, success } = this.rollSave(room, token, d.ability, d.dc);
        saves.push({ name: effect.name, roll, success });
        if (success) remove = true;
      }
      if (!remove && d.type === 'rounds' && phase === 'start') {
        d.rounds -= 1;
        changed = true;
        if (d.rounds <= 0) {
          remove = true;
          removed.push(effect.name);
        }
      }
      if (!remove && d.type === 'endOfTurn' && phase === 'start') {
        if (d.of === 'target' || effect.sourceId === token.id) {
          remove = true;
          removed.push(effect.name);
        }
      }
      if (remove) {
        this.changeMaxHp(room, token, effect, -1);
        token.conditions = token.conditions.filter((c) => c.effectId !== effect.id);
        changed = true;
      }
      return !remove;
    });
    token.effects = kept;

    for (const map of room.scene.maps) {
      for (const other of map.tokens) {
        if (other === token) continue;
        const keptOther = other.effects.filter((effect) => {
          if (effect.duration.type === 'endOfTurn' && effect.duration.of === 'source' && effect.sourceId === token.id) {
            this.changeMaxHp(room, other, effect, -1);
            other.conditions = other.conditions.filter((c) => c.effectId !== effect.id);
            removed.push(effect.name);
            changed = true;
            return false;
          }
          return true;
        });
        other.effects = keptOther;
      }
    }

    if (changed) this.saveSoon(room);
    return { changed, saves, removed };
  }

  /** Эффекты концентрации существа-источника на всех картах. */
  concentratingEffectsOf(room: Room, token: Token): EffectInstance[] {
    const out: EffectInstance[] = [];
    for (const map of room.scene.maps) {
      for (const target of map.tokens) {
        out.push(...concentratingEffects(target.effects, token.id));
      }
    }
    return out;
  }

  /** Снимает все эффекты концентрации заклинателя; возвращает изменённые токены. */
  clearConcentration(room: Room, sourceId: string): { mapId: string; token: Token }[] {
    const changed: { mapId: string; token: Token }[] = [];
    for (const map of room.scene.maps) {
      for (const token of map.tokens) {
        const removedIds = new Set(
          token.effects.filter((e) => e.concentration && e.sourceId === sourceId).map((e) => e.id)
        );
        if (!removedIds.size) continue;
        for (const effect of token.effects) {
          if (removedIds.has(effect.id)) this.changeMaxHp(room, token, effect, -1);
        }
        token.effects = token.effects.filter((e) => !removedIds.has(e.id));
        token.conditions = token.conditions.filter((c) => !(c.effectId && removedIds.has(c.effectId)));
        changed.push({ mapId: map.id, token });
      }
      for (const entry of map.combat.entries) {
        const turn = map.combat.turns[entry.id];
        if (turn?.concentrationId && entry.tokenId === sourceId) turn.concentrationId = null;
      }
    }
    if (changed.length) this.saveSoon(room);
    return changed;
  }

  /** Запоминает эффект концентрации в состоянии хода заклинателя. */
  setConcentration(room: Room, mapId: string, token: Token, effectId: string) {
    const turn = this.turnForToken(room, mapId, token);
    if (!turn) return;
    turn.concentrationId = effectId;
    this.saveSoon(room);
  }

  /**
   * Долгий отдых: снимает с токенов персонажа все эффекты (с откатом maxHp),
   * их состояния и концентрацию (в т.ч. на других токенах). Возвращает изменения.
   */
  clearEffectsForPlayer(room: Room, playerId: string): { mapId: string; token: Token }[] {
    const libId = room.controllers[playerId];
    if (!libId) return [];
    const changed = new Map<string, { mapId: string; token: Token }>();
    for (const map of room.scene.maps) {
      for (const token of map.tokens) {
        if (token.libraryItemId !== libId) continue;
        for (const c of this.clearConcentration(room, token.id)) changed.set(c.token.id, c);
        if (!token.effects.length) continue;
        const removedIds = new Set(token.effects.map((e) => e.id));
        for (const effect of token.effects) this.changeMaxHp(room, token, effect, -1);
        token.effects = [];
        token.conditions = token.conditions.filter((c) => !(c.effectId && removedIds.has(c.effectId)));
        changed.set(token.id, { mapId: map.id, token });
      }
    }
    if (changed.size) this.saveSoon(room);
    return [...changed.values()];
  }

  /**
   * Проверка концентрации при получении урона: СЛ 10 или половина урона.
   * При провале эффекты концентрации снимаются. null — концентрации нет.
   */
  concentrationCheck(
    room: Room,
    token: Token,
    damage: number
  ):
    | {
        dc: number;
        roll: DiceRollResult;
        success: boolean;
        names: string[];
        changed: { mapId: string; token: Token }[];
      }
    | null {
    const active = this.concentratingEffectsOf(room, token);
    if (!active.length) return null;
    const dc = concentrationDc(damage);
    const { roll, success } = this.rollSave(room, token, 'con', dc);
    const names = [...new Set(active.map((e) => e.name))];
    const changed = success ? [] : this.clearConcentration(room, token.id);
    return { dc, roll, success, names, changed };
  }

  /** Фиксирует потраченное передвижение бойца (предупреждение, не блокировка). */
  setMovement(room: Room, mapId: string, tokenId: string, used: number, diagonals?: number) {
    Combat.setMovement(this, room, mapId, tokenId, used, diagonals);
  }

  ensureActiveTurn(room: Room, mapId: string) {
    Combat.ensureActiveTurn(room, mapId);
  }

  addTokenToCombat(room: Room, mapId: string, token: Token) {
    Combat.addTokenToCombat(this, room, mapId, token);
  }

  addCombatToken(room: Room, mapId: string, tokenId: string): boolean {
    return Combat.addCombatToken(this, room, mapId, tokenId);
  }

  addMapTokensToCombat(room: Room, mapId: string) {
    Combat.addMapTokensToCombat(this, room, mapId);
  }

  removeTokenFromCombat(room: Room, mapId: string, tokenId: string) {
    Combat.removeTokenFromCombat(this, room, mapId, tokenId);
  }

  removeCombatant(room: Room, mapId: string, id: string) {
    Combat.removeCombatant(this, room, mapId, id);
  }

  updateCombatant(
    room: Room,
    mapId: string,
    id: string,
    patch: { name?: string; initiative?: number; bonus?: string }
  ) {
    Combat.updateCombatant(this, room, mapId, id, patch);
  }

  moveCombatant(room: Room, mapId: string, id: string, toIndex: number) {
    Combat.moveCombatant(this, room, mapId, id, toIndex);
  }

  rollCombat(room: Room, mapId: string, id?: string) {
    Combat.rollCombat(this, room, mapId, id);
  }

  renameCombatantByToken(room: Room, mapId: string, tokenId: string, name: string) {
    Combat.renameCombatantByToken(this, room, mapId, tokenId, name);
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
    this.repo.save(room.code, () => toPersistedRoom(room));
  }

  /** Записать все отложенные комнаты (остановка сервера). */
  flushSaves() {
    return this.repo.flush();
  }

  /** Включает/выключает режим тестов (права ведущего у всех игроков). */
  setTestMode(room: Room, enabled: boolean) {
    if (room.testMode === enabled) return;
    room.testMode = enabled;
    this.saveSoon(room);
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
      testMode: room.testMode === true,
    };
  }
}
