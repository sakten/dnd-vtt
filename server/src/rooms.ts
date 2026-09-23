import { randomBytes } from 'node:crypto';
import type {
  ActionCost,
  AbilityKey,
  ChatMessage,
  CombatState,
  ConditionKey,
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
import { DEFAULT_GRID } from 'shared';
import { createRoomRepository, removeRoomUploadDir, type RoomRepository } from './store';
import { toPersistedRoom, type Room } from './roomTypes';
import { hydrateRoom } from './roomNormalize';
import * as Actor from './room/actor';
import * as Combat from './room/combat';
import * as Effects from './room/effects';
import * as Resources from './room/resources';
import * as Tokens from './room/tokens';
import { controllerIdOfToken, findTokenById, hasResourceFor, locateToken, tokenById } from './room/helpers';

export {
  controllerIdOfItem,
  controllerIdOfToken,
  gridSizeOfMap,
  gridSizeOfToken,
  hasResourceFor,
  sheetOfToken,
  withinFeet,
} from './room/helpers';

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
      optionalRules: { surrounded: false },
    };
    this.rooms.set(code, room);
    return room;
  }

  findMap(room: Room, id: string): MapInfo | null {
    return Tokens.findMap(room, id);
  }

  private generateCode(): string {
    for (;;) {
      const bytes = randomBytes(12);
      const code = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
      if (!this.rooms.has(code)) return code;
    }
  }

  addMap(room: Room, input: { name: string; url: string; width: number; height: number }): MapInfo {
    return Tokens.addMap(this, room, input);
  }

  removeMap(room: Room, id: string) {
    Tokens.removeMap(this, room, id);
  }

  renameMap(room: Room, id: string, name: string) {
    Tokens.renameMap(this, room, id, name);
  }

  addLibraryItem(room: Room, input: TokenFields): LibraryItem {
    return Tokens.addLibraryItem(this, room, input);
  }

  updateLibraryItem(room: Room, id: string, patch: Partial<LibraryItem>, includeDm: boolean) {
    Tokens.updateLibraryItem(this, room, id, patch, includeDm);
  }

  removeLibraryItem(room: Room, id: string) {
    Tokens.removeLibraryItem(this, room, id);
  }

  addMessage(room: Room, message: ChatMessage) {
    Tokens.addMessage(this, room, message);
  }

  addToken(room: Room, mapId: string, item: LibraryItem, x: number, y: number, ownerId: string): Token | null {
    return Tokens.addToken(this, room, mapId, item, x, y, ownerId);
  }

  characterName(room: Room, mapId: string, playerId: string): string {
    return Tokens.characterName(room, mapId, playerId);
  }

  controlsToken(room: Room, mapId: string, playerId: string, token: Token): boolean {
    return Tokens.controlsToken(room, mapId, playerId, token);
  }

  clearControllersForItem(room: Room, libraryItemId: string): string[] {
    return Tokens.clearControllersForItem(this, room, libraryItemId);
  }

  findToken(room: Room, mapId: string, id: string) {
    return Tokens.findToken(room, mapId, id);
  }

  removeToken(room: Room, mapId: string, id: string) {
    Tokens.removeToken(this, room, mapId, id);
  }

  clearLocks(room: Room, playerId: string) {
    Tokens.clearLocks(room, playerId);
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

  endTurn(room: Room, mapId: string): string[] {
    return Combat.endTurn(this, room, mapId);
  }

  advanceTurn(room: Room, mapId: string, delta: number): string[] {
    return Combat.advanceTurn(this, room, mapId, delta);
  }

  setTurn(room: Room, mapId: string, target: { id?: string; index?: number }) {
    Combat.setTurn(this, room, mapId, target);
  }

  beginMovementTurn(room: Room, mapId: string, entryId: string) {
    Combat.beginMovementTurn(this, room, mapId, entryId);
  }

  setTurnPointer(room: Room, mapId: string, entryId: string) {
    Combat.setTurnPointer(this, room, mapId, entryId);
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

  abilityCheckExprForToken(room: Room, token: Token, ability: AbilityKey, skill?: string): string {
    return Combat.abilityCheckExprForToken(room, token, ability, skill);
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

  canAttack(room: Room, mapId: string, token: Token, opts: { unarmed?: boolean } = {}): boolean {
    return Combat.canAttack(room, mapId, token, opts);
  }

  consumeAttack(room: Room, mapId: string, token: Token, opts: { unarmed?: boolean; loading?: boolean } = {}): boolean {
    return Combat.consumeAttack(this, room, mapId, token, opts);
  }

  spendSlot(room: Room, mapId: string, token: Token, slot: ActionCost): boolean {
    return Combat.spendSlot(this, room, mapId, token, slot);
  }

  spendLegendary(room: Room, mapId: string, token: Token, amount: number): boolean {
    return Combat.spendLegendary(this, room, mapId, token, amount);
  }

  redistributeSlots(room: Room, mapId: string): void {
    Combat.redistributeSlots(room, mapId);
  }

  startAbilityCooldown(room: Room, mapId: string, token: Token, actionId: string, turns: number): void {
    Combat.startAbilityCooldown(this, room, mapId, token, actionId, turns);
  }

  /** Есть ли у игрока ресурс в нужном количестве. */
  hasResource(room: Room, playerId: string, key: string, amount = 1): boolean {
    return hasResourceFor(room, playerId, key, amount);
  }

  /** Списывает ресурс игрока; false — если ресурса нет или не хватает. */
  spendResource(room: Room, playerId: string, key: string, amount = 1): boolean {
    return Resources.spendResource(this, room, playerId, key, amount);
  }

  /** Списывает ячейку заклинания круга (обычную, иначе pact). null — нет ячейки. */
  spendSpellSlot(room: Room, playerId: string, level: number): 'slot' | 'pact' | null {
    return Resources.spendSpellSlot(this, room, playerId, level);
  }

  /** Списывает ячейку заклинания монстра из статблока; без настроенных ячеек — без учёта. */
  spendTokenSpellSlot(room: Room, token: Token, level: number): boolean {
    return Resources.spendTokenSpellSlot(this, room, token, level);
  }

  /** id игрока-контролёра токена (персонажа/призыва). */
  controllerOfToken(room: Room, token: Token): string | undefined {
    return controllerIdOfToken(room, token);
  }

  damageDefensesForToken(room: Room, token: Token): DamageDefense[] {
    return Effects.damageDefensesForToken(room, token);
  }

  savePartsForToken(room: Room, token: Token, ability: AbilityKey): RollParts {
    return Effects.savePartsForToken(room, token, ability);
  }
  rollSave(
    room: Room,
    token: Token,
    ability: AbilityKey,
    dc: number,
    opts: { conditionsAutoFail?: boolean; advantage?: boolean; condition?: ConditionKey; magical?: boolean } = {}
  ): { roll: DiceRollResult; success: boolean } {
    return Effects.rollSave(room, token, ability, dc, opts);
  }

  saveBonusForToken(room: Room, token: Token, ability: AbilityKey): number {
    return Effects.saveBonusForToken(room, token, ability);
  }

  tickConditions(
    room: Room,
    token: Token,
    phase: 'start' | 'end'
  ): {
    changed: boolean;
    saves: { name: string; roll: DiceRollResult; success: boolean }[];
    removed: { key: ConditionKey; name: string }[];
  } {
    return Effects.tickConditions(this, room, token, phase);
  }

  applyEffect(room: Room, token: Token, effect: EffectInstance) {
    Effects.applyEffect(this, room, token, effect);
  }

  removeEffect(room: Room, token: Token, effectId: string): boolean {
    return Effects.removeEffect(this, room, token, effectId);
  }

  changeMaxHp(room: Room, token: Token, effect: EffectInstance, sign: 1 | -1) {
    Effects.changeMaxHp(this, room, token, effect, sign);
  }

  grantTempHp(room: Room, token: Token, amount: number) {
    Effects.grantTempHp(this, room, token, amount);
  }

  tickEffects(
    room: Room,
    token: Token,
    phase: 'start' | 'end'
  ): {
    changed: boolean;
    saves: { name: string; roll: DiceRollResult; success: boolean }[];
    removed: string[];
    escalated: { name: string; condition: ConditionKey }[];
    pruned: { mapId: string; token: Token }[];
  } {
    return Effects.tickEffects(this, room, token, phase);
  }

  concentratingEffectsOf(room: Room, token: Token): EffectInstance[] {
    return Effects.concentratingEffectsOf(room, token);
  }

  pruneConcentration(room: Room, sourceId: string, sourceKey: string): { mapId: string; token: Token }[] {
    return Effects.pruneConcentration(this, room, sourceId, sourceKey);
  }

  clearConcentration(room: Room, sourceId: string): { mapId: string; token: Token }[] {
    return Effects.clearConcentration(this, room, sourceId);
  }

  setConcentration(room: Room, mapId: string, token: Token, effectId: string) {
    Effects.setConcentration(this, room, mapId, token, effectId);
  }

  clearEffectsForPlayer(room: Room, playerId: string): { mapId: string; token: Token }[] {
    return Effects.clearEffectsForPlayer(this, room, playerId);
  }

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
    return Effects.concentrationCheck(this, room, token, damage);
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
  addTokenToCombatAfter(room: Room, mapId: string, token: Token, afterTokenId: string) {
    Combat.addTokenToCombatAfter(this, room, mapId, token, afterTokenId);
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

  renameCombatantByToken(room: Room, mapId: string, tokenId: string, name: string, imageUrl?: string) {
    Combat.renameCombatantByToken(this, room, mapId, tokenId, name, imageUrl);
  }

  /** Токены персонажа игрока на всех картах (статы резолвит `actorStats`). */
  characterTokens(room: Room, playerId: string): { mapId: string; token: Token }[] {
    return Resources.characterTokens(room, playerId);
  }

  /** Замораживает статы персонажа в его токены при отвязке (токен становится обычным). */
  freezeCharacterTokens(room: Room, playerId: string): { mapId: string; token: Token }[] {
    return Actor.freezeCharacterTokens(room, playerId);
  }

  /** То же для всех игроков предмета (удаление предмета, снятие галки «токен игрока»). */
  freezeCharacterTokensOfItem(room: Room, libraryItemId: string): { mapId: string; token: Token }[] {
    return Actor.freezeCharacterTokensOfItem(room, libraryItemId);
  }

  /** Помечает все токены персонажа мёртвыми/живыми (по итогу death-сейвов). */
  markControlledTokensDead(room: Room, playerId: string, dead: boolean): { mapId: string; token: Token }[] {
    return Effects.markControlledTokensDead(this, room, playerId, dead);
  }

  /**
   * Изменяет HP токена с учётом канона: у персонажа HP живёт в PlayerResources
   * и зеркалится в токены, у монстров — прямо в токене. HP может уходить в минус.
   * Лечение сбрасывает death-сейвы (но не оживляет мёртвых); урон лежачему добавляет
   * провал (крит — 2); HP ≤ 0 → «Без сознания»/«Мёртв». Возвращает изменившиеся токены.
   */
  adjustTokenHp(
    room: Room,
    mapId: string,
    token: Token,
    delta: number,
    opts: { crit?: boolean } = {}
  ): { mapId: string; token: Token }[] {
    return Effects.adjustTokenHp(this, room, mapId, token, delta, opts);
  }

  /** Revivify: вернуть мёртвого к жизни с 1 HP. */
  reviveToken(room: Room, mapId: string, token: Token): { mapId: string; token: Token }[] {
    return Effects.reviveToken(this, room, mapId, token);
  }

  /** Spare the Dying: цель на 0 HP становится стабильной. */
  stabilizeToken(room: Room, token: Token): { mapId: string; token: Token }[] {
    return Effects.stabilizeToken(this, room, token);
  }

  /** Ручное снятие «Мёртв» ДМом: сброс death-сейвов, лежачие — «Без сознания». */
  clearDeadState(room: Room, playerId: string): { mapId: string; token: Token }[] {
    return Effects.clearDeadState(this, room, playerId);
  }

  saveSoon(room: Room) {
    this.repo.save(room.code, () => toPersistedRoom(room), () => room.chat);
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

  /** Наружу — только `RoomState`: рантайм-поля комнаты (листы, ресурсы, nextZ) отсекаются. */
  toState(room: Room): RoomState {
    const { sheets, resources, players, nextZ: _nextZ, ...rest } = room;
    return {
      ...rest,
      players: players.map((p) => {
        const res = resources[p.id];
        const sheet = sheets[p.id];
        return {
          id: p.id,
          name: p.name,
          role: p.role,
          isConnected: p.isConnected,
          rollAnimChance: p.rollAnimChance ?? 0,
          hpCurrent: res ? res.hp.current : null,
          hpMax: res ? res.hp.max : null,
          classKey: sheet?.classes?.[0]?.className ?? null,
        };
      }),
    };
  }
}
