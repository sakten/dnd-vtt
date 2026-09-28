import type { ZoneInstance, ZoneSection, ZoneWallDef } from '../domain/automation';
import {
  applyDamageToParts,
  type DamageDefense,
  type DamageDefenseType,
  type DamagePartAmount,
} from '../domain/damage';
import { snapToGrid, type Wall } from '../domain/scene';
import type { Token } from '../domain/token';
import {
  cellCenter,
  directionUnit,
  FEET_PER_CELL,
  footprintCells,
  footprintHits,
  pointCell,
  tokenCells,
  type AreaGrid,
  type AreaPoint,
} from './areas';
import { nearestPointOnSegment, rectCrossesWalls, segmentRectDistance, tokenRect, type Rect } from './walls';

/**
 * Геометрия тонких стен-зон (Wall of Ice): стена — сегменты по границам клеток,
 * а не занятые клетки. Плоская стена идёт по грани колонки цели (по правому
 * нормалю направления) от начала клетки-якоря; купол — полигон радиуса `size`.
 * Секции нумеруются вдоль длины/дуги (по `sectionFeet`), состояние HP — в зоне.
 */

export interface ZoneWallSegment {
  a: AreaPoint;
  b: AreaPoint;
  /** Индекс секции вдоль геометрии. */
  section: number;
}

export type ZoneWallSource = Pick<ZoneInstance, 'area' | 'origin' | 'direction'> & {
  wall?: Pick<ZoneWallDef, 'sectionFeet'>;
  /** Цепочка панелей (узлы); при наличии геометрия берётся из неё. */
  wallPath?: { x: number; y: number }[];
};

/** Ссылка на секцию стены-зоны: единый формат цели клиента и сервера. */
export interface ZoneTargetRef {
  zoneId: string;
  section: number;
}

/** Id цели-секции: клиент шлёт его в `targetIds`, сервер разбирает. */
export function zoneTargetId(zoneId: string, section: number): string {
  return `zone:${zoneId}#${section}`;
}

/** Разбор id цели вида `zone:<zoneId>#<секция>` (иначе undefined). */
export function parseZoneTargetId(id: string | undefined): ZoneTargetRef | undefined {
  if (!id || !id.startsWith('zone:')) return undefined;
  const [zoneId, sectionRaw, ...rest] = id.slice('zone:'.length).split('#');
  if (!zoneId || !sectionRaw || rest.length) return undefined;
  const section = Number(sectionRaw);
  if (!Number.isInteger(section) || section < 0) return undefined;
  return { zoneId, section };
}

function feetToPx(feet: number, grid: AreaGrid): number {
  return (feet / FEET_PER_CELL) * grid.size;
}

function anchor(zone: Pick<ZoneInstance, 'origin'>, grid: AreaGrid): AreaPoint {
  const cell = pointCell(zone.origin, grid);
  return cellCenter(cell.cx, cell.cy, grid);
}

function lerp(a: AreaPoint, b: AreaPoint, t: number): AreaPoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Сегменты плоской стены: линия на грани клетки-якоря, равные секции по длине. */
function lineSegments(zone: ZoneWallSource, grid: AreaGrid, sectionFeet: number): ZoneWallSegment[] {
  if (zone.area.shape !== 'line') return [];
  const center = anchor(zone, grid);
  const dir = directionUnit(zone.direction ?? null, center);
  if (!dir) return [];
  const lengthPx = feetToPx(zone.area.size, grid);
  // Правый нормаль: вертикальная стена — по правой грани колонки, горизонтальная — по верхней.
  const normal = { x: dir.y, y: -dir.x };
  const offset = grid.size / 2;
  const start = {
    x: center.x + normal.x * offset - dir.x * offset,
    y: center.y + normal.y * offset - dir.y * offset,
  };
  const count = Math.max(1, Math.round(zone.area.size / sectionFeet));
  const segments: ZoneWallSegment[] = [];
  for (let i = 0; i < count; i++) {
    segments.push({
      a: lerp(start, { x: start.x + dir.x * lengthPx, y: start.y + dir.y * lengthPx }, i / count),
      b: lerp(start, { x: start.x + dir.x * lengthPx, y: start.y + dir.y * lengthPx }, (i + 1) / count),
      section: i,
    });
  }
  return segments;
}

