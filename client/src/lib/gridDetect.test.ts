import { describe, expect, it } from 'vitest';
import { detectGridFromImageData, GRID_AUTO_CONFIDENCE } from './gridDetect';

/** Синтетическая карта: светлый шумный пол + тёмные линии сетки толщиной 2px. */
function makeGridImage(
  w: number,
  h: number,
  size: number,
  ox: number,
  oy: number,
  opts: { gridX?: boolean; gridY?: boolean } = {}
): Uint8ClampedArray {
  const { gridX = true, gridY = true } = opts;
  const data = new Uint8ClampedArray(w * h * 4);
  let seed = 42;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const onLine = (gridX && (x - ox) % size <= 1) || (gridY && (y - oy) % size <= 1);
      const v = onLine ? 40 : 170 + Math.round((rand() - 0.5) * 24);
      const i = (y * w + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = Math.max(0, Math.min(255, v));
      data[i + 3] = 255;
    }
  }
  return data;
}

function noiseImage(w: number, h: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  let seed = 7;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.round(rand() * 255);
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = 255;
  }
  return data;
}

describe('detectGridFromImageData', () => {
  it('находит сетку 50px со сдвигом', () => {
    const found = detectGridFromImageData(makeGridImage(400, 300, 50, 17, 3), 400, 300);
    expect(found).not.toBeNull();
    expect(Math.abs(found!.size - 50)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(found!.offsetX - 17)).toBeLessThanOrEqual(2);
    expect(Math.abs(found!.offsetY - 3)).toBeLessThanOrEqual(2);
    expect(found!.confidence).toBeGreaterThanOrEqual(GRID_AUTO_CONFIDENCE);
  });

  it('находит нестандартный размер 37px', () => {
    const found = detectGridFromImageData(makeGridImage(420, 320, 37, 5, 9), 420, 320);
    expect(found).not.toBeNull();
    expect(Math.abs(found!.size - 37)).toBeLessThanOrEqual(1.5);
  });

  it('шум без сетки — null', () => {
    expect(detectGridFromImageData(noiseImage(300, 300), 300, 300)).toBeNull();
  });

  it('сетка только по одной оси — используем её', () => {
    const onlyX = makeGridImage(400, 300, 50, 10, 10, { gridY: false });
    const found = detectGridFromImageData(onlyX, 400, 300);
    expect(found).not.toBeNull();
    expect(Math.abs(found!.size - 50)).toBeLessThanOrEqual(1.5);
  });

  it('усиленные линии каждые 2 клетки не удваивают период (сабгармоника)', () => {
    const data = new Uint8ClampedArray(400 * 300 * 4);
    for (let y = 0; y < 300; y++) {
      for (let x = 0; x < 400; x++) {
        const modX = (((x - 5) % 50) + 50) % 50;
        const modY = (((y - 5) % 50) + 50) % 50;
        let v = 180;
        if (modX <= 1) v = x % 100 <= 1 ? 30 : 60;
        if (modY <= 1) v = Math.min(v, y % 100 <= 1 ? 30 : 60);
        const i = (y * 400 + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = v;
        data[i + 3] = 255;
      }
    }
    const found = detectGridFromImageData(data, 400, 300);
    expect(found).not.toBeNull();
    expect(Math.abs(found!.size - 50)).toBeLessThanOrEqual(1.5);
  });
});
