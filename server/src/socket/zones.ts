import { randomUUID } from 'node:crypto';
import {
  rollDice,
  tokenFullyInArea,
  tokensInArea,
  type AutomationDef,
  type AutomationPayload,
  type MapInfo,
  type SpellStats,
  type Token,
  type ZoneInstance,
} from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { applyDamage } from './damage';
import { pushSaveMessage } from './effects';
import { applyEffectTo, removeZoneEffects } from './effectsApply';

/**
 * Зоны на карте (R8.1, движок областей): создание при касте, аура внутри,
 * триггеры enter/exit/startOfTurn/endOfTurn, снятие по концентрации.
 * Клиенту зоны приезжают в `maps:update` (поле `zones` карты).
 */

const gridOf = (room: Room) => ({
  size: room.scene.grid.size || 50,
  offsetX: room.scene.grid.offsetX,
  offsetY: room.scene.grid.offsetY,
});

/** Ключ текущего хода карты (для `enterOncePerTurn`); вне боя — null. */
function turnKey(map: MapInfo): string | null {
  const combat = map.combat;
  if (!combat?.active || combat.currentIndex < 0) return null;
  const entry = combat.entries[combat.currentIndex];
  return entry ? `${combat.round}:${entry.id}` : null;
}

/** Точка привязки зоны: для ауры — позиция источника; false — источник исчез. */
function syncZoneOrigin(ctx: ConnCtx, room: Room, mapId: string, zone: ZoneInstance): boolean {
  if (zone.anchor !== 'source') return true;
  const source = ctx.manager.findToken(room, mapId, zone.sourceId);
  if (!source) return false;
  zone.origin = { x: source.x, y: source.y };
  return true;
}

/** Токены внутри зоны (с учётом `containment`). */
function insideTokens(ctx: ConnCtx, room: Room, mapId: string, zone: ZoneInstance): Token[] {
  const map = ctx.manager.findMap(room, mapId);
  if (!map) return [];
  const grid = gridOf(room);
  if (zone.containment === 'fullyWithin') {
    return map.tokens.filter((t) => tokenFullyInArea(t, zone.area, zone.origin, zone.direction ?? null, grid));
  }
  return tokensInArea(map.tokens, zone.area, zone.origin, zone.direction ?? null, grid);
}

function singleType(payload: AutomationPayload): string | undefined {
  const types = payload.damage?.types ?? [];
  return types.length === 1 ? types[0] : undefined;
}

/** Применяет payload зоны к целям: спас → урон (half) → эффекты (с zoneId). */
function applyZonePayload(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  zone: ZoneInstance,
  payload: AutomationPayload | undefined,
  targets: Token[]
): void {
  if (!payload || !targets.length) return;
  const damageType = singleType(payload);
  for (const target of targets) {
    let success = false;
    if (payload.save) {
      const result = ctx.manager.rollSave(room, target, payload.save.ability, zone.dc ?? 10);
      success = result.success;
      pushSaveMessage(ctx, room, `${zone.name} · ${target.name}`, result.roll, success);
      if (success && !payload.save.half) continue;
    }
    if (payload.damage) {
      const roll = rollDice(payload.damage.dice);
      applyDamage(ctx, {
        target,
        mapId,
        amount: roll.total,
        damageType,
        halve: payload.save ? success : false,
        roll,
        author: zone.name,
        kind: 'damage',
        params: { subject: `${zone.name} · ${target.name}`, damageType },
      });
    }
    for (const effectDef of payload.effects ?? []) {
      applyEffectTo(ctx, room, {
        sourceKey: zone.sourceKey,
        sourceId: zone.sourceId,
        mapId,
        effectDef,
        target,
        untilSaveDc: zone.dc,
        escapeDc: zone.dc,
        zoneId: zone.id,
      });
    }
  }
}

/** Пересчитывает состав зоны: аура на вошедших, снятие с вышедших, enter/exit. */
function syncZone(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  zone: ZoneInstance,
  opts: { aura?: boolean; enterExit?: boolean } = {}
): void {
  const inside = insideTokens(ctx, room, mapId, zone);
  const ids = new Set(inside.map((t) => t.id));
  const prev = new Set(zone.occupants ?? []);
  const entered = inside.filter((t) => !prev.has(t.id));
  const exited = [...prev]
    .filter((id) => !ids.has(id))
    .map((id) => ctx.manager.findToken(room, mapId, id))
    .filter((t): t is Token => !!t);
  zone.occupants = [...ids];

  for (const token of exited) removeZoneEffects(ctx, room, mapId, token, zone.id);

  if (opts.aura && zone.aura) applyZonePayload(ctx, room, mapId, zone, zone.aura, entered);

  if (opts.enterExit && zone.triggers?.enter && entered.length) {
    const key = turnKey(ctx.manager.findMap(room, mapId)!);
    const fresh = entered.filter((t) => {
      if (!zone.enterOncePerTurn || key === null) return true;
      return zone.enteredThisTurn?.[t.id] !== key;
    });
    for (const t of fresh) {
      if (zone.enterOncePerTurn && key !== null) {
        zone.enteredThisTurn = { ...(zone.enteredThisTurn ?? {}), [t.id]: key };
      }
    }
    applyZonePayload(ctx, room, mapId, zone, zone.triggers.enter, fresh);
  }
  if (opts.enterExit && zone.triggers?.exit) {
    applyZonePayload(ctx, room, mapId, zone, zone.triggers.exit, exited);
  }
}

