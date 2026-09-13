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
    targetTokenId: null,
    aim: null,
    multiTarget: null,
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

  it('castSpell шлёт spell:cast с целью по умолчанию', () => {
    useGameStore.setState({ targetTokenId: 't2' });
    useGameStore.getState().castSpell({ tokenId: 't1', spellKey: 'XPHB:Fireball', slotLevel: 4 });
    expect(emitted).toContainEqual({
      event: 'spell:cast',
      payload: { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Fireball', slotLevel: 4, targetIds: ['t2'] },
    });
  });

  it('startAim: self-область берёт точку от кастера', () => {
    useGameStore.getState().startAim({
      tokenId: 't1',
      spellKey: 'XPHB:Burning Hands',
      spec: { shape: 'cone', size: 15 },
      originKind: 'self',
      rangeFeet: null,
    });
    expect(useGameStore.getState().aim?.origin).toEqual({ x: 100, y: 100 });
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
        targetIds: undefined,
      },
    });
    expect(useGameStore.getState().aim).toBeNull();
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
    expect(useGameStore.getState().aim?.origin).toEqual({ x: 600, y: 100 });
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
    expect(useGameStore.getState().multiTarget?.targets).toEqual(['a', 'b']);
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
    expect(useGameStore.getState().multiTarget).toBeNull();
  });
});
