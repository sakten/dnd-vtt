import { describe, expect, it } from 'vitest';
import { visionRadiiCells, type LightArea, type Sense, type Token, type Wall } from 'shared';
import { visionViewers, visibleCells } from './los';

const VISION_BASE = {
  width: 250,
  height: 150,
  cellSize: 50,
  offsetX: 0,
  offsetY: 0,
  walls: [] as Wall[],
  darkness: false,
  areas: [] as LightArea[],
};

const viewer = (x: number, y: number, senses: Sense[] = []) => ({ x, y, senses });

function wall(x1: number, y1: number, x2: number, y2: number, kind: Wall['kind'] = 'wall', open = false): Wall {
  return { id: `w-${x1}-${y1}-${x2}-${y2}`, kind, x1, y1, x2, y2, ...(open ? { open: true } : {}) };
}

const area = (kind: LightArea['kind'], x: number, y: number, w: number, h: number): LightArea[] => [
  { id: `a-${kind}`, kind, x, y, w, h },
];

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

  it('магическая тьма не пропускает тёмное зрение, мгла — только слепое', () => {
    const senses: Sense[] = [
      { type: 'darkvision', range: 60 },
      { type: 'devilsight', range: 60 },
      { type: 'blindsight', range: 60 },
    ];
    expect(visionRadiiCells(false, senses, 'magical')).toEqual([12, 12]);
    expect(visionRadiiCells(false, senses, 'obscured')).toEqual([12]);
    expect(visionRadiiCells(false, senses, 'darkness')).toEqual([12, 12, 12]);
    expect(visionRadiiCells(false, [], 'magical')).toEqual([]);
    expect(visionRadiiCells(false, [{ type: 'darkvision', range: 60 }], 'obscured')).toEqual([]);
    expect(visionRadiiCells(true, [], null)).toEqual([1]);
  });
});

describe('visionViewers', () => {
  const ownOne = (t: Token) => t.name === 'Свой';
  const tokens = [
    { x: 25, y: 25, name: 'Свой', isPlayerToken: true, senses: [{ type: 'darkvision', range: 60 }] },
    { x: 225, y: 25, name: 'Чужой', isPlayerToken: true, senses: [{ type: 'blindsight', range: 30 }] },
  ] as Token[];

  it('объединение — все токены игроков, свои — только контролируемые', () => {
    expect(visionViewers(tokens, true, ownOne)).toEqual([
      { x: 25, y: 25, senses: [{ type: 'darkvision', range: 60 }] },
      { x: 225, y: 25, senses: [{ type: 'blindsight', range: 30 }] },
    ]);
    expect(visionViewers(tokens, false, ownOne)).toEqual([
      { x: 25, y: 25, senses: [{ type: 'darkvision', range: 60 }] },
    ]);
  });

  it('без своих токенов — откат к объединению', () => {
    expect(visionViewers(tokens, false, () => false)).toHaveLength(2);
  });
});

describe('visibleCells', () => {
  it('без зрителей — null (затемнения нет)', () => {
    expect(visibleCells({ ...VISION_BASE, viewers: [] })).toBeNull();
  });

  it('открытая карта без ограничения видна целиком', () => {
    const cells = visibleCells({ ...VISION_BASE, viewers: [viewer(25, 75)] });
    expect(cells?.size).toBe(15);
  });

  it('стена блокирует клетки за собой', () => {
    const cells = visibleCells({
      ...VISION_BASE,
      walls: [wall(100, 0, 100, 150)],
      viewers: [viewer(25, 75)],
    });
    expect(cells?.has('0,1')).toBe(true);
    expect(cells?.has('1,1')).toBe(true);
    expect(cells?.has('2,1')).toBe(false);
  });

  it('закрытая дверь блокирует обзор, открытая — нет; окно не блокирует', () => {
    const closed = visibleCells({
      ...VISION_BASE,
      walls: [wall(100, 0, 100, 150, 'door')],
      viewers: [viewer(25, 75)],
    });
    expect(closed?.has('4,1')).toBe(false);
    const open = visibleCells({
      ...VISION_BASE,
      walls: [wall(100, 0, 100, 150, 'door', true)],
      viewers: [viewer(25, 75)],
    });
    expect(open?.has('4,1')).toBe(true);
    const asWindow = visibleCells({
      ...VISION_BASE,
      walls: [wall(100, 0, 100, 150, 'window')],
      viewers: [viewer(25, 75)],
    });
    expect(asWindow?.has('4,1')).toBe(true);
  });

  it('в темноте без сенсов — 1 клетка вокруг (3×3)', () => {
    const cells = visibleCells({ ...VISION_BASE, darkness: true, viewers: [viewer(125, 75)] });
    expect(cells?.size).toBe(9);
    expect(cells?.has('2,1')).toBe(true);
    expect(cells?.has('3,2')).toBe(true);
    expect(cells?.has('3,3')).toBe(false);
  });

  it('тёмное зрение расширяет, но в магической тьме не работает', () => {
    const senses: Sense[] = [{ type: 'darkvision', range: 60 }];
    const bright = visibleCells({ ...VISION_BASE, darkness: true, viewers: [viewer(25, 75, senses)] });
    expect(bright?.has('2,1')).toBe(true);
    const magical = visibleCells({
      ...VISION_BASE,
      darkness: true,
      areas: area('magical', 100, 0, 150, 150),
      viewers: [viewer(25, 75, senses)],
    });
    expect(magical?.has('2,1')).toBe(false);
    const blindsight = visibleCells({
      ...VISION_BASE,
      darkness: true,
      areas: area('magical', 100, 0, 150, 150),
      viewers: [viewer(25, 75, [{ type: 'blindsight', range: 60 }])],
    });
    expect(blindsight?.has('2,1')).toBe(true);
  });

  it('мгла: без слепого зрения клетки закрыты, со слепым — видны', () => {
    const noSense = visibleCells({
      ...VISION_BASE,
      areas: area('obscured', 100, 0, 150, 150),
      viewers: [viewer(25, 75, [{ type: 'darkvision', range: 120 }])],
    });
    expect(noSense?.has('2,1')).toBe(false);
    const blinded = visibleCells({
      ...VISION_BASE,
      areas: area('obscured', 100, 0, 150, 150),
      viewers: [viewer(25, 75, [{ type: 'blindsight', range: 60 }])],
    });
    expect(blinded?.has('2,1')).toBe(true);
  });

  it('внутри магической тьмы/мглы без зрения не видно даже своей клетки', () => {
    const magical = visibleCells({
      ...VISION_BASE,
      areas: area('magical', 100, 0, 150, 150),
      viewers: [viewer(125, 75, [{ type: 'darkvision', range: 120 }])],
    });
    expect(magical?.has('2,1')).toBe(false);
    const obscured = visibleCells({
      ...VISION_BASE,
      areas: area('obscured', 100, 0, 150, 150),
      viewers: [viewer(125, 75)],
    });
    expect(obscured?.has('2,1')).toBe(false);
  });

  it('обзор зрителей объединяется', () => {
    const cells = visibleCells({
      ...VISION_BASE,
      darkness: true,
      viewers: [viewer(25, 25), viewer(225, 125)],
    });
    expect(cells?.has('0,0')).toBe(true);
    expect(cells?.has('4,2')).toBe(true);
    expect(cells?.has('2,1')).toBe(false);
  });
});
