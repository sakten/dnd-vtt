import {
  crossesWalls,
  isRecord,
  spellAreaOrigin,
  spellHasArea,
  spellIsSelf,
  spellRangeFeet,
  tokenVisibleFrom,
  tokensInArea,
  type Spell,
  type SpellStats,
  type Token,
} from 'shared';
import type { ConnCtx } from './context';
import { fail } from './errors';
import type { SpellCastInput } from './spellResolve';

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
  /** Выбранная форма призыва (Find Familiar). */
  summonKey?: string;
  author: string;
}

/** Сбор входных данных каста: цели по области/списку, точка и направление. */
export function collectSpellCast(ctx: ConnCtx, params: SpellCastParams): SpellCastInput | undefined {
  const room = ctx.getRoom();
  if (!room) return undefined;
  const { caster, mapId, spell } = params;
  const targets: Token[] = [];
  let area = false;
  let areaOrigin: { x: number; y: number } | null = null;
  if (spellHasArea(spell) && spell.areaSpec) {
    const map = ctx.manager.findMap(room, mapId);
    const grid = {
      size: map?.grid.size || room.scene.grid.size || 50,
      offsetX: map?.grid.offsetX ?? room.scene.grid.offsetX,
      offsetY: map?.grid.offsetY ?? room.scene.grid.offsetY,
    };
    const originKind = spellAreaOrigin(spell);
    const originPt = originKind === 'self' ? { x: caster.x, y: caster.y } : isPoint(params.origin) ? params.origin : null;
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
      if (map && crossesWalls(caster, originPt, map.walls, 'sight')) {
        fail(ctx, 'noClearPath');
        return undefined;
      }
    }
    const affected = map
      ? tokensInArea(
          map.tokens,
          spell.areaSpec,
          originPt,
          isPoint(params.direction) ? params.direction : null,
          grid,
          'euclidean',
          map.walls
        )
      : [];
    for (const t of affected) {
      if (t.id !== caster.id) targets.push(t);
    }
    area = true;
    areaOrigin = originPt;
  } else {
    const map = ctx.manager.findMap(room, mapId);
    const grid = {
      size: map?.grid.size || room.scene.grid.size || 50,
      offsetX: map?.grid.offsetX ?? room.scene.grid.offsetX,
      offsetY: map?.grid.offsetY ?? room.scene.grid.offsetY,
    };
    for (const id of Array.isArray(params.targetIds) ? params.targetIds : []) {
      if (typeof id !== 'string') continue;
      const found = ctx.manager.findToken(room, mapId, id);
      if (!found) continue;
      // 5e: цель доступна, если видна хотя бы одна её клетка (стена/закрытая дверь рушат линию).
      if (map && found.id !== caster.id && !tokenVisibleFrom(caster, found, map.walls, grid)) {
        fail(ctx, 'noClearPath');
        return undefined;
      }
      targets.push(found);
    }
    if (spellIsSelf(spell) && !targets.some((t) => t.id === caster.id)) targets.push(caster);
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
    direction: isPoint(params.direction) ? params.direction : null,
    summonKey: params.summonKey,
    author: params.author,
  };
}
