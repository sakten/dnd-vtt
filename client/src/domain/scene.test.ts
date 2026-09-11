import { describe, expect, it } from 'vitest';
import { DEFAULT_GRID, emptyCombatState, emptyTurnState } from 'shared';
import { makeMap, makeScene, makeToken } from '../test/fixtures';
import {
  patchCombatTurn,
  patchToken,
  removeTokenById,
  replaceToken,
  resizeGrid,
  setCombat,
  setFog,
  setGrid,
  updateMap,
  upsertToken,
  withMaps,
} from './scene';

const scene = () => makeScene([makeMap('m1', [makeToken('t1')]), makeMap('m2', [makeToken('t2')])]);

describe('updateMap / withMaps', () => {
  it('меняет только целевую карту и не мутирует исходную сцену', () => {
    const s = scene();
    const next = updateMap(s, 'm2', (m) => ({ ...m, name: 'Изменено' }));
    expect(next).not.toBe(s);
    expect(next.maps[0]).toBe(s.maps[0]);
    expect(next.maps[1].name).toBe('Изменено');
    expect(s.maps[1].name).toBe('m2');
  });

  it('отсутствующий mapId возвращает ту же сцену', () => {
    const s = scene();
    expect(updateMap(s, 'nope', (m) => m)).toBe(s);
  });

  it('withMaps заменяет список карт и активную', () => {
    const s = scene();
    const next = withMaps(s, [], null);
    expect(next.maps).toEqual([]);
    expect(next.activeMapId).toBeNull();
  });
});

describe('токены', () => {
  it('upsertToken добавляет новый и не дублирует существующий', () => {
    const s = scene();
    const added = upsertToken(s, 'm1', makeToken('t3'));
    expect(added.maps[0].tokens.map((t) => t.id)).toEqual(['t1', 't3']);

    const same = upsertToken(s, 'm1', makeToken('t1', { name: 'Обновлённый' }));
    expect(same.maps[0].tokens).toHaveLength(1);
    expect(same.maps[0].tokens[0].name).toBe('t1');
  });

  it('replaceToken заменяет по id, отсутствующий — no-op', () => {
    const s = scene();
    const next = replaceToken(s, 'm1', makeToken('t1', { x: 120 }));
    expect(next.maps[0].tokens[0].x).toBe(120);
    expect(s.maps[0].tokens[0].x).toBe(0);

    const noop = replaceToken(s, 'm1', makeToken('unknown'));
    expect(noop.maps[0].tokens.map((t) => t.id)).toEqual(['t1']);
  });

  it('patchToken мерджит поля', () => {
    const s = scene();
    const next = patchToken(s, 'm1', 't1', { name: 'Новое', hpCurrent: 5 });
    expect(next.maps[0].tokens[0]).toMatchObject({ name: 'Новое', hpCurrent: 5, id: 't1' });
    expect(s.maps[0].tokens[0].name).toBe('t1');
  });

  it('removeTokenById удаляет нужный токен', () => {
    const s = scene();
    const next = removeTokenById(s, 'm1', 't1');
    expect(next.maps[0].tokens).toEqual([]);
    expect(s.maps[0].tokens).toHaveLength(1);
  });
});

describe('combat / fog / grid', () => {
  it('setCombat заменяет состояние боя карты', () => {
    const s = scene();
    const combat = { ...emptyCombatState(), active: true, round: 2, currentIndex: 0 };
    const next = setCombat(s, 'm1', combat);
    expect(next.maps[0].combat).toEqual(combat);
    expect(s.maps[0].combat.active).toBe(false);
  });

  it('patchCombatTurn мерджит ресурсы хода и no-op без записи', () => {
    const s = scene();
    s.maps[0].combat.turns.e1 = { ...emptyTurnState(), actionUsed: false };
    const next = patchCombatTurn(s, 'm1', 'e1', { actionUsed: true, movementUsed: 10 });
    expect(next.maps[0].combat.turns.e1).toMatchObject({ actionUsed: true, movementUsed: 10 });
    expect(s.maps[0].combat.turns.e1.actionUsed).toBe(false);

    const noop = patchCombatTurn(s, 'm1', 'nope', { actionUsed: true });
    expect(noop.maps[0].combat.turns).toEqual(s.maps[0].combat.turns);
  });

  it('setFog и setGrid', () => {
    const s = scene();
    const fog = { ...s.maps[0].fog, hidden: ['1,2'] };
    expect(setFog(s, 'm1', fog).maps[0].fog.hidden).toEqual(['1,2']);

    const grid = { ...DEFAULT_GRID, size: 70 };
    const withGrid = setGrid(s, grid);
    expect(withGrid.grid.size).toBe(70);
    expect(s.grid.size).toBe(DEFAULT_GRID.size);
  });
});

describe('resizeGrid', () => {
  it('пересчитывает размеры токенов и снапит позиции', () => {
    const s = scene();
    s.maps[0].tokens = [makeToken('t1', { cells: 2, w: 100, h: 100, x: 130, y: 90 })];
    const grid = { ...DEFAULT_GRID, size: 50, offsetX: 0, offsetY: 0, snap: true };
    const next = resizeGrid(s, grid);

    const t1 = next.maps[0].tokens[0];
    expect(t1.w).toBe(100);
    expect(t1.h).toBe(100);
    expect(t1.x % 50).toBe(0);
    expect(t1.y % 50).toBe(0);
    expect(s.maps[0].tokens[0].w).toBe(100);
  });
});
