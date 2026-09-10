import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Server as SocketServer, Socket } from 'socket.io';
import {
  DiceParseError,
  isCriticalHit,
  normalizeSheet,
  rollDice,
  snapToGrid,
  type ChatMessage,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from 'shared';
import type { Room, RoomManager } from './rooms';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type AppServer = SocketServer<ClientToServerEvents, ServerToClientEvents>;

function adminTokenOk(token?: string): boolean {
  const expected = process.env.VTT_ADMIN_TOKEN;
  if (!expected) return true;
  if (!token) return false;
  const a = createHash('sha256').update(token).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export function registerSocket(io: AppServer, manager: RoomManager) {
  io.on('connection', (socket: AppSocket) => {
    let roomCode: string | null = null;
    let playerId: string | null = null;

    socket.on('ping', () => {
      socket.emit('pong');
    });

    const broadcast = <E extends keyof ServerToClientEvents>(event: E, ...args: Parameters<ServerToClientEvents[E]>) => {
      if (roomCode) socket.to(roomCode).emit(event, ...args);
    };

    const broadcastAll = <E extends keyof ServerToClientEvents>(event: E, ...args: Parameters<ServerToClientEvents[E]>) => {
      if (roomCode) io.to(roomCode).emit(event, ...args);
    };

    const broadcastMaps = (room: Room) => {
      broadcastAll('maps:update', { maps: room.scene.maps, activeMapId: room.scene.activeMapId });
    };

    const isDm = () => {
      if (!roomCode || !playerId) return false;
      const room = manager.get(roomCode);
      return !!room?.players.find((p) => p.id === playerId && p.role === 'dm');
    };

    const systemMessage = (room: Room, text: string) => {
      const message: ChatMessage = { id: randomUUID(), kind: 'text', author: 'Система', text, ts: Date.now() };
      manager.addMessage(room, message);
      broadcastAll('chat:message', message);
    };

    socket.on('admin:list', ({ adminToken }, cb) => {
      if (!adminTokenOk(adminToken)) {
        cb({ error: 'Неверный пароль ведущего' });
        return;
      }
      cb({ rooms: manager.listRooms() });
    });

    socket.on('admin:create', ({ adminToken, name, clientId, roomName }, cb) => {
      if (!adminTokenOk(adminToken)) {
        cb({ error: 'Неверный пароль ведущего' });
        return;
      }
      const playerName = name.trim() || 'Ведущий';
      const room = manager.create(roomName);
      room.players.push({ id: clientId, name: playerName, role: 'dm', isConnected: true, socketId: socket.id });
      manager.saveSoon(room);
      roomCode = room.code;
      playerId = clientId;
      socket.join(room.code);
      socket.emit('room:joined', {
        room: manager.toState(room),
        selfId: clientId,
        sheet: room.sheets[clientId] ?? null,
      });
      cb({ code: room.code });
    });

    socket.on('admin:join', ({ adminToken, code, clientId, name }, cb) => {
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
        existing.socketId = socket.id;
        existing.isConnected = true;
        existing.role = 'dm';
        existing.name = playerName;
      } else {
        room.players.push({ id: clientId, name: playerName, role: 'dm', isConnected: true, socketId: socket.id });
      }
      manager.saveSoon(room);
      roomCode = room.code;
      playerId = clientId;
      socket.join(room.code);
      socket.emit('room:joined', {
        room: manager.toState(room),
        selfId: clientId,
        sheet: room.sheets[clientId] ?? null,
      });
      cb({ ok: true });
      broadcast('players:update', manager.toState(room).players);
    });

    socket.on('admin:rename', ({ adminToken, code, name }, cb) => {
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

    socket.on('admin:delete', ({ adminToken, code }, cb) => {
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

    socket.on('room:create', ({ name, clientId, adminToken, roomName }, cb) => {
      if (!adminTokenOk(adminToken)) {
        cb({ error: 'Нужен пароль ведущего' });
        return;
      }
      const room = manager.create(roomName);
      room.players.push({ id: clientId, name, role: 'dm', isConnected: true, socketId: socket.id });
      manager.saveSoon(room);
      roomCode = room.code;
      playerId = clientId;
      socket.join(room.code);
      socket.emit('room:joined', {
        room: manager.toState(room),
        selfId: clientId,
        sheet: room.sheets[clientId] ?? null,
      });
      cb({ ok: true });
      broadcast('players:update', manager.toState(room).players);
    });

    socket.on('room:join', ({ code, name, clientId }, cb) => {
      const room = manager.get(code.toUpperCase());
      if (!room) {
        cb({ error: 'Комната не найдена' });
        return;
      }
      const existing = room.players.find((p) => p.id === clientId);
      if (existing) {
        existing.socketId = socket.id;
        existing.isConnected = true;
      } else {
        room.players.push({ id: clientId, name, role: 'player', isConnected: true, socketId: socket.id });
        systemMessage(room, `${name} вошёл в комнату`);
      }
      manager.saveSoon(room);
      roomCode = room.code;
      playerId = clientId;
      socket.join(room.code);
      socket.emit('room:joined', {
        room: manager.toState(room),
        selfId: clientId,
        sheet: room.sheets[clientId] ?? null,
      });
      cb({ ok: true });
      broadcast('players:update', manager.toState(room).players);
    });

    socket.on('map:add', (payload) => {
      if (!roomCode || !isDm()) return;
      const room = manager.get(roomCode);
      if (!room) return;
      manager.addMap(room, payload);
      broadcastMaps(room);
    });

    socket.on('map:remove', (id) => {
      if (!roomCode || !isDm()) return;
      const room = manager.get(roomCode);
      if (!room) return;
      manager.removeMap(room, id);
      broadcastMaps(room);
    });

    socket.on('map:rename', ({ id, name }) => {
      if (!roomCode || !isDm()) return;
      const room = manager.get(roomCode);
      if (!room) return;
      manager.renameMap(room, id, name.trim().slice(0, 60));
      broadcastMaps(room);
    });

    socket.on('map:bring', (id) => {
      if (!roomCode || !isDm()) return;
      const room = manager.get(roomCode);
      if (!room) return;
      if (!room.scene.maps.some((m) => m.id === id)) return;
      room.scene.activeMapId = id;
      manager.saveSoon(room);
      broadcastAll('map:bring', { activeMapId: id });
    });

    socket.on('fog:update', ({ mapId, fog }) => {
      if (!roomCode || !isDm()) return;
      const room = manager.get(roomCode);
      if (!room) return;
      const map = room.scene.maps.find((m) => m.id === mapId);
      if (!map) return;
      if (typeof fog?.size !== 'number' || fog.size < 5 || fog.size > 1000) return;
      map.fog = {
        size: fog.size,
        offsetX: typeof fog.offsetX === 'number' ? fog.offsetX : 0,
        offsetY: typeof fog.offsetY === 'number' ? fog.offsetY : 0,
        hidden: Array.isArray(fog.hidden) ? fog.hidden.slice(0, 50000) : [],
      };
      manager.saveSoon(room);
      broadcastAll('fog:update', { mapId, fog: map.fog });
    });

    socket.on('library:add', (payload) => {
      if (!roomCode) return;
      const room = manager.get(roomCode);
      if (!room) return;
      manager.addLibraryItem(room, payload);
      broadcastAll('library:update', room.library);
    });

    socket.on('library:update', ({ id, patch }) => {
      if (!roomCode) return;
      const room = manager.get(roomCode);
      if (!room) return;
      manager.updateLibraryItem(room, id, patch);
      broadcastAll('library:update', room.library);
    });

    socket.on('library:remove', (id) => {
      if (!roomCode) return;
      const room = manager.get(roomCode);
      if (!room) return;
      manager.removeLibraryItem(room, id);
      broadcastAll('library:update', room.library);
    });

    socket.on('grid:update', (grid) => {
      if (!roomCode || !isDm()) return;
      const room = manager.get(roomCode);
      if (!room) return;
      room.scene.grid = grid;
      for (const map of room.scene.maps) {
        for (const token of map.tokens) {
          token.w = token.cells * grid.size;
          token.h = token.cells * grid.size;
          if (grid.snap) {
            token.x = snapToGrid(token.x, grid.offsetX, grid.size, token.cells);
            token.y = snapToGrid(token.y, grid.offsetY, grid.size, token.cells);
          }
        }
      }
      manager.saveSoon(room);
      broadcast('grid:update', grid);
      for (const map of room.scene.maps) {
        for (const token of map.tokens) broadcast('token:update', { mapId: map.id, token });
      }
    });

    socket.on('token:add', (payload) => {
      if (!roomCode || !playerId) return;
      const room = manager.get(roomCode);
      if (!room) return;
      const token = manager.addToken(room, payload.mapId, { ...payload, ownerId: playerId });
      if (!token) return;
      broadcastAll('token:add', { mapId: payload.mapId, token });
    });

    socket.on('token:move', ({ mapId, id, x, y }) => {
      if (!roomCode) return;
      const room = manager.get(roomCode);
      if (!room) return;
      const token = manager.findToken(room, mapId, id);
      if (!token) return;
      token.x = x;
      token.y = y;
      manager.saveSoon(room);
      broadcastAll('token:update', { mapId, token });
    });

    socket.on('token:lock', ({ mapId, id, lock }) => {
      if (!roomCode || !playerId) return;
      const room = manager.get(roomCode);
      if (!room) return;
      const token = manager.findToken(room, mapId, id);
      if (!token) return;
      token.lockedBy = lock ? playerId : null;
      manager.saveSoon(room);
      broadcastAll('token:update', { mapId, token });
    });

    socket.on('token:update', ({ mapId, id, patch }) => {
      if (!roomCode) return;
      const room = manager.get(roomCode);
      if (!room) return;
      const token = manager.findToken(room, mapId, id);
      if (!token) return;
      if (patch.name !== undefined) token.name = patch.name;
      if (patch.description !== undefined) token.description = patch.description;
      if (patch.cells !== undefined) {
        token.cells = Math.min(4, Math.max(1, Math.round(patch.cells)));
        token.w = token.cells * room.scene.grid.size;
        token.h = token.cells * room.scene.grid.size;
      }
      if (patch.round !== undefined) token.round = patch.round;
      if (patch.scale !== undefined) token.scale = patch.scale;
      if (patch.rotation !== undefined) token.rotation = patch.rotation;
      if (patch.visible !== undefined) token.visible = patch.visible;
      manager.saveSoon(room);
      broadcastAll('token:update', { mapId, token });
    });

    socket.on('token:remove', ({ mapId, id }) => {
      if (!roomCode) return;
      const room = manager.get(roomCode);
      if (!room) return;
      manager.removeToken(room, mapId, id);
      broadcastAll('token:remove', { mapId, id });
    });

    socket.on('chat:send', (text) => {
      if (!roomCode || !playerId) return;
      const room = manager.get(roomCode);
      if (!room) return;
      const trimmed = text.trim().slice(0, 500);
      if (!trimmed) return;
      const player = room.players.find((p) => p.id === playerId);
      const message: ChatMessage = {
        id: randomUUID(),
        kind: 'text',
        author: player?.name ?? '?',
        text: trimmed,
        ts: Date.now(),
      };
      manager.addMessage(room, message);
      broadcastAll('chat:message', message);
    });

    socket.on('sheet:update', (sheet) => {
      if (!roomCode || !playerId) return;
      const room = manager.get(roomCode);
      if (!room) return;
      const normalized = normalizeSheet(sheet);
      room.sheets[playerId] = normalized;
      manager.saveSoon(room);
      socket.emit('sheet:update', { sheet: normalized });
    });

    socket.on('dice:roll', ({ expression, label }) => {
      if (!roomCode || !playerId) return;
      const room = manager.get(roomCode);
      if (!room) return;
      const player = room.players.find((p) => p.id === playerId);
      try {
        const roll = rollDice(expression);
        const message: ChatMessage = {
          id: randomUUID(),
          kind: 'roll',
          author: player?.name ?? '?',
          roll,
          label: label?.trim() ? label.trim() : undefined,
          ts: Date.now(),
        };
        manager.addMessage(room, message);
        broadcastAll('chat:message', message);
      } catch (e) {
        socket.emit('chat:error', e instanceof DiceParseError ? e.message : 'Не удалось распознать бросок');
      }
    });

    socket.on('dice:attack', ({ hit, damage }) => {
      if (!roomCode || !playerId) return;
      const room = manager.get(roomCode);
      if (!room) return;
      const player = room.players.find((p) => p.id === playerId);
      const author = player?.name ?? '?';
      try {
        const hitRoll = rollDice(hit.expression);
        const crit = isCriticalHit(hitRoll);
        const hitMessage: ChatMessage = {
          id: randomUUID(),
          kind: 'roll',
          author,
          roll: hitRoll,
          label: hit.label?.trim() ? hit.label.trim() : undefined,
          ts: Date.now(),
        };
        manager.addMessage(room, hitMessage);
        broadcastAll('chat:message', hitMessage);

        const damageExpression = damage?.expression.trim();
        if (damageExpression) {
          const damageRoll = rollDice(damageExpression, Math.random, { doubleDice: crit });
          const damageMessage: ChatMessage = {
            id: randomUUID(),
            kind: 'roll',
            author,
            roll: damageRoll,
            label: damage?.label?.trim() ? damage.label.trim() : undefined,
            crit,
            ts: Date.now(),
          };
          manager.addMessage(room, damageMessage);
          broadcastAll('chat:message', damageMessage);
        }
      } catch (e) {
        socket.emit('chat:error', e instanceof DiceParseError ? e.message : 'Не удалось распознать бросок');
      }
    });

    socket.on('disconnect', () => {
      if (!roomCode || !playerId) return;
      const room = manager.get(roomCode);
      if (!room) return;
      const player = room.players.find((p) => p.id === playerId);
      if (!player || player.socketId !== socket.id) return;
      player.isConnected = false;
      player.socketId = null;
      manager.clearLocks(room, playerId);
      manager.saveSoon(room);
      broadcast('players:update', manager.toState(room).players);
      for (const map of room.scene.maps) {
        for (const token of map.tokens) {
          if (token.lockedBy === playerId) broadcastAll('token:update', { mapId: map.id, token });
        }
      }
      systemMessage(room, `${player.name} вышел из комнаты`);
    });
  });
}
