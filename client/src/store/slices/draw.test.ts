import { beforeEach, describe, expect, it } from 'vitest';
import type { DrawStroke } from 'shared';
import { useGameStore } from '../useGameStore';
import { MAX_STROKES, STROKE_TTL_MS } from './draw';

const stroke = (id: string, patch: Partial<DrawStroke> = {}): DrawStroke => ({
  id,
  mapId: 'm1',
  color: '#e5484d',
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
  ],
  ...patch,
});

describe('draw slice', () => {
  beforeEach(() => {
    useGameStore.setState({ strokes: [], viewMapId: 'm1', drawMode: { active: false, color: '#e5484d' } });
  });

  it('штрих добавляется с временем жизни 10 секунд', () => {
    const before = performance.now();
    useGameStore.getState().onDrawStroke(stroke('s1'));
    const added = useGameStore.getState().strokes[0]!;
    expect(added.id).toBe('s1');
    expect(added.expiresAt - before).toBeGreaterThanOrEqual(STROKE_TTL_MS - 50);
    expect(added.expiresAt - before).toBeLessThanOrEqual(STROKE_TTL_MS + 50);
  });

  it('дубликат по id не добавляется дважды', () => {
    useGameStore.getState().onDrawStroke(stroke('s1'));
    useGameStore.getState().onDrawStroke(stroke('s1'));
    expect(useGameStore.getState().strokes).toHaveLength(1);
  });

  it('pruneStrokes убирает истёкшие', () => {
    useGameStore.setState({ strokes: [{ ...stroke('s1'), expiresAt: performance.now() - 1 }] });
    useGameStore.getState().pruneStrokes();
    expect(useGameStore.getState().strokes).toEqual([]);
  });

  it('потолок штрихов вытесняет старейшие', () => {
    for (let i = 0; i < MAX_STROKES + 3; i++) useGameStore.getState().onDrawStroke(stroke(`s${i}`));
    const ids = useGameStore.getState().strokes.map((s) => s.id);
    expect(ids).toHaveLength(MAX_STROKES);
    expect(ids[0]).toBe('s3');
  });

  it('commitStroke добавляет свой штрих локально', () => {
    useGameStore.getState().setDrawMode({ color: '#3b82f6' });
    useGameStore.getState().commitStroke([
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]);
    const added = useGameStore.getState().strokes[0]!;
    expect(added.mapId).toBe('m1');
    expect(added.color).toBe('#3b82f6');
    expect(added.points).toHaveLength(2);
  });
});
