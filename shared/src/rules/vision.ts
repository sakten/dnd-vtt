import type { ZoneInstance } from '../domain/automation';
import type { Sense } from '../domain/sense';
import type { LightArea, LightAreaKind, Wall } from '../domain/scene';
import { areaCellKey, areaCells, pointCell, type AreaGrid } from './areas';
import { crossesWalls, type Point } from './walls';

export interface SightContext {
  walls: Wall[];
  /** Карта в «Темноте»: дальность ограничена восприятием. */
  darkness: boolean;
  /** Клетки вижна (как у тумана). */
  cellSize: number;
  offsetX: number;
  offsetY: number;
  /** Области тьмы/магической тьмы/мглы. */
  areas?: LightArea[];
  /** Активные зоны заклинаний (тьма/мгла по флагам). */
  zones?: ZoneInstance[];
}

/** Вижн-вид зоны по флагам: `blocksLight` — магическая тьма, `obscured: heavy` — мгла. */
export function zoneVisionKind(zone: ZoneInstance): LightAreaKind | null {
  if (!zone.flags) return null;
  if (zone.flags.blocksLight) return 'magical';
  if (zone.flags.obscured === 'heavy') return 'obscured';
  return null;
}

/** Клетки вижн-зон с их видами (для вуали: считается один раз на пересчёт). */
export function zoneVisionCells(zones: ZoneInstance[], grid: AreaGrid): Map<string, LightAreaKind> {
  const out = new Map<string, LightAreaKind>();
  for (const zone of zones) {
    const kind = zoneVisionKind(zone);
    if (!kind) continue;
    for (const key of areaCells(zone.area, zone.origin, zone.direction ?? null, grid)) {
      const prev = out.get(key);
      out.set(key, prev ? strongestKind(prev, kind) ?? kind : kind);
    }
  }
  return out;
}

/** Вижн-вид зон в точке (для проверок по цели: атаки). */
export function zoneVisionKindAt(zones: ZoneInstance[], point: Point, grid: AreaGrid): LightAreaKind | null {
  const { cx, cy } = pointCell(point, grid);
  const key = areaCellKey(cx, cy);
  let kind: LightAreaKind | null = null;
  for (const zone of zones) {
    const zoneKind = zoneVisionKind(zone);
    if (!zoneKind) continue;
    const cells = areaCells(zone.area, zone.origin, zone.direction ?? null, grid);
    if (cells.includes(key)) kind = strongestKind(kind, zoneKind);
  }
  return kind;
}

/** Вид области, накрывающей точку (первая по списку), иначе null. */
export function areaKindAt(areas: LightArea[], point: Point): LightAreaKind | null {
  for (const area of areas) {
    if (point.x >= area.x && point.x <= area.x + area.w && point.y >= area.y && point.y <= area.y + area.h) {
      return area.kind;
    }
  }
  return null;
}

const KIND_SEVERITY: Record<LightAreaKind, number> = { darkness: 1, magical: 2, obscured: 3 };

/** Более строгий из двух видов области (мгла строже магической тьмы, та — обычной). */
export function strongestKind(a: LightAreaKind | null, b: LightAreaKind | null): LightAreaKind | null {
  if (!a) return b;
  if (!b) return a;
  return KIND_SEVERITY[a] >= KIND_SEVERITY[b] ? a : b;
}

/** Какие сенсы работают в области: магическая тьма — кроме тёмного зрения, мгла — только слепое. */
function sensesForKind(senses: Sense[] | undefined, kind: LightAreaKind): Sense[] {
  const list = senses ?? [];
  if (kind === 'magical') return list.filter((s) => s.type !== 'darkvision');
  if (kind === 'obscured') return list.filter((s) => s.type === 'blindsight');
  return list;
}

/**
 * Радиусы восприятия в клетках: вне тьмы (и без области) — без предела,
 * в темноте/области — по сенсам (футы ÷ 5). Без подходящих сенсов:
 * в обычной тьме 1 клетка вокруг, в магической тьме и мгле — только своя клетка.
 */
export function visionRadiiCells(
  darkness: boolean,
  senses: Sense[] | undefined,
  kind: LightAreaKind | null = null
): (number | null)[] {
  if (!kind && !darkness) return [null];
  const allowed = kind ? sensesForKind(senses, kind) : senses ?? [];
  const radii = allowed.map((s) => Math.floor(Math.max(0, s.range) / 5)).filter((r) => r > 0);
  if (radii.length > 0) return radii;
  return kind === 'magical' || kind === 'obscured' ? [0] : [1];
}

/**
 * Видит ли зритель точку: стены и закрытые двери блокируют всегда,
 * тьма (глобальная «Темнота» или область у зрителя/цели) — ограничивает радиусом.
 */
export function canSee(from: Point, target: Point, senses: Sense[] | undefined, ctx: SightContext): boolean {
  if (crossesWalls(from, target, ctx.walls, 'sight')) return false;
  const grid: AreaGrid = { size: ctx.cellSize || 50, offsetX: ctx.offsetX, offsetY: ctx.offsetY };
  const kind = strongestKind(
    strongestKind(areaKindAt(ctx.areas ?? [], from), areaKindAt(ctx.areas ?? [], target)),
    strongestKind(
      ctx.zones ? zoneVisionKindAt(ctx.zones, from, grid) : null,
      ctx.zones ? zoneVisionKindAt(ctx.zones, target, grid) : null
    )
  );
  if (!kind && !ctx.darkness) return true;
  const size = ctx.cellSize || 50;
  const fromX = Math.floor((from.x - ctx.offsetX) / size);
  const fromY = Math.floor((from.y - ctx.offsetY) / size);
  const targetX = Math.floor((target.x - ctx.offsetX) / size);
  const targetY = Math.floor((target.y - ctx.offsetY) / size);
  const distance = Math.max(Math.abs(targetX - fromX), Math.abs(targetY - fromY));
  return visionRadiiCells(ctx.darkness, senses, kind).some((r) => r === null || distance <= r);
}
