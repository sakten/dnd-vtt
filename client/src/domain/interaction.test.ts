import { describe, expect, it } from 'vitest';
import {
  aimOriginKind,
  aimToCursor,
  confirmArea,
  placeScatterPoint,
  scatterBack,
  scatterToPlaces,
  startAim,
  startScatter,
  toggleScatterTarget,
} from './interaction';
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

  it('стена от точки (Wall of Thorns): ось задаёт вариант, каст одним кликом', () => {
    const caster = makeToken('t1', { x: 100, y: 100 });
    const aim = startAim(
      {
        tokenId: 't1',
        spellKey: 'XPHB:Wall of Thorns',
        spec: { shape: 'line', size: 60, width: 5 },
        originKind: 'point',
        rangeFeet: 120,
        variant: 'horizontal',
      },
      caster
    );

    const moved = aimToCursor(aim, { x: 200, y: 100 }, caster, 50);
    expect(moved?.mode === 'aim' ? moved.aim.origin : null).toEqual({ x: 200, y: 100 });
    expect(moved?.mode === 'aim' ? moved.aim.direction : null).toEqual({ x: 300, y: 100 });

    const cast = confirmArea(moved);
    expect(cast.command).toMatchObject({
      type: 'castSpell',
      payload: { spellKey: 'XPHB:Wall of Thorns', origin: { x: 200, y: 100 }, direction: { x: 300, y: 100 } },
    });
  });

  it('кольцо (Wall of Thorns, круг): сфера не тянет направление', () => {
    const caster = makeToken('t1', { x: 100, y: 100 });
    const aim = startAim(
      {
        tokenId: 't1',
        spellKey: 'XPHB:Wall of Thorns',
        spec: { shape: 'ring', size: 10, inner: 5 },
        originKind: 'point',
        rangeFeet: 120,
        variant: 'ring',
      },
      caster
    );

    const moved = aimToCursor(aim, { x: 200, y: 100 }, caster, 50);
    expect(moved?.mode === 'aim' ? moved.aim.origin : null).toEqual({ x: 200, y: 100 });
    // Кольцо — не направленная область: direction остаётся точкой (как у сфер).
    expect(moved?.mode === 'aim' ? moved.aim.direction : null).toEqual({ x: 200, y: 100 });
  });
});

describe('Scatter: цели → точки', () => {
  const start = () => startScatter({ tokenId: 't1', spellKey: 'XGE:Scatter', slotLevel: 6, maxTargets: 5 });

  it('тумблер целей; «Далее» — только с целью; «Назад» сбрасывает точки', () => {
    let it = start();
    it = toggleScatterTarget(it, 't2')!;
    it = toggleScatterTarget(it, 't3')!;
    it = toggleScatterTarget(it, 't2')!; // снятие
    expect(it.mode === 'scatter' ? it.scatter.targets : []).toEqual(['t3']);

    const noNext = scatterToPlaces(start());
    expect(noNext?.mode === 'scatter' ? noNext.scatter.phase : null).toBe('targets');

    const places = scatterToPlaces(it);
    expect(places?.mode === 'scatter' ? places.scatter.phase : null).toBe('places');
    // Одна цель: первая же точка завершает каст.
    const placed = placeScatterPoint(places, { x: 10, y: 20 });
    expect(placed.next).toBeNull();
    expect(placed.command).toMatchObject({
      type: 'castSpell',
      payload: { placements: [{ targetId: 't3', x: 10, y: 20 }] },
    });

    // Две цели: после первой точки «Назад» сбрасывает placements.
    let two = startScatter({ tokenId: 't1', spellKey: 'XGE:Scatter', maxTargets: 5 });
    two = toggleScatterTarget(two, 't2')!;
    two = toggleScatterTarget(two, 't3')!;
    two = scatterToPlaces(two)!;
    const first = placeScatterPoint(two, { x: 10, y: 20 });
    expect(first.next?.mode === 'scatter' ? first.next.scatter.placements : []).toEqual([
      { targetId: 't2', x: 10, y: 20 },
    ]);
    const back = scatterBack(first.next);
    expect(back?.mode === 'scatter' ? back.scatter.placements : null).toEqual([]);
    expect(back?.mode === 'scatter' ? back.scatter.phase : null).toBe('targets');
  });

  it('на лимите целей — сразу фаза точек', () => {
    let it = startScatter({ tokenId: 't1', spellKey: 'XGE:Scatter', maxTargets: 2 });
    it = toggleScatterTarget(it, 't2')!;
    expect(it.mode === 'scatter' ? it.scatter.phase : null).toBe('targets');
    it = toggleScatterTarget(it, 't3')!;
    expect(it.mode === 'scatter' ? it.scatter.phase : null).toBe('places');
  });

  it('последняя точка — каст с placements', () => {
    let it = startScatter({ tokenId: 't1', spellKey: 'XGE:Scatter', slotLevel: 6, maxTargets: 5 });
    it = toggleScatterTarget(it, 't2')!;
    it = toggleScatterTarget(it, 't3')!;
    it = scatterToPlaces(it)!;
    const first = placeScatterPoint(it, { x: 100, y: 100 });
    expect(first.command).toBeUndefined();
    const last = placeScatterPoint(first.next, { x: 200, y: 200 });
    expect(last.next).toBeNull();
    expect(last.command).toEqual({
      type: 'castSpell',
      payload: {
        tokenId: 't1',
        spellKey: 'XGE:Scatter',
        slotLevel: 6,
        advantage: undefined,
        placements: [
          { targetId: 't2', x: 100, y: 100 },
          { targetId: 't3', x: 200, y: 200 },
        ],
      },
    });
  });
});
