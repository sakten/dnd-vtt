import { describe, expect, it } from 'vitest';
import type { Wall } from '../domain/scene';
import { crossesWalls, segmentsIntersect } from './walls';

const P = (x: number, y: number) => ({ x, y });
const wall = (x1: number, y1: number, x2: number, y2: number): Wall => ({ id: 'w', kind: 'wall', x1, y1, x2, y2 });

describe('segmentsIntersect', () => {
  it('крест-накрест', () => {
    expect(segmentsIntersect(P(0, 0), P(10, 10), P(0, 10), P(10, 0))).toBe(true);
  });

  it('параллельные не пересекаются', () => {
    expect(segmentsIntersect(P(0, 0), P(10, 0), P(0, 5), P(10, 5))).toBe(false);
  });

  it('касание концом — пересечение (нельзя протиснуться)', () => {
    expect(segmentsIntersect(P(0, 0), P(10, 0), P(10, 0), P(10, 10))).toBe(true);
  });

  it('касание T-образное', () => {
    expect(segmentsIntersect(P(0, 0), P(10, 0), P(5, 0), P(5, 10))).toBe(true);
  });

  it('конец стены ровно в начале движения — пересечение', () => {
    expect(segmentsIntersect(P(0, 0), P(10, 0), P(0, 0), P(0, -10))).toBe(true);
  });

  it('коллинеарные внахлёст', () => {
    expect(segmentsIntersect(P(0, 0), P(10, 0), P(5, 0), P(15, 0))).toBe(true);
  });

  it('коллинеарные врозь', () => {
    expect(segmentsIntersect(P(0, 0), P(10, 0), P(15, 0), P(20, 0))).toBe(false);
  });

  it('рядом, но без касания', () => {
    expect(segmentsIntersect(P(0, 0), P(10, 0), P(10.001, 0.001), P(20, 0.001))).toBe(false);
  });
});

describe('crossesWalls', () => {
  const wallAlongEdge = wall(0, -25, 0, 25);

  it('переход через стену по границе клеток', () => {
    expect(crossesWalls(P(-25, 0), P(25, 0), [wallAlongEdge])).toBe(true);
  });

  it('движение параллельно стене не блокируется', () => {
    expect(crossesWalls(P(25, -24), P(25, 24), [wallAlongEdge])).toBe(false);
  });

  it('диагональная стена через угол клетки блокирует переход по диагонали', () => {
    expect(crossesWalls(P(0, 50), P(50, 0), [wall(0, 0, 50, 50)])).toBe(true);
  });

  it('пустой список стен — свободно', () => {
    expect(crossesWalls(P(0, 0), P(100, 0), [])).toBe(false);
  });

  it('закрытая дверь блокирует и обзор, и проход', () => {
    const door = { ...wallAlongEdge, kind: 'door' as const };
    expect(crossesWalls(P(-25, 0), P(25, 0), [door], 'sight')).toBe(true);
    expect(crossesWalls(P(-25, 0), P(25, 0), [door], 'move')).toBe(true);
  });

  it('открытая дверь не блокирует', () => {
    const door = { ...wallAlongEdge, kind: 'door' as const, open: true };
    expect(crossesWalls(P(-25, 0), P(25, 0), [door], 'sight')).toBe(false);
    expect(crossesWalls(P(-25, 0), P(25, 0), [door], 'move')).toBe(false);
  });

  it('окно: не блокирует обзор, но блокирует проход', () => {
    const window = { ...wallAlongEdge, kind: 'window' as const };
    expect(crossesWalls(P(-25, 0), P(25, 0), [window], 'sight')).toBe(false);
    expect(crossesWalls(P(-25, 0), P(25, 0), [window], 'move')).toBe(true);
  });
});
