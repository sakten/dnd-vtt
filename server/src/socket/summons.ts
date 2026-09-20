import { randomUUID } from 'node:crypto';
import {
  bestiaryTokenFields,
  hasInvocation,
  INVOCATION_PACT_KEYS,
  PACT_OF_CHAIN_FORMS,
  snapToGrid,
  tokenCells,
  type LibraryItem,
  type MapInfo,
  type SpellStats,
  type SummonDef,
  type Token,
} from 'shared';
import bestiaryData from 'shared/bestiaryData';
import { findSpell } from '../spells';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';

export interface SummonRequest {
  caster: Token;
  mapId: string;
  /** Круг ячейки, которым наложено заклинание. */
  level: number;
  def: SummonDef;
  stats: SpellStats | null;
  /** Точка призыва (клетка рядом с ней), null — рядом с кастером. */
  origin?: { x: number; y: number } | null;
  /** Выбранная форма (Find Familiar): ключ каталога. */
  summonKey?: string;
  /** Ключ заклинания (метка на токене). */
  spellKey?: string;
}

/** Фамильяр (Find Familiar) без Pact of the Chain атаковать не может. */
export function familiarCannotAttack(token: Token | null | undefined): boolean {
  return (
    !!token?.summon &&
    token.summon.spellKey === 'XPHB:Find Familiar' &&
    token.summon.pact !== true
  );
}

/** Проверка формы фамильяра по каталогу: обычная — флаг `familiar`, особая — инвокация. */
export function summonFormIssue(key: string, pactChain: boolean): 'summonNoPact' | 'summonNoForm' | undefined {
  const entry = bestiaryData.entries.find((e) => e.key === key);
  if (!entry) return 'summonNoForm';
  if (PACT_OF_CHAIN_FORMS.includes(entry.key)) return pactChain ? undefined : 'summonNoPact';
  return entry.familiar === true ? undefined : 'summonNoForm';
}

/** Шаблон призыва из каталога (для валидации размера/места). */
export function summonEntry(key: string) {
  return bestiaryData.entries.find((e) => e.key === key);
}

/** Есть ли рядом с точкой свободное место под токен шаблона (проверка до траты ячейки). */
export function hasFreeSummonSpot(
  room: Room,
  mapId: string,
  cells: number,
  center: { x: number; y: number }
): boolean {
  const map = room.scene.maps.find((m) => m.id === mapId);
  if (!map) return false;
  const occupied = new Set(map.tokens.flatMap((token) => tokenCells(token, map.grid)));
  return freeSpots(map, cells, center, occupied, 1).length > 0;
}

/** Игрок, управляющий токеном-кастером (по контроллеру персонажа). */
function controllerPlayerId(room: Room, caster: Token): string | undefined {
  for (const [playerId, libraryItemId] of Object.entries(room.controllers)) {
    if (libraryItemId === caster.libraryItemId) return playerId;
  }
  return undefined;
}

/** Pact of the Chain выбран в листе кастера. */
function hasPactChain(room: Room, caster: Token): boolean {
  const playerId = controllerPlayerId(room, caster);
  const sheet = playerId ? room.sheets[playerId] : undefined;
  return !!sheet && hasInvocation(sheet, INVOCATION_PACT_KEYS.chain);
}

/** Свободные клетки для призыва: спираль от точки, проверка границ и занятости. */
function freeSpots(
  map: MapInfo,
  cells: number,
  center: { x: number; y: number },
  occupied: Set<string>,
  count: number
): { x: number; y: number }[] {
  const grid = map.grid;
  const size = grid.size || 50;
  const cols = Math.max(1, Math.floor(map.width / size));
  const rows = Math.max(1, Math.floor(map.height / size));
  const cx = snapToGrid(center.x, grid.offsetX, size, cells);
  const cy = snapToGrid(center.y, grid.offsetY, size, cells);
  const col0 = Math.round((cx - grid.offsetX) / size - cells / 2);
  const row0 = Math.round((cy - grid.offsetY) / size - cells / 2);
  const out: { x: number; y: number }[] = [];
  for (let ring = 0; ring <= 2 && out.length < count; ring++) {
    for (let dx = -ring; dx <= ring && out.length < count; dx++) {
      for (let dy = -ring; dy <= ring && out.length < count; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const col = col0 + dx;
        const row = row0 + dy;
        if (col < 0 || row < 0 || col + cells > cols || row + cells > rows) continue;
        const keys: string[] = [];
        let free = true;
        for (let x = col; x < col + cells && free; x++) {
          for (let y = row; y < row + cells; y++) {
            const key = `${x},${y}`;
            if (occupied.has(key)) {
              free = false;
              break;
            }
            keys.push(key);
          }
        }
        if (!free) continue;
        for (const key of keys) occupied.add(key);
        out.push({ x: grid.offsetX + (col + cells / 2) * size, y: grid.offsetY + (row + cells / 2) * size });
      }
    }
  }
  return out;
}

/** Идентификаторы токенов кастера: он сам и его двойники-персонажи на других картах. */
export function summonSourceIds(room: Room, caster: Token): Set<string> {
  const ids = new Set<string>([caster.id]);
  if (caster.libraryItemId) {
    for (const map of room.scene.maps) {
      for (const token of map.tokens) {
        if (token.libraryItemId === caster.libraryItemId) ids.add(token.id);
      }
    }
  }
  return ids;
}

