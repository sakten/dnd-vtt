import type { ZoneInstance } from '../domain/automation';
import type { LightSource } from '../domain/automation';
import { SENSE_TYPES, type Sense, type SenseType } from '../domain/sense';
import type { LightArea, LightAreaKind, MapInfo, Wall } from '../domain/scene';
import type { Token } from '../domain/token';
import { areaCellKey, areaCellsSpread, cellCenter, cellChebyshev, pointCell, type AreaGrid } from './areas';
import { crossesWalls, type Point } from './walls';

/** Уровень света клетки от заклинаний: яркий или сумеречный. */
export type LightLevel = 'bright' | 'dim';

/** Источник света в мире (эффект токена или светящаяся зона). */
export interface LightEmitter {
  x: number;
  y: number;
  light: LightSource;
}

/**
 * Клетки, освещённые источниками: радиус по Чебышёву, тени от стен, ярче — ближе.
 * Несколько источников комбинируются максимумом (bright > dim).
 */
export function lightCells(
  emitters: LightEmitter[],
  grid: AreaGrid,
  walls: Wall[] = [],
  bounds?: { cx0: number; cy0: number; cx1: number; cy1: number } | null
): Map<string, LightLevel> {
  const out = new Map<string, LightLevel>();
  for (const emitter of emitters) {
    const brightFeet = Math.max(0, emitter.light.bright);
    const radiusFeet = brightFeet + Math.max(0, emitter.light.dim);
    if (radiusFeet <= 0) continue;
    const radiusCells = Math.ceil(radiusFeet / 5);
    const source = pointCell({ x: emitter.x, y: emitter.y }, grid);
    for (let dx = -radiusCells; dx <= radiusCells; dx++) {
      for (let dy = -radiusCells; dy <= radiusCells; dy++) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        if (distance > radiusCells) continue;
        const cx = source.cx + dx;
        const cy = source.cy + dy;
        if (bounds && (cx < bounds.cx0 || cx > bounds.cx1 || cy < bounds.cy0 || cy > bounds.cy1)) continue;
        const feet = distance * 5;
        const level: LightLevel | null = feet <= brightFeet ? 'bright' : emitter.light.dim > 0 ? 'dim' : null;
        if (!level) continue;
        // Свет не проходит через стены/закрытые двери.
        if (crossesWalls({ x: emitter.x, y: emitter.y }, cellCenter(cx, cy, grid), walls, 'sight')) continue;
        const key = areaCellKey(cx, cy);
        if (level === 'bright' || !out.has(key)) out.set(key, level);
      }
    }
  }
  return out;
}

export interface MapLightSource {
  key: string;
  x: number;
  y: number;
  light: LightSource;
}

/** Свет ярче: bright > dim, при равенстве — больший суммарный радиус. */
function brighterLight(a: LightSource, b: LightSource): boolean {
  const rank = (l: LightSource) => (l.bright > 0 ? 2 : 1);
  if (rank(a) !== rank(b)) return rank(a) > rank(b);
  return a.bright + a.dim > b.bright + b.dim;
}

/** Источники света карты: сильнейший видимый свет эффекта на токен + светящиеся зоны. */
export function mapLights(tokens: Token[], zones: ZoneInstance[]): MapLightSource[] {
  const items: MapLightSource[] = [];
  for (const token of tokens) {
    let best: LightSource | undefined;
    for (const effect of token.effects) {
      if (!effect.light || effect.hidden) continue;
      if (!best || brighterLight(effect.light, best)) best = effect.light;
    }
    if (best) items.push({ key: `t:${token.id}`, x: token.x, y: token.y, light: best });
  }
  for (const zone of zones) {
    if (!zone.light || !zone.origin) continue;
    items.push({ key: `z:${zone.id}`, x: zone.origin.x, y: zone.origin.y, light: zone.light });
  }
  return items;
}

/** Клетки света карты с тенями от стен (общий расчёт для клиента и серверных проверок обзора). */
export function mapLightCells(
  tokens: Token[],
  zones: ZoneInstance[],
  grid: AreaGrid,
  walls: Wall[] = []
): Map<string, LightLevel> {
  const emitters: LightEmitter[] = mapLights(tokens, zones).map((l) => ({ x: l.x, y: l.y, light: l.light }));
  return lightCells(emitters, grid, walls);
}

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
  /** Клетки со светом заклинаний: яркий свет и сумерки перекрывают обычную тьму. */
  light?: Map<string, LightLevel>;
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

/**
 * Уровень света в точке: области/зоны тьмы и мглы, свет заклинаний, глобальная
 * «Тьма»; по умолчанию — яркий. Для правил, которые смотрят на свет у цели
 * (Shadow Blade: преимущество в сумерках/темноте).
 */
export function lightLevelAt(ctx: SightContext, point: Point): LightLevel | 'dark' {
  if (visionKindAt(ctx, point)) return 'dark';
  const grid: AreaGrid = { size: ctx.cellSize || 50, offsetX: ctx.offsetX, offsetY: ctx.offsetY };
  const cell = pointCell(point, grid);
  const lit = ctx.light?.get(areaCellKey(cell.cx, cell.cy));
  if (lit) return lit;
  return ctx.darkness ? 'dark' : 'bright';
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
  const targetCell = pointCell(target, grid);
  const lit = ctx.light?.get(areaCellKey(targetCell.cx, targetCell.cy));
  const fromKind = visionKindAt(ctx, from);
  const toKind = visionKindAt(ctx, target);
  // Мгла и магическая тьма свет игнорируют; обычная тьма у цели — перекрывается светом.
  const blocked = fromKind === 'magical' || fromKind === 'obscured' || toKind === 'magical' || toKind === 'obscured';
  const kind = lit && !blocked ? null : strongestKind(fromKind, toKind);
  if (!kind && (!ctx.darkness || lit)) return true;
  const fromCell = pointCell(from, grid);
  const distance = cellChebyshev(fromCell, targetCell);
  return visionRadiiCells(ctx.darkness, senses, kind).some((r) => r === null || distance <= r);
}

/**
 * Взаимная невидимость участников атаки одним расчётом (одна карта):
 * RAW — не видишь цель → помеха; цель не видит тебя → преимущество.
 * Общий код оружия, заклинаний и клиентского предпросмотра.
 */
export function unseenBetween(
  attacker: Point,
  target: Point,
  attackerSenses: Sense[] | undefined,
  targetSenses: Sense[] | undefined,
  sight: SightContext
): { unseenTarget: boolean; unseenAttacker: boolean } {
  return {
    unseenTarget: !canSee(attacker, target, attackerSenses, sight),
    unseenAttacker: !canSee(target, attacker, targetSenses, sight),
  };
}
