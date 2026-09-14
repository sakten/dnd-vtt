import { describe, expect, it } from 'vitest';
import { DEFAULT_GRID, DEFAULT_SPEED, defaultFog, emptyCombatState } from './types';
import { isRecord, normalizeLibraryItem, normalizeMapInfo, normalizeScene, normalizeToken } from './normalize';

describe('isRecord', () => {
  it('отсекает null, массивы и примитивы', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord([])).toBe(false);
    expect(isRecord('x')).toBe(false);
  });
});

describe('normalizeToken', () => {
  it('добирает дефолты и выводит hpCurrent из hpMax', () => {
    const token = normalizeToken({ id: 't1', hpMax: '17' }, { keepAcHp: true });
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
  it('legacy url → imageUrl, имя до 60 символов', () => {
    const item = normalizeLibraryItem({ id: 'l1', name: 'x'.repeat(80), url: '/uploads/g.png' });
    expect(item.imageUrl).toBe('/uploads/g.png');
    expect('url' in item).toBe(false);
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

  it('нормализует карты и токены (keepAcHp проходит в токены)', () => {
    const scene = normalizeScene(
      {
        maps: [{ id: 'm1', tokens: [{ id: 't1', hpMax: '5' }] }],
        activeMapId: 'm1',
        grid: DEFAULT_GRID,
      },
      { keepAcHp: true }
    );
    expect(scene.maps[0]!.tokens[0]!.hpCurrent).toBe(5);
    expect(scene.maps[0]!.fog).toEqual(defaultFog(DEFAULT_GRID));
  });
});
