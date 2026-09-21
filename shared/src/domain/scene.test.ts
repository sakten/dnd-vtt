import { describe, expect, it } from 'vitest';
import { DEFAULT_GRID, gridOfMap } from './scene';

describe('gridOfMap', () => {
  it('сетка карты важнее дефолта комнаты', () => {
    const map = { grid: { ...DEFAULT_GRID, size: 100, offsetX: 10 } };
    expect(gridOfMap(map, { ...DEFAULT_GRID, size: 70 })).toMatchObject({ size: 100, offsetX: 10 });
  });

  it('без карты — дефолт комнаты, без обоих — DEFAULT_GRID', () => {
    expect(gridOfMap(undefined, { ...DEFAULT_GRID, size: 70 }).size).toBe(70);
    expect(gridOfMap(null, null)).toEqual(DEFAULT_GRID);
  });

  it('нулевой размер и частичные поля падают на дефолт', () => {
    const grid = gridOfMap({ grid: { size: 0, offsetY: undefined, snap: false } });
    expect(grid.size).toBe(50);
    expect(grid.offsetY).toBe(0);
    expect(grid.snap).toBe(false);
    expect(grid.color).toBe(DEFAULT_GRID.color);
  });
});
