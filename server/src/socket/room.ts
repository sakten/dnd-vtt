import type { Token } from 'shared';
import { LEAVE_GRACE_MS, type ConnCtx } from './context';
import { adminTokenOk } from './admin';
import { asBool, asString, asTrimmedString } from './decode';

export function registerRoomHandlers(ctx: ConnCtx) {
  const { socket, io, manager, getRoom, dmRoom, broadcast, broadcastAll, emitToken, broadcastLibrary, systemMessage, emitJoined, cancelPendingLeave, pendingLeaves } = ctx;

    ctx.on('room:create', ({ name, clientId, adminToken, roomName }, cb) => {
      if (!adminTokenOk(adminToken)) {
        cb({ error: { code: 'passwordRequired' } });
        return;
      }
      const ownerId = asString(clientId);
      if (!ownerId) {
        cb({ error: { code: 'badRequest' } });
        return;
      }
      const playerName = asString(name, 30) ?? '';
      const room = manager.create(asString(roomName));
      room.players.push({ id: ownerId, name: playerName, role: 'dm', isConnected: true, socketId: socket.id, clientId: ownerId });
      ctx.roomCode = room.code;
      ctx.playerId = ownerId;
      socket.join(room.code);
      emitJoined(room, ownerId);
      cb({ ok: true });
      broadcast('players:update', manager.toState(room).players);
    });

    ctx.on('room:join', ({ code, name, clientId }, cb) => {
      const roomCode = asString(code);
      const playerId = asString(clientId);
      if (!roomCode || !playerId) {
        cb({ error: { code: 'roomNotFound' } });
        return;
      }
      const room = manager.get(roomCode.toUpperCase());
      if (!room) {
        cb({ error: { code: 'roomNotFound' } });
        return;
      }
      const safeName = asTrimmedString(name, 30) ?? '';
      if (!safeName) {
        cb({ error: { code: 'badRequest' } });
        return;
      }
      // Аккаунт: сначала свой браузер (clientId/id — лист мог переименовать игрока),
      // затем имя как логин (вход с другого браузера после выхода).
      const nameKey = safeName.toLocaleLowerCase();
      const byClient = room.players.find((p) => p.clientId === playerId || p.id === playerId);
      const byName = room.players.find((p) => p.name.trim().toLocaleLowerCase() === nameKey);
      const existing = byClient ?? byName;
      if (existing) {
        const sameBrowser = existing === byClient;
        // Занятое имя: живая сессия чужого браузера недоступна, имя ведущего — тем более.
        if (!sameBrowser && (existing.socketId !== null || existing.role === 'dm')) {
          cb({ error: { code: 'nameTaken' } });
          return;
        }
        cancelPendingLeave(room.code, existing.id);
        existing.socketId = socket.id;
        existing.isConnected = true;
        existing.clientId = playerId;
        ctx.roomCode = room.code;
        ctx.playerId = existing.id;
        socket.join(room.code);
        emitJoined(room, existing.id);
        cb({ ok: true });
        broadcast('players:update', manager.toState(room).players);
        return;
      }
      room.players.push({ id: playerId, name: safeName, role: 'player', isConnected: true, socketId: socket.id, clientId: playerId });
      systemMessage(room, { code: 'room.joined', params: { name: safeName } });
      ctx.roomCode = room.code;
      ctx.playerId = playerId;
      socket.join(room.code);
      emitJoined(room, playerId);
      cb({ ok: true });
      broadcast('players:update', manager.toState(room).players);
    });

    ctx.on('room:settings', ({ testMode }) => {
      const enabled = asBool(testMode);
      const room = getRoom();
      if (!room || enabled === undefined) return;
      const me = ctx.playerId ? room.players.find((p) => p.id === ctx.playerId) : undefined;
      if (me?.role !== 'dm') return; // настройку комнаты меняет только реальный ведущий
      if (room.testMode === enabled) return;
      manager.setTestMode(room, enabled);
      // Переслать токены/библиотеку: в режиме тестов статы открываются всем.
      for (const map of room.scene.maps) {
        for (const token of map.tokens) emitToken(room, 'token:update', map.id, token);
      }
      broadcastLibrary(room);
      broadcastAll('room:settings', { testMode: enabled });
      systemMessage(room, { code: enabled ? 'room.testModeOn' : 'room.testModeOff' });
    });

    ctx.on('player:remove', ({ id }) => {
      const room = dmRoom();
      const targetId = asString(id);
      if (!room || !targetId || targetId === ctx.playerId) return;
      const target = room.players.find((p) => p.id === targetId);
      if (!target) return;
      const targetSocket = target.socketId ? io.sockets.sockets.get(target.socketId) : undefined;
      room.players = room.players.filter((p) => p.id !== targetId);
      ctx.notifyPlayers(room);
      if (targetSocket) {
        targetSocket.emit('player:kicked');
        setTimeout(() => targetSocket.disconnect(true), 300);
      }
    });


    ctx.onDisconnect(() => {
      if (!ctx.playerId) return;
      const room = getRoom();
      if (!room) return;
      const player = room.players.find((p) => p.id === ctx.playerId);
      if (!player || player.socketId !== socket.id) return;
      const lockedTokens: { id: string; token: Token }[] = [];
      for (const map of room.scene.maps) {
        for (const token of map.tokens) {
          if (token.lockedBy === ctx.playerId) lockedTokens.push({ id: map.id, token });
        }
      }
      player.socketId = null;
      manager.clearLocks(room, ctx.playerId);
      for (const { id, token } of lockedTokens) emitToken(room, 'token:update', id, token);
      // Не объявляем выход сразу: Socket.IO переподключения создают новый сокет,
      // и игрок успевает вернуться. Даём грейс-период и отменяем при повторном входе.
      const key = `${room.code}:${ctx.playerId}`;
      const previous = pendingLeaves.get(key);
      if (previous) clearTimeout(previous);
      pendingLeaves.set(
        key,
        setTimeout(() => {
          pendingLeaves.delete(key);
          const r = manager.get(room.code);
          if (!r) return;
          const p = r.players.find((x) => x.id === ctx.playerId);
          if (!p || p.socketId !== null) return;
          p.isConnected = false;
          manager.saveSoon(r);
          ctx.notifyPlayers(r);
          systemMessage(r, { code: 'room.left', params: { name: p.name } });
        }, LEAVE_GRACE_MS)
      );
    });
}
