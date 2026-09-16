import { describe, expect, it } from 'vitest';
import type { ZoneInstance } from '../domain/automation';
import type { Wall } from '../domain/scene';
import { diagonalStepCost, findPath, movementCost, nearestFreeCell, planWalk, reachableCells } from './movement';

describe('diagonalStepCost', () => {
  it('чередует 5 и 10 футов', () => {
    expect(diagonalStepCost(0)).toBe(5);
    expect(diagonalStepCost(1)).toBe(10);
    expect(diagonalStepCost(2)).toBe(5);
    expect(diagonalStepCost(3)).toBe(10);
  });

  it('уважает feetPerCell', () => {
    expect(diagonalStepCost(1, 10)).toBe(20);
  });
});

describe('movementCost', () => {
  it('ортогональный шаг', () => {
    expect(movementCost({ x: 0, y: 0 }, { x: 50, y: 0 }, 50)).toEqual({ feet: 5, diagonals: 0 });
  });

  it('одиночная и вторая диагональ', () => {
    expect(movementCost({ x: 0, y: 0 }, { x: 50, y: 50 }, 50)).toEqual({ feet: 5, diagonals: 1 });
    // 1-я диагональ 5 + 2-я 10 = 15 за сегмент
    expect(movementCost({ x: 0, y: 0 }, { x: 100, y: 100 }, 50)).toEqual({ feet: 15, diagonals: 2 });
  });

  it('продолжает чередование от diagonalsBefore', () => {
    expect(movementCost({ x: 0, y: 0 }, { x: 50, y: 50 }, 50, 1)).toEqual({ feet: 10, diagonals: 2 });
    expect(movementCost({ x: 0, y: 0 }, { x: 50, y: 50 }, 50, 2)).toEqual({ feet: 5, diagonals: 3 });
  });

  it('смешанный сегмент: 1 прямая + 1 диагональ', () => {
    // dx=2, dy=1 → 1 ортогональный (5) + 1 диагональ (5)
    expect(movementCost({ x: 0, y: 0 }, { x: 100, y: 50 }, 50)).toEqual({ feet: 10, diagonals: 1 });
  });

  it('защита от некорректной сетки', () => {
    expect(movementCost({ x: 0, y: 0 }, { x: 100, y: 0 }, 0)).toEqual({ feet: 0, diagonals: 0 });
    expect(movementCost({ x: 0, y: 0 }, { x: 100, y: 0 }, Number.NaN)).toEqual({ feet: 0, diagonals: 0 });
  });
});

const has = (cells: { cx: number; cy: number }[], cx: number, cy: number) =>
  cells.some((c) => c.cx === cx && c.cy === cy);

describe('reachableCells', () => {
  it('на 5 фт достижимы центр и 8 соседей (первая диагональ дешёвая)', () => {
    const cells = reachableCells(0, 0, 5);
    expect(has(cells, 0, 0)).toBe(true);
    expect(has(cells, 1, 1)).toBe(true);
    expect(has(cells, -1, 1)).toBe(true);
    expect(cells).toHaveLength(9);
  });

  it('вторая диагональ стоит 10 — (2,2) за 10 фт недостижимо, (2,0) достижимо', () => {
    const cells = reachableCells(0, 0, 10);
    expect(has(cells, 2, 0)).toBe(true);
    expect(has(cells, 2, 2)).toBe(false);
    expect(has(cells, 1, 1)).toBe(true);
  });

  it('учитывает чётность уже пройденных диагоналей', () => {
    const afterOne = reachableCells(0, 0, 5, 1);
    expect(has(afterOne, 1, 1)).toBe(false);
    expect(has(afterOne, 1, 0)).toBe(true);

    const afterOneTen = reachableCells(0, 0, 10, 1);
    expect(has(afterOneTen, 1, 1)).toBe(true);
  });

  it('меньше клетки — пусто', () => {
    expect(reachableCells(0, 0, 4)).toEqual([]);
  });
});

const GRID = { size: 50, offsetX: 0, offsetY: 0 };
const BOUNDS = { cols: 5, rows: 3 };
const wall = (x1: number, y1: number, x2: number, y2: number): Wall => ({
  id: 'w1',
  kind: 'wall',
  x1,
  y1,
  x2,
  y2,
});