/** Сегменты купола/сферы: полигон радиуса `area.size`, 6 равных дуг-секций (~10.47 фт). */
function ringSegments(zone: ZoneWallSource, grid: AreaGrid, sectionFeet: number): ZoneWallSegment[] {
  if (zone.area.shape !== 'ring') return [];
  const center = anchor(zone, grid);
  const radiusPx = feetToPx(zone.area.size, grid);
  const circumferenceFeet = 2 * Math.PI * zone.area.size;
  // Округление до ближайшего: круглые стены делятся на равные дуги (r10 → 6 дуг).
  const count = Math.max(1, Math.round(circumferenceFeet / sectionFeet));
  const steps = Math.max(16, count * 4);
  const segments: ZoneWallSegment[] = [];
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const a0 = t0 * Math.PI * 2 - Math.PI / 2;
    const a1 = t1 * Math.PI * 2 - Math.PI / 2;
    segments.push({
      a: { x: center.x + Math.cos(a0) * radiusPx, y: center.y + Math.sin(a0) * radiusPx },
      b: { x: center.x + Math.cos(a1) * radiusPx, y: center.y + Math.sin(a1) * radiusPx },
      section: Math.min(count - 1, Math.floor(((t0 + t1) / 2) * count)),
    });
  }
  return segments;
}

/** Сегменты стены зоны: цепочка панелей (`wallPath`), кольцо или линия. */
export function zoneWallSegments(zone: ZoneWallSource, grid: AreaGrid): ZoneWallSegment[] {
  if (zone.wallPath && zone.wallPath.length >= 2) {
    return zone.wallPath.slice(1).map((b, i) => ({ a: zone.wallPath![i]!, b, section: i }));
  }
  const sectionFeet = zone.wall?.sectionFeet ?? 10;
  return zone.area.shape === 'ring' ? ringSegments(zone, grid, sectionFeet) : lineSegments(zone, grid, sectionFeet);
}

/** Число секций стены по её геометрии. */
export function zoneWallSectionCount(zone: ZoneWallSource, grid: AreaGrid): number {
  let count = 0;
  for (const segment of zoneWallSegments(zone, grid)) count = Math.max(count, segment.section + 1);
  return count;
}

/** Начальное состояние секций стены. */
export function createZoneSections(wall: ZoneWallDef, count: number): ZoneSection[] {
  const hp = wall.hp ?? 0;
  return Array.from({ length: count }, () => ({ hp, maxHp: hp }));
}

/** Защиты секции стены (иммунитеты/сопротивления/уязвимости) в формате урона. */
export function zoneWallDefenses(wall: ZoneWallDef): DamageDefense[] {
  const list: DamageDefense[] = [];
  (wall.immunities ?? []).forEach((damageType, i) =>
    list.push({ id: `wi${i}`, type: 'immunity', damageType })
  );
  (wall.resistances ?? []).forEach((damageType, i) =>
    list.push({ id: `wr${i}`, type: 'resistance', damageType })
  );
  (wall.vulnerabilities ?? []).forEach((damageType, i) =>
    list.push({ id: `wv${i}`, type: 'vulnerability', damageType })
  );
  return list;
}

function segmentWalls(
  zoneId: string,
  segments: ZoneWallSegment[],
  kind: Wall['kind'],
  axes: { movement: boolean; actions: boolean }
): Wall[] {
  const defaultActions = kind === 'wall';
  return segments.map((segment, i) => ({
    id: `zw:${zoneId}:${i}`,
    x1: segment.a.x,
    y1: segment.a.y,
    x2: segment.b.x,
    y2: segment.b.y,
    kind,
    ...(axes.movement ? {} : { blocksMovement: false }),
    ...(axes.actions !== defaultActions ? { blocksActions: axes.actions } : {}),
  }));
}

/** Препятствия-сегменты непробитых секций всех стен-зон (оси: движение/обзор/действия). */
export function zoneWallObstacles(zones: ZoneInstance[] | undefined, grid: AreaGrid): Wall[] {
  const walls: Wall[] = [];
  for (const zone of zones ?? []) {
    if (!zone.wall) continue;
    const intact = zoneWallSegments(zone, grid).filter((s) => !zone.sections?.[s.section]?.broken);
    // Оси стены независимы: обзор — kind (`wall`/`window`), движение и действия — флаги.
    const movement = zone.wall.blocksMovement !== false;
    const sight = zone.wall.blocksLineOfSight !== false;
    const actions = zone.wall.blocksActions !== false;
    walls.push(...segmentWalls(zone.id, intact, sight ? 'wall' : 'window', { movement, actions }));
  }
  return walls;
}

/** Стены сцены + непробитые сегменты стен-зон (общий список для движения/обзора). */
export function wallsWithZones(walls: Wall[], zones: ZoneInstance[] | undefined, grid: AreaGrid): Wall[] {
  const extra = zoneWallObstacles(zones, grid);
  return extra.length ? [...walls, ...extra] : walls;
}

