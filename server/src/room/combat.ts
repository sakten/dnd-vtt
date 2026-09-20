import {
  abilityMod,
  actionSlotAvailable,
  attacksPerAction,
  bonusPart,
  DEFAULT_AC,
  DEFAULT_SPEED,
  emptyCombatState,
  emptyTurnState,
  exhaustionSpeedPenalty,
  minLegendaryCost,
  modifiedValue,
  restrictionsFor,
  rollDice,
  type AbilityKey,
  type ActionCost,
  type CombatState,
  type DiceRollResult,
  type InitiativeEntry,
  type Token,
  type TurnState,
} from 'shared';
import type { Room } from '../roomTypes';
import { actorStats } from './actor';
import { controllerIdOfToken, findTokenById } from './helpers';

/** Зависимости боевого домена: сохранение комнаты. */
export interface CombatDeps {
  saveSoon(room: Room): void;
}

function findToken(room: Room, mapId: string, id: string): Token | null {
  return room.scene.maps.find((m) => m.id === mapId)?.tokens.find((t) => t.id === id) ?? null;
}

export function combatOf(room: Room, mapId: string): CombatState | null {
  return room.scene.maps.find((m) => m.id === mapId)?.combat ?? null;
}

function initiativeBonusFor(room: Room, token: Token): string {
  return actorStats(room, token).initiativeBonus;
}

function rollInit(bonus: string): DiceRollResult {
  const b = bonus.trim();
  const expression = !b ? 'd20' : /^[+-]/.test(b) ? `d20${b}` : `d20+${b}`;
  try {
    return rollDice(expression);
  } catch {
    return rollDice('d20');
  }
}

function makeEntry(room: Room, token: Token): InitiativeEntry {
  const bonus = initiativeBonusFor(room, token);
  const roll = rollInit(bonus);
  return {
    id: crypto.randomUUID(),
    tokenId: token.id,
    name: token.name,
    imageUrl: token.imageUrl,
    initiative: roll.total,
    bonus,
    roll,
  };
}

function reRollEntry(room: Room, entry: InitiativeEntry) {
  const token = entry.tokenId ? findTokenById(room, entry.tokenId) : null;
  const bonus = token ? initiativeBonusFor(room, token) : entry.bonus;
  const roll = rollInit(bonus);
  entry.bonus = bonus;
  entry.initiative = roll.total;
  entry.roll = roll;
}

function slotEntry(owner: InitiativeEntry): InitiativeEntry {
  return {
    id: crypto.randomUUID(),
    tokenId: owner.tokenId,
    name: owner.name,
    imageUrl: owner.imageUrl,
    initiative: owner.initiative,
    bonus: owner.bonus,
    legendaryOwnerId: owner.id,
  };
}

/** Доп. записи в инициативе: по одной после чужого хода, не больше легендарных. */
function distributeLegendarySlots(room: Room, combat: CombatState): void {
  const mains = combat.entries.filter((e) => !e.legendaryOwnerId);
  const pending = new Map<string, number>();
  for (const entry of mains) {
    const token = entry.tokenId ? findTokenById(room, entry.tokenId) : null;
    const max = token?.statblock?.legendary?.max ?? 0;
    const others = mains.filter((o) => o.tokenId !== entry.tokenId).length;
    const slots = Math.min(max, others);
    if (slots > 0) pending.set(entry.id, slots);
  }
  if (!pending.size) {
    combat.entries = mains;
    return;
  }
  const after = new Map<string, InitiativeEntry[]>();
  for (const entry of mains) {
    for (const [ownerId, left] of pending) {
      if (left <= 0) continue;
      const owner = mains.find((e) => e.id === ownerId);
      if (!owner || entry.tokenId === owner.tokenId) continue;
      const list = after.get(entry.id) ?? [];
      list.push(slotEntry(owner));
      after.set(entry.id, list);
      pending.set(ownerId, left - 1);
    }
  }
  const out: InitiativeEntry[] = [];
  for (const entry of mains) {
    out.push(entry);
    out.push(...(after.get(entry.id) ?? []));
  }
  combat.entries = out;
}

