import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_GRID } from 'shared';
import { fakeSocket, makeMap, type EmittedEvent } from '../../test/fixtures';
import { useGameStore } from '../useGameStore';

let emitted: EmittedEvent[] = [];

beforeEach(() => {
  const { socket, emitted: out } = fakeSocket();
  emitted = out;
  useGameStore.setState({
    socket,
    viewMapId: 'm1',
    scene: { maps: [makeMap('m1')], activeMapId: 'm1', grid: { ...DEFAULT_GRID } },
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
});