/** Пересекает ли «лист» подошву токена в любой точке шага `from→to` (развёртка). */
function sheetHitsSweep(
  segment: ZoneWallSegment,
  token: Pick<Token, 'w' | 'h'>,
  from: AreaPoint,
  to: AreaPoint,
  steps = 4
): boolean {
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const rect = tokenRect({
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
      w: token.w,
      h: token.h,
    });
    if (segmentRectDistance(segment.a, segment.b, rect) <= 0) return true;
  }
  return false;
}

/** Сегменты пробитых секций, чей лист пересекает развёртка подошвы токена при шаге. */
export function zoneSheetCrossings(
  zone: ZoneInstance,
  token: Pick<Token, 'w' | 'h'>,
  from: AreaPoint,
  to: AreaPoint,
  grid: AreaGrid
): number[] {
  if (!zone.wall || !zone.sections?.some((s) => s.broken)) return [];
  const crossed = new Set<number>();
  for (const segment of zoneWallSegments(zone, grid)) {
    if (!zone.sections[segment.section]?.broken) continue;
    if (sheetHitsSweep(segment, token, from, to)) crossed.add(segment.section);
  }
  return [...crossed];
}

/** Токены, чью подошву стена разрезает (касание грани подошвы разрезом не считается). */
export function tokensCrossingSegments<S extends Pick<Token, 'x' | 'y' | 'w' | 'h'>>(
  tokens: S[],
  segments: ZoneWallSegment[]
): S[] {
  if (!segments.length) return [];
  const eps = 1;
  return tokens.filter((token) => {
    const rect = tokenRect(token);
    const inner: Rect = {
      x: rect.x + eps,
      y: rect.y + eps,
      w: Math.max(0, rect.w - eps * 2),
      h: Math.max(0, rect.h - eps * 2),
    };
    return segments.some((segment) => segmentRectDistance(segment.a, segment.b, inner) <= 0);
  });
}

/** Сторона выталкивания: `a` — левый нормаль хода стены, `b` — правый; undefined — сторона кастера. */
export type WallPushSide = 'a' | 'b';

export interface WallPushMove {
  tokenId: string;
  x: number;
  y: number;
}

export interface WallPushInput {
  /** Сегменты стены: выталкивание работает для любой геометрии (цепочка, кольцо, будущие стены). */
  segments: ZoneWallSegment[];
  /** Все токены карты — для проверки занятости клеток. */
  tokens: Pick<Token, 'id' | 'x' | 'y' | 'w' | 'h'>[];
  /** Разрезанные существа (кто смещается). */
  cut: Pick<Token, 'id' | 'x' | 'y' | 'w' | 'h'>[];
  grid: AreaGrid;
  bounds?: { cols: number; rows: number } | null;
  walls?: Wall[];
  side?: WallPushSide;
  caster?: { x: number; y: number } | null;
}

function nearestSegmentToPoint(p: AreaPoint, segments: ZoneWallSegment[]): ZoneWallSegment | null {
  let best: ZoneWallSegment | null = null;
  let bestDist = Infinity;
  for (const segment of segments) {
    const q = nearestPointOnSegment(p, segment.a, segment.b);
    const dist = Math.hypot(p.x - q.x, p.y - q.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = segment;
    }
  }
  return best;
}

/**
 * Минимальный сдвиг разрезанных стеной существ на выбранную сторону (по клеткам,
 * с сохранением чётности анкера подошвы). Сторона по умолчанию — где стоит кастер;
 * занятая сторона → противоположная; обе заняты — существо остаётся на месте.
 * Возвращает план перемещений (применяет вызывающий — сервер каста, клиент для превью).
 */
