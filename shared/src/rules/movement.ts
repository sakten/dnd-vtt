import { gridDistanceFeet, type GridBox } from './combat';
import type { ZoneInstance } from '../domain/automation';
import { snapToGrid, type Wall } from '../domain/scene';
import { areaCellKey, areaCells, cellCenter, pointCell, tokenCells, type AreaGrid } from './areas';
import { crossesWalls } from './walls';

export const DEFAULT_FEET_PER_CELL = 5;

/** Точка на сетке (мировые координаты, обычно центр токена). */
export interface GridPoint {
  x: number;
  y: number;
}

/** Клетка сетки по индексам. */
export interface GridCell {
  cx: number;
  cy: number;
}

export interface MovementCost {
  /** Стоимость сегмента в футах. */
  feet: number;
  /** Суммарное число диагональных шагов после сегмента. */
  diagonals: number;
}

/**
 * Стоимость шага по диагонали с чередованием: 1-я диагональ за ход — 5 фт,
 * 2-я — 10 фт, 3-я — 5 фт и т.д. `diagonalsBefore` — сколько диагоналей уже
 * пройдено за этот ход.
 */
export function diagonalStepCost(diagonalsBefore: number, feetPerCell = DEFAULT_FEET_PER_CELL): number {
  return diagonalsBefore % 2 === 0 ? feetPerCell : feetPerCell * 2;
}

/**
 * Стоимость перемещения между двумя точками по сетке в футах: ортогональные
 * шаги по `feetPerCell`, диагонали — с чередованием (см. `diagonalStepCost`).
 * Возвращает стоимость сегмента и новое число диагоналей.
 */
export function movementCost(
  from: GridPoint,
  to: GridPoint,
  gridSize: number,
  diagonalsBefore = 0,
  feetPerCell = DEFAULT_FEET_PER_CELL
): MovementCost {
  if (!Number.isFinite(gridSize) || gridSize <= 0) return { feet: 0, diagonals: diagonalsBefore };
  const dx = Math.round(Math.abs(to.x - from.x) / gridSize);
  const dy = Math.round(Math.abs(to.y - from.y) / gridSize);
  const diagSteps = Math.min(dx, dy);
  const straight = Math.abs(dx - dy);
  let feet = straight * feetPerCell;
  let diagonals = diagonalsBefore;
  for (let i = 0; i < diagSteps; i++) {
    feet += diagonalStepCost(diagonals, feetPerCell);
    diagonals += 1;
  }
  return { feet, diagonals };
}

const NEIGHBORS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/**
 * Покидает ли путь (цепочка мировых точек) досягаемость реактора: где-то был в
 * 5 фт, а после шага стал дальше. Размер мувера берётся из `mover`.
 */
export function pathLeavesReach(path: GridPoint[], reactor: GridBox, mover: GridBox, gridSize: number): boolean {
  if (path.length < 2) return false;
  for (let i = 0; i < path.length - 1; i++) {
    const before = gridDistanceFeet({ ...path[i]!, w: mover.w, h: mover.h }, reactor, gridSize);
    const after = gridDistanceFeet({ ...path[i + 1]!, w: mover.w, h: mover.h }, reactor, gridSize);
    if (before <= 5 && after > 5) return true;
  }
  return false;
}

/**
 * Клетки, достижимые за `remainingFeet` из клетки (cx, cy) с учётом
 * чередующейся стоимости диагоналей. Поиск по состояниям (клетка, чётность
 * диагоналей); стоимость в клетках, алгоритм Диала на малых дистанциях.
 */
export function reachableCells(
  cx: number,
  cy: number,
  remainingFeet: number,
  diagonalsBefore = 0,
  feetPerCell = DEFAULT_FEET_PER_CELL
): GridCell[] {  if (!Number.isFinite(remainingFeet) || feetPerCell <= 0) return [];
  const maxCells = Math.floor(remainingFeet / feetPerCell);
  if (maxCells < 1) return [];

  const startP = ((diagonalsBefore % 2) + 2) % 2;
  const stateKey = (x: number, y: number, p: number) => `${x},${y},${p}`;
  const best = new Map<string, number>();
  const buckets: { x: number; y: number; p: number }[][] = Array.from({ length: maxCells + 1 }, () => []);
  const reach = new Map<string, GridCell>();

  best.set(stateKey(cx, cy, startP), 0);
  buckets[0]!.push({ x: cx, y: cy, p: startP });
  reach.set(`${cx},${cy}`, { cx, cy });

  for (let cost = 0; cost <= maxCells; cost++) {
    const bucket = buckets[cost]!;
    for (const state of bucket) {
      if ((best.get(stateKey(state.x, state.y, state.p)) ?? Infinity) < cost) continue;
      for (const [dx, dy] of NEIGHBORS) {
        const diagonal = dx !== 0 && dy !== 0;
        const step = diagonal ? (state.p === 0 ? 1 : 2) : 1;
        const nextCost = cost + step;
        if (nextCost > maxCells) continue;
        const nx = state.x + dx;
        const ny = state.y + dy;
        const np = diagonal ? (state.p ^ 1) : state.p;
        const key = stateKey(nx, ny, np);
        if (nextCost < (best.get(key) ?? Infinity)) {
          best.set(key, nextCost);
          buckets[nextCost]!.push({ x: nx, y: ny, p: np });
        }
        reach.set(`${nx},${ny}`, { cx: nx, cy: ny });
      }
    }
  }
  return [...reach.values()];
}

