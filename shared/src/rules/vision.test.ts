import { describe, expect, it } from 'vitest';
import type { ZoneInstance } from '../domain/automation';
import type { Sense } from '../domain/sense';
import type { LightArea, LightAreaKind, Wall } from '../domain/scene';
import { canSee, lightCells, lightLevelAt, tokenSenses, zoneVisionCells, zoneVisionKindAt } from './vision';
import { countAttackAdvantage } from './combat';

const SIGHT = { walls: [] as Wall[], darkness: false, cellSize: 50, offsetX: 0, offsetY: 0 };
const DARK_SIGHT = { ...SIGHT, darkness: true };

const wall = (x1: number, y1: number, x2: number, y2: number): Wall => ({
  id: 'w1',
  kind: 'wall',
  x1,
  y1,
  x2,
  y2,
});

describe('canSee', () => {
  it('вне темноты видно без ограничения дальности; стена блокирует', () => {
    expect(canSee({ x: 25, y: 75 }, { x: 625, y: 75 }, undefined, SIGHT)).toBe(true);
    expect(canSee({ x: 25, y: 75 }, { x: 625, y: 75 }, undefined, { ...SIGHT, walls: [wall(300, 0, 300, 150)] })).toBe(
      false
    );
  });

  it('в темноте без сенсов — 1 клетка вокруг; тёмное зрение расширяет радиус', () => {
    expect(canSee({ x: 25, y: 25 }, { x: 75, y: 25 }, undefined, DARK_SIGHT)).toBe(true);
    expect(canSee({ x: 25, y: 25 }, { x: 125, y: 25 }, undefined, DARK_SIGHT)).toBe(false);
    const darkvision: Sense[] = [{ type: 'darkvision', range: 60 }];
    expect(canSee({ x: 25, y: 25 }, { x: 125, y: 25 }, darkvision, DARK_SIGHT)).toBe(true);
    expect(canSee({ x: 25, y: 25 }, { x: 675, y: 25 }, darkvision, DARK_SIGHT)).toBe(false);
  });

  it('слепое и дьявольское зрение тоже действуют в темноте', () => {
    const senses: Sense[] = [
      { type: 'blindsight', range: 10 },
      { type: 'devilsight', range: 120 },
    ];
    expect(canSee({ x: 25, y: 25 }, { x: 125, y: 25 }, senses, DARK_SIGHT)).toBe(true);
  });

  it('стена блокирует и тёмное зрение', () => {
    const darkvision: Sense[] = [{ type: 'darkvision', range: 120 }];
    expect(canSee({ x: 25, y: 75 }, { x: 225, y: 75 }, darkvision, { ...DARK_SIGHT, walls: [wall(100, 0, 100, 150)] })).toBe(
      false
    );
  });
});

describe('свет заклинаний', () => {
  const grid = { size: 50, offsetX: 0, offsetY: 0 };

  it('lightCells: яркий круг, сумерки за ним и тени от стен', () => {
    const cells = lightCells([{ x: 25, y: 25, light: { bright: 10, dim: 10 } }], grid);
    expect(cells.get('0,0')).toBe('bright');
    expect(cells.get('2,0')).toBe('bright'); // 10 фт
    expect(cells.get('3,0')).toBe('dim'); // 15 фт
    expect(cells.get('4,0')).toBe('dim'); // 20 фт
    expect(cells.get('5,0')).toBeUndefined();

    const shadowed = lightCells([{ x: 25, y: 25, light: { bright: 20, dim: 0 } }], grid, [wall(50, 0, 50, 200)]);
    expect(shadowed.get('0,0')).toBe('bright');
    expect(shadowed.get('2,0')).toBeUndefined(); // за стеной света нет
  });

  it('canSee: свет перекрывает обычную тьму, но не мглу и магическую тьму', () => {
    const light = lightCells([{ x: 625, y: 75, light: { bright: 20, dim: 0 } }], grid);
    expect(canSee({ x: 25, y: 25 }, { x: 625, y: 75 }, undefined, { ...DARK_SIGHT, light })).toBe(true);
    const magical: LightArea[] = [{ id: 'a1', kind: 'magical', x: 600, y: 50, w: 50, h: 50 }];
    expect(canSee({ x: 25, y: 25 }, { x: 625, y: 75 }, undefined, { ...DARK_SIGHT, light, areas: magical })).toBe(
      false
    );
  });
});

