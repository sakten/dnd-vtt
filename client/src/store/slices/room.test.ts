import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GRID, type RoomState } from 'shared';
import { fakeSocket, type EmittedEvent } from '../../test/fixtures';
import type { AppSocket } from '../../net/socket';
import { useGameStore } from '../useGameStore';

let emitted: EmittedEvent[] = [];

beforeEach(() => {
  const { socket, emitted: out } = fakeSocket();
  emitted = out;
  useGameStore.setState({
    socket,
    socketDispose: null,
    connected: false,
    connectError: false,
    roomCode: null,
    roomName: null,
    draggingTokenId: null,
    hoverTokenId: null,
  });
});

const last = (event: string) => emitted.filter((e) => e.event === event).at(-1)?.payload;

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
      customSpecs: [],
      testMode: true,
      optionalRules: { surrounded: false, fogSight: 0 },
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

  it('onDisconnected сбрасывает подключение и hover/drag', () => {
    useGameStore.setState({ connected: true, draggingTokenId: 't1', hoverTokenId: 't2' });
    useGameStore.getState().onDisconnected();
    const state = useGameStore.getState();
    expect(state.connected).toBe(false);
    expect(state.draggingTokenId).toBeNull();
    expect(state.hoverTokenId).toBeNull();
  });

  it('onRoomSettings обновляет режим тестов и правила', () => {
    useGameStore.getState().onRoomSettings({ testMode: true, optionalRules: { surrounded: true, fogSight: 3 } });
    const state = useGameStore.getState();
    expect(state.testMode).toBe(true);
    expect(state.optionalRules).toEqual({ surrounded: true, fogSight: 3 });
  });

  it('onRoomClosed очищает комнату и крит', () => {
    useGameStore.setState({ roomCode: 'ABCD', roomName: 'Игра', critHit: { id: 'm1', author: 'A', label: 'X', total: 20 } });
    useGameStore.getState().onRoomClosed('Комната удалена');
    const state = useGameStore.getState();
    expect(state.roomCode).toBeNull();
    expect(state.roomName).toBeNull();
    expect(state.joinError).toBe('Комната удалена');
    expect(state.critHit).toBeNull();
  });

  it('команды комнаты шлют ожидаемые события', () => {
    useGameStore.getState().setRoomSettings(true);
    expect(last('room:settings')).toEqual({ testMode: true });

    useGameStore.getState().setOptionalRules({ surrounded: true, fogSight: 0 });
    expect(last('room:settings')).toEqual({ optionalRules: { surrounded: true, fogSight: 0 } });

    useGameStore.getState().removePlayer('p1');
    expect(last('player:remove')).toEqual({ id: 'p1' });

    useGameStore.getState().importCustomSpell('{"key":"CUSTOM:X"}');
    expect(last('custom:import')).toEqual({ json: '{"key":"CUSTOM:X"}' });

    useGameStore.getState().removeCustomSpell('CUSTOM:X');
    expect(last('custom:remove')).toBe('CUSTOM:X');
  });
});
