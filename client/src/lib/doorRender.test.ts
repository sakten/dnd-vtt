import { describe, expect, it } from 'vitest';
import type { Wall } from 'shared';
import { doorGeometry, doorLeafEnd, doorLeaves, type DoorLeaf } from './doorRender';

const door = (x1: number, y1: number, x2: number, y2: number, open = false): Wall => ({
  id: 'd1',
  kind: 'door',
  x1,
  y1,
  x2,
  y2,
  open,
});

describe('doorGeometry', () => {
  it('горизонтальная дверь: петля в x1,y1, открытие вправо от направления (вниз)', () => {
    const g = doorGeometry(door(10, 20, 60, 20));
    expect(g.hinge).toEqual({ x: 10, y: 20 });
    expect(g.tip).toEqual({ x: 60, y: 20 });
    expect(g.length).toBe(50);
    expect(g.closedAngleDeg).toBe(0);
    expect(g.openAngleDeg).toBe(90);
    expect(doorLeafEnd(door(10, 20, 60, 20), false)).toEqual({ x: 60, y: 20 });
    const open = doorLeafEnd(door(10, 20, 60, 20), true);
    expect(open.x).toBeCloseTo(10);
    expect(open.y).toBeCloseTo(70);
  });

  it('вертикальная дверь: открытие влево (вправо от направления вниз)', () => {
    const g = doorGeometry(door(0, 0, 0, 50));
    expect(g.closedAngleDeg).toBe(90);
    expect(g.openAngleDeg).toBe(180);
    const open = doorLeafEnd(door(0, 0, 0, 50), true);
    expect(open.x).toBeCloseTo(-50);
    expect(open.y).toBeCloseTo(0);
  });

  it('створка всегда остаётся на петле: длина от петли равна длине двери', () => {
    for (const open of [false, true]) {
      const end = doorLeafEnd(door(30, 40, 80, 90), open);
      expect(Math.hypot(end.x - 30, end.y - 40)).toBeCloseTo(Math.hypot(50, 50));
    }
  });

  it('нормаль вправо единичная и перпендикулярна сегменту', () => {
    const g = doorGeometry(door(0, 0, 30, 40));
    expect(Math.hypot(g.rightNormal.x, g.rightNormal.y)).toBeCloseTo(1);
    expect(g.rightNormal.x * 30 + g.rightNormal.y * 40).toBeCloseTo(0);
    expect(g.rightNormal.x).toBeCloseTo(-40 / 50);
    expect(g.rightNormal.y).toBeCloseTo(30 / 50);
  });

  it('вырожденная дверь (нулевая длина) не даёт NaN', () => {
    const g = doorGeometry(door(5, 5, 5, 5));
    expect(g.length).toBe(0);
    expect(g.rightNormal).toEqual({ x: 0, y: 0 });
    expect(Number.isFinite(g.openAngleDeg)).toBe(true);
  });
});

describe('doorLeaves', () => {
  const openEnd = (leaf: DoorLeaf) => {
    const rad = (leaf.openAngleDeg * Math.PI) / 180;
    return { x: leaf.hinge.x + Math.cos(rad) * leaf.length, y: leaf.hinge.y + Math.sin(rad) * leaf.length };
  };

  it('дверь в клетку — одна створка (как раньше)', () => {
    const leaves = doorLeaves(door(10, 20, 60, 20), 50);
    expect(leaves).toHaveLength(1);
    expect(leaves[0]!).toMatchObject({ hinge: { x: 10, y: 20 }, length: 50, closedAngleDeg: 0, openAngleDeg: 90 });
  });

  it('длиннее клетки — двустворчатая: половинки с обоих концов открываются в одну сторону', () => {
    const leaves = doorLeaves(door(0, 0, 100, 0), 50);
    expect(leaves).toHaveLength(2);
    expect(leaves[0]!).toMatchObject({ hinge: { x: 0, y: 0 }, length: 50, closedAngleDeg: 0, openAngleDeg: 90 });
    expect(leaves[1]!).toMatchObject({ hinge: { x: 100, y: 0 }, length: 50, closedAngleDeg: 180, openAngleDeg: 90 });
    expect(openEnd(leaves[0]!).y).toBeCloseTo(50);
    expect(openEnd(leaves[1]!).y).toBeCloseTo(50);
    // Закрытые створки смыкаются в середине.
    expect(leaves[0]!.hinge.x + leaves[0]!.length).toBeCloseTo(50);
    expect(leaves[1]!.hinge.x - leaves[1]!.length).toBeCloseTo(50);
  });

  it('небольшой перевес клетки — всё ещё одна створка, заметный — двустворчатая', () => {
    expect(doorLeaves(door(0, 0, 52, 0), 50)).toHaveLength(1);
    expect(doorLeaves(door(0, 0, 54, 0), 50)).toHaveLength(2);
  });
});
