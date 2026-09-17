import { describe, expect, it } from 'vitest';
import { wallsEscapeStep } from './wallDraw';

describe('wallsEscapeStep', () => {
  it('вне режима «Стены» — не наш шаг', () => {
    expect(wallsEscapeStep({ active: false, start: { x: 0, y: 0 } })).toBeNull();
  });

  it('цепочка начата — первое нажатие её завершает', () => {
    expect(wallsEscapeStep({ active: true, start: { x: 10, y: 10 } })).toBe('finish-chain');
  });

  it('цепочки нет — выходим из режима', () => {
    expect(wallsEscapeStep({ active: true, start: null })).toBe('exit');
  });
});
