import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_GRID } from 'shared';
import { fakeSocket, makeMap, makeToken, type EmittedEvent } from '../test/fixtures';
import { useGameStore } from './useGameStore';
import { emitInMap } from './helpers';
import { activeMapOf, characterTokenOf, tokenById } from './selectors';
import { clearTokenUiFor } from './uiReset';

let emitted: EmittedEvent[] = [];

beforeEach(() => {
  const { socket, emitted: out } = fakeSocket();
  emitted = out;
  useGameStore.setState({
    socket,
    viewMapId: 'm1',
    scene: {
      maps: [makeMap('m1', [makeToken('t1', { libraryItemId: 'char1' })])],
      activeMapId: 'm1',
      grid: { ...DEFAULT_GRID },
    },
  });
});

describe('emitInMap', () => {
  it('подставляет mapId активной карты', () => {
    emitInMap(useGameStore.getState, 'combat:start', {});
    expect(emitted).toContainEqual({ event: 'combat:start', payload: { mapId: 'm1' } });
  });

  it('без активной карты молчит', () => {
    useGameStore.setState({ viewMapId: null });
    emitInMap(useGameStore.getState, 'combat:start', {});
    expect(emitted).toHaveLength(0);
  });
});

describe('clearTokenUiFor', () => {
  it('сбрасывает ссылки на удалённый токен, не трогая чужие', () => {
    useGameStore.setState({
      selectedTokenId: 't1',
      tokenMenuId: 't2',
      draggingTokenId: 't1',
      hoverTokenId: 't1',
      interaction: { mode: 'target', target: { kind: 'action', tokenId: 't1', actionId: 'attack', slot: 'action', label: 'Атака' } },
    });
    const patch = clearTokenUiFor(useGameStore.getState(), 't1');
    expect(patch).toMatchObject({
      selectedTokenId: null,
      tokenMenuId: 't2',
      draggingTokenId: null,
      hoverTokenId: null,
      interaction: null,
    });
  });
});

describe('selectors', () => {
  it('activeMapOf / tokenById / characterTokenOf', () => {
    const s = useGameStore.getState();
    const map = activeMapOf(s);
    expect(map?.id).toBe('m1');
    expect(tokenById(map, 't1')?.id).toBe('t1');
    expect(tokenById(map, 'nope')).toBeNull();
    expect(characterTokenOf(map, 'char1')?.id).toBe('t1');
    expect(characterTokenOf(map, 'char2')).toBeNull();
  });
});
