import {
  abilityMod,
  actionSlotAvailable,
  attacksPerAction,
  DEFAULT_AC,
  DEFAULT_SPEED,
  emptyCombatState,
  emptyTurnState,
  exhaustionSpeedPenalty,
  initiativeBonus,
  modifiedValue,
  rollDice,
  statNumber,
  type AbilityKey,
  type ActionCost,
  type CombatState,
  type DiceRollResult,
  type InitiativeEntry,
  type Token,
  type TurnState,
} from 'shared';
import type { Room } from '../roomTypes';
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
  return initiativeBonus(token, room.players, room.sheets);
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
  if (entries.length) beginTurn(room, mapId, entries[0].id);
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
  const controllerId = controllerIdOfToken(room, token);
  const sheetSpeed = controllerId ? room.sheets[controllerId]?.speed : undefined;
  const base = sheetSpeed ?? token.speed ?? DEFAULT_SPEED;
  const abilities = abilitiesForToken(room, token);
  const afterExhaustion = Math.max(0, base + exhaustionSpeedPenalty(token.conditions));
  return {
    speed: Math.max(0, modifiedValue(afterExhaustion, token.effects, 'speed', {}, abilities)),
    legendaryMax: token.statblock?.legendary?.max ?? 0,
    extraActions: Math.max(0, modifiedValue(0, token.effects, 'extraActions', {}, abilities)),
    extraBonusActions: Math.max(0, modifiedValue(0, token.effects, 'extraBonusActions', {}, abilities)),
  };
}

/** Начинает/сбрасывает ход записи, сохраняя концентрацию заклинателя. */
export function beginTurn(room: Room, mapId: string, entryId: string) {
  const combat = combatOf(room, mapId);
  if (!combat) return;
  const entry = combat.entries.find((e) => e.id === entryId);
  if (!entry) return;
  const { speed, legendaryMax, extraActions, extraBonusActions } = turnResources(room, entry);
  const prev = combat.turns[entry.id];
  combat.turns[entry.id] = {
    ...emptyTurnState(speed),
    extraActions,
    extraBonusActions,
    legendaryRemaining: legendaryMax,
    legendaryMax,
    concentrationId: prev?.concentrationId ?? null,
  };
}

/** Завершает текущий ход, переходя к следующему по инициативе. */
export function endTurn(m: CombatDeps, room: Room, mapId: string) {
  advanceTurn(m, room, mapId, 1);
}

export function advanceTurn(m: CombatDeps, room: Room, mapId: string, delta: number) {
  const combat = combatOf(room, mapId);
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
  beginTurn(room, mapId, combat.entries[idx].id);
  m.saveSoon(room);
}

/** DM задаёт активную запись по id или индексу. */
export function setTurn(m: CombatDeps, room: Room, mapId: string, target: { id?: string; index?: number }) {
  const combat = combatOf(room, mapId);
  if (!combat || combat.entries.length === 0) return;
  let idx = -1;
  if (typeof target.id === 'string') idx = combat.entries.findIndex((e) => e.id === target.id);
  else if (typeof target.index === 'number') idx = Math.round(target.index);
  if (idx < 0 || idx >= combat.entries.length) return;
  combat.round = Math.max(1, combat.round);
  combat.currentIndex = idx;
  beginTurn(room, mapId, combat.entries[idx].id);
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
  const controllerId = controllerIdOfToken(room, token);
  const sheet = controllerId ? room.sheets[controllerId] : undefined;
  const base = sheet?.speed ?? token.speed ?? DEFAULT_SPEED;
  return Math.max(0, modifiedValue(base, token.effects, 'speed', {}, abilitiesForToken(room, token)));
}

/** Характеристики токена: из листа персонажа либо из статблока монстра. */
export function abilitiesForToken(room: Room, token: Token): Record<AbilityKey, number> | undefined {
  const controllerId = controllerIdOfToken(room, token);
  const sheet = controllerId ? room.sheets[controllerId] : undefined;
  if (sheet) return sheet.abilities;
  return token.statblock?.abilities;
}

