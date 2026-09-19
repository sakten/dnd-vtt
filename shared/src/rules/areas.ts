import type { AreaSpec } from '../domain/actions';
import type { Wall } from '../domain/scene';
import type { Token } from '../domain/token';
import { crossesWalls } from './walls';

/**
 * Геометрия областей (Ф7) на квадратной сетке: набор клеток шаблона и сбор
 * попавших существ. Общая для клиента (подсветка) и сервера (применение).
 */

export const FEET_PER_CELL = 5;

export interface AreaGrid {
  size: number;
  offsetX: number;
  offsetY: number;
}

export interface AreaPoint {
  x: number;
  y: number;
}

export type DistanceMetric = 'euclidean' | 'chebyshev';

/** Клетка, в которой лежит точка. EPS защищает от FP-погрешности на границах (139.9 × 9 = 1259.1). */
export function pointCell(p: AreaPoint, grid: AreaGrid): { cx: number; cy: number } {
  const eps = 1e-6;
  return {
    cx: Math.floor((p.x - grid.offsetX) / grid.size + eps),
    cy: Math.floor((p.y - grid.offsetY) / grid.size + eps),
  };
}

/** Центр клетки в мировых координатах. */
export function cellCenter(cx: number, cy: number, grid: AreaGrid): AreaPoint {
  return {
    x: grid.offsetX + (cx + 0.5) * grid.size,
    y: grid.offsetY + (cy + 0.5) * grid.size,
  };
}

export function areaCellKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

/** Допуск по краям подошвы (px): координаты токенов хранятся с округлением до 0.1. */
const CELL_EDGE_EPS = 0.25;

/** Занимаемые токеном клетки (по ограничивающему прямоугольнику). */
export function tokenCells(token: Pick<Token, 'x' | 'y' | 'w' | 'h'>, grid: AreaGrid): string[] {
  const x0 = token.x - token.w / 2;
  const y0 = token.y - token.h / 2;
  const cx0 = Math.floor((x0 + CELL_EDGE_EPS - grid.offsetX) / grid.size);
  const cy0 = Math.floor((y0 + CELL_EDGE_EPS - grid.offsetY) / grid.size);
  const cx1 = Math.floor((x0 + token.w - CELL_EDGE_EPS - grid.offsetX) / grid.size);
  const cy1 = Math.floor((y0 + token.h - CELL_EDGE_EPS - grid.offsetY) / grid.size);
  const cells: string[] = [];
  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cy = cy0; cy <= cy1; cy++) cells.push(areaCellKey(cx, cy));
  }
  return cells;
}

/** Расстояние между точками в футах по выбранной метрике. */
function feet(a: AreaPoint, b: AreaPoint, grid: AreaGrid, metric: DistanceMetric): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const px = metric === 'chebyshev' ? Math.max(Math.abs(dx), Math.abs(dy)) : Math.hypot(dx, dy);
  return (px / grid.size) * FEET_PER_CELL;
}

/** Единичное направление от центра к `direction` (null, если направление не задано). */
function directionUnit(direction: AreaPoint | null, center: AreaPoint): AreaPoint | null {
  if (!direction || (direction.x === center.x && direction.y === center.y)) return null;
  const dx = direction.x - center.x;
  const dy = direction.y - center.y;
  const len = Math.hypot(dx, dy);
  return { x: dx / len, y: dy / len };
}

/** Попадает ли точка в шаблон (та же геометрия, что у `areaCells`). Вершина шаблона — всегда внутри. */
function pointInShape(
  spec: AreaSpec,
  center: AreaPoint,
  dir: AreaPoint | null,
  p: AreaPoint,
  grid: AreaGrid,
  metric: DistanceMetric
): boolean {
  const vx = p.x - center.x;
  const vy = p.y - center.y;
  const distanceFeet = feet(p, center, grid, 'euclidean');

  switch (spec.shape) {
    case 'sphere':
    case 'cylinder': {
      const d = metric === 'chebyshev' ? Math.max(Math.abs(vx), Math.abs(vy)) : Math.hypot(vx, vy);
      return (d / grid.size) * FEET_PER_CELL <= spec.size + 1e-6;
    }
    case 'cube': {
      const half = (spec.size / 2 / FEET_PER_CELL) * grid.size;
      return Math.abs(vx) <= half + 1e-6 && Math.abs(vy) <= half + 1e-6;
    }
    case 'cone': {
      if (!dir) return Math.hypot(vx, vy) < 1e-6;
      const lengthPx = (spec.size / FEET_PER_CELL) * grid.size;
      const proj = vx * dir.x + vy * dir.y;
      if (proj < -1e-6 || distanceFeet > spec.size + 1e-6) return false;
      const unit = distanceFeet > 0 ? { x: vx / Math.hypot(vx, vy), y: vy / Math.hypot(vx, vy) } : dir;
      const cos = unit.x * dir.x + unit.y * dir.y;
      return cos >= Math.cos((53 / 2) * (Math.PI / 180)) - 1e-6 && proj <= lengthPx + 1e-6;
    }
    case 'line': {
      if (!dir) return Math.hypot(vx, vy) < 1e-6;
      const lengthPx = (spec.size / FEET_PER_CELL) * grid.size;
      const halfWidthPx = ((spec.width ?? 5) / 2 / FEET_PER_CELL) * grid.size;
      const proj = vx * dir.x + vy * dir.y;
      if (proj < -1e-6 || proj > lengthPx + 1e-6) return false;
      const perp = Math.abs(vx * dir.y - vy * dir.x);
      return perp <= halfWidthPx + 1e-6;
    }
  }
}

