import { attachSocketBridge, joinRoomWithTimeout } from '../../net/bridge';
import { createSocket } from '../../net/socket';
import { newId } from '../../lib/id';
import type { GameState, Slice } from '../types';

export const createRoomSlice: Slice<Pick<GameState, 'init' | 'onConnected' | 'onDisconnected' | 'onJoinError' | 'onRoomJoined' | 'onRoomRenamed' | 'onRoomClosed' | 'onPlayersUpdate' | 'joinRoom' | 'removePlayer'>> = (set, get) => {
  return {
    init: () => {
      if (get().socket) return;
      const socket = createSocket();
      set({ socket });
      attachSocketBridge(socket, get);
    },

    onConnected: () => set({ connected: true }),
    onDisconnected: () => set({ connected: false, draggingTokenId: null, hoverTokenId: null }),
    onJoinError: (joinError) => set({ joinError }),

    onRoomJoined: ({ room, selfId, sheet, resources }) => {
      const player = room.players.find((p) => p.id === selfId);
      set({
        roomCode: room.code,
        roomName: room.name,
        selfId,
        role: player?.role ?? 'player',
        players: room.players,
        scene: room.scene,
        viewMapId: room.scene.activeMapId,
        library: room.library ?? [],
        sheet: sheet ?? null,
        resources: resources ?? null,
        currentCharacterId: room.controllers?.[selfId] ?? null,
        chat: room.chat,
        joinError: null,
        targetTokenId: null,
      });
    },

    onRoomRenamed: ({ name }) => set({ roomName: name }),

    onRoomClosed: (joinError) =>
      set({
        roomCode: null,
        roomName: null,
        joinError,
        resources: null,
        currentCharacterId: null,
        critHit: null,
        hoverTokenId: null,
        selectedTokenId: null,
        tokenMenuId: null,
        draggingTokenId: null,
        targetTokenId: null,
      }),

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
      get().socket?.emit('player:remove', { id });
    },
  };
};