export interface PathfindInput {
  /** Стартовая точка (мировые координаты, обычно центр токена). */
  from: GridPoint;
  /** Целевая точка (мировые координаты). */
  to: GridPoint;
  grid: AreaGrid;
  /** Границы карты в клетках; без значения — без ограничений. */
  bounds?: { cols: number; rows: number } | null;
  walls: Wall[];
  /** Непроходимые клетки (враги/нейтралы): ключи `areaCellKey`. */
  blocked?: Set<string>;
  /** Клетки удвоенной стоимости (союзники, сложная местность). */
  difficult?: Set<string>;
  /** Если задано — входить можно только в эти клетки (старт разрешён всегда). */
  allow?: Set<string>;
  /** Размер подошвы ходока в клетках: проходимость и сложная местность — по всем её клеткам. */
  moverCells?: number;
  /** Сколько диагоналей уже пройдено в этом ходу (чередование 5-10-5). */
  diagonalsBefore?: number;
  feetPerCell?: number;
}

export interface FoundPath {
  cells: GridCell[];
  /** Мировые точки (центры клеток) от старта к финишу. */
  points: GridPoint[];
  feet: number;
  diagonals: number;
}

interface PathNode {
  cx: number;
  cy: number;
  /** Чётность пройденных диагоналей (0 — следующая стоит 5 фт). */
  p: number;
  /** Стоимость в клетках (5 футов), сложная местность — ×2. */
  g: number;
  f: number;
  diag: number;
  parent?: PathNode;
}

/**
 * A* по клеткам: ортогональные шаги 5 фт, диагонали с чередованием 5-10-5,
 * сложная местность ×2; стены и закрытые двери/окна блокируют (`move`),
 * клетки из `blocked` непроходимы. Возвращает путь или null.
 */
export function findPath(input: PathfindInput): FoundPath | null {
  const { grid, walls } = input;
  const feetPerCell = input.feetPerCell ?? DEFAULT_FEET_PER_CELL;
  const blocked = input.blocked ?? new Set<string>();
  const difficult = input.difficult ?? new Set<string>();
  const diagonalsBefore = Math.max(0, input.diagonalsBefore ?? 0);
  const moverCells = Math.max(1, Math.round(input.moverCells ?? 1));
  const start = pointCell(input.from, grid);
  const goal = pointCell(input.to, grid);
  const inBounds = (cx: number, cy: number) =>
    !input.bounds || (cx >= 0 && cy >= 0 && cx < input.bounds.cols && cy < input.bounds.rows);
  if (!inBounds(goal.cx, goal.cy) || footprintHits(goal.cx, goal.cy, moverCells, blocked)) return null;

  const keyOf = (cx: number, cy: number, p: number) => `${cx},${cy},${p}`;
  const heuristic = (cx: number, cy: number) => Math.max(Math.abs(cx - goal.cx), Math.abs(cy - goal.cy));
  const startP = ((diagonalsBefore % 2) + 2) % 2;
  const startNode: PathNode = {
    cx: start.cx,
    cy: start.cy,
    p: startP,
    g: 0,
    f: heuristic(start.cx, start.cy),
    diag: 0,
  };
  const open: PathNode[] = [startNode];
  const best = new Map<string, number>([[keyOf(start.cx, start.cy, startP), 0]]);

  while (open.length > 0) {
    let idx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i]!.f < open[idx]!.f) idx = i;
    }
    const node = open.splice(idx, 1)[0]!;
    if (node.cx === goal.cx && node.cy === goal.cy) {
      const chain: PathNode[] = [];
      let cursor: PathNode | undefined = node;
      while (cursor) {
        chain.push(cursor);
        cursor = cursor.parent;
      }
      chain.reverse();
      return {
        cells: chain.map((n) => ({ cx: n.cx, cy: n.cy })),
        points: chain.map((n) => cellCenter(n.cx, n.cy, grid)),
        feet: node.g * feetPerCell,
        diagonals: diagonalsBefore + node.diag,
      };
    }
    const from = cellCenter(node.cx, node.cy, grid);
    for (const [dx, dy] of NEIGHBORS) {
      const cx = node.cx + dx;
      const cy = node.cy + dy;
      if (!inBounds(cx, cy)) continue;
      const key = areaCellKey(cx, cy);
      if (footprintHits(cx, cy, moverCells, blocked)) continue;
      if (input.allow && !input.allow.has(key) && !(cx === start.cx && cy === start.cy)) continue;
      const diagonal = dx !== 0 && dy !== 0;
      const to = cellCenter(cx, cy, grid);
      if (crossesWalls(from, to, walls, 'move')) continue;
      const stepUnits = (diagonal ? (node.p === 0 ? 1 : 2) : 1) * (footprintHits(cx, cy, moverCells, difficult) ? 2 : 1);
      const g = node.g + stepUnits;
      const p = diagonal ? node.p ^ 1 : node.p;
      const stateKey = keyOf(cx, cy, p);
      if (g >= (best.get(stateKey) ?? Infinity)) continue;
      best.set(stateKey, g);
      open.push({
        cx,
        cy,
        p,
        g,
        f: g + heuristic(cx, cy),
        diag: node.diag + (diagonal ? 1 : 0),
        parent: node,
      });
    }
  }
  return null;
}

