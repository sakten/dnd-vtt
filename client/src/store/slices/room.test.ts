import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GRID, type RoomState } from 'shared';
import { fakeSocket } from '../../test/fixtures';
import type { AppSocket } from '../../net/socket';
import { useGameStore } from '../useGameStore';

beforeEach(() => {
  useGameStore.setState({
    socket: fakeSocket().socket,
    socketDispose: null,
    connected: false,
    connectError: false,
  });
});

describe('room slice: подключение и режим тестов', () => {
  it('onConnectError выставляет ошибку, onConnected сбрасывает', () => {
    useGameStore.getState().onConnectError();
    expect(useGameStore.getState().connectError).toBe(true);

    useGameStore.getState().onConnected();
    expect(useGameStore.getState().connectError).toBe(false);
    expect(useGameStore.getState().connected).toBe(true);
  });

  it('onRoomJoined берёт testMode из состояния комнаты', () => {
    const room: RoomState = {
      code: 'ABCD',
      name: 'Игра',
      scene: { maps: [], activeMapId: null, grid: { ...DEFAULT_GRID } },
      library: [],
      players: [{ id: 'p1', name: 'A', role: 'player', isConnected: true }],
      chat: [],
      controllers: {},
      testMode: true,
    };

    useGameStore.getState().onRoomJoined({ room, selfId: 'p1', sheet: null, resources: null });

    const state = useGameStore.getState();
    expect(state.role).toBe('player');
    expect(state.testMode).toBe(true);
  });

  it('disposeSocket снимает мост, отключает сокет и чистит состояние', () => {
    const dispose = vi.fn();
    const disconnect = vi.fn();
    useGameStore.setState({
      socket: { disconnect } as unknown as AppSocket,
      socketDispose: dispose,
      connected: true,
    });

    useGameStore.getState().disposeSocket();

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
    const state = useGameStore.getState();
    expect(state.socket).toBeNull();
    expect(state.socketDispose).toBeNull();
    expect(state.connected).toBe(false);
  });
});
