import { describe, expect, it } from 'vitest';
import type { Wall } from '../domain/scene';
import type { Token } from '../domain/token';
import {
  areaCellKey,
  areaCells,
  areaCellsSpread,
  cellCenter,
  cellChebyshev,
  pointCell,
  spreadCells,
  tokenCells,
  tokenFullyInArea,
  tokenVisibleFrom,
  tokensInArea,
  type AreaGrid,
} from './areas';

const grid: AreaGrid = { size: 50, offsetX: 0, offsetY: 0 };
const origin = cellCenter(0, 0, grid);
const east = { x: origin.x + 100, y: origin.y };

describe('клеточная геометрия', () => {
  it('pointCell: FP-граница уходит в соседнюю клетку, отрицательные — floor', () => {
    expect(pointCell({ x: 120, y: 25 }, grid)).toEqual({ cx: 2, cy: 0 });
    expect(pointCell({ x: 99.999999999, y: 0 }, grid).cx).toBe(2);
    expect(pointCell({ x: -1, y: -51 }, grid)).toEqual({ cx: -1, cy: -2 });
    expect(areaCellKey(2, 3)).toBe('2,3');
  });

  it('cellChebyshev: максимум по осям', () => {
    expect(cellChebyshev({ cx: 0, cy: 0 }, { cx: 3, cy: 1 })).toBe(3);
    expect(cellChebyshev({ cx: 2, cy: 5 }, { cx: 2, cy: 1 })).toBe(4);
  });
});

const wall = (x1: number, y1: number, x2: number, y2: number, kind: Wall['kind'] = 'wall', open = false): Wall => ({
  id: 'w1',
  x1,
  y1,
  x2,
  y2,
  kind,
  open,
});

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

  it('округление координат не добавляет лишнюю клетку (сетка 139.9, сдвиг 2.3)', () => {
    const oddGrid = { size: 139.9, offsetX: 2.3, offsetY: 2.3 };
    expect(tokenCells({ x: 1051.5, y: 1191.5, w: 139.9, h: 139.9 }, oddGrid)).toEqual(['7,8']);
  });

  it('попадание — по любой занятой клетке', () => {
    const tokens = [tokenAt(1, 0), tokenAt(9, 9)];
    const hit = tokensInArea(tokens, { shape: 'sphere', size: 10 }, origin, null, grid);
    expect(hit).toHaveLength(1);
    expect(hit[0]).toBe(tokens[0]);
  });

  it('tokenFullyInArea требует все занятые клетки внутри («полностью внутри»)', () => {
    const big = { x: 75, y: 25, w: 150, h: 50 }; // занимает клетки 0..2 (центры 0/5/10 фт)
    expect(tokenFullyInArea(big, { shape: 'sphere', size: 5 }, origin, null, grid)).toBe(false);
    expect(tokenFullyInArea(big, { shape: 'sphere', size: 10 }, origin, null, grid)).toBe(true);
  });
});

describe('распространение области и стены', () => {
  const sphere = { shape: 'sphere', size: 20 } as const;

  it('сплошная стена не пропускает эффект', () => {
    const walls = [wall(100, -300, 100, 300)];
    expect(tokensInArea([tokenAt(2, 0)], sphere, origin, null, grid, 'euclidean', walls)).toHaveLength(0);
  });

  it('закрытая дверь блокирует, открытая пропускает', () => {
    const closed = [wall(100, -300, 100, 300, 'door')];
    const open = [wall(100, -300, 100, 300, 'door', true)];
    expect(tokensInArea([tokenAt(2, 0)], sphere, origin, null, grid, 'euclidean', closed)).toHaveLength(0);
    expect(tokensInArea([tokenAt(2, 0)], sphere, origin, null, grid, 'euclidean', open)).toHaveLength(1);
  });

  it('эффект огибает край стены (укрытие не спасает)', () => {
    const walls = [wall(100, -25, 100, 25)];
    expect(tokensInArea([tokenAt(2, 1)], sphere, origin, null, grid, 'euclidean', walls)).toHaveLength(1);
  });

  it('без стен заливка совпадает с областью', () => {
    const cells = new Set(areaCells(sphere, origin, null, grid));
    expect(spreadCells(cells, origin, grid, [])).toEqual(cells);
  });

  it('цель видна, если видна хотя бы одна её клетка', () => {
    const big = { x: 175, y: 75, w: 100, h: 100 };
    expect(tokenVisibleFrom(origin, big, [wall(100, -25, 100, 25)], grid)).toBe(true);
    expect(tokenVisibleFrom(origin, big, [wall(100, -300, 100, 300)], grid)).toBe(false);
  });

  it('«полностью внутри» тоже обрезается стеной', () => {
    const big = { x: 75, y: 25, w: 100, h: 50 }; // клетки (0,0), (1,0), (2,0)
    expect(tokenFullyInArea(big, sphere, origin, null, grid)).toBe(true);
    expect(tokenFullyInArea(big, sphere, origin, null, grid, 'euclidean', [wall(100, -300, 100, 300)])).toBe(false);
  });

  it('диагональный конус распространяется даже при стенах на карте', () => {
    const ne = { x: origin.x + 200, y: origin.y - 200 };
    const walls = [wall(1000, 1000, 1050, 1050)]; // далёкая стена: заливка запускается, но не мешает
    const cells = areaCellsSpread({ shape: 'cone', size: 15 }, origin, ne, grid, walls);
    expect(cells.has('1,-1')).toBe(true);
    expect(cells.has('2,-2')).toBe(true);

    const lineCells = areaCellsSpread({ shape: 'line', size: 15, width: 5 }, origin, ne, grid, walls);
    expect(lineCells.has('1,-1')).toBe(true);
    expect(lineCells.has('2,-2')).toBe(true);
  });

  it('диагональный шаг через угол, занятый стеной, блокируется', () => {
    const ne = { x: origin.x + 200, y: origin.y - 200 };
    // Стена по ребру клеток (0,0)–(1,0): её конец касается общего угла (50, 0).
    const walls = [wall(50, 0, 50, 50)];
    const cells = areaCellsSpread({ shape: 'cone', size: 15 }, origin, ne, grid, walls);
    expect(cells.has('1,-1')).toBe(false);
  });
});