function redistributeLegendarySlots(room: Room, combat: CombatState): void {
  combat.entries = combat.entries.filter((e) => !e.legendaryOwnerId);
  distributeLegendarySlots(room, combat);
}

/** Пересобирает легендарные слоты после правки статблока в бою. */
export function redistributeSlots(room: Room, mapId: string): void {
  const combat = combatOf(room, mapId);
  if (!combat?.active) return;
  const activeId = combat.entries[combat.currentIndex]?.id;
  redistributeLegendarySlots(room, combat);
  restoreActive(combat, activeId);
}

/** Доступен ли легендарный слот: у владельца хватает пула на самую дешёвую способность. */
function legendarySlotUsable(room: Room, combat: CombatState, entry: InitiativeEntry): boolean {
  const ownerId = entry.legendaryOwnerId;
  if (!ownerId) return true;
  const owner = combat.turns[ownerId];
  if (!owner) return false;
  const token = entry.tokenId ? findTokenById(room, entry.tokenId) : null;
  if (!token) return false;
  const min = minLegendaryCost(token.statblock?.actions);
  return owner.legendaryRemaining > 0 && owner.legendaryRemaining >= min;
}

export function startCombat(m: CombatDeps, room: Room, mapId: string) {
  const map = room.scene.maps.find((mm) => mm.id === mapId);
  if (!map) return;
  const entries = map.tokens.map((t) => makeEntry(room, t));
  entries.sort((a, b) => b.initiative - a.initiative);
  map.combat = {
    ...emptyCombatState(),
    active: true,
    entries,
    round: entries.length ? 1 : 0,
    currentIndex: entries.length ? 0 : -1,
  };
  distributeLegendarySlots(room, map.combat);
  if (map.combat.entries.length) beginTurn(room, mapId, map.combat.entries[0]!.id);
  m.saveSoon(room);
}

export function endCombat(m: CombatDeps, room: Room, mapId: string) {
  const map = room.scene.maps.find((mm) => mm.id === mapId);
  if (!map) return;
  map.combat = emptyCombatState();
  m.saveSoon(room);
}

export function clearCombat(m: CombatDeps, room: Room, mapId: string) {
  const map = room.scene.maps.find((mm) => mm.id === mapId);
  if (!map) return;
  map.combat = { ...emptyCombatState(), active: true };
  m.saveSoon(room);
}

/** Максимум передвижения и легендарных действий для записи инициативы. */
function turnResources(
  room: Room,
  entry: InitiativeEntry
): { speed: number; legendaryMax: number; extraActions: number; extraBonusActions: number } {
  const token = entry.tokenId ? findTokenById(room, entry.tokenId) : null;
  if (!token) return { speed: DEFAULT_SPEED, legendaryMax: 0, extraActions: 0, extraBonusActions: 0 };
  const stats = actorStats(room, token);
  const afterExhaustion = Math.max(0, stats.speed + exhaustionSpeedPenalty(token.conditions));
  return {
    speed: Math.max(0, modifiedValue(afterExhaustion, token.effects, 'speed', {}, stats.abilities)),
    legendaryMax: token.statblock?.legendary?.max ?? 0,
    extraActions: Math.max(0, modifiedValue(0, token.effects, 'extraActions', {}, stats.abilities)),
    extraBonusActions: Math.max(0, modifiedValue(0, token.effects, 'extraBonusActions', {}, stats.abilities)),
  };
}

/** Начинает/сбрасывает ход записи, сохраняя концентрацию заклинателя. */
export function beginTurn(room: Room, mapId: string, entryId: string) {
  const combat = combatOf(room, mapId);
  if (!combat) return;
  const entry = combat.entries.find((e) => e.id === entryId);
  if (!entry || entry.legendaryOwnerId) return;
  const { speed, legendaryMax, extraActions, extraBonusActions } = turnResources(room, entry);
  const prev = combat.turns[entry.id];
  const abilityCooldowns: Record<string, number> = {};
  for (const [key, value] of Object.entries(prev?.abilityCooldowns ?? {})) {
    const next = value - 1;
    if (next > 0) abilityCooldowns[key] = next;
  }
  combat.turns[entry.id] = {
    ...emptyTurnState(speed),
    extraActions,
    extraBonusActions,
    legendaryRemaining: legendaryMax,
    legendaryMax,
    concentrationId: prev?.concentrationId ?? null,
    ...(Object.keys(abilityCooldowns).length ? { abilityCooldowns } : {}),
  };
}

