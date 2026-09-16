import { attachSocketBridge, joinRoomWithTimeout } from '../../net/bridge';
import { createSocket } from '../../net/socket';
import { newId } from '../../lib/id';
import { emit } from '../helpers';
import { clearOptimistic } from '../optimistic';
import { UI_RESET } from '../uiReset';
import type { GameState, Slice } from '../types';

export const createRoomSlice: Slice<Pick<GameState, 'init' | 'onConnected' | 'onConnectError' | 'onDisconnected' | 'onJoinError' | 'onRoomJoined' | 'onRoomRenamed' | 'onRoomSettings' | 'onRoomClosed' | 'onPlayersUpdate' | 'joinRoom' | 'removePlayer' | 'setRoomSettings'>> = (set, get) => {
  return {
    init: () => {
      if (get().socket) return;
      const socket = createSocket();
      set({ socket });
      attachSocketBridge(socket, get);
    },

    onConnected: () => set({ connected: true, connectError: false }),

    onConnectError: () => set({ connectError: true }),

    onDisconnected: () => {
      clearOptimistic();
      set({ connected: false, draggingTokenId: null, hoverTokenId: null });
    },
    onJoinError: (joinError) => set({ joinError }),

    onRoomJoined: ({ room, selfId, sheet, resources }) => {
      const player = room.players.find((p) => p.id === selfId);
      clearOptimistic();
      set({
        ...UI_RESET,
        roomCode: room.code,
        roomName: room.name,
        selfId,
        role: player?.role ?? 'player',
        testMode: room.testMode === true,
        players: room.players,
        scene: room.scene,
        viewMapId: room.scene.activeMapId,
        library: room.library ?? [],
        sheet: sheet ?? null,
        resources: resources ?? null,
        currentCharacterId: room.controllers?.[selfId] ?? null,
        chat: room.chat,
        joinError: null,
      });
    },

    onRoomRenamed: ({ name }) => set({ roomName: name }),

    onRoomSettings: ({ testMode }) => set({ testMode: testMode === true }),

    setRoomSettings: (testMode) => {
      emit(get, 'room:settings', { testMode });
    },

    onRoomClosed: (joinError) => {
      clearOptimistic();
      set({
        ...UI_RESET,
        roomCode: null,
        roomName: null,
        joinError,
        resources: null,
        currentCharacterId: null,
        critHit: null,
      });
    },

    onPlayersUpdate: (players) => set({ players }),

    joinRoom: (code, name) => {
      const socket = get().socket;
      if (!socket) return;
      const playerId = localStorage.getItem('vtt-player') ?? newId();
      localStorage.setItem('vtt-player', playerId);
      set({ joinError: null });
      joinRoomWithTimeout(
        socket,
        { code: code.trim().toUpperCase(), name, clientId: playerId },
        (message) => set({ joinError: message })
      );
    },

    removePlayer: (id) => {
      emit(get, 'player:remove', { id });
    },
  };
};