describe('canSee: области', () => {
  const from = { x: 25, y: 75 };
  const target = { x: 125, y: 75 };
  const area = (kind: LightAreaKind): LightArea[] => [{ id: 'a1', kind, x: 100, y: 0, w: 50, h: 150 }];
  const darkvision: Sense[] = [{ type: 'darkvision', range: 60 }];
  const devilsight: Sense[] = [{ type: 'devilsight', range: 60 }];
  const blindsight: Sense[] = [{ type: 'blindsight', range: 60 }];

  it('тьма: любое восприятие работает', () => {
    expect(canSee(from, target, darkvision, { ...SIGHT, areas: area('darkness') })).toBe(true);
    expect(canSee(from, target, devilsight, { ...SIGHT, areas: area('darkness') })).toBe(true);
  });

  it('магическая тьма: тёмное зрение не работает, дьявольское и слепое — да', () => {
    expect(canSee(from, target, darkvision, { ...SIGHT, areas: area('magical') })).toBe(false);
    expect(canSee(from, target, devilsight, { ...SIGHT, areas: area('magical') })).toBe(true);
    expect(canSee(from, target, blindsight, { ...SIGHT, areas: area('magical') })).toBe(true);
  });

  it('магическая тьма и мгла: без подходящего зрения видна только своя клетка', () => {
    const own = { x: 125, y: 75 };
    const next = { x: 175, y: 75 };
    expect(canSee(own, own, undefined, { ...SIGHT, areas: area('magical') })).toBe(true);
    expect(canSee(own, next, undefined, { ...SIGHT, areas: area('magical') })).toBe(false);
    expect(canSee(own, own, darkvision, { ...SIGHT, areas: area('obscured') })).toBe(true);
    expect(canSee(own, next, darkvision, { ...SIGHT, areas: area('obscured') })).toBe(false);
  });

  it('зритель внутри магической тьмы не видит и наружу без дьявольского/слепого зрения', () => {
    const own = { x: 125, y: 75 };
    const outside = { x: 325, y: 75 };
    const devilsight: Sense[] = [{ type: 'devilsight', range: 60 }];
    expect(canSee(own, outside, darkvision, { ...SIGHT, areas: area('magical') })).toBe(false);
    expect(canSee(own, outside, devilsight, { ...SIGHT, areas: area('magical') })).toBe(true);
    expect(canSee(own, outside, undefined, { ...SIGHT, areas: area('obscured') })).toBe(false);
  });

  it('мгла: только слепое зрение', () => {
    expect(canSee(from, target, devilsight, { ...SIGHT, areas: area('obscured') })).toBe(false);
    expect(canSee(from, target, blindsight, { ...SIGHT, areas: area('obscured') })).toBe(true);
    expect(canSee(from, target, darkvision, { ...SIGHT, areas: area('obscured') })).toBe(false);
  });
});

describe('tokenSenses', () => {
  it('объединяет сенсы токена и эффектов, берёт максимум по типу', () => {
    const token = {
      senses: [{ type: 'darkvision', range: 60 }],
      effects: [
        { senses: [{ type: 'darkvision', range: 150 }] },
        { senses: [{ type: 'devilsight', range: 120 }] },
      ],
    } as unknown as Parameters<typeof tokenSenses>[0];
    expect(tokenSenses(token)).toEqual([
      { type: 'darkvision', range: 150 },
      { type: 'devilsight', range: 120 },
    ]);
  });
});