/** Завершает текущий ход, переходя к следующему по инициативе; возвращает имена пропущенных слотов. */
export function endTurn(m: CombatDeps, room: Room, mapId: string): string[] {
  return advanceTurn(m, room, mapId, 1);
}

export function advanceTurn(m: CombatDeps, room: Room, mapId: string, delta: number): string[] {
  const combat = combatOf(room, mapId);
  if (!combat || !combat.active || combat.entries.length === 0) return [];
  const n = combat.entries.length;
  let idx = combat.currentIndex < 0 ? (delta > 0 ? 0 : n - 1) : combat.currentIndex + delta;
  let guard = 0;
  const skipped: string[] = [];
  while (guard++ < n * 2) {
    if (idx >= n) {
      idx -= n;
      combat.round = Math.max(1, combat.round) + 1;
    } else if (idx < 0) {
      idx += n;
      combat.round = Math.max(1, combat.round - 1);
    }
    const entry = combat.entries[idx]!;
    if (legendarySlotUsable(room, combat, entry)) break;
    if (entry.legendaryOwnerId) skipped.push(entry.name);
    idx += delta;
  }
  combat.round = Math.max(1, combat.round);
  combat.currentIndex = idx;
  beginTurn(room, mapId, combat.entries[idx]!.id);
  m.saveSoon(room);
  return skipped;
}

/** DM задаёт активную запись по id или индексу. */
export function setTurn(m: CombatDeps, room: Room, mapId: string, target: { id?: string; index?: number }) {
  const combat = combatOf(room, mapId);
  if (!combat || combat.entries.length === 0) return;
  let idx = -1;
  if (typeof target.id === 'string') idx = combat.entries.findIndex((e) => e.id === target.id);
  else if (typeof target.index === 'number') idx = Math.round(target.index);
  if (idx < 0 || idx >= combat.entries.length) return;
  // Ручной перевод хода отменяет очередь движения (Мантия вдохновения).
  combat.moveQueue = undefined;
  combat.moveReturn = null;
  combat.round = Math.max(1, combat.round);
  combat.currentIndex = idx;
  beginTurn(room, mapId, combat.entries[idx]!.id);
  m.saveSoon(room);
}

/** Ход «только движение» (Мантия вдохновения): действия/бонусы/реакции недоступны. */
export function beginMovementTurn(m: CombatDeps, room: Room, mapId: string, entryId: string) {
  const combat = combatOf(room, mapId);
  const idx = combat ? combat.entries.findIndex((e) => e.id === entryId) : -1;
  if (!combat || idx < 0) return;
  combat.currentIndex = idx;
  beginTurn(room, mapId, entryId);
  const turn = combat.turns[entryId];
  if (!turn) return;
  turn.movementOnly = true;
  turn.actionUsed = true;
  turn.bonusActionUsed = true;
  turn.reactionUsed = true;
  turn.attacksRemaining = 0;
  turn.flurryAttacks = 0;
  turn.extraActions = 0;
  turn.extraBonusActions = 0;
  turn.legendaryRemaining = 0;
  m.saveSoon(room);
}

/** Перевод указателя хода без сброса состояния (возврат к прерванному ходу). */
export function setTurnPointer(m: CombatDeps, room: Room, mapId: string, entryId: string) {
  const combat = combatOf(room, mapId);
  const idx = combat ? combat.entries.findIndex((e) => e.id === entryId) : -1;
  if (!combat || idx < 0) return;
  combat.currentIndex = idx;
  m.saveSoon(room);
}

/** Число атак за действие: Extra Attack по листу или multiattack монстра. */
export function attacksPerToken(room: Room, token: Token): number {
  const controllerId = controllerIdOfToken(room, token);
  const sheet = controllerId ? room.sheets[controllerId] : undefined;
  if (sheet) return attacksPerAction(sheet.classes);
  return Math.max(1, token.statblock?.multiattack ?? 1);
}

