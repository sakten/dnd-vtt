import { createHash, timingSafeEqual } from 'node:crypto';
import type { ConnCtx } from './context';

export function adminTokenOk(token?: string): boolean {
  const expected = process.env.VTT_ADMIN_TOKEN;
  if (!expected) return true;
  if (!token) return false;
  const a = createHash('sha256').update(token).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export function registerAdminHandlers(ctx: ConnCtx) {
  const { socket, io, manager, broadcast, emitJoined, cancelPendingLeave } = ctx;

    ctx.on('admin:list', ({ adminToken }, cb) => {
      if (!adminTokenOk(adminToken)) {
        cb({ error: 'Неверный пароль ведущего' });
        return;
      }
      cb({ rooms: manager.listRooms() });
    });

    ctx.on('admin:create', ({ adminToken, name, clientId, roomName }, cb) => {
      if (!adminTokenOk(adminToken)) {
        cb({ error: 'Неверный пароль ведущего' });
        return;
      }
      const playerName = name.trim() || 'Ведущий';
      const room = manager.create(roomName);
      room.players.push({ id: clientId, name: playerName, role: 'dm', isConnected: true, socketId: socket.id });
      manager.saveSoon(room);
      ctx.roomCode = room.code;
      ctx.playerId = clientId;
      socket.join(room.code);
      emitJoined(room, clientId);
      cb({ code: room.code });
    });

    ctx.on('admin:join', ({ adminToken, code, clientId, name }, cb) => {
      if (!adminTokenOk(adminToken)) {
        cb({ error: 'Неверный пароль ведущего' });
        return;
      }
      const room = manager.get(code.toUpperCase());
      if (!room) {
        cb({ error: 'Комната не найдена' });
        return;
      }
      const playerName = name.trim() || 'Ведущий';
      const existing = room.players.find((p) => p.id === clientId);
      if (existing) {
        cancelPendingLeave(room.code, clientId);
        existing.socketId = socket.id;
        existing.isConnected = true;
        existing.role = 'dm';
        existing.name = playerName;
      } else {
        room.players.push({ id: clientId, name: playerName, role: 'dm', isConnected: true, socketId: socket.id });
      }
      manager.saveSoon(room);
      ctx.roomCode = room.code;
      ctx.playerId = clientId;
      socket.join(room.code);
      emitJoined(room, clientId);
      cb({ ok: true });
      broadcast('players:update', manager.toState(room).players);
    });

    ctx.on('admin:rename', ({ adminToken, code, name }, cb) => {
      if (!adminTokenOk(adminToken)) {
        cb({ error: 'Неверный пароль ведущего' });
        return;
      }
      const room = manager.get(code.toUpperCase());
      if (!room) {
        cb({ error: 'Комната не найдена' });
        return;
      }
      if (!name.trim()) {
        cb({ error: 'Пустое название' });
        return;
      }
      const renamed = manager.renameRoom(room, name);
      io.to(room.code).emit('room:renamed', { name: renamed });
      cb({ ok: true });
    });

    ctx.on('admin:delete', ({ adminToken, code }, cb) => {
      if (!adminTokenOk(adminToken)) {
        cb({ error: 'Неверный пароль ведущего' });
        return;
      }
      const target = code.toUpperCase();
      const room = manager.get(target);
      if (!room) {
        cb({ error: 'Комната не найдена' });
        return;
      }
      io.in(room.code).emit('room:deleted');
      cb({ ok: true });
      manager.deleteRoom(room.code);
      setImmediate(() => {
        io.in(room.code).disconnectSockets(true);
      });
    });

}
