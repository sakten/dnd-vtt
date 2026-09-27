import {
  automationForSpell,
  cellCenter,
  crossesWalls,
  gridOfMap,
  hostileTokens,
  isBanished,
  isRecord,
  isThinWallSpell,
  pointCell,
  parseZoneTargetId,
  spellAreaOrigin,
  spellCastArea,
  spellCastDirection,
  spellHasArea,
  spellIsSelf,
  spellRangeFeet,
  tokenVisibleFrom,
  tokensCrossingSegments,
  tokensNearFeet,
  wallsWithZones,
  zoneWallSegments,
  type Spell,
  type SpellStats,
  type Token,
} from 'shared';import type { ConnCtx } from './context';
import { areaTokens } from './areaTokens';
import { fail } from './errors';
import type { SpellCastInput } from './spellResolve';
import type { Room } from '../roomTypes';

const isPoint = (p: unknown): p is { x: number; y: number } =>
  isRecord(p) && Number.isFinite(p.x) && Number.isFinite(p.y);

export interface SpellCastParams {
  mapId: string;
  caster: Token;
  spell: Spell;
  castLevel: number;
  characterLevel: number;
  stats: SpellStats | null;
  targetIds?: unknown;
  advantage?: 'a' | 'd';
  origin?: unknown;
  direction?: unknown;
  /** Тонкая стена цепочкой панелей: узлы. */
  path?: unknown;
  /** Тонкая стена: сторона выталкивания разрезанных существ. */
  pushSide?: unknown;
  /** Выбранная форма призыва (Find Familiar). */
  summonKey?: string;
  /** Вариант заклинания (Dragon's Breath: тип урона выдоха). */
  variant?: string;
  /** Выбор состояния для снятия (Lesser/Greater Restoration). */
  condition?: string;
  /** Scatter: точки назначения по целям. */
  placements?: unknown;
  /** Телепорт с пассажиром (Dimension Door, Thunder Step). */
  passengerId?: string;
  author: string;
}