/** Эффективная скорость токена: лист/статблок + бонусы и множители эффектов. */
export function tokenSpeed(room: Room, token: Token): number {
  const stats = actorStats(room, token);
  return Math.max(0, modifiedValue(stats.speed, token.effects, 'speed', {}, stats.abilities));
}

/** Характеристики токена: из листа персонажа либо из статблока монстра. */
export function abilitiesForToken(room: Room, token: Token): Record<AbilityKey, number> | undefined {
  return actorStats(room, token).abilities;
}

/** Эффективный AC токена с учётом эффектов (Shield, Mage Armor, Barkskin…). */
export function acForToken(room: Room, token: Token): number {
  const stats = actorStats(room, token);
  return modifiedValue(stats.ac > 0 ? stats.ac : DEFAULT_AC, token.effects, 'ac', {}, stats.abilities);
}

/** Модификатор характеристики токена: из листа персонажа или статблока монстра. */
export function abilityModForToken(room: Room, token: Token, ability: AbilityKey): number {
  return abilityMod(actorStats(room, token).abilities?.[ability] ?? 10);
}

/** Формула проверки характеристики с владением/экспертизой (Выпутаться: STR/Athletics). */
export function abilityCheckExprForToken(
  room: Room,
  token: Token,
  ability: AbilityKey,
  skill?: string
): string {
  const mod = abilityModForToken(room, token, ability);
  const controllerId = controllerIdOfToken(room, token);
  const sheet = controllerId ? room.sheets[controllerId] : undefined;
  const level = skill && sheet ? sheet.skills[skill] ?? 0 : 0;
  const suffix = mod >= 0 ? `+${mod}` : `${mod}`;
  return `d20${suffix}${sheet && level > 0 ? bonusPart(sheet.proficiencyBonus, level) : ''}`;
}

/** Добавляет передвижение на текущий ход (Рывок). */
export function grantExtraMovement(m: CombatDeps, room: Room, mapId: string, token: Token, feet: number) {
  const turn = turnForToken(room, mapId, token);
  if (!turn) return;
  turn.movementMax += Math.max(0, Math.round(feet));
  m.saveSoon(room);
}

/** Ресурсы хода токена, если он сейчас активен в бою карты; иначе null. */
export function turnForToken(room: Room, mapId: string, token: Token): TurnState | null {
  const combat = combatOf(room, mapId);
  if (!combat?.active) return null;
  const active = combat.entries[combat.currentIndex];
  if (!active || active.tokenId !== token.id) return null;
  return combat.turns[active.id] ?? null;
}

/**
 * Состояние хода записи инициативы токена, даже если он не активен (реакции
 * в чужой ход). Создаёт состояние лениво, если запись есть, а ход не начинался.
 */
export function turnStateFor(room: Room, mapId: string, token: Token): TurnState | null {
  const combat = combatOf(room, mapId);
  if (!combat?.active) return null;
  const entry = combat.entries.find((e) => e.tokenId === token.id);
  if (!entry) return null;
  if (!combat.turns[entry.id]) beginTurn(room, mapId, entry.id);
  return combat.turns[entry.id] ?? null;
}

/** Активен ли токен в бою карты (вне боя — всегда true). */
export function isActiveToken(room: Room, mapId: string, tokenId: string): boolean {
  const combat = combatOf(room, mapId);
  if (!combat?.active) return true;
  const active = combat.entries[combat.currentIndex];
  return !active || active.tokenId === tokenId;
}

/** Доступна ли атака: запас мультиатаки/Шквала (безоружные) или свободное действие. */
export function canAttack(
  room: Room,
  mapId: string,
  token: Token,
  opts: { unarmed?: boolean } = {}
): boolean {
  const turn = turnForToken(room, mapId, token);
  if (!turn) return true;
  if (restrictionsFor(token.conditions, token.effects).oneAttackOnly && turn.actionUsed) return false;
  const flurry = opts.unarmed === true && turn.flurryAttacks > 0;
  return turn.attacksRemaining > 0 || flurry || !turn.actionUsed || turn.extraActions > 0;
}