describe('findPath', () => {
  it('прямой путь по открытой карте', () => {
    const path = findPath({ from: { x: 25, y: 25 }, to: { x: 125, y: 25 }, grid: GRID, bounds: BOUNDS, walls: [] });
    expect(path?.cells).toEqual([
      { cx: 0, cy: 0 },
      { cx: 1, cy: 0 },
      { cx: 2, cy: 0 },
    ]);
    expect(path?.feet).toBe(10);
    expect(path?.points[path.points.length - 1]).toEqual({ x: 125, y: 25 });
  });

  it('диагонали чередуют 5/10', () => {
    const path = findPath({ from: { x: 25, y: 25 }, to: { x: 125, y: 125 }, grid: GRID, bounds: BOUNDS, walls: [] });
    expect(path?.feet).toBe(15);
    expect(path?.diagonals).toBe(2);
  });

  it('стена заставляет обойти', () => {
    const path = findPath({
      from: { x: 25, y: 25 },
      to: { x: 125, y: 25 },
      grid: GRID,
      bounds: BOUNDS,
      walls: [wall(100, 0, 100, 50)],
    });
    expect(path).not.toBeNull();
    expect(path!.feet).toBe(15);
    expect(path!.cells[path!.cells.length - 1]).toEqual({ cx: 2, cy: 0 });
    expect(path!.cells).not.toContainEqual({ cx: 1, cy: 0 });
    expect(path!.cells.length).toBeGreaterThanOrEqual(3);
  });

  it('сложная местность удваивает стоимость', () => {
    const path = findPath({
      from: { x: 25, y: 25 },
      to: { x: 125, y: 25 },
      grid: GRID,
      bounds: { cols: 5, rows: 1 },
      walls: [],
      difficult: new Set(['1,0']),
    });
    expect(path?.cells.map((c) => `${c.cx},${c.cy}`)).toEqual(['0,0', '1,0', '2,0']);
    expect(path?.feet).toBe(15);
  });

  it('непроходимая цель и подбор ближайшей свободной клетки', () => {
    const blocked = new Set(['2,0']);
    expect(
      findPath({ from: { x: 25, y: 25 }, to: { x: 125, y: 25 }, grid: GRID, bounds: BOUNDS, walls: [], blocked })
    ).toBeNull();
    expect(nearestFreeCell({ cx: 2, cy: 0 }, blocked, BOUNDS)).toEqual({ cx: 1, cy: 0 });
  });
});

describe('planWalk', () => {
  const base = {
    grid: GRID,
    mapWidth: 250,
    mapHeight: 150,
    walls: [] as Wall[],
    tokens: [],
    moverId: 't1',
    cells: 1,
    zones: [] as ZoneInstance[],
  };

  it('1×1 идёт по центрам, старт — ровно позиция токена', () => {
    const path = planWalk({ ...base, from: { x: 25, y: 75 }, to: { x: 125, y: 75 } });
    expect(path?.points[0]).toEqual({ x: 25, y: 75 });
    expect(path?.points[path.points.length - 1]).toEqual({ x: 125, y: 75 });
    expect(path?.feet).toBe(10);
  });

  it('2×2 идёт по пересечениям линий', () => {
    const path = planWalk({ ...base, cells: 2, from: { x: 100, y: 100 }, to: { x: 200, y: 100 } });
    expect(path).not.toBeNull();
    expect(path!.points.every((p) => p.x % GRID.size === 0 && p.y % GRID.size === 0)).toBe(true);
  });

  it('видимость ограничивает маршрут, в невидимую цель — отмена', () => {
    const visible = new Set(['0,1', '1,1', '2,1']);
    const path = planWalk({ ...base, from: { x: 25, y: 75 }, to: { x: 125, y: 75 }, visible });
    expect(path?.cells.map((c) => `${c.cx},${c.cy}`)).toEqual(['0,1', '1,1', '2,1']);
    expect(planWalk({ ...base, from: { x: 25, y: 75 }, to: { x: 225, y: 75 }, visible })).toBeNull();
  });

  it('полная слепота: ровно один шаг в соседнюю клетку к курсору', () => {
    const path = planWalk({ ...base, from: { x: 25, y: 75 }, to: { x: 225, y: 25 }, blind: true });
    expect(path?.points).toHaveLength(2);
    expect(path?.cells[1]).toEqual({ cx: 1, cy: 0 });
    expect(path?.feet).toBe(5);
  });

  it('враги/нейтралы блокируют, союзники — сложная местность', () => {
    const enemy = [{ id: 'e1', x: 75, y: 75, w: 50, h: 50, faction: 'enemy' }];
    expect(planWalk({ ...base, from: { x: 25, y: 75 }, to: { x: 75, y: 75 }, tokens: enemy })).toBeNull();
    const ally = [{ id: 'a1', x: 75, y: 75, w: 50, h: 50, faction: 'ally' }];
    const path = planWalk({ ...base, from: { x: 25, y: 75 }, to: { x: 125, y: 75 }, tokens: ally });
    expect(path?.feet).toBe(15);
  });
});
