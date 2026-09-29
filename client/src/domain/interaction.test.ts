import { describe, expect, it } from 'vitest';
import {
  aimOriginKind,
  aimToCursor,
  confirmArea,
  finishMulti,
  pickMultiTarget,
  pickTarget,
  placeScatterPoint,
  scatterBack,
  scatterToPlaces,
  startAim,
  startMulti,
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

    // Курсор у угла клетки: якорь всё равно садится в центр клетки, ось строго по варианту —
    // иначе сырой курсор смещал ось и длинная стена косила.
    const moved = aimToCursor(aim, { x: 200, y: 100 }, caster, 50);
    expect(moved?.mode === 'aim' ? moved.aim.origin : null).toEqual({ x: 225, y: 125 });
    expect(moved?.mode === 'aim' ? moved.aim.direction : null).toEqual({ x: 325, y: 125 });
    // Внутри той же клетки — тот же якорь и ось (нет дрожания).
    const jitter = aimToCursor(aim, { x: 240, y: 140 }, caster, 50);
    expect(jitter?.mode === 'aim' ? jitter.aim.origin : null).toEqual({ x: 225, y: 125 });
    expect(jitter?.mode === 'aim' ? jitter.aim.direction : null).toEqual({ x: 325, y: 125 });

    const cast = confirmArea(moved);
    expect(cast.command).toMatchObject({
      type: 'castSpell',
      payload: { spellKey: 'XPHB:Wall of Thorns', origin: { x: 225, y: 125 }, direction: { x: 325, y: 125 } },
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

describe('Steel Wind Strike: цели → точка телепорта', () => {
  const start = () =>
    startMulti({
      tokenId: 't1',
      spellKey: 'XPHB:Steel Wind Strike',
      slotLevel: 5,
      count: 5,
      distinct: true,
      thenAim: { rangeFeet: null, feet: 5 },
    });

  it('после выбора целей — прицел, каст несёт и цели, и точку', () => {
    const caster = makeToken('t1', { x: 100, y: 100 });
    const it = pickMultiTarget(start(), 't2').next;
    expect(it?.mode).toBe('multi');

    // Досрочное применение (2 цели из 5) — прицел, а не каст.
    const early = finishMulti(pickMultiTarget(it, 't3').next);
    expect(early.command).toBeUndefined();
    const aim = early.next!;
    expect(aim.mode).toBe('aim');
    if (aim.mode !== 'aim') return;
    expect(aim.aim.targetIds).toEqual(['t2', 't3']);
    expect(aim.aim.nearTargets).toBe(true);

    const moved = aimToCursor(aim, { x: 250, y: 100 }, caster, 50);
    const cast = confirmArea(moved);
    expect(cast.command).toMatchObject({
      type: 'castSpell',
      payload: { spellKey: 'XPHB:Steel Wind Strike', targetIds: ['t2', 't3'], origin: { x: 250, y: 100 } },
    });
  });

  it('без ограничения ренжа точка телепорта не клампится', () => {
    const caster = makeToken('t1', { x: 100, y: 100 });
    const aim = finishMulti(pickMultiTarget(start(), 't2').next).next!;
    const moved = aimToCursor(aim, { x: 5000, y: 100 }, caster, 50);
    expect(moved?.mode === 'aim' ? moved.aim.origin : null).toEqual({ x: 5000, y: 100 });
  });

  it('полный набор целей сразу переводит к прицелу', () => {
    // count 2 и thenAim: второй клик не кастует, а открывает прицел.
    const it = startMulti({
      tokenId: 't1',
      spellKey: 'XPHB:Steel Wind Strike',
      slotLevel: 3,
      count: 2,
      distinct: true,
      thenAim: { rangeFeet: null, feet: 5 },
    });
    const result = pickMultiTarget(pickMultiTarget(it, 't2').next, 't3');
    expect(result.command).toBeUndefined();
    expect(result.next?.mode).toBe('aim');
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

  it('Telekinesis: та же машина, но команда — action:use с точкой', () => {
    let it = startScatter({
      tokenId: 't1',
      actionId: 'spell:e1:grip',
      slot: 'action',
      maxTargets: 1,
      kind: 'telekinesis',
      destFeet: 30,
    });
    it = toggleScatterTarget(it, 't2')!;
    expect(it.mode === 'scatter' ? it.scatter.phase : null).toBe('places');
    const place = placeScatterPoint(it, { x: 150, y: 250 });
    expect(place.next).toBeNull();
    expect(place.command).toEqual({
      type: 'runAction',
      tokenId: 't1',
      actionId: 'spell:e1:grip',
      extra: { targetIds: ['t2'], slot: 'action', placements: [{ targetId: 't2', x: 150, y: 250 }] },
    });
  });
});

describe('пассажир телепорта', () => {
  it('клик по существу — каст с точкой прибытия и passengerId', () => {
    const origin = { x: 200, y: 100 };
    const it = {
      mode: 'target' as const,
      target: {
        kind: 'passenger' as const,
        tokenId: 't1',
        spellKey: 'XPHB:Dimension Door',
        slotLevel: 4,
        label: '',
        origin,
        plan: { feet: 5, destFeet: 5 },
      },
    };
    const { next, command } = pickTarget(it, 't2');
    expect(next).toBeNull();
    expect(command).toMatchObject({
      type: 'castSpell',
      payload: { tokenId: 't1', spellKey: 'XPHB:Dimension Door', slotLevel: 4, origin, passengerId: 't2' },
    });
  });
});

describe('атака оружием по себе', () => {
  it('клик по своему токену не завершает режим и не шлёт атаку', () => {
    const it = {
      mode: 'target' as const,
      target: {
        kind: 'action' as const,
        tokenId: 't1',
        actionId: 'attack',
        slot: 'action' as const,
        attackIndex: 0,
        label: '',
      },
    };
    const own = pickTarget(it, 't1');
    expect(own.next).toBe(it);
    expect(own.command).toBeUndefined();
    // По чужому токену атака как раньше.
    expect(pickTarget(it, 't2').command).toMatchObject({ type: 'runAction', extra: { targetIds: ['t2'] } });
    // Безоружный удар (без индекса оружия) по себе не блокируется.
    const unarmed = {
      mode: 'target' as const,
      target: { kind: 'action' as const, tokenId: 't1', actionId: 'unarmedStrike', slot: 'action' as const, label: '' },
    };
    expect(pickTarget(unarmed, 't1').command).toMatchObject({ type: 'runAction' });
  });

  it('бросок атаки по своему токену (меню ROLL) не начинается', () => {
    const it = {
      mode: 'target' as const,
      target: { kind: 'rollAttack' as const, tokenId: 't1', attackIndex: 0, label: '' },
    };
    const own = pickTarget(it, 't1');
    expect(own.next).toBe(it);
    expect(own.command).toBeUndefined();
    expect(pickTarget(it, 't2').command).toMatchObject({ type: 'rollAttack' });
  });
});