/** Эффективный AC токена с учётом эффектов (Shield, Mage Armor, Barkskin…). */
export function acForToken(room: Room, token: Token): number {
  const explicit = statNumber(token.ac);
  return modifiedValue(
    explicit > 0 ? explicit : DEFAULT_AC,
    token.effects,
    'ac',
    {},
    abilitiesForToken(room, token)
  );
}

/** Модификатор характеристики токена: из листа персонажа или статблока монстра. */
export function abilityModForToken(room: Room, token: Token, ability: AbilityKey): number {
  const controllerId = controllerIdOfToken(room, token);
  const sheet = controllerId ? room.sheets[controllerId] : undefined;
  const score = sheet ? sheet.abilities[ability] : token.statblock?.abilities?.[ability];
  return abilityMod(score ?? 10);
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

/** Доступна ли атака: есть запас мультиатаки или свободное действие. */
export function canAttack(room: Room, mapId: string, token: Token): boolean {
  const turn = turnForToken(room, mapId, token);
  if (!turn) return true;
  return turn.attacksRemaining > 0 || !turn.actionUsed || turn.extraActions > 0;
}

/** Списывает атаку (запас мультиатаки либо действие). */
export function consumeAttack(m: CombatDeps, room: Room, mapId: string, token: Token): boolean {
  const turn = turnForToken(room, mapId, token);
  if (!turn) return true;
  if (turn.attacksRemaining > 0) {
    turn.attacksRemaining -= 1;
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
  switch (slot) {
    case 'action':
      if (!actionSlotAvailable(turn, 'action')) return false;
      if (turn.extraActions > 0) turn.extraActions -= 1;
      else turn.actionUsed = true;
      break;
    case 'bonus':
      if (!actionSlotAvailable(turn, 'bonus')) return false;
      if (turn.extraBonusActions > 0) turn.extraBonusActions -= 1;
      else turn.bonusActionUsed = true;
      break;
    case 'reaction':
      if (!actionSlotAvailable(turn, 'reaction')) return false;
      turn.reactionUsed = true;
      break;
    default:
      return true;
  }
  m.saveSoon(room);
  return true;
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
  const entry = combat.entries[combat.currentIndex];
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
  const activeRemoved = !!activeId && removed.some((e) => e.id === activeId);
  restoreActive(combat, activeRemoved ? undefined : activeId);
  if (combat.active && combat.entries.length) beginTurn(room, mapId, combat.entries[combat.currentIndex].id);
  m.saveSoon(room);
}

export function removeCombatant(m: CombatDeps, room: Room, mapId: string, id: string) {
  const combat = combatOf(room, mapId);
  if (!combat) return;
  const activeId = combat.entries[combat.currentIndex]?.id;
  const before = combat.entries.length;
  combat.entries = combat.entries.filter((e) => e.id !== id);
  if (combat.entries.length === before) return;
  delete combat.turns[id];
  const activeRemoved = activeId === id;
  restoreActive(combat, activeRemoved ? undefined : activeId);
  if (combat.active && combat.entries.length) beginTurn(room, mapId, combat.entries[combat.currentIndex].id);
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
  entries.splice(to, 0, entry);
  restoreActive(combat, activeId);
  m.saveSoon(room);
}

export function rollCombat(m: CombatDeps, room: Room, mapId: string, id?: string) {
  const combat = combatOf(room, mapId);
  if (!combat) return;
  if (id) {
    const entry = combat.entries.find((e) => e.id === id);
    if (entry) reRollEntry(room, entry);
  } else {
    const activeId = combat.entries[combat.currentIndex]?.id;
    for (const entry of combat.entries) reRollEntry(room, entry);
    combat.entries.sort((a, b) => b.initiative - a.initiative);
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
