import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_GRID } from 'shared';
import { fakeSocket, makeMap, makeToken, type EmittedEvent } from '../../test/fixtures';
import { useGameStore } from '../useGameStore';

let emitted: EmittedEvent[] = [];

beforeEach(() => {
  const { socket, emitted: out } = fakeSocket();
  emitted = out;
  useGameStore.setState({
    socket,
    viewMapId: 'm1',
    interaction: null,
    scene: {
      maps: [makeMap('m1', [makeToken('t1', { x: 100, y: 100 })])],
      activeMapId: 'm1',
      grid: { ...DEFAULT_GRID },
    },
  });
});

describe('actions slice', () => {
  it('runAction шлёт action:use с mapId и деталями', () => {
    useGameStore.getState().runAction('t1', 'dash', { slot: 'action' });
    expect(emitted).toContainEqual({
      event: 'action:use',
      payload: { mapId: 'm1', tokenId: 't1', actionId: 'dash', slot: 'action' },
    });
  });

  it('без активной карты ничего не шлёт', () => {
    useGameStore.setState({ viewMapId: null });
    useGameStore.getState().runAction('t1', 'dash');
    expect(emitted).toHaveLength(0);
  });

  it('startTargeting + resolveTargeting шлют action:use с целью', () => {
    useGameStore.getState().startTargeting({
      kind: 'action',
      tokenId: 't1',
      actionId: 'attack',
      slot: 'action',
      attackIndex: 0,
      label: 'Атака: Меч',
    });
    expect(emitted).toHaveLength(0);
    useGameStore.getState().resolveTargeting('t2');
    expect(emitted).toContainEqual({
      event: 'action:use',
      payload: { mapId: 'm1', tokenId: 't1', actionId: 'attack', slot: 'action', attackIndex: 0, targetIds: ['t2'] },
    });
    expect(useGameStore.getState().interaction).toBeNull();
  });

  it('startTargeting + resolveTargeting для заклинания шлют spell:cast с целью', () => {
    useGameStore.getState().startTargeting({
      kind: 'spell',
      tokenId: 't1',
      spellKey: 'XPHB:Fireball',
      slotLevel: 4,
      label: 'Fireball',
    });
    useGameStore.getState().resolveTargeting('t2');
    expect(emitted).toContainEqual({
      event: 'spell:cast',
      payload: { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Fireball', slotLevel: 4, targetIds: ['t2'] },
    });
  });

  it('startMultiTarget с actionId шлёт action:use со всеми целями', () => {
    useGameStore.getState().startMultiTarget({
      tokenId: 't1',
      actionId: 'class:bard.glamour:mantleOfInspiration',
      slot: 'bonus',
      count: 2,
      distinct: true,
    });
    useGameStore.getState().addMultiTarget('t2');
    expect(useGameStore.getState().interaction?.mode).toBe('multi');
    useGameStore.getState().addMultiTarget('t3');
    expect(emitted).toContainEqual({
      event: 'action:use',
      payload: {
        mapId: 'm1',
        tokenId: 't1',
        actionId: 'class:bard.glamour:mantleOfInspiration',
        slot: 'bonus',
        targetIds: ['t2', 't3'],
      },
    });
    expect(useGameStore.getState().interaction).toBeNull();
  });

  it('startTargeting + resolveTargeting для ROLL-атаки шлют dice:attack с целью', () => {
    useGameStore.getState().startTargeting({ kind: 'rollAttack', tokenId: 't1', attackIndex: 2, label: 'Атака: Меч' });
    useGameStore.getState().resolveTargeting('t2');
    expect(emitted).toContainEqual({
      event: 'dice:attack',
      payload: { tokenId: 't1', targetId: 't2', attackIndex: 2 },
    });
  });

  it('cancelTargeting сбрасывает режим без бросков', () => {
    useGameStore.getState().startTargeting({ kind: 'action', tokenId: 't1', actionId: 'grapple', slot: 'action', label: 'Захват' });
    useGameStore.getState().cancelTargeting();
    expect(useGameStore.getState().interaction).toBeNull();
    expect(emitted).toHaveLength(0);
  });

  it('startAim: self-область берёт точку от кастера', () => {
    useGameStore.getState().startAim({
      tokenId: 't1',
      spellKey: 'XPHB:Burning Hands',
      spec: { shape: 'cone', size: 15 },
      originKind: 'self',
      rangeFeet: null,
    });
    const aim = useGameStore.getState().interaction;
    expect(aim?.mode === 'aim' ? aim.aim.origin : null).toEqual({ x: 100, y: 100 });
  });

  it('confirmAim шлёт spell:cast с origin/direction', () => {
    useGameStore.getState().startAim({
      tokenId: 't1',
      spellKey: 'XPHB:Fireball',
      slotLevel: 3,
      spec: { shape: 'sphere', size: 20 },
      originKind: 'point',
      rangeFeet: null,
    });
    useGameStore.getState().aimToCursor({ x: 200, y: 150 });
    useGameStore.getState().confirmAim();
    expect(emitted).toContainEqual({
      event: 'spell:cast',
      payload: {
        mapId: 'm1',
        tokenId: 't1',
        spellKey: 'XPHB:Fireball',
        slotLevel: 3,
        origin: { x: 200, y: 150 },
        direction: { x: 200, y: 150 },
      },
    });
    expect(useGameStore.getState().interaction).toBeNull();
  });

  it('aimToCursor: точка не уходит за дистанцию заклинания', () => {
    useGameStore.getState().startAim({
      tokenId: 't1',
      spellKey: 'XPHB:Fireball',
      spec: { shape: 'sphere', size: 20 },
      originKind: 'point',
      rangeFeet: 50,
    });
    useGameStore.getState().aimToCursor({ x: 1000, y: 100 });
    const aim = useGameStore.getState().interaction;
    expect(aim?.mode === 'aim' ? aim.aim.origin : null).toEqual({ x: 600, y: 100 });
  });

  it('multiTarget: каст после выбора целей на все снаряды', () => {
    useGameStore.getState().startMultiTarget({
      tokenId: 't1',
      spellKey: 'XPHB:Scorching Ray',
      slotLevel: 2,
      count: 3,
    });
    useGameStore.getState().addMultiTarget('a');
    useGameStore.getState().addMultiTarget('b');
    expect(emitted).toHaveLength(0);
    const multi = useGameStore.getState().interaction;
    expect(multi?.mode === 'multi' ? multi.multi.targets : null).toEqual(['a', 'b']);
    useGameStore.getState().addMultiTarget('c');
    expect(emitted).toContainEqual({
      event: 'spell:cast',
      payload: {
        mapId: 'm1',
        tokenId: 't1',
        spellKey: 'XPHB:Scorching Ray',
        slotLevel: 2,
        targetIds: ['a', 'b', 'c'],
      },
    });
    expect(useGameStore.getState().interaction).toBeNull();
  });

  it('multiTarget: меньше максимума — применение кнопкой, дубли целей игнорируются', () => {
    useGameStore.getState().startMultiTarget({
      tokenId: 't1',
      spellKey: 'XPHB:Mass Healing Word',
      slotLevel: 3,
      count: 6,
      distinct: true,
    });
    useGameStore.getState().addMultiTarget('a');
    useGameStore.getState().addMultiTarget('b');
    useGameStore.getState().addMultiTarget('a');
    const multi = useGameStore.getState().interaction;
    expect(multi?.mode === 'multi' ? multi.multi.targets : null).toEqual(['a', 'b']);
    useGameStore.getState().finishMultiTarget();
    expect(emitted).toContainEqual({
      event: 'spell:cast',
      payload: {
        mapId: 'm1',
        tokenId: 't1',
        spellKey: 'XPHB:Mass Healing Word',
        slotLevel: 3,
        targetIds: ['a', 'b'],
      },
    });
    expect(useGameStore.getState().interaction).toBeNull();
  });

  it('multiTarget: применение без целей ничего не шлёт', () => {
    useGameStore.getState().startMultiTarget({
      tokenId: 't1',
      spellKey: 'XPHB:Mass Healing Word',
      slotLevel: 3,
      count: 6,
      distinct: true,
    });
    useGameStore.getState().finishMultiTarget();
    expect(emitted).toHaveLength(0);
    expect(useGameStore.getState().interaction?.mode).toBe('multi');
  });
});