/** Убирает один призыв: эффекты, токен, запись в бою, рассылка. */
export function removeSummonToken(ctx: ConnCtx, room: Room, mapId: string, token: Token): void {
  for (const effect of [...token.effects]) ctx.manager.removeEffect(room, token, effect.id);
  ctx.manager.removeToken(room, mapId, token.id);
  ctx.broadcastAll('token:remove', { mapId, id: token.id });
  if (ctx.manager.combatOf(room, mapId)?.active) {
    ctx.manager.removeTokenFromCombat(room, mapId, token.id);
    ctx.syncCombat(room, mapId);
  }
}

/** Снимает призывы кастеров (смерть/удаление кастера). */
export function removeSummonsOf(ctx: ConnCtx, room: Room, casterTokenIds: Set<string>): number {
  let removed = 0;
  for (const map of room.scene.maps) {
    const doomed = map.tokens.filter((token) => token.summon && casterTokenIds.has(token.summon.casterTokenId));
    for (const token of doomed) {
      removeSummonToken(ctx, room, map.id, token);
      removed += 1;
    }
  }
  return removed;
}

/**
 * Сбрасывает только концентрационные призывы (Summon-*): фамильяр/скакун
 * не зависят от концентрации и остаются при касте другого заклинания.
 */
export function removeConcSummonsOf(ctx: ConnCtx, room: Room, casterTokenIds: Set<string>): number {
  let removed = 0;
  for (const map of room.scene.maps) {
    const doomed = map.tokens.filter((token) => {
      const key = token.summon?.spellKey;
      return (
        !!token.summon &&
        casterTokenIds.has(token.summon.casterTokenId) &&
        !!key &&
        findSpell(key)?.concentration === true
      );
    });
    for (const token of doomed) {
      removeSummonToken(ctx, room, map.id, token);
      removed += 1;
    }
  }
  return removed;
}

/** Призыв пал в бою: токен исчезает (эффекты/инициатива чистятся в `removeSummonToken`). */
export function checkSummonDeath(ctx: ConnCtx, room: Room, mapId: string, token: Token): void {
  if (token.summon && token.hpCurrent <= 0) removeSummonToken(ctx, room, mapId, token);
}

/**
 * Спавн призыва: шаблон каталога + скейл круга/кастера, владелец-контролёр,
 * в бою — запись сразу после кастера (Summon-*) или по своей инициативе (фамильяр).
 */
export function runSummon(ctx: ConnCtx, request: SummonRequest): Token[] {
  const room = ctx.getRoom();
  if (!room) return [];
  const map = ctx.manager.findMap(room, request.mapId);
  if (!map) return [];
  const key = request.summonKey ?? request.def.creature;
  const entry = key ? bestiaryData.entries.find((e) => e.key === key) : undefined;
  if (!entry) return [];
  // Особые формы Pact of the Chain — только с выбранной инвокацией (Find Familiar).
  const pactChain = hasPactChain(room, request.caster);
  if (request.def.choices && summonFormIssue(entry.key, pactChain)) return [];

  const fields = bestiaryTokenFields(entry, {
    slotLevel: request.level,
    ...(request.stats ? { spellAttackBonus: request.stats.attack } : {}),
  });
  const playerId = controllerPlayerId(room, request.caster);
  const ownerName = playerId ? ctx.manager.characterName(room, request.mapId, playerId) : request.caster.owner;

  // Повторный призыв тем же заклинанием заменяет прежнего (фамильяр — не больше одного).
  if (request.spellKey) {
    const sourceIds = summonSourceIds(room, request.caster);
    for (const map of room.scene.maps) {
      const old = map.tokens.filter(
        (token) =>
          token.summon &&
          sourceIds.has(token.summon.casterTokenId) &&
          token.summon.spellKey === request.spellKey
      );
      for (const token of old) removeSummonToken(ctx, room, map.id, token);
    }
  }

  const occupied = new Set(map.tokens.flatMap((token) => tokenCells(token, map.grid)));
  const center = request.origin ?? { x: request.caster.x, y: request.caster.y };
  const spots = freeSpots(map, fields.cells, center, occupied, Math.max(1, request.def.count ?? 1));
  const spawned: Token[] = [];
  for (const spot of spots) {
    const item: LibraryItem = { id: randomUUID(), ...fields, owner: ownerName || '' };
    const token = ctx.manager.addToken(room, request.mapId, item, spot.x, spot.y, playerId ?? '');
    if (!token) continue;
    token.summon = {
      casterTokenId: request.caster.id,
      ...(request.spellKey ? { spellKey: request.spellKey } : {}),
      ...(pactChain && PACT_OF_CHAIN_FORMS.includes(entry.key) ? { pact: true } : {}),
    };
    // Призыв на стороне кастера (герой → ally), иначе свои бьют по нему «по возможности».
    token.faction = request.caster.faction;
    spawned.push(token);
  }
  if (!spawned.length) return [];

  const combat = ctx.manager.combatOf(room, request.mapId);
  for (const token of spawned) {
    ctx.emitToken(room, 'token:add', request.mapId, token);
    if (!combat?.active) continue;
    if (request.def.initiative === 'afterCaster') {
      ctx.manager.addTokenToCombatAfter(room, request.mapId, token, request.caster.id);
    } else {
      ctx.manager.addTokenToCombat(room, request.mapId, token);
    }
  }
  if (combat?.active) ctx.syncCombat(room, request.mapId);
  return spawned;
}
