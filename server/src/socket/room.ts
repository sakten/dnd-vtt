import { randomUUID } from 'node:crypto';
import type { ChatMessage, Token } from 'shared';
import { LEAVE_GRACE_MS, type ConnCtx } from './context';
import { adminTokenOk } from './admin';

export function registerRoomHandlers(ctx: ConnCtx) {
  const { socket, io, manager, getRoom, dmRoom, broadcast, broadcastAll, emitToken, systemMessage, emitJoined, cancelPendingLeave, pendingLeaves } = ctx;

    socket.on('room:create', ({ name, clientId, adminToken, roomName }, cb) => {
      if (!adminTokenOk(adminToken)) {
        cb({ error: 'Нужен пароль ведущего' });
        return;
      }
      const room = manager.create(roomName);
      room.players.push({ id: clientId, name, role: 'dm', isConnected: true, socketId: socket.id });
      manager.saveSoon(room);
      ctx.roomCode = room.code;
      ctx.playerId = clientId;
      socket.join(room.code);
      emitJoined(room, clientId);
      cb({ ok: true });
      broadcast('players:update', manager.toState(room).players);
    });

    socket.on('room:join', ({ code, name, clientId }, cb) => {
      if (typeof code !== 'string' || typeof clientId !== 'string') {
        cb({ error: 'Комната не найдена' });
        return;
      }
      const room = manager.get(code.toUpperCase());
      if (!room) {
        cb({ error: 'Комната не найдена' });
        return;
      }
      const safeName = typeof name === 'string' ? name.trim().slice(0, 30) : '';
      const displayName = safeName || 'Игрок';
      const existing = room.players.find((p) => p.id === clientId);
      if (existing) {
        cancelPendingLeave(room.code, clientId);
        existing.socketId = socket.id;
        existing.isConnected = true;
      } else {
        room.players.push({ id: clientId, name: displayName, role: 'player', isConnected: true, socketId: socket.id });
        systemMessage(room, `${displayName} вошёл в комнату`);
      }
      manager.saveSoon(room);
      ctx.roomCode = room.code;
      ctx.playerId = clientId;
      socket.join(room.code);
      emitJoined(room, clientId);
      cb({ ok: true });
      broadcast('players:update', manager.toState(room).players);
    });

    socket.on('player:remove', ({ id }) => {
      const room = dmRoom();
      if (!room || typeof id !== 'string' || id === ctx.playerId) return;
      const target = room.players.find((p) => p.id === id);
      if (!target) return;
      const targetSocket = target.socketId ? io.sockets.sockets.get(target.socketId) : undefined;
      room.players = room.players.filter((p) => p.id !== id);
      manager.saveSoon(room);
      broadcastAll('players:update', manager.toState(room).players);
      if (targetSocket) {
        targetSocket.emit('player:kicked');
        setTimeout(() => targetSocket.disconnect(true), 300);
      }
    });


    socket.on('disconnect', () => {
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
      manager.saveSoon(room);
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
          io.to(r.code).emit('players:update', manager.toState(r).players);
          const message: ChatMessage = {
            id: randomUUID(),
            kind: 'text',
            author: 'Система',
            text: `${p.name} вышел из комнаты`,
            ts: Date.now(),
          };
          manager.addMessage(r, message);
          io.to(r.code).emit('chat:message', message);
        }, LEAVE_GRACE_MS)
      );
    });
}
