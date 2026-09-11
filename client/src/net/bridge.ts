import type { GameState } from '../store/types';
import { newId } from '../lib/id';
import type { AppSocket } from './socket';

const HEARTBEAT_MS = 60000;
const STALE_MS = 180000;

function clearRoomParam() {
  const url = new URL(window.location.href);
  url.searchParams.delete('room');
  window.history.replaceState(null, '', url.toString());
}

export function attachSocketBridge(socket: AppSocket, get: () => GameState): void {
  let lastPong = Date.now();

  socket.onAny(() => {
    lastPong = Date.now();
  });
  socket.on('pong', () => {
    lastPong = Date.now();
  });
  window.setInterval(() => {
    // Не трогаем соединение в фоновой вкладке и проверяем реже, чтобы не
    // провоцировать лишние переподключения (и сообщения «вышел»).
    if (!socket.connected || document.hidden) return;
    if (Date.now() - lastPong > STALE_MS) {
      socket.disconnect();
      socket.connect();
    } else {
      socket.emit('ping');
    }
  }, HEARTBEAT_MS);

  socket.on('connect', () => {
    const state = get();
    state.onConnected();
    if (state.roomCode && state.selfId) {
      const name = localStorage.getItem('vtt-name') ?? '';
      socket.emit('room:join', { code: state.roomCode, name, clientId: state.selfId }, (res) => {
        if ('error' in res) get().onJoinError(res.error);
      });
    }
  });
  socket.on('disconnect', () => get().onDisconnected());

  socket.on('room:joined', (payload) => {
    get().onRoomJoined(payload);
    const url = new URL(window.location.href);
    if (url.searchParams.get('room') !== payload.room.code) {
      url.searchParams.set('room', payload.room.code);
      url.searchParams.delete('admin');
      window.history.replaceState(null, '', url.toString());
    }
  });
  socket.on('room:renamed', (payload) => get().onRoomRenamed(payload));
  socket.on('room:deleted', () => {
    get().onRoomClosed('Комната удалена ведущим');
    clearRoomParam();
  });
  socket.on('player:kicked', () => {
    get().onRoomClosed('Ведущий удалил вас из комнаты');
    clearRoomParam();
  });

  socket.on('players:update', (players) => get().onPlayersUpdate(players));
  socket.on('maps:update', (payload) => get().onMapsUpdate(payload));
  socket.on('map:bring', (payload) => get().onMapBring(payload));
  socket.on('fog:update', (payload) => get().onFogUpdate(payload));
  socket.on('grid:update', (grid) => get().onGridUpdate(grid));
  socket.on('library:update', (library) => get().onLibraryUpdate(library));
  socket.on('combat:update', (payload) => get().onCombatUpdate(payload));

  socket.on('token:add', (payload) => get().onTokenAdd(payload));
  socket.on('token:update', (payload) => get().onTokenUpdate(payload));
  socket.on('token:remove', (payload) => get().onTokenRemove(payload));

  socket.on('chat:message', (message) => get().onChatMessage(message));
  socket.on('chat:error', (message) => get().onChatError(message));

  socket.on('sheet:update', (payload) => get().onSheetUpdate(payload));
  socket.on('resources:update', (resources) => get().onResourcesUpdate(resources));
  socket.on('character:update', (payload) => get().onCharacterUpdate(payload));

  const inviteCode = new URLSearchParams(window.location.search).get('room')?.toUpperCase();
  if (inviteCode) {
    const name = localStorage.getItem('vtt-name') ?? '';
    if (name) {
      const playerId = localStorage.getItem('vtt-player') ?? newId();
      localStorage.setItem('vtt-player', playerId);
      socket.emit('room:join', { code: inviteCode, name, clientId: playerId }, (res) => {
        if ('error' in res) get().onJoinError(res.error);
      });
    }
  }
}