/** Ближайшая свободная клетка к заданной (шахматные кольца до 4 клеток). */
export function nearestFreeCell(
  target: GridCell,
  blocked: Set<string>,
  bounds?: { cols: number; rows: number } | null,
  allowed?: Set<string> | null
): GridCell | null {
  const key = areaCellKey(target.cx, target.cy);
  if (!blocked.has(key) && (!allowed || allowed.has(key))) return target;
  for (let r = 1; r <= 4; r++) {
    let best: GridCell | null = null;
    let bestDist = Infinity;
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const cx = target.cx + dx;
        const cy = target.cy + dy;
        if (bounds && (cx < 0 || cy < 0 || cx >= bounds.cols || cy >= bounds.rows)) continue;
        const candidate = areaCellKey(cx, cy);
        if (blocked.has(candidate)) continue;
        if (allowed && !allowed.has(candidate)) continue;
        const dist = Math.hypot(dx, dy);
        if (dist < bestDist) {
          bestDist = dist;
          best = { cx, cy };
        }
      }
    }
    if (best) return best;
  }
  return null;
}

/** Клетки подошвы токена для клетки-якоря (чётные размеры — от пересечения, нечётные — от центра). */
export function footprintCells(cx: number, cy: number, cells: number): string[] {
  const lo = Math.floor(cells / 2);
  const hi = cells % 2 === 0 ? cells / 2 - 1 : lo;
  const keys: string[] = [];
  for (let x = cx - lo; x <= cx + hi; x++) {
    for (let y = cy - lo; y <= cy + hi; y++) keys.push(areaCellKey(x, y));
  }
  return keys;
}

/** Пересекается ли подошва токена (якорь `cx,cy`, размер `cells`) с множеством клеток. */
export function footprintHits(cx: number, cy: number, cells: number, set: Set<string>): boolean {
  const lo = Math.floor(cells / 2);
  const hi = cells % 2 === 0 ? cells / 2 - 1 : lo;
  for (let x = cx - lo; x <= cx + hi; x++) {
    for (let y = cy - lo; y <= cy + hi; y++) {
      if (set.has(areaCellKey(x, y))) return true;
    }
  }
  return false;
}

export interface PlanWalkMover {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  faction: string;
}

export interface PlanWalkInput {
  /** Центр токена-ходока (старт). */
  from: GridPoint;
  /** Целевая точка (курсор). */
  to: GridPoint;
  grid: AreaGrid;
  mapWidth: number;
  mapHeight: number;
  walls: Wall[];
  /** Все токены карты; ходок исключается по `moverId`. */
  tokens: PlanWalkMover[];
  moverId: string;
  /** Размер ходока в клетках: чётные привязаны к пересечениям, нечётные — к центрам. */
  cells: number;
  zones: ZoneInstance[];
  /** Клетки, видимые игроку: ходить можно только по ним (null — без ограничения). */
  visible?: Set<string> | null;
  /** Полная слепота (магическая тьма/мгла без зрения): не больше одной клетки за ход. */
  blind?: boolean;
  diagonalsBefore?: number;
}

