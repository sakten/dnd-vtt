import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildFxMask } from './mask';

afterEach(() => {
  vi.restoreAllMocks();
});

function mockCanvas(hasContext = true) {
  const fillRect = vi.fn();
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    hasContext ? ({ fillStyle: '', fillRect } as unknown as CanvasRenderingContext2D) : null
  );
  const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');
  return { fillRect, getContext, toDataURL };
}

describe('buildFxMask', () => {
  it('не строит маску для пустых размеров или клетки', () => {
    expect(buildFxMask({ cell: 50, offsetX: 0, offsetY: 0, cols: 0, rows: 2, blocked: [] })).toBeNull();
    expect(buildFxMask({ cell: 50, offsetX: 0, offsetY: 0, cols: 2, rows: 0, blocked: [] })).toBeNull();
    expect(buildFxMask({ cell: 0, offsetX: 0, offsetY: 0, cols: 2, rows: 2, blocked: [] })).toBeNull();
  });

  it('возвращает null, если canvas-контекст недоступен', () => {
    mockCanvas(false);
    expect(buildFxMask({ cell: 50, offsetX: 1, offsetY: 2, cols: 2, rows: 2, blocked: [] })).toBeNull();
  });

  it('закрашивает только видимые клетки и считает мировые размеры', () => {
    const { fillRect } = mockCanvas();
    const mask = buildFxMask({
      cell: 50,
      offsetX: 10,
      offsetY: 20,
      cols: 3,
      rows: 2,
      blocked: ['0,0', '2,1', '2,1'],
    });

    expect(fillRect).toHaveBeenCalledTimes(4);
    expect(mask).toEqual({
      url: 'data:image/png;base64,AAAA',
      cell: 50,
      offsetX: 10,
      offsetY: 20,
      width: 150,
      height: 100,
    });
  });
});
