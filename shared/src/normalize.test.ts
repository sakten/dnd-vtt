import { describe, expect, it } from 'vitest';
import { emptyCombatState } from './domain/combat';
import { DEFAULT_SPEED } from './domain/core';
import { DEFAULT_GRID, defaultFog } from './domain/scene';
import { isRecord, normalizeLibraryItem, normalizeMapInfo, normalizeScene, normalizeToken, normalizeWalls } from './normalize';

describe('isRecord', () => {
  it('отсекает null, массивы и примитивы', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord([])).toBe(false);
    expect(isRecord('x')).toBe(false);
  });
});

describe('normalizeWalls: дверные настройки', () => {
  it('у дверей сохраняет dmOnly/pickDc, у стен и окон — вырезает', () => {
    const [door, wall, window] = normalizeWalls([
      { id: 'd1', kind: 'door', x1: 0, y1: 0, x2: 50, y2: 0, dmOnly: true, pickDc: 17, open: true },
      { id: 'w1', kind: 'wall', x1: 0, y1: 0, x2: 50, y2: 0, dmOnly: true, pickDc: 15 },
      { id: 'o1', kind: 'window', x1: 0, y1: 0, x2: 50, y2: 0, pickDc: 15 },
    ]);

    expect(door).toMatchObject({ kind: 'door', open: true, dmOnly: true, pickDc: 17 });
    expect(wall!.dmOnly).toBeUndefined();
    expect(wall!.pickDc).toBeUndefined();
    expect(window!.pickDc).toBeUndefined();
  });

  it('pickDc: нет/0/мусор не сохраняются, вырезаются границы', () => {
    const walls = normalizeWalls([
      { id: 'd1', kind: 'door', x1: 0, y1: 0, x2: 50, y2: 0, pickDc: 0 },
      { id: 'd2', kind: 'door', x1: 0, y1: 0, x2: 50, y2: 0, pickDc: 99 },
      { id: 'd3', kind: 'door', x1: 0, y1: 0, x2: 50, y2: 0, pickDc: Number.NaN },
    ]);
    expect(walls[0]!.pickDc).toBeUndefined();
    expect(walls[1]!.pickDc).toBe(40);
    expect(walls[2]!.pickDc).toBeUndefined();
  });
});

describe('normalizeToken', () => {
  it('добирает дефолты и выводит hpCurrent из hpMax', () => {
    const token = normalizeToken({ id: 't1', ac: '10', hpMax: '17' });
    expect(token.id).toBe('t1');
    expect(token.hpCurrent).toBe(17);
    expect(token.speed).toBe(DEFAULT_SPEED);
    expect(token.faction).toBe('neutral');
    expect(token.conditions).toEqual([]);
  });

  it('сохраняет неизвестные поля (совместимость формата)', () => {
    const token = normalizeToken({ id: 't1', futureField: 'x' });
    expect((token as unknown as { futureField?: string }).futureField).toBe('x');
  });
});

describe('normalizeLibraryItem', () => {
  it('imageUrl и имя до 60 символов', () => {
    const item = normalizeLibraryItem({ id: 'l1', name: 'x'.repeat(80), imageUrl: '/uploads/g.png' });
    expect(item.imageUrl).toBe('/uploads/g.png');
    expect(item.name).toHaveLength(60);
  });
});

describe('normalizeMapInfo', () => {
  it('добирает туман/бой/токены из грида', () => {
    const map = normalizeMapInfo({ id: 'm1' }, DEFAULT_GRID);
    expect(map.fog).toEqual(defaultFog(DEFAULT_GRID));
    expect(map.combat).toEqual(emptyCombatState());
    expect(map.tokens).toEqual([]);
  });
});

describe('normalizeScene', () => {
  it('не-массив maps становится пустой сценой с дефолтным гридом', () => {
    const scene = normalizeScene({ activeMapId: null });
    expect(scene.maps).toEqual([]);
    expect(scene.grid).toEqual(DEFAULT_GRID);
  });

  it('нормализует карты и токены', () => {
    const scene = normalizeScene({
      maps: [{ id: 'm1', tokens: [{ id: 't1', ac: '10', hpMax: '5' }] }],
      activeMapId: 'm1',
      grid: DEFAULT_GRID,
    });
    expect(scene.maps[0]!.tokens[0]!.hpCurrent).toBe(5);
    expect(scene.maps[0]!.fog).toEqual(defaultFog(DEFAULT_GRID));
  });
});
