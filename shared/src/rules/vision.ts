import type { ZoneInstance } from '../domain/automation';
import { SENSE_TYPES, type Sense, type SenseType } from '../domain/sense';
import type { LightArea, LightAreaKind, MapInfo, Wall } from '../domain/scene';
import type { Token } from '../domain/token';
import { areaCellKey, areaCellsSpread, cellChebyshev, pointCell, type AreaGrid } from './areas';
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
  /** Предвычисленные клетки вижн-зон (Map из `zoneVisionCells`) — для массовых расчётов. */
  zoneCells?: Map<string, LightAreaKind>;
}

/** Вижн-вид зоны по флагам: `blocksLight` — магическая тьма, `obscured: heavy` — мгла. */
export function zoneVisionKind(zone: ZoneInstance): LightAreaKind | null {
  if (!zone.flags) return null;
  if (zone.flags.blocksLight) return 'magical';
  if (zone.flags.obscured === 'heavy') return 'obscured';
  return null;
}

/** Контекст обзора из карты: сетка задаёт клетки вижна (у тумана те же размер и сдвиг). */
export function sightContextOf(
  map: Pick<MapInfo, 'walls' | 'vision' | 'lightAreas' | 'zones'>,
  grid: AreaGrid
): SightContext {
  return {
    walls: map.walls,
    darkness: map.vision.darkness,
    cellSize: grid.size || 50,
    offsetX: grid.offsetX,
    offsetY: grid.offsetY,
    areas: map.lightAreas,
    zones: map.zones,
  };
}

/** Клетки вижн-зон с их видами (для вуали: считается один раз на пересчёт). */
export function zoneVisionCells(
  zones: ZoneInstance[],
  grid: AreaGrid,
  walls: Wall[] = []
): Map<string, LightAreaKind> {
  const out = new Map<string, LightAreaKind>();
  for (const zone of zones) {
    const kind = zoneVisionKind(zone);
    if (!kind || !zone.origin || !Number.isFinite(zone.origin.x) || !Number.isFinite(zone.origin.y)) continue;
    // Тьма/мгла зоны не распространяется через стены: только по достижимым клеткам области.
    for (const key of areaCellsSpread(zone.area, zone.origin, zone.direction ?? null, grid, walls)) {
      const prev = out.get(key);
      out.set(key, prev ? strongestKind(prev, kind) ?? kind : kind);
    }
  }
  return out;
}

/** Вижн-вид зон в точке (для проверок по цели: атаки). */
export function zoneVisionKindAt(
  zones: ZoneInstance[],
  point: Point,
  grid: AreaGrid,
  walls: Wall[] = []
): LightAreaKind | null {
  const cell = pointCell(point, grid);
  const key = areaCellKey(cell.cx, cell.cy);
  let kind: LightAreaKind | null = null;
  for (const zone of zones) {
    const zoneKind = zoneVisionKind(zone);
    if (!zoneKind || !zone.origin || !Number.isFinite(zone.origin.x) || !Number.isFinite(zone.origin.y)) continue;
    if (areaCellsSpread(zone.area, zone.origin, zone.direction ?? null, grid, walls).has(key)) {
      kind = strongestKind(kind, zoneKind);
    }
  }
  return kind;
}

/**
 * Вид в точке: строжайший из области тьмы/мглы и вижн-зоны. Единая точка входа
 * для `canSee` и вуали; при `zoneCells` зоны берутся из кэша, иначе считаются по точке.
 */
export function visionKindAt(
  ctx: Pick<SightContext, 'areas' | 'zones' | 'zoneCells' | 'cellSize' | 'offsetX' | 'offsetY' | 'walls'>,
  point: Point
): LightAreaKind | null {
  const grid: AreaGrid = { size: ctx.cellSize || 50, offsetX: ctx.offsetX, offsetY: ctx.offsetY };
  const cell = pointCell(point, grid);
  const fromZones = ctx.zoneCells
    ? ctx.zoneCells.get(areaCellKey(cell.cx, cell.cy)) ?? null
    : ctx.zones
      ? zoneVisionKindAt(ctx.zones, point, grid, ctx.walls ?? [])
      : null;
  return strongestKind(areaKindAt(ctx.areas ?? [], point), fromZones);
}

/** Восприятие, выдаваемое эффектом (Darkvision и подобные). */
export function tokenSenses(token: Pick<Token, 'senses' | 'effects'>): Sense[] {
  const merged = new Map<SenseType, number>();
  for (const sense of token.senses ?? []) merged.set(sense.type, Math.max(merged.get(sense.type) ?? 0, sense.range));
  for (const effect of token.effects ?? []) {
    for (const sense of effect.senses ?? []) {
      merged.set(sense.type, Math.max(merged.get(sense.type) ?? 0, sense.range));
    }
  }
  const out: Sense[] = [];
  for (const type of SENSE_TYPES) {
    const range = merged.get(type);
    if (range !== undefined && range > 0) out.push({ type, range });
  }
  return out;
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
  const kind = strongestKind(visionKindAt(ctx, from), visionKindAt(ctx, target));
  if (!kind && !ctx.darkness) return true;
  const grid: AreaGrid = { size: ctx.cellSize || 50, offsetX: ctx.offsetX, offsetY: ctx.offsetY };
  const fromCell = pointCell(from, grid);
  const targetCell = pointCell(target, grid);
  const distance = cellChebyshev(fromCell, targetCell);
  return visionRadiiCells(ctx.darkness, senses, kind).some((r) => r === null || distance <= r);
}