describe('вижн-зоны заклинаний', () => {
  const grid = { size: 50, offsetX: 0, offsetY: 0 };
  const zone = (flags: ZoneInstance['flags'], size = 20): ZoneInstance => ({
    id: 'z1',
    name: 'Z',
    sourceKey: 'k',
    sourceId: 's',
    origin: { x: 125, y: 75 },
    area: { shape: 'sphere', size },
    duration: { type: 'rounds', rounds: 10 },
    flags,
  });

  it('blocksLight — магическая тьма, obscured heavy — мгла, light — без эффекта', () => {
    expect(zoneVisionKindAt([zone({ blocksLight: true })], { x: 125, y: 75 }, grid)).toBe('magical');
    expect(zoneVisionKindAt([zone({ obscured: 'heavy' })], { x: 125, y: 75 }, grid)).toBe('obscured');
    expect(zoneVisionKindAt([zone({ obscured: 'light' })], { x: 125, y: 75 }, grid)).toBeNull();
    expect(zoneVisionKindAt([zone({ difficultTerrain: true })], { x: 125, y: 75 }, grid)).toBeNull();
  });

  it('клетки вижн-зон и canSee учитывают зону', () => {
    const cells = zoneVisionCells([zone({ blocksLight: true }, 15)], grid);
    expect(cells.get('2,1')).toBe('magical');
    const zones = [zone({ blocksLight: true }, 15)];
    const darkvision: Sense[] = [{ type: 'darkvision', range: 60 }];
    const devilsight: Sense[] = [{ type: 'devilsight', range: 60 }];
    expect(canSee({ x: 25, y: 75 }, { x: 125, y: 75 }, darkvision, { ...SIGHT, zones })).toBe(false);
    expect(canSee({ x: 25, y: 75 }, { x: 125, y: 75 }, devilsight, { ...SIGHT, zones })).toBe(true);
  });

  it('тьма зоны не распространяется через сплошную стену', () => {
    const zones = [zone({ blocksLight: true }, 20)];
    const wall = { id: 'w1', kind: 'wall' as const, x1: 150, y1: -100, x2: 150, y2: 300 };
    const cells = zoneVisionCells(zones, grid, [wall]);
    // Клетки до стены — тьма; за стеной — нет.
    expect(cells.get('2,1')).toBe('magical');
    expect(cells.get('3,1')).toBeUndefined();
    expect(zoneVisionKindAt(zones, { x: 175, y: 75 }, grid, [wall])).toBeNull();
    expect(zoneVisionKindAt(zones, { x: 175, y: 75 }, grid)).toBe('magical');
  });
});

describe('countAttackAdvantage: невидимость (RAW)', () => {
  it('невидимая цель — помеха, невидимый атакующий — преимущество, вместе гасятся', () => {
    expect(countAttackAdvantage({ unseenTarget: true }).mode).toBe('d');
    expect(countAttackAdvantage({ unseenAttacker: true }).mode).toBe('a');
    expect(countAttackAdvantage({ unseenTarget: true, unseenAttacker: true }).mode).toBeUndefined();
  });
});

describe('lightLevelAt (Shadow Blade: свет у цели)', () => {
  const point = { x: 25, y: 25 };
  const grid = { size: 50, offsetX: 0, offsetY: 0 };

  it('по умолчанию яркий; глобальная «Тьма» — темнота', () => {
    expect(lightLevelAt(SIGHT, point)).toBe('bright');
    expect(lightLevelAt(DARK_SIGHT, point)).toBe('dark');
  });

  it('области тьмы/мглы — темнота даже при свете заклинаний', () => {
    const area: LightArea = { id: 'a1', x: 0, y: 0, w: 100, h: 100, kind: 'darkness' };
    const light = lightCells([{ x: 25, y: 25, light: { bright: 20, dim: 0 } }], grid);
    expect(lightLevelAt({ ...SIGHT, areas: [area], light }, point)).toBe('dark');
    expect(lightLevelAt({ ...SIGHT, areas: [{ ...area, kind: 'magical' }], light }, point)).toBe('dark');
  });

  it('свет заклинаний: яркая клетка — bright, сумерки — dim, свет снимает «Тьму»', () => {
    const light = new Map([
      ['0,0', 'dim' as const],
      ['1,0', 'bright' as const],
    ]);
    expect(lightLevelAt({ ...SIGHT, light }, point)).toBe('dim');
    expect(lightLevelAt({ ...SIGHT, light }, { x: 75, y: 25 })).toBe('bright');
    expect(lightLevelAt({ ...DARK_SIGHT, light }, { x: 75, y: 25 })).toBe('bright');
  });
});
