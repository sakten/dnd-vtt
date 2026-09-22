import { describe, expect, it } from 'vitest';
import { aimOriginKind, aimToCursor, startAim } from './interaction';
import { makeToken } from '../test/fixtures';

describe('области прицеливания', () => {
  it('конус и линия исходят от кастера, остальное — от точки', () => {
    expect(aimOriginKind('cone')).toBe('self');
    expect(aimOriginKind('line')).toBe('self');
    expect(aimOriginKind('sphere')).toBe('point');
    expect(aimOriginKind('cylinder')).toBe('point');
  });

  it('конус от кастера: направление на курсор, у вершины не дёргается', () => {
    const caster = makeToken('t1', { x: 100, y: 100 });
    const aim = startAim(
      {
        tokenId: 't1',
        spellKey: 'XPHB:Cone of Cold',
        spec: { shape: 'cone', size: 60 },
        originKind: 'self',
        rangeFeet: null,
      },
      caster
    );

    const far = aimToCursor(aim, { x: 300, y: 100 }, caster, 50);
    expect(far?.mode === 'aim' ? far.aim.direction : null).toEqual({ x: 300, y: 100 });

    // Вплотную к вершине (< клетки) направление держится последним.
    const near = aimToCursor(far, { x: 110, y: 105 }, caster, 50);
    expect(near?.mode === 'aim' ? near.aim.direction : null).toEqual({ x: 300, y: 100 });

    const away = aimToCursor(near, { x: 100, y: 300 }, caster, 50);
    expect(away?.mode === 'aim' ? away.aim.direction : null).toEqual({ x: 100, y: 300 });
  });

  it('конус от точки (легаси): направление всё равно смотрит на курсор', () => {
    const caster = makeToken('t1', { x: 100, y: 100 });
    const aim = startAim(
      {
        tokenId: 't1',
        actionId: 'ability:cone',
        spec: { shape: 'cone', size: 30 },
        originKind: 'point',
        rangeFeet: 30,
      },
      caster
    );

    const moved = aimToCursor(aim, { x: 200, y: 100 }, caster, 50);
    expect(moved?.mode === 'aim' ? moved.aim.direction : null).toEqual({ x: 200, y: 100 });
    expect(moved?.mode === 'aim' ? moved.aim.origin : null).toEqual({ x: 200, y: 100 });
  });
});
