import { describe, expect, it } from 'vitest';
import type { Token, Wall } from 'shared';
import { partyViewers, visionRadiusCells, visibleCells } from './los';

const VISION_BASE = { width: 250, height: 150, cellSize: 50, offsetX: 0, offsetY: 0 };

function wall(x1: number, y1: number, x2: number, y2: number, kind: Wall['kind'] = 'wall', open = false): Wall {
  return { id: `w-${x1}-${y1}-${x2}-${y2}`, kind, x1, y1, x2, y2, ...(open ? { open: true } : {}) };
}

describe('visionRadiusCells', () => {
  it('вне темноты — без ограничения, в темноте — тёмное зрение или 1 клетка', () => {
    expect(visionRadiusCells(60, false)).toBeNull();
    expect(visionRadiusCells(0, false)).toBeNull();
    expect(visionRadiusCells(60, true)).toBe(12);
    expect(visionRadiusCells(0, true)).toBe(1);
    expect(visionRadiusCells(3, true)).toBe(1);
  });
});

describe('partyViewers', () => {
  const base = { x: 25, y: 25, darkvision: 60 };
  it('берёт только токены игроков и считает радиус', () => {
    const tokens = [{ ...base, isPlayerToken: true }, { ...base, x: 225, isPlayerToken: false }] as Token[];
    expect(partyViewers(tokens, false)).toEqual([{ x: 25, y: 25, radius: null }]);
    expect(partyViewers(tokens, true)).toEqual([{ x: 25, y: 25, radius: 12 }]);
  });
});

describe('visibleCells', () => {
  it('без зрителей — null (затемнения нет)', () => {
    expect(visibleCells({ ...VISION_BASE, walls: [], viewers: [] })).toBeNull();
  });

  it('открытая карта без ограничения видна целиком', () => {
    const cells = visibleCells({ ...VISION_BASE, walls: [], viewers: [{ x: 25, y: 75, radius: null }] });
    expect(cells?.size).toBe(15);
  });

  it('стена блокирует клетки за собой', () => {
    const cells = visibleCells({
      ...VISION_BASE,
      walls: [wall(100, 0, 100, 150)],
      viewers: [{ x: 25, y: 75, radius: null }],
    });
    expect(cells?.has('0,1')).toBe(true);
    expect(cells?.has('1,1')).toBe(true);
    expect(cells?.has('2,1')).toBe(false);
    expect(cells?.has('4,1')).toBe(false);
  });

  it('закрытая дверь блокирует обзор, открытая — нет; окно не блокирует', () => {
    const closed = visibleCells({
      ...VISION_BASE,
      walls: [wall(100, 0, 100, 150, 'door')],
      viewers: [{ x: 25, y: 75, radius: null }],
    });
    expect(closed?.has('4,1')).toBe(false);
    const open = visibleCells({
      ...VISION_BASE,
      walls: [wall(100, 0, 100, 150, 'door', true)],
      viewers: [{ x: 25, y: 75, radius: null }],
    });
    expect(open?.has('4,1')).toBe(true);
    const window = visibleCells({
      ...VISION_BASE,
      walls: [wall(100, 0, 100, 150, 'window')],
      viewers: [{ x: 25, y: 75, radius: null }],
    });
    expect(window?.has('4,1')).toBe(true);
  });

  it('радиус в темноте — клеточный: 1 клетка вокруг (3×3)', () => {
    const cells = visibleCells({ ...VISION_BASE, walls: [], viewers: [{ x: 125, y: 75, radius: 1 }] });
    expect(cells?.size).toBe(9);
    expect(cells?.has('2,1')).toBe(true);
    expect(cells?.has('3,2')).toBe(true);
    expect(cells?.has('3,3')).toBe(false);
  });

  it('обзор зрителей объединяется', () => {
    const cells = visibleCells({
      ...VISION_BASE,
      walls: [],
      viewers: [
        { x: 25, y: 25, radius: 1 },
        { x: 225, y: 125, radius: 1 },
      ],
    });
    expect(cells?.has('0,0')).toBe(true);
    expect(cells?.has('4,2')).toBe(true);
    expect(cells?.has('2,1')).toBe(false);
  });
});