/** Списывает атаку (запас мультиатаки/Шквала либо действие). */
export function consumeAttack(
  m: CombatDeps,
  room: Room,
  mapId: string,
  token: Token,
  opts: { unarmed?: boolean } = {}
): boolean {
  const turn = turnForToken(room, mapId, token);
  if (!turn) return true;
  if (restrictionsFor(token.conditions, token.effects).oneAttackOnly && turn.actionUsed) return false;
  if (turn.attacksRemaining > 0) {
    turn.attacksRemaining -= 1;
  } else if (opts.unarmed === true && turn.flurryAttacks > 0) {
    turn.flurryAttacks -= 1;
  } else if (turn.extraActions > 0) {
    turn.extraActions -= 1;
    turn.attacksRemaining = Math.max(0, attacksPerToken(room, token) - 1);
  } else if (!turn.actionUsed) {
    turn.actionUsed = true;
    turn.attacksRemaining = Math.max(0, attacksPerToken(room, token) - 1);
  } else {
    return false;
  }
  m.saveSoon(room);
  return true;
}

/** Списывает слот действия (action/bonus/reaction) для токена. */
export function spendSlot(m: CombatDeps, room: Room, mapId: string, token: Token, slot: ActionCost): boolean {
  // Реакция доступна в чужой ход: берём состояние записи токена, не только активной.
  const turn = slot === 'reaction' ? turnStateFor(room, mapId, token) : turnForToken(room, mapId, token);
  if (!turn) return true;
  const restrictions = restrictionsFor(token.conditions, token.effects);
  switch (slot) {
    case 'action':
      if (restrictions.noActions) return false;
      if (restrictions.actionOrBonusOnly && turn.bonusActionUsed) return false;
      if (!actionSlotAvailable(turn, 'action')) return false;
      if (turn.extraActions > 0) turn.extraActions -= 1;
      else turn.actionUsed = true;
      break;
    case 'bonus':
      if (restrictions.noBonus) return false;
      if (restrictions.actionOrBonusOnly && turn.actionUsed) return false;
      if (!actionSlotAvailable(turn, 'bonus')) return false;
      if (turn.extraBonusActions > 0) turn.extraBonusActions -= 1;
      else turn.bonusActionUsed = true;
      break;
    case 'reaction':
      if (restrictions.noReactions) return false;
      if (!actionSlotAvailable(turn, 'reaction')) return false;
      turn.reactionUsed = true;
      break;
    default:
      return true;
  }
  m.saveSoon(room);
  return true;
}

/** Состояние хода владельца записи (для легендарного слота — состояние основной записи). */
function activeOwnerTurn(room: Room, mapId: string, token: Token): TurnState | null {
  const combat = combatOf(room, mapId);
  if (!combat?.active) return null;
  const entry = combat.entries.find((e) => e.tokenId === token.id);
  if (!entry) return null;
  const turnId = entry.legendaryOwnerId ?? entry.id;
  return combat.turns[turnId] ?? null;
}

/** Списывает легендарные действия с пула владельца (слоты ссылаются на основную запись). */
export function spendLegendary(m: CombatDeps, room: Room, mapId: string, token: Token, amount: number): boolean {
  if (amount <= 0) return true;
  const turn = activeOwnerTurn(room, mapId, token);
  if (!turn) return true;
  if (turn.legendaryRemaining < amount) return false;
  turn.legendaryRemaining -= amount;
  m.saveSoon(room);
  return true;
}

/** Ставит перезарядку способности (ходов) с текущего хода монстра. */
export function startAbilityCooldown(
  m: CombatDeps,
  room: Room,
  mapId: string,
  token: Token,
  actionId: string,
  turns: number
): void {
  if (turns <= 0) return;
  const turn = activeOwnerTurn(room, mapId, token);
  if (!turn) return;
  turn.abilityCooldowns = { ...(turn.abilityCooldowns ?? {}), [actionId]: Math.min(20, Math.round(turns)) };
  m.saveSoon(room);
}