/** Снимает зону и её аура-эффекты со всех токенов карты. */
export function removeZone(ctx: ConnCtx, room: Room, mapId: string, zone: ZoneInstance): void {
  const map = ctx.manager.findMap(room, mapId);
  if (!map?.zones) return;
  for (const token of map.tokens) removeZoneEffects(ctx, room, mapId, token, zone.id);
  map.zones = map.zones.filter((z) => z.id !== zone.id);
}

/** Создаёт зону из def при касте (прошлая зона того же источника заменяется). */
export interface CreateZoneInput {
  caster: Token;
  mapId: string;
  def: AutomationDef;
  stats: SpellStats | null;
  origin: { x: number; y: number };
  direction?: { x: number; y: number } | null;
}

export function createZoneFromDef(ctx: ConnCtx, input: CreateZoneInput): ZoneInstance | null {
  const room = ctx.getRoom();
  const zoneDef = input.def.zone;
  if (!room || !zoneDef) return null;
  const map = ctx.manager.findMap(room, input.mapId);
  if (!map) return null;
  map.zones = map.zones ?? [];

  for (const stale of map.zones.filter((z) => z.sourceKey === input.def.key && z.sourceId === input.caster.id)) {
    removeZone(ctx, room, input.mapId, stale);
  }

  const zone: ZoneInstance = {
    id: randomUUID(),
    name: input.def.name,
    sourceKey: input.def.key,
    sourceId: input.caster.id,
    origin: input.origin,
    direction: input.direction ?? null,
    area: zoneDef.area,
    duration: zoneDef.duration,
    concentration: input.def.concentration,
    anchor: zoneDef.anchor,
    movable: zoneDef.movable,
    containment: zoneDef.containment,
    enterOncePerTurn: zoneDef.enterOncePerTurn,
    dc: input.stats?.dc,
    aura: zoneDef.aura,
    triggers: zoneDef.triggers,
    flags: zoneDef.flags,
    occupants: [],
  };
  map.zones.push(zone);
  // Появившиеся внутри сразу получают ауру (HoH: «полностью внутри — ослеплён»).
  syncZone(ctx, room, input.mapId, zone, { aura: true, enterExit: false });
  ctx.broadcastMaps(room);
  return zone;
}

/** Тик активного токена: раунды зон, аура, вход/выход, start/endOfTurn. */
export function tickZones(ctx: ConnCtx, room: Room, mapId: string, token: Token, phase: 'start' | 'end'): void {
  const map = ctx.manager.findMap(room, mapId);
  if (!map?.zones?.length) return;
  for (const zone of [...map.zones]) {
    if (!syncZoneOrigin(ctx, room, mapId, zone)) {
      removeZone(ctx, room, mapId, zone);
      continue;
    }
    if (zone.duration.type === 'rounds' && phase === 'start' && zone.sourceId === token.id) {
      zone.duration.rounds -= 1;
      if (zone.duration.rounds <= 0) {
        removeZone(ctx, room, mapId, zone);
        continue;
      }
    }
    syncZone(ctx, room, mapId, zone, { aura: true, enterExit: true });
    const payload = phase === 'start' ? zone.triggers?.startOfTurn : zone.triggers?.endOfTurn;
    if (payload && (zone.occupants ?? []).includes(token.id)) {
      applyZonePayload(ctx, room, mapId, zone, payload, [token]);
    }
  }
  ctx.broadcastMaps(room);
}

/** После перемещения: аура и триггеры enter/exit для зон. */
export function handleMovementZones(ctx: ConnCtx, room: Room, mapId: string): void {
  const map = ctx.manager.findMap(room, mapId);
  if (!map?.zones?.length) return;
  for (const zone of [...map.zones]) {
    if (!syncZoneOrigin(ctx, room, mapId, zone)) {
      removeZone(ctx, room, mapId, zone);
      continue;
    }
    syncZone(ctx, room, mapId, zone, { aura: true, enterExit: true });
  }
  ctx.broadcastMaps(room);
}

/** Снимает все зоны существа-источника (концентрация, выход из боя, удаление). */
export function removeZonesOfSource(ctx: ConnCtx, room: Room, sourceId: string): boolean {
  let changed = false;
  for (const map of room.scene.maps) {
    for (const zone of [...(map.zones ?? [])]) {
      if (zone.sourceId !== sourceId) continue;
      removeZone(ctx, room, map.id, zone);
      changed = true;
    }
  }
  if (changed) ctx.broadcastMaps(room);
  return changed;
}