/** Сбор входных данных каста: цели по области/списку, точка и направление. */
export function collectSpellCast(ctx: ConnCtx, params: SpellCastParams): SpellCastInput | undefined {
  const room = ctx.getRoom();
  if (!room) return undefined;
  const { caster, mapId, spell } = params;
  const targets: Token[] = [];
  const placements: { targetId: string; x: number; y: number }[] = [];
  for (const raw of Array.isArray(params.placements) ? params.placements : []) {
    if (!raw || typeof raw !== 'object') continue;
    const p = raw as { targetId?: unknown; x?: unknown; y?: unknown };
    if (typeof p.targetId !== 'string' || !p.targetId) continue;
    if (typeof p.x !== 'number' || typeof p.y !== 'number') continue;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    placements.push({ targetId: p.targetId, x: p.x, y: p.y });
  }
  let area = false;
  let areaOrigin: { x: number; y: number } | null = null;
  let areaDirection: { x: number; y: number } | null = null;
  /** Dispel Magic: цель-зона на карте (`zone:<id>#<секция>`). */
  let dispelZoneId: string | undefined;
  const pushSide = params.pushSide === 'a' || params.pushSide === 'b' ? params.pushSide : undefined;
  // Тонкая стена цепочкой панелей (Wall of Ice): узлы задают геометрию, цели — разрезанные.
  const wallPath = (Array.isArray(params.path) ? params.path : []).filter(isPoint).slice(0, 12);
  if (isThinWallSpell(spell.key) && wallPath.length >= 2) {
    const map = ctx.manager.findMap(room, mapId);
    const grid = gridOfMap(map, room.scene.grid);
    const wallAreaSpec = spellCastArea(spell, params.variant) ?? { shape: 'line', size: wallPath.length, width: 1 };
    const segments = zoneWallSegments(
      { area: wallAreaSpec, origin: wallPath[0]!, direction: null, wallPath },
      grid
    );
    const cut = map
      ? tokensCrossingSegments(map.tokens.filter((t) => !isBanished(t) && t.id !== caster.id), segments)
      : [];
    return {
      caster,
      mapId,
      spell,
      castLevel: params.castLevel,
      characterLevel: params.characterLevel,
      stats: params.stats,
      targets: cut,
      advantage: params.advantage,
      area: true,
      origin: wallPath[0]!,
      direction: null,
      path: wallPath,
      ...(pushSide ? { pushSide } : {}),
      ...(params.variant ? { variant: params.variant } : {}),
      ...(params.condition ? { condition: params.condition } : {}),
      author: params.author,
    };
  }
  const castArea = spellCastArea(spell, params.variant);
  if (spellHasArea(spell) && castArea) {
    const map = ctx.manager.findMap(room, mapId);
    const grid = gridOfMap(map, room.scene.grid);
    const originKind = spellAreaOrigin(spell);
    let originPt = originKind === 'self' ? { x: caster.x, y: caster.y } : isPoint(params.origin) ? params.origin : null;
    if (!originPt) {
      fail(ctx, 'noAreaPoint');
      return undefined;
    }
    if (originKind === 'point') {
      const range = spellRangeFeet(spell);
      const feet = (Math.hypot(originPt.x - caster.x, originPt.y - caster.y) / grid.size) * 5;
      if (range !== null && feet > range) {
        fail(ctx, 'outOfRange', { feet });
        return undefined;
      }
      // 5e: до точки накладывания нужен чистый путь (закрытая дверь/стена блокируют).
      if (map && crossesWalls(caster, originPt, wallsWithZones(map.walls, map.zones, grid), 'action')) {
        fail(ctx, 'noClearPath');
        return undefined;
      }
    }
    // Ось стены задаёт вариант каста, а якорь — центр клетки: сырой курсор
    // смещал ось на полклетки, и длинная стена косила (60 фт уезжали на клетки).
    const wallCell = pointCell(originPt, grid);
    const wallAnchor = cellCenter(wallCell.cx, wallCell.cy, grid);
    const axis = spellCastDirection(spell.key, params.variant, wallAnchor);
    if (axis) originPt = wallAnchor;
    areaDirection = axis ?? (isPoint(params.direction) ? params.direction : null);
    if (map && isThinWallSpell(spell.key)) {
      // Тонкая стена (Wall of Ice): появление бьёт существ, чью подошву разрезают сегменты.
      const segments = zoneWallSegments({ area: castArea, origin: originPt, direction: areaDirection }, grid);
      const cut = tokensCrossingSegments(
        map.tokens.filter((t) => !isBanished(t) && t.id !== caster.id),
        segments
      );
      for (const t of cut) targets.push(t);
    } else {
      const affected = areaTokens(ctx, room, mapId, castArea, originPt, {
        direction: areaDirection,
        excludeId: caster.id,
      });
      for (const t of affected) targets.push(t);
    }
    area = true;
    areaOrigin = originPt;
  } else {
    const map = ctx.manager.findMap(room, mapId);
    const grid = gridOfMap(map, room.scene.grid);
    for (const id of Array.isArray(params.targetIds) ? params.targetIds : []) {
      if (typeof id !== 'string') continue;
      // Dispel Magic: цель-зона (`zone:<id>#<секция>`) — секция не важна, берём id зоны.
      const zoneRef = parseZoneTargetId(id);
      if (zoneRef) {
        dispelZoneId = dispelZoneId ?? zoneRef.zoneId;
        continue;
      }
      const found = ctx.manager.findToken(room, mapId, id);
      if (!found) continue;
      // Изгнанный (Banishment) — не на поле: целью быть не может.
      if (isBanished(found)) {
        fail(ctx, 'spellNoTarget');
        return undefined;
      }
      // 5e: цель доступна, если видна хотя бы одна её клетка (стена/закрытая дверь рушат линию).
      if (map && found.id !== caster.id && !tokenVisibleFrom(caster, found, wallsWithZones(map.walls, map.zones, grid), grid)) {
        fail(ctx, 'noClearPath');
        return undefined;
      }
      targets.push(found);
    }
    // Scatter: цели берём из точек назначения (проверки — в validateSpellCast).
    for (const placement of placements) {
      const found = map?.tokens.find((t) => t.id === placement.targetId);
      if (found && !targets.some((t) => t.id === found.id)) targets.push(found);
    }
    if (spellIsSelf(spell) && !targets.length) targets.push(caster);
  }
  return {
    caster,
    mapId,
    spell,
    castLevel: params.castLevel,
    characterLevel: params.characterLevel,
    stats: params.stats,
    targets,
    advantage: params.advantage,
    area,
    origin: areaOrigin ?? (isPoint(params.origin) ? params.origin : null),
    direction: areaDirection ?? (isPoint(params.direction) ? params.direction : null),
    ...(pushSide ? { pushSide } : {}),
    summonKey: params.summonKey,
    variant: params.variant,
    condition: params.condition,
    ...(placements.length ? { placements } : {}),
    ...(dispelZoneId ? { dispelZoneId } : {}),
    ...(params.passengerId ? { passengerId: params.passengerId } : {}),
    author: params.author,
  };
}

/**
 * Chain Lightning: игрок выбрал только первую цель — добавляем скачки: до `jumps`
 * враждебных существ в `feet` от неё (по дистанции, без повторов, кроме изгнанных).
 */
export function expandChainTargets(ctx: ConnCtx, room: Room, input: SpellCastInput): void {
  const primary = input.targets[0];
  if (!primary) return;
  const def = automationForSpell(input.spell, {
    castLevel: input.castLevel,
    characterLevel: input.characterLevel,
  });
  const chain = def.chain;
  if (!chain) return;
  const map = ctx.manager.findMap(room, input.mapId);
  if (!map) return;
  const grid = gridOfMap(map, room.scene.grid);
  const extra = tokensNearFeet(map.tokens, primary, chain.feet, grid.size).filter(
    (token) =>
      token.id !== primary.id &&
      !input.targets.some((t) => t.id === token.id) &&
      !isBanished(token) &&
      hostileTokens(input.caster, token)
  );
  for (const token of extra.slice(0, Math.max(0, chain.jumps))) input.targets.push(token);
}
