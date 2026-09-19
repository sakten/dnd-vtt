import { describe, expect, it } from 'vitest';
import type { FogState } from 'shared';
import { cellIndex, cellKey, fogCellsAround, fogCellsBetween, fogRects, isCellHidden, withFogCells } from './fog';

const fog = (hidden: string[] = []): FogState => ({ size: 50, offsetX: 0, offsetY: 0, hidden });

describe('клетки тумана', () => {
  it('cellIndex/cellKey по мировым координатам', () => {
    expect(cellIndex(120, 0, 50)).toBe(2);
    expect(cellIndex(-1, 0, 50)).toBe(-1);
    expect(cellKey(2, 3)).toBe('2,3');
  });

  it('прямоугольник между точками — все клетки, порядок точек не важен', () => {
    const a = { x: 25, y: 25 };
    const b = { x: 125, y: 75 };
    expect(new Set(fogCellsBetween(a, b, fog()))).toEqual(new Set(['0,0', '1,0', '2,0', '0,1', '1,1', '2,1']));
    expect(new Set(fogCellsBetween(b, a, fog()))).toEqual(new Set(fogCellsBetween(a, b, fog())));
  });

  it('кисть-круг: радиус 1 — пять клеток, радиус 0 — одна', () => {
    expect(fogCellsAround({ x: 25, y: 25 }, 1, fog())).toHaveLength(5);
    expect(fogCellsAround({ x: 25, y: 25 }, 0, fog())).toEqual(['0,0']);
  });

  it('withFogCells скрывает и показывает без мутации входа', () => {
    const base = fog(['1,1']);
    const hiddenState = withFogCells(base, ['2,2'], 'hide');
    expect(new Set(hiddenState.hidden)).toEqual(new Set(['1,1', '2,2']));
    expect(base.hidden).toEqual(['1,1']);
    expect(withFogCells(hiddenState, ['1,1'], 'reveal').hidden).toEqual(['2,2']);
  });

  it('fogRects переводит ключи в мировые прямоугольники', () => {
    expect(fogRects(fog(['1,2', 'bad']))).toEqual([{ x: 50, y: 100, size: 50 }]);
  });

  it('isCellHidden: скрытая клетка — true, видимая и без тумана — false', () => {
    const hidden = new Set(['2,3']);
    expect(isCellHidden(fog(), hidden, 125, 175)).toBe(true);
    expect(isCellHidden(fog(), hidden, 75, 75)).toBe(false);
    expect(isCellHidden(undefined, hidden, 125, 175)).toBe(false);
  });
});
