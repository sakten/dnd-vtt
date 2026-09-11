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
): GridCell[] {
  if (!Number.isFinite(remainingFeet) || feetPerCell <= 0) return [];
  const maxCells = Math.floor(remainingFeet / feetPerCell);
  if (maxCells < 1) return [];

  const startP = ((diagonalsBefore % 2) + 2) % 2;
  const stateKey = (x: number, y: number, p: number) => `${x},${y},${p}`;
  const best = new Map<string, number>();
  const buckets: { x: number; y: number; p: number }[][] = Array.from({ length: maxCells + 1 }, () => []);
  const reach = new Map<string, GridCell>();

  best.set(stateKey(cx, cy, startP), 0);
  buckets[0].push({ x: cx, y: cy, p: startP });
  reach.set(`${cx},${cy}`, { cx, cy });

  for (let cost = 0; cost <= maxCells; cost++) {
    const bucket = buckets[cost];
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
          buckets[nextCost].push({ x: nx, y: ny, p: np });
        }
        reach.set(`${nx},${ny}`, { cx: nx, cy: ny });
      }
    }
  }
  return [...reach.values()];
}
