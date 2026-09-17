import type { GameState } from '../store/types';
import { t } from '../i18n';
import { errorText } from '../i18n/errors';
import { newId } from '../lib/id';
import type { AppSocket } from './socket';

const HEARTBEAT_MS = 60000;
const STALE_MS = 180000;
const JOIN_TIMEOUT_MS = 5000;

function clearRoomParam() {
  const url = new URL(window.location.href);
  url.searchParams.delete('room');
  window.history.replaceState(null, '', url.toString());
}

/** Вход в комнату с таймаутом: если ack не пришёл — сообщаем об ошибке. */
export function joinRoomWithTimeout(
  socket: AppSocket,
  payload: { code: string; name: string; clientId: string },
  onError: (message: string) => void
) {
  let settled = false;
  const timer = window.setTimeout(() => {
    if (settled) return;
    settled = true;
    onError(t('ui.bridge.timeout'));
  }, JOIN_TIMEOUT_MS);
  socket.emit('room:join', payload, (res) => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    if ('error' in res) onError(errorText(res.error));
  });
}

/**
 * Вешает обработчики и heartbeat на сокет.
 * Возвращает `dispose()` — снять слушатели и остановить таймер (ре-инит/выход/HMR).
 */
export function attachSocketBridge(socket: AppSocket, get: () => GameState): () => void {
  let lastPong = Date.now();

  const onAnyHandler = () => {
    lastPong = Date.now();
  };
  socket.onAny(onAnyHandler);
  socket.on('pong', () => {
    lastPong = Date.now();
  });
  const heartbeat = window.setInterval(() => {
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

  const inviteCode = new URLSearchParams(window.location.search).get('room')?.toUpperCase() ?? '';

  socket.on('connect', () => {
    const state = get();
    state.onConnected();
    if (state.roomCode && state.selfId) {
      const name = localStorage.getItem('vtt-name') ?? '';
      joinRoomWithTimeout(socket, { code: state.roomCode, name, clientId: state.selfId }, (message) =>
        get().onRoomClosed(message)
      );
      return;
    }
    if (inviteCode) {
      const name = localStorage.getItem('vtt-name') ?? '';
      if (!name) return;
      const playerId = localStorage.getItem('vtt-player') ?? newId();
      localStorage.setItem('vtt-player', playerId);
      joinRoomWithTimeout(socket, { code: inviteCode, name, clientId: playerId }, (message) => {
        get().onJoinError(message);
        clearRoomParam();
      });
    }
  });
  socket.on('disconnect', () => get().onDisconnected());
  socket.on('connect_error', () => get().onConnectError());

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
  socket.on('room:settings', (payload) => get().onRoomSettings(payload));
  socket.on('room:deleted', () => {
    get().onRoomClosed(t('ui.bridge.roomDeleted'));
    clearRoomParam();
  });
  socket.on('player:kicked', () => {
    get().onRoomClosed(t('ui.bridge.removed'));
    clearRoomParam();
  });

  socket.on('players:update', (players) => get().onPlayersUpdate(players));
  socket.on('maps:update', (payload) => get().onMapsUpdate(payload));
  socket.on('map:bring', (payload) => get().onMapBring(payload));
  socket.on('fog:update', (payload) => get().onFogUpdate(payload));
  socket.on('walls:update', (payload) => get().onWallsUpdate(payload));
  socket.on('vision:update', (payload) => get().onVisionUpdate(payload));
  socket.on('areas:update', (payload) => get().onAreasUpdate(payload));
  socket.on('zones:update', (payload) => get().onZonesUpdate(payload));
  socket.on('grid:update', (grid) => get().onGridUpdate(grid));
  socket.on('library:update', (library) => get().onLibraryUpdate(library));
  socket.on('combat:update', (payload) => get().onCombatUpdate(payload));

  socket.on('token:add', (payload) => get().onTokenAdd(payload));
  socket.on('token:update', (payload) => get().onTokenUpdate(payload));
  socket.on('token:remove', (payload) => get().onTokenRemove(payload));
  socket.on('token:walk', (payload) => get().onTokenWalk(payload));

  socket.on('chat:message', (message) => get().onChatMessage(message));
  socket.on('chat:error', (message) => get().onChatError(message));

  socket.on('reaction:offer', (offer) => get().onReactionOffer(offer));
  socket.on('reaction:close', (payload) => get().onReactionClose(payload));

  socket.on('sheet:update', (payload) => get().onSheetUpdate(payload));
  socket.on('resources:update', (resources) => get().onResourcesUpdate(resources));
  socket.on('character:update', (payload) => get().onCharacterUpdate(payload));

  return () => {
    window.clearInterval(heartbeat);
    socket.offAny();
    socket.removeAllListeners();
  };
}
