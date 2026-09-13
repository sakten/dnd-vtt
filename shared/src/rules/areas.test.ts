import { describe, expect, it } from 'vitest';
import type { Token } from '../types';
import { areaCells, cellCenter, tokenCells, tokensInArea, type AreaGrid } from './areas';

const grid: AreaGrid = { size: 50, offsetX: 0, offsetY: 0 };
const origin = cellCenter(0, 0, grid);
const east = { x: origin.x + 100, y: origin.y };

function tokenAt(cx: number, cy: number): Pick<Token, 'x' | 'y' | 'w' | 'h'> {
  const c = cellCenter(cx, cy, grid);
  return { x: c.x, y: c.y, w: 50, h: 50 };
}

describe('areaCells', () => {
  it('сфера: центр клетки в радиусе (по прямой)', () => {
    const cells = new Set(areaCells({ shape: 'sphere', size: 20 }, origin, null, grid));
    expect(cells.has('0,0')).toBe(true);
    expect(cells.has('3,0')).toBe(true);
    expect(cells.has('4,0')).toBe(true);
    expect(cells.has('5,0')).toBe(false);
    expect(cells.has('3,3')).toBe(false);
  });

  it('сфера: метрику можно переключить на Чебышёва', () => {
    const cheb = new Set(areaCells({ shape: 'sphere', size: 20 }, origin, null, grid, 'chebyshev'));
    expect(cheb.has('4,4')).toBe(true);
    expect(new Set(areaCells({ shape: 'sphere', size: 20 }, origin, null, grid)).has('4,4')).toBe(false);
  });

  it('конус: 53° от направления и не дальше длины', () => {
    const cells = new Set(areaCells({ shape: 'cone', size: 15 }, origin, east, grid));
    expect(cells.has('0,0')).toBe(true);
    expect(cells.has('2,0')).toBe(true);
    expect(cells.has('4,0')).toBe(false);
    expect(cells.has('0,1')).toBe(false);
  });

  it('линия: длина и ширина 5 фт', () => {
    const cells = new Set(areaCells({ shape: 'line', size: 30, width: 5 }, origin, east, grid));
    expect(cells.has('6,0')).toBe(true);
    expect(cells.has('7,0')).toBe(false);
    expect(cells.has('0,1')).toBe(false);
  });

  it('куб: осевой квадрат со стороной N', () => {
    const cells = new Set(areaCells({ shape: 'cube', size: 15 }, origin, null, grid));
    expect(cells.has('-1,-1')).toBe(true);
    expect(cells.has('1,1')).toBe(true);
    expect(cells.has('2,0')).toBe(false);
  });

  it('конус/линия без направления — только вершина', () => {
    expect(areaCells({ shape: 'cone', size: 15 }, origin, null, grid)).toEqual(['0,0']);
    expect(areaCells({ shape: 'line', size: 30, width: 5 }, origin, null, grid)).toEqual(['0,0']);
  });
});

describe('tokenCells / tokensInArea', () => {
  it('токен занимает свои клетки', () => {
    expect(new Set(tokenCells({ x: 75, y: 25, w: 50, h: 50 }, grid))).toEqual(new Set(['1,0']));
    expect(new Set(tokenCells({ x: 100, y: 100, w: 100, h: 100 }, grid))).toEqual(
      new Set(['1,1', '2,1', '1,2', '2,2'])
    );
  });

  it('попадание — по любой занятой клетке', () => {
    const tokens = [tokenAt(1, 0), tokenAt(9, 9)];
    const hit = tokensInArea(tokens, { shape: 'sphere', size: 10 }, origin, null, grid);
    expect(hit).toHaveLength(1);
    expect(hit[0]).toBe(tokens[0]);
  });
});
