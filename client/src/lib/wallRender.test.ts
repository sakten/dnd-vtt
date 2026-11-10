import { describe, expect, it } from 'vitest';
import { areaCellKey, type Wall } from 'shared';
import { visibleWallPieces, wallPointVisible } from './wallRender';

const grid = { size: 50, offsetX: 0, offsetY: 0 };
const wall = (x1: number, y1: number, x2: number, y2: number, kind: Wall['kind'] = 'wall'): Wall => ({
  id: 'w1',
  kind,
  x1,
  y1,
  x2,
  y2,
});
const cells = (...keys: [number, number][]) => new Set(keys.map(([cx, cy]) => areaCellKey(cx, cy)));
const none = new Set<string>();

describe('wallPointVisible', () => {
  it('линия по границе клеток видна, если видима клетка с любой стороны', () => {
    expect(wallPointVisible(25, 50, cells([0, 0]), none, grid)).toBe(true);
    expect(wallPointVisible(25, 50, cells([0, 1]), none, grid)).toBe(true);
    expect(wallPointVisible(25, 50, cells([1, 0]), none, grid)).toBe(false);
  });

  it('туман скрывает клетку даже при формальной видимости', () => {
    expect(wallPointVisible(25, 50, cells([0, 0]), cells([0, 0]), grid)).toBe(false);
    expect(wallPointVisible(25, 50, cells([0, 0], [0, 1]), cells([0, 0]), grid)).toBe(true);
  });

  it('диагональ видна по клетке, в которой лежит', () => {
    expect(wallPointVisible(25, 25, cells([0, 0]), none, grid)).toBe(true);
    expect(wallPointVisible(75, 75, cells([0, 0]), none, grid)).toBe(false);
  });
});

describe('visibleWallPieces', () => {
  it('стена между видимой и скрытой клеткой остаётся целиком', () => {
    const pieces = visibleWallPieces([wall(0, 50, 50, 50)], cells([0, 0]), none, grid);
    expect(pieces).toHaveLength(1);
    expect(pieces[0]).toMatchObject({ x1: 0, y1: 50, x2: 50, y2: 50 });
  });

  it('стена между двумя скрытыми клетками не рисуется', () => {
    expect(visibleWallPieces([wall(0, 50, 50, 50)], cells([5, 5]), none, grid)).toEqual([]);
  });

  it('внутренняя стена видимой комнаты рисуется (обе стороны видимы)', () => {
    const pieces = visibleWallPieces([wall(50, 0, 50, 50)], cells([0, 0], [1, 0]), none, grid);
    expect(pieces).toHaveLength(1);
  });

  it('у длинной стены остаётся только видимый участок', () => {
    const pieces = visibleWallPieces([wall(0, 50, 150, 50)], cells([1, 0]), none, grid);
    expect(pieces).toHaveLength(1);
    expect(pieces[0]).toMatchObject({ x1: 50, y1: 50, x2: 100, y2: 50 });
  });

  it('двери и пустые клетки не попадают в куски', () => {
    expect(visibleWallPieces([wall(0, 50, 50, 50, 'door')], cells([0, 0]), none, grid)).toEqual([]);
    expect(visibleWallPieces([wall(0, 50, 50, 50)], none, none, grid)).toEqual([]);
  });

  it('окно рисуется как стена', () => {
    const pieces = visibleWallPieces([wall(0, 50, 50, 50, 'window')], cells([0, 0]), none, grid);
    expect(pieces).toHaveLength(1);
    expect(pieces[0]?.kind).toBe('window');
  });
});
