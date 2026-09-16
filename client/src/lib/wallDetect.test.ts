import { describe, expect, it } from 'vitest';
import { detectWalls } from './wallDetect';

interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Карта: фон/стены задаются яркостями, толщина линий 14px (шире пропуска сетки). */
function makeImage(
  w: number,
  h: number,
  walls: Seg[],
  opts: { floor?: number; wall?: number; thickness?: number } = {}
): Uint8ClampedArray {
  const { floor = 200, wall = 20, thickness = 14 } = opts;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    data[p] = data[p + 1] = data[p + 2] = floor;
    data[p + 3] = 255;
  }
  for (const seg of walls) {
    const len = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1) || 1;
    const nx = -(seg.y2 - seg.y1) / len;
    const ny = (seg.x2 - seg.x1) / len;
    for (let t = 0; t <= len; t += 1) {
      const cx = seg.x1 + ((seg.x2 - seg.x1) * t) / len;
      const cy = seg.y1 + ((seg.y2 - seg.y1) * t) / len;
      for (let d = -thickness / 2; d <= thickness / 2; d++) {
        const x = Math.round(cx + nx * d);
        const y = Math.round(cy + ny * d);
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const p = (y * w + x) * 4;
        data[p] = data[p + 1] = data[p + 2] = wall;
      }
    }
  }
  return data;
}

const GRID = { size: 50, offsetX: 0, offsetY: 0 };

describe('detectWalls (A++)', () => {
  it('находит тёмную вертикальную стену', () => {
    const img = makeImage(200, 300, [{ x1: 100, y1: 0, x2: 100, y2: 300 }]);
    const walls = detectWalls(img, 200, 300, GRID);
    const solid = walls.filter((w) => w.kind === 'wall');
    expect(solid).toHaveLength(1);
    expect(solid[0]!.x1).toBe(100);
    expect(solid[0]!.y1).toBe(0);
    expect(solid[0]!.y2).toBe(300);
  });

  it('находит светлую стену на тёмном полу (полярность не важна)', () => {
    const img = makeImage(200, 300, [{ x1: 100, y1: 0, x2: 100, y2: 300 }], { floor: 30, wall: 220 });
    const walls = detectWalls(img, 200, 300, GRID);
    const solid = walls.filter((w) => w.kind === 'wall');
    expect(solid).toHaveLength(1);
    expect(solid[0]!.x1).toBe(100);
  });

  it('разрыв в одну клетку между прогонами становится дверью', () => {
    const img = makeImage(200, 300, [
      { x1: 100, y1: 0, x2: 100, y2: 150 },
      { x1: 100, y1: 200, x2: 100, y2: 300 },
    ]);
    const walls = detectWalls(img, 200, 300, GRID);
    const doors = walls.filter((w) => w.kind === 'door');
    expect(doors).toHaveLength(1);
    expect(doors[0]!.y1).toBe(150);
    expect(doors[0]!.y2).toBe(200);
    expect(walls.filter((w) => w.kind === 'wall')).toHaveLength(2);
  });

  it('разрыв в две клетки тоже дверь', () => {
    const img = makeImage(200, 350, [
      { x1: 100, y1: 0, x2: 100, y2: 150 },
      { x1: 100, y1: 250, x2: 100, y2: 350 },
    ]);
    const walls = detectWalls(img, 200, 350, GRID);
    const doors = walls.filter((w) => w.kind === 'door');
    expect(doors).toHaveLength(1);
    expect(doors[0]!.y1).toBe(150);
    expect(doors[0]!.y2).toBe(250);
  });

  it('фильтр мебели убирает изолированный прямоугольник', () => {
    const img = makeImage(200, 200, [
      { x1: 50, y1: 50, x2: 100, y2: 50 },
      { x1: 100, y1: 50, x2: 100, y2: 100 },
      { x1: 50, y1: 100, x2: 100, y2: 100 },
      { x1: 50, y1: 50, x2: 50, y2: 100 },
    ]);
    expect(detectWalls(img, 200, 200, GRID)).toHaveLength(0);
    expect(detectWalls(img, 200, 200, { ...GRID, furnitureFilter: false }).length).toBeGreaterThan(0);
  });

  it('без дверей проёмы остаются проходами', () => {
    const img = makeImage(200, 300, [
      { x1: 100, y1: 0, x2: 100, y2: 150 },
      { x1: 100, y1: 200, x2: 100, y2: 300 },
    ]);
    const walls = detectWalls(img, 200, 300, { ...GRID, doors: false });
    expect(walls.filter((w) => w.kind === 'door')).toHaveLength(0);
    const solid = walls.filter((w) => w.kind === 'wall').sort((a, b) => a.y1 - b.y1);
    expect(solid).toHaveLength(2);
    expect(solid[0]!.y2).toBe(150);
    expect(solid[1]!.y1).toBe(200);
  });

  it('пустая карта — нет стен', () => {
    expect(detectWalls(makeImage(200, 200, []), 200, 200, GRID)).toEqual([]);
  });
});
