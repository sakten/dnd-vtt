import { describe, expect, it } from 'vitest';
import { visionRadiiCells, type Sense, type Token, type Wall } from 'shared';
import { visionViewers, visibleCells } from './los';

const VISION_BASE = { width: 250, height: 150, cellSize: 50, offsetX: 0, offsetY: 0 };

function wall(x1: number, y1: number, x2: number, y2: number, kind: Wall['kind'] = 'wall', open = false): Wall {
  return { id: `w-${x1}-${y1}-${x2}-${y2}`, kind, x1, y1, x2, y2, ...(open ? { open: true } : {}) };
}

describe('visionRadiiCells', () => {
  it('вне темноты — без ограничения', () => {
    expect(visionRadiiCells(false, [])).toEqual([null]);
    expect(visionRadiiCells(false, [{ type: 'darkvision', range: 60 }])).toEqual([null]);
  });

  it('в темноте — по типам восприятия, без них 1 клетка', () => {
    expect(visionRadiiCells(true, [])).toEqual([1]);
    expect(visionRadiiCells(true, [{ type: 'darkvision', range: 60 }])).toEqual([12]);
    const multi: Sense[] = [
      { type: 'darkvision', range: 60 },
      { type: 'blindsight', range: 10 },
    ];
    expect(visionRadiiCells(true, multi)).toEqual([12, 2]);
  });
});

describe('visionViewers', () => {
  const base = { x: 25, y: 25 };
  const ownOne = (t: Token) => t.name === 'Свой';
  const tokens = [
    { ...base, name: 'Свой', isPlayerToken: true, senses: [{ type: 'darkvision', range: 60 }] },
    { ...base, x: 225, name: 'Чужой', isPlayerToken: true, senses: [{ type: 'blindsight', range: 30 }] },
  ] as Token[];

  it('объединение — все токены игроков, свои — только контролируемые', () => {
    expect(visionViewers(tokens, false, true, ownOne)).toEqual([
      { x: 25, y: 25, radii: [null] },
      { x: 225, y: 25, radii: [null] },
    ]);
    expect(visionViewers(tokens, true, true, ownOne)).toEqual([
      { x: 25, y: 25, radii: [12] },
      { x: 225, y: 25, radii: [6] },
    ]);
    expect(visionViewers(tokens, true, false, ownOne)).toEqual([{ x: 25, y: 25, radii: [12] }]);
  });

  it('без своих токенов — откат к объединению', () => {
    expect(visionViewers(tokens, false, false, () => false)).toHaveLength(2);
  });
});

describe('visibleCells', () => {
  it('без зрителей — null (затемнения нет)', () => {
    expect(visibleCells({ ...VISION_BASE, walls: [], viewers: [] })).toBeNull();
  });

  it('открытая карта без ограничения видна целиком', () => {
    const cells = visibleCells({ ...VISION_BASE, walls: [], viewers: [{ x: 25, y: 75, radii: [null] }] });
    expect(cells?.size).toBe(15);
  });

  it('стена блокирует клетки за собой', () => {
    const cells = visibleCells({
      ...VISION_BASE,
      walls: [wall(100, 0, 100, 150)],
      viewers: [{ x: 25, y: 75, radii: [null] }],
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
      viewers: [{ x: 25, y: 75, radii: [null] }],
    });
    expect(closed?.has('4,1')).toBe(false);
    const open = visibleCells({
      ...VISION_BASE,
      walls: [wall(100, 0, 100, 150, 'door', true)],
      viewers: [{ x: 25, y: 75, radii: [null] }],
    });
    expect(open?.has('4,1')).toBe(true);
    const window = visibleCells({
      ...VISION_BASE,
      walls: [wall(100, 0, 100, 150, 'window')],
      viewers: [{ x: 25, y: 75, radii: [null] }],
    });
    expect(window?.has('4,1')).toBe(true);
  });

  it('радиус в темноте — клеточный: 1 клетка вокруг (3×3)', () => {
    const cells = visibleCells({ ...VISION_BASE, walls: [], viewers: [{ x: 125, y: 75, radii: [1] }] });
    expect(cells?.size).toBe(9);
    expect(cells?.has('2,1')).toBe(true);
    expect(cells?.has('3,2')).toBe(true);
    expect(cells?.has('3,3')).toBe(false);
  });

  it('несколько радиусов у зрителя объединяются (слепое + тёмное зрение)', () => {
    const cells = visibleCells({ ...VISION_BASE, walls: [], viewers: [{ x: 125, y: 75, radii: [1, 2] }] });
    expect(cells?.size).toBe(15);
    expect(cells?.has('0,0')).toBe(true);
    expect(cells?.has('4,2')).toBe(true);
  });

  it('обзор зрителей объединяется', () => {
    const cells = visibleCells({
      ...VISION_BASE,
      walls: [],
      viewers: [
        { x: 25, y: 25, radii: [1] },
        { x: 225, y: 125, radii: [1] },
      ],
    });
    expect(cells?.has('0,0')).toBe(true);
    expect(cells?.has('4,2')).toBe(true);
    expect(cells?.has('2,1')).toBe(false);
  });
});