/** Точка внутри шаблона (для проверок по конкретной цели — вижн-зоны, атаки). */
export function areaContainsPoint(
  spec: AreaSpec,
  origin: AreaPoint,
  direction: AreaPoint | null,
  point: AreaPoint,
  grid: AreaGrid,
  metric: DistanceMetric = 'euclidean'
): boolean {
  const originCell = pointCell(origin, grid);
  const center = cellCenter(originCell.cx, originCell.cy, grid);
  return pointInShape(spec, center, directionUnit(direction, center), point, grid, metric);
}

/**
 * Клетки, попавшие в шаблон. `origin` — точка привязки (для конуса/линии —
 * вершина), `direction` — направление для конуса/линии (мировая точка).
 */
export function areaCells(
  spec: AreaSpec,
  origin: AreaPoint,
  direction: AreaPoint | null,
  grid: AreaGrid,
  metric: DistanceMetric = 'euclidean'
): string[] {
  const originCell = pointCell(origin, grid);
  const center = cellCenter(originCell.cx, originCell.cy, grid);
  const dir = directionUnit(direction, center);
  const span = Math.ceil((spec.size + (spec.width ?? 0)) / FEET_PER_CELL) + 2;
  const keys: string[] = [];

  for (let cx = originCell.cx - span; cx <= originCell.cx + span; cx++) {
    for (let cy = originCell.cy - span; cy <= originCell.cy + span; cy++) {
      if (pointInShape(spec, center, dir, cellCenter(cx, cy, grid), grid, metric)) keys.push(areaCellKey(cx, cy));
    }
  }

  if (!keys.includes(areaCellKey(originCell.cx, originCell.cy))) {
    // Вершина всегда часть шаблона.
    keys.push(areaCellKey(originCell.cx, originCell.cy));
  }
  return keys;
}

/** Все занятые клетки токена внутри шаблона (Hunger of Hadar: «полностью внутри»). */
export function tokenFullyInArea<S extends Pick<Token, 'x' | 'y' | 'w' | 'h'>>(
  token: S,
  spec: AreaSpec,
  origin: AreaPoint,
  direction: AreaPoint | null,
  grid: AreaGrid,
  metric: DistanceMetric = 'euclidean'
): boolean {
  const cells = new Set(areaCells(spec, origin, direction, grid, metric));
  const own = tokenCells(token, grid);
  return own.length > 0 && own.every((key) => cells.has(key));
}

/** Существа, у которых хотя бы одна занятая клетка попала в шаблон. */
export function tokensInArea<S extends Pick<Token, 'x' | 'y' | 'w' | 'h'>>(
  tokens: S[],
  spec: AreaSpec,
  origin: AreaPoint,
  direction: AreaPoint | null,
  grid: AreaGrid,
  metric: DistanceMetric = 'euclidean',
  walls?: Wall[]
): S[] {
  let cells = new Set(areaCells(spec, origin, direction, grid, metric));
  // 5e: эффект распространяется по клеткам области и огибает углы; сплошная стена обрывает путь.
  if (walls && walls.length > 0) cells = spreadCells(cells, origin, grid, walls);
  return tokens.filter((t) => tokenCells(t, grid).some((key) => cells.has(key)));
}

/**
 * Видна ли от точки хотя бы одна клетка подошвы токена (5e: цель за укрытием
 * доступна, если виден её край; большие токены бьются через видимую клетку).
 */
export function tokenVisibleFrom(
  from: AreaPoint,
  token: Pick<Token, 'x' | 'y' | 'w' | 'h'>,
  walls: Wall[],
  grid: AreaGrid
): boolean {
  for (const key of tokenCells(token, grid)) {
    const [cx, cy] = key.split(',').map(Number);
    if (cx === undefined || cy === undefined) continue;
    if (!crossesWalls(from, cellCenter(cx, cy, grid), walls, 'sight')) return true;
  }
  return false;
}

/**
 * Клетки области, достижимые от вершины: заливка по 4 соседям, переход между
 * клетками запрещён, если их центры разделяет блокирующая стена (закрытая дверь).
 * Укрытие за краем стены не спасает — эффект обходит препятствие по клеткам.
 */
export function spreadCells(
  cells: Set<string>,
  origin: AreaPoint,
  grid: AreaGrid,
  walls: Wall[]
): Set<string> {
  const start = pointCell(origin, grid);
  const startKey = areaCellKey(start.cx, start.cy);
  if (!cells.has(startKey)) return cells;
  const reached = new Set<string>([startKey]);
  const queue: Array<{ cx: number; cy: number }> = [start];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head]!;
    const a = cellCenter(cur.cx, cur.cy, grid);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const next = { cx: cur.cx + dx, cy: cur.cy + dy };
      const key = areaCellKey(next.cx, next.cy);
      if (!cells.has(key) || reached.has(key)) continue;
      if (crossesWalls(a, cellCenter(next.cx, next.cy, grid), walls, 'sight')) continue;
      reached.add(key);
      queue.push(next);
    }
  }
  return reached;
}