/**
 * План похода: A* со стенами/дверями; подошва ходока (1×1, 2×2, …) проверяется по
 * всем своим клеткам: враги/нейтралы непроходимы, союзники и сложная местность — ×2;
 * цель, чья подошва накрывает другого, — отмена. Первая точка — ровно текущая позиция.
 */
export function planWalk(input: PlanWalkInput): FoundPath | null {
  const { grid, walls } = input;
  const cells = Math.max(1, Math.round(input.cells || 1));
  const cols = Math.max(1, Math.ceil(input.mapWidth / grid.size));
  const rows = Math.max(1, Math.ceil(input.mapHeight / grid.size));
  const blocked = new Set<string>();
  const difficult = new Set<string>();
  const occupied = new Set<string>();
  for (const other of input.tokens) {
    if (other.id === input.moverId) continue;
    const friendly = other.faction === 'ally';
    for (const key of tokenCells(other, grid)) {
      occupied.add(key);
      if (friendly) difficult.add(key);
      else blocked.add(key);
    }
  }
  for (const zone of input.zones) {
    if (!zone.flags?.difficultTerrain) continue;
    for (const key of areaCells(zone.area, zone.origin, zone.direction ?? null, grid)) difficult.add(key);
  }
  const bounds = { cols, rows };
  const even = cells % 2 === 0;
  const node = (cell: GridCell) =>
    even
      ? { x: grid.offsetX + cell.cx * grid.size, y: grid.offsetY + cell.cy * grid.size }
      : cellCenter(cell.cx, cell.cy, grid);

  // Полная слепота: шаг только в одну соседнюю свободную клетку (без опоры на видимость).
  if (input.blind) {
    const fromCell = pointCell(input.from, grid);
    let best: GridCell | null = null;
    let bestDist = Infinity;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const cx = fromCell.cx + dx;
        const cy = fromCell.cy + dy;
        if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
        if (footprintHits(cx, cy, cells, blocked)) continue;
        if (footprintHits(cx, cy, cells, occupied)) continue;
        const center = cellCenter(cx, cy, grid);
        if (crossesWalls(input.from, center, walls, 'move')) continue;
        const distance = Math.hypot(center.x - input.to.x, center.y - input.to.y);
        if (distance < bestDist) {
          bestDist = distance;
          best = { cx, cy };
        }
      }
    }
    if (!best) return null;
    const point = node(best);
    const cost = movementCost(input.from, point, grid.size, input.diagonalsBefore ?? 0);
    return { cells: [fromCell, best], points: [input.from, point], feet: cost.feet, diagonals: cost.diagonals };
  }

  const visible = input.visible ?? null;
  const cursorCell = pointCell(input.to, grid);
  // Якорь постановки: чётные размеры — по пересечениям, нечётные — по центрам.
  const anchorPoint = {
    x: snapToGrid(input.to.x, grid.offsetX, grid.size, cells),
    y: snapToGrid(input.to.y, grid.offsetY, grid.size, cells),
  };
  const anchorCell = pointCell(anchorPoint, grid);
  // В невидимую клетку ходить нельзя: маршрут отменяется (кроме режима слепоты выше).
  if (visible && !visible.has(areaCellKey(cursorCell.cx, cursorCell.cy))) return null;
  // Конечная клетка должна быть свободной: подошва целиком, цель на занятой клетке не выбирается.
  if (footprintHits(anchorCell.cx, anchorCell.cy, cells, occupied)) return null;
  const startCell = pointCell(input.from, grid);
  if (anchorCell.cx === startCell.cx && anchorCell.cy === startCell.cy) return null;
  const found = findPath({
    from: input.from,
    to: anchorPoint,
    grid,
    bounds,
    walls,
    blocked,
    difficult,
    allow: visible ?? undefined,
    moverCells: cells,
    diagonalsBefore: input.diagonalsBefore ?? 0,
  });
  if (!found) return null;
  const points: GridPoint[] = [];
  for (let i = 0; i < found.cells.length; i++) {
    const cell = found.cells[i]!;
    const snapped = i === found.cells.length - 1 ? anchorPoint : node(cell);
    const last = points[points.length - 1];
    if (!last || last.x !== snapped.x || last.y !== snapped.y) points.push(snapped);
  }
  points[0] = { x: input.from.x, y: input.from.y };
  return { ...found, points };
}
