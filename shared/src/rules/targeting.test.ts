import { describe, expect, it } from 'vitest';
import { DEFAULT_GRID, type Wall } from '../domain/scene';
import type { Token } from '../domain/token';
import { creatureTargetIssue, nearestTarget, teleportCellsNearTargets } from './targeting';

const grid = { ...DEFAULT_GRID };
const token = (id: string, x: number, y: number): Token =>
  ({ id, x, y, w: 50, h: 50, faction: 'enemy', effects: [] }) as unknown as Token;
const wall = (x1: number, y1: number, x2: number, y2: number): Wall => ({ id: 'w', x1, y1, x2, y2, kind: 'wall' });

describe('creatureTargetIssue', () => {
  const caster = token('c', 100, 100);

  it('в пределах дистанции и без стен — можно', () => {
    expect(creatureTargetIssue(caster, token('t', 200, 100), [], grid, 30)).toBeUndefined();
  });

  it('вне дистанции — outOfRange с футами', () => {
    expect(creatureTargetIssue(caster, token('t', 600, 100), [], grid, 30)).toEqual({
      code: 'outOfRange',
      feet: 50,
    });
  });

  it('стена между — noClearPath', () => {
    expect(creatureTargetIssue(caster, token('t', 200, 100), [wall(150, 0, 150, 200)], grid, 30)).toEqual({
      code: 'noClearPath',
    });
  });
});

describe('nearestTarget', () => {
  it('выбирает ближайшую цель к точке', () => {
    const far = token('a', 200, 100);
    const near = token('b', 120, 100);
    expect(nearestTarget({ x: 110, y: 100 }, [far, near])?.id).toBe('b');
    expect(nearestTarget({ x: 110, y: 100 }, [])).toBeUndefined();
  });
});

describe('teleportCellsNearTargets', () => {
  const target = token('t', 225, 225);

  it('рядом с мелкой целью — все соседние клетки (в т.ч. диагонали), своя клетка занята', () => {
    const keys = teleportCellsNearTargets([target], [target], grid, [], 5, 'mover');
    expect(keys.sort()).toEqual(['3,3', '3,4', '3,5', '4,3', '4,5', '5,3', '5,4', '5,5']);
  });

  it('рядом с крупной целью доступны клетки у её подошвы, дальние — нет', () => {
    const big = { ...token('big', 200, 200), w: 100, h: 100 } as Token;
    const keys = teleportCellsNearTargets([big], [big], grid, [], 5, 'mover');
    expect(keys).toContain('2,2');
    expect(keys).toContain('5,4');
    expect(keys).toContain('5,5');
    expect(keys).not.toContain('4,4'); // клетка подошвы занята
    expect(keys).not.toContain('1,1'); // через клетку — 10 фт
  });

  it('клетка перемещаемого не считается занятой', () => {
    const mover = token('m', 275, 225); // клетка 5,4 рядом с целью
    const keys = teleportCellsNearTargets([target], [target, mover], grid, [], 5, mover.id);
    expect(keys).toContain('5,4');
    expect(keys).toContain('3,4');
  });

  it('стена между целью и клеткой убирает клетку', () => {
    const keys = teleportCellsNearTargets([target], [target], grid, [wall(250, 200, 250, 250)], 5, 'mover');
    expect(keys).not.toContain('5,4');
    expect(keys).toContain('3,4');
  });

  it('изгнанная цель не даёт клеток', () => {
    const banished = {
      ...target,
      effects: [{ id: 'b', name: 'Banishment', duration: { type: 'rounds', rounds: 1 }, modifiers: [], banish: true }],
    } as unknown as Token;
    expect(teleportCellsNearTargets([banished], [banished], grid, [], 5, 'mover')).toEqual([]);
  });
});
