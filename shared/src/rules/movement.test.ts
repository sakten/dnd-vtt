import { describe, expect, it } from 'vitest';
import { diagonalStepCost, movementCost, reachableCells } from './movement';

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