export function wallPushPlan(input: WallPushInput): WallPushMove[] {
  const { segments, grid } = input;
  if (!segments.length || !input.cut.length) return [];
  const size = grid.size;
  const offset = { x: grid.offsetX, y: grid.offsetY };
  const bounds = input.bounds ?? null;
  const occupied = new Set<string>();
  for (const token of input.tokens) for (const key of tokenCells(token, grid)) occupied.add(key);
  const moves: WallPushMove[] = [];

  for (const token of input.cut) {
    const panel = nearestSegmentToPoint(token, segments);
    if (!panel) continue;
    const ux = panel.b.x - panel.a.x;
    const uy = panel.b.y - panel.a.y;
    const len = Math.hypot(ux, uy) || 1;
    const u = { x: ux / len, y: uy / len };
    const crossTo = (p: AreaPoint) => u.x * (p.y - panel.a.y) - u.y * (p.x - panel.a.x);
    let sign = input.side === 'b' ? -1 : input.side === 'a' ? 1 : Math.sign(crossTo(input.caster ?? token));
    if (!sign) sign = 1;
    const cells = Math.max(1, Math.round(token.w / size));
    const ax = snapToGrid(token.x, offset.x, size, cells);
    const ay = snapToGrid(token.y, offset.y, size, cells);
    // Нормаль выбранной стороны — по ней выбираем лучшего кандидата (ровно наружу).
    const normal = { x: -u.y * sign, y: u.x * sign };

    const candidateClear = (point: AreaPoint): boolean => {
      const probe = { x: point.x, y: point.y, w: token.w, h: token.h };
      if (tokensCrossingSegments([probe], segments).length) return false;
      if (rectCrossesWalls(tokenRect(probe), input.walls ?? [], 'move')) return false;
      const cell = pointCell(point, grid);
      if (bounds) {
        for (const key of footprintCells(cell.cx, cell.cy, cells)) {
          const [cx, cy] = key.split(',').map(Number);
          if (cx! < 0 || cy! < 0 || cx! >= bounds.cols || cy! >= bounds.rows) return false;
        }
      }
      return !footprintHits(cell.cx, cell.cy, cells, occupied);
    };
    const pushTo = (wanted: number): WallPushMove | undefined => {
      for (let r = 1; r <= 3; r++) {
        const candidates: { x: number; y: number; dot: number; manhattan: number }[] = [];
        for (let dx = -r; dx <= r; dx++) {
          for (let dy = -r; dy <= r; dy++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const point = { x: ax + dx * size, y: ay + dy * size };
            if (Math.sign(crossTo(point)) !== wanted) continue;
            if (!candidateClear(point)) continue;
            candidates.push({ ...point, dot: dx * normal.x + dy * normal.y, manhattan: Math.abs(dx) + Math.abs(dy) });
          }
        }
        if (candidates.length) {
          candidates.sort((a, b) => b.dot - a.dot || a.manhattan - b.manhattan);
          const best = candidates[0]!;
          return { tokenId: token.id, x: best.x, y: best.y };
        }
      }
      return undefined;
    };

    const own = tokenCells(token, grid);
    for (const key of own) occupied.delete(key);
    const moved = pushTo(sign) ?? pushTo(-sign);
    if (!moved) {
      for (const key of own) occupied.add(key);
      continue;
    }
    moves.push(moved);
    const anchor = pointCell({ x: moved.x, y: moved.y }, grid);
    for (const key of footprintCells(anchor.cx, anchor.cy, cells)) occupied.add(key);
  }
  return moves;
}

/** Ближайшая точка сегментов к точке (проекция с зажимом). */
export function nearestSegmentPoint(p: AreaPoint, segments: ZoneWallSegment[]): AreaPoint | null {
  let best: AreaPoint | null = null;
  let bestDist = Infinity;
  for (const segment of segments) {
    const point = nearestPointOnSegment(p, segment.a, segment.b);
    const dist = Math.hypot(p.x - point.x, p.y - point.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = point;
    }
  }
  return best;
}

/** Середина секции (для метки HP и точки прицела). */
export function zoneWallSectionMidpoint(segments: ZoneWallSegment[], section: number): AreaPoint | null {
  const own = segments.filter((s) => s.section === section);
  if (!own.length) return null;
  const first = own[0]!;
  const last = own[own.length - 1]!;
  return { x: (first.a.x + last.b.x) / 2, y: (first.a.y + last.b.y) / 2 };
}

export interface ZoneSectionDamage {
  applied: number;
  note?: DamageDefenseType;
  broken: boolean;
}

/**
 * Урон по секции стены с её защитами (иммунитет/сопротивление/уязвимость).
 * Части без типа наследуют `mainType` (как в `applyDamage`). Пробитая секция — undefined.
 */
export function damageZoneSection(
  zone: ZoneInstance,
  section: number,
  parts: DamagePartAmount[],
  mainType?: string
): ZoneSectionDamage | undefined {
  const state = zone.sections?.[section];
  if (!zone.wall || !state || state.broken) return undefined;
  const typed = parts.map((part) => ({ ...part, damageType: part.damageType ?? mainType }));
  const result = applyDamageToParts(typed, zoneWallDefenses(zone.wall));
  state.hp = Math.max(0, state.hp - result.amount);
  if (state.hp <= 0) state.broken = true;
  return { applied: result.amount, note: result.note, broken: !!state.broken };
}
