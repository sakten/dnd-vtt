import { createHash, timingSafeEqual } from 'node:crypto';
import type { ConnCtx } from './context';
import { asString, asTrimmedString } from './decode';

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
        cb({ error: { code: 'wrongAdminToken' } });
        return;
      }
      cb({ rooms: manager.listRooms() });
    });

    ctx.on('admin:create', ({ adminToken, name, clientId, roomName }, cb) => {
      if (!adminTokenOk(adminToken)) {
        cb({ error: { code: 'wrongAdminToken' } });
        return;
      }
      const ownerId = asString(clientId);
      if (!ownerId) {
        cb({ error: { code: 'badRequest' } });
        return;
      }
      const playerName = asTrimmedString(name, 30) || 'Ведущий';
      const room = manager.create(asString(roomName));
      room.players.push({ id: ownerId, name: playerName, role: 'dm', isConnected: true, socketId: socket.id });
      ctx.roomCode = room.code;
      ctx.playerId = ownerId;
      socket.join(room.code);
      emitJoined(room, ownerId);
      cb({ code: room.code });
    });

    ctx.on('admin:join', ({ adminToken, code, clientId, name }, cb) => {
      if (!adminTokenOk(adminToken)) {
        cb({ error: { code: 'wrongAdminToken' } });
        return;
      }
      const roomCode = asString(code);
      const ownerId = asString(clientId);
      const room = roomCode ? manager.get(roomCode.toUpperCase()) : undefined;
      if (!room || !ownerId) {
        cb({ error: { code: 'roomNotFound' } });
        return;
      }
      const playerName = asTrimmedString(name, 30) || 'Ведущий';
      const existing = room.players.find((p) => p.id === ownerId);
      if (existing) {
        cancelPendingLeave(room.code, ownerId);
        existing.socketId = socket.id;
        existing.isConnected = true;
        existing.role = 'dm';
        existing.name = playerName;
      } else {
        room.players.push({ id: ownerId, name: playerName, role: 'dm', isConnected: true, socketId: socket.id });
      }
      ctx.roomCode = room.code;
      ctx.playerId = ownerId;
      socket.join(room.code);
      emitJoined(room, ownerId);
      cb({ ok: true });
      broadcast('players:update', manager.toState(room).players);
    });

    ctx.on('admin:rename', ({ adminToken, code, name }, cb) => {
      if (!adminTokenOk(adminToken)) {
        cb({ error: { code: 'wrongAdminToken' } });
        return;
      }
      const roomCode = asString(code);
      const room = roomCode ? manager.get(roomCode.toUpperCase()) : undefined;
      if (!room) {
        cb({ error: { code: 'roomNotFound' } });
        return;
      }
      const playerName = asTrimmedString(name, 60);
      if (!playerName) {
        cb({ error: { code: 'emptyName' } });
        return;
      }
      const renamed = manager.renameRoom(room, playerName);
      io.to(room.code).emit('room:renamed', { name: renamed });
      cb({ ok: true });
    });

    ctx.on('admin:flush', async ({ adminToken }, cb) => {
      if (!adminTokenOk(adminToken)) {
        cb({ error: { code: 'wrongAdminToken' } });
        return;
      }
      await manager.flushSaves();
      cb({ ok: true });
    });

    ctx.on('admin:delete', ({ adminToken, code }, cb) => {
      if (!adminTokenOk(adminToken)) {
        cb({ error: { code: 'wrongAdminToken' } });
        return;
      }
      const roomCode = asString(code);
      const target = roomCode ? roomCode.toUpperCase() : '';
      const room = target ? manager.get(target) : undefined;
      if (!room) {
        cb({ error: { code: 'roomNotFound' } });
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