/** Фиксирует потраченное передвижение бойца (предупреждение, не блокировка). */
export function setMovement(m: CombatDeps, room: Room, mapId: string, tokenId: string, used: number, diagonals?: number) {
  const combat = combatOf(room, mapId);
  if (!combat || !Number.isFinite(used)) return;
  const entry = combat.entries.find((e) => e.tokenId === tokenId);
  if (!entry) return;
  const turn = combat.turns[entry.id];
  if (!turn) return;
  turn.movementUsed = Math.max(0, Math.round(used));
  if (typeof diagonals === 'number' && Number.isFinite(diagonals)) {
    turn.diagonalsUsed = Math.max(0, Math.round(diagonals));
  }
  m.saveSoon(room);
}

function restoreActive(combat: CombatState, entryId: string | undefined) {
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
export function ensureActiveTurn(room: Room, mapId: string) {
  const combat = combatOf(room, mapId);
  if (!combat || !combat.active || combat.entries.length === 0) return;
  if (combat.currentIndex < 0 || combat.currentIndex >= combat.entries.length) {
    combat.currentIndex = 0;
    combat.round = Math.max(1, combat.round);
  }
  const entry = combat.entries[combat.currentIndex]!;
  if (!combat.turns[entry.id]) beginTurn(room, mapId, entry.id);
}

export function addTokenToCombat(m: CombatDeps, room: Room, mapId: string, token: Token) {
  const combat = combatOf(room, mapId);
  if (!combat) return;
  const activeId = combat.entries[combat.currentIndex]?.id;
  const entry = makeEntry(room, token);
  const at = combat.entries.findIndex((e) => e.initiative < entry.initiative);
  if (at < 0) combat.entries.push(entry);
  else combat.entries.splice(at, 0, entry);
  redistributeLegendarySlots(room, combat);
  restoreActive(combat, activeId);
  ensureActiveTurn(room, mapId);
  m.saveSoon(room);
}

/** Призыв «в свой ход»: запись встаёт сразу после записи кастера (Summon-*). */
export function addTokenToCombatAfter(
  m: CombatDeps,
  room: Room,
  mapId: string,
  token: Token,
  afterTokenId: string
) {
  const combat = combatOf(room, mapId);
  if (!combat) return;
  const at = combat.entries.findIndex((e) => e.tokenId === afterTokenId && !e.legendaryOwnerId);
  if (at < 0) return addTokenToCombat(m, room, mapId, token);
  const activeId = combat.entries[combat.currentIndex]?.id;
  combat.entries.splice(at + 1, 0, makeEntry(room, token));
  redistributeLegendarySlots(room, combat);
  restoreActive(combat, activeId);
  ensureActiveTurn(room, mapId);
  m.saveSoon(room);
}

export function addCombatToken(m: CombatDeps, room: Room, mapId: string, tokenId: string): boolean {
  const combat = combatOf(room, mapId);
  if (!combat || combat.entries.some((e) => e.tokenId === tokenId)) return false;
  const token = findToken(room, mapId, tokenId);
  if (!token) return false;
  addTokenToCombat(m, room, mapId, token);
  return true;
}

export function addMapTokensToCombat(m: CombatDeps, room: Room, mapId: string) {
  const map = room.scene.maps.find((mm) => mm.id === mapId);
  if (!map) return;
  const combat = map.combat;
  const existing = new Set(combat.entries.map((e) => e.tokenId));
  const additions = map.tokens.filter((t) => !existing.has(t.id)).map((t) => makeEntry(room, t));
  if (additions.length === 0) return;
  const activeId = combat.entries[combat.currentIndex]?.id;
  combat.entries = [...combat.entries, ...additions].sort((a, b) => b.initiative - a.initiative);
  redistributeLegendarySlots(room, combat);
  restoreActive(combat, activeId);
  ensureActiveTurn(room, mapId);
  m.saveSoon(room);
}

export function removeTokenFromCombat(m: CombatDeps, room: Room, mapId: string, tokenId: string) {
  const combat = combatOf(room, mapId);
  if (!combat) return;
  const activeId = combat.entries[combat.currentIndex]?.id;
  const removed = combat.entries.filter((e) => e.tokenId === tokenId);
  if (removed.length === 0) return;
  combat.entries = combat.entries.filter((e) => e.tokenId !== tokenId);
  for (const e of removed) delete combat.turns[e.id];
  redistributeLegendarySlots(room, combat);
  const activeRemoved = !!activeId && removed.some((e) => e.id === activeId);
  restoreActive(combat, activeRemoved ? undefined : activeId);
  if (combat.active && combat.entries.length) beginTurn(room, mapId, combat.entries[combat.currentIndex]!.id);
  m.saveSoon(room);
}

export function removeCombatant(m: CombatDeps, room: Room, mapId: string, id: string) {
  const combat = combatOf(room, mapId);
  if (!combat) return;
  const target = combat.entries.find((e) => e.id === id);
  if (!target) return;
  const activeId = combat.entries[combat.currentIndex]?.id;
  const removedIds = new Set([id]);
  if (!target.legendaryOwnerId) {
    for (const e of combat.entries) {
      if (e.legendaryOwnerId === id) removedIds.add(e.id);
    }
  }
  combat.entries = combat.entries.filter((e) => !removedIds.has(e.id));
  for (const rid of removedIds) delete combat.turns[rid];
  if (!target.legendaryOwnerId) redistributeLegendarySlots(room, combat);
  const activeRemoved = !combat.entries.some((e) => e.id === activeId);
  restoreActive(combat, activeRemoved ? undefined : activeId);
  if (combat.active && combat.entries.length) beginTurn(room, mapId, combat.entries[combat.currentIndex]!.id);
  m.saveSoon(room);
}

export function updateCombatant(
  m: CombatDeps,
  room: Room,
  mapId: string,
  id: string,
  patch: { name?: string; initiative?: number; bonus?: string }
) {
  const entry = combatOf(room, mapId)?.entries.find((e) => e.id === id);
  if (!entry) return;
  if (typeof patch.name === 'string') entry.name = patch.name.slice(0, 40);
  if (typeof patch.bonus === 'string') entry.bonus = patch.bonus.slice(0, 10);
  if (typeof patch.initiative === 'number' && Number.isFinite(patch.initiative)) {
    entry.initiative = Math.round(patch.initiative);
  }
  m.saveSoon(room);
}

export function moveCombatant(m: CombatDeps, room: Room, mapId: string, id: string, toIndex: number) {
  const combat = combatOf(room, mapId);
  if (!combat) return;
  const entries = combat.entries;
  const from = entries.findIndex((e) => e.id === id);
  if (from < 0) return;
  const to = Math.min(Math.max(0, Math.round(toIndex)), entries.length - 1);
  if (from === to) return;
  const activeId = entries[combat.currentIndex]?.id;
  const [entry] = entries.splice(from, 1);
  entries.splice(to, 0, entry!);
  restoreActive(combat, activeId);
  m.saveSoon(room);
}

export function rollCombat(m: CombatDeps, room: Room, mapId: string, id?: string) {
  const combat = combatOf(room, mapId);
  if (!combat) return;
  const activeId = combat.entries[combat.currentIndex]?.id;
  if (id) {
    const entry = combat.entries.find((e) => e.id === id);
    const owner = entry?.legendaryOwnerId ? combat.entries.find((e) => e.id === entry.legendaryOwnerId) : entry;
    if (!owner) return;
    reRollEntry(room, owner);
    for (const slot of combat.entries.filter((e) => e.legendaryOwnerId === owner.id)) {
      slot.initiative = owner.initiative;
      slot.bonus = owner.bonus;
      slot.roll = owner.roll;
    }
  } else {
    combat.entries = combat.entries.filter((e) => !e.legendaryOwnerId);
    for (const entry of combat.entries) reRollEntry(room, entry);
    combat.entries.sort((a, b) => b.initiative - a.initiative);
    distributeLegendarySlots(room, combat);
    restoreActive(combat, activeId);
  }
  m.saveSoon(room);
}

export function renameCombatantByToken(m: CombatDeps, room: Room, mapId: string, tokenId: string, name: string) {
  const combat = combatOf(room, mapId);
  if (!combat) return;
  const entry = combat.entries.find((e) => e.tokenId === tokenId);
  if (!entry) return;
  entry.name = name.slice(0, 40);
  m.saveSoon(room);
}
