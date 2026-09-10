import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Server as SocketServer, Socket } from 'socket.io';
import {
  DEFAULT_ABILITIES,
  DiceParseError,
  effectiveMaxHp,
  emptyResources,
  isCriticalHit,
  normalizeSheet,
  rollDice,
  sanitizeResources,
  sheetMods,
  snapToGrid,
  syncResources,
  type ChatMessage,
  type ClassLevel,
  type ClientToServerEvents,
  type DiceRollResult,
  type PlayerResources,
  type ServerToClientEvents,
  type Token,
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

    const getRoom = (): Room | null => (roomCode ? manager.get(roomCode) ?? null : null);

    const LEAVE_GRACE_MS = 8000;
    const pendingLeaves = new Map<string, ReturnType<typeof setTimeout>>();
    const cancelPendingLeave = (code: string, id: string) => {
      const key = `${code}:${id}`;
      const t = pendingLeaves.get(key);
      if (t) {
        clearTimeout(t);
        pendingLeaves.delete(key);
      }
    };

    const isDm = () => {
      const room = getRoom();
      if (!room || !playerId) return false;
      return room.players.some((p) => p.id === playerId && p.role === 'dm');
    };

    const dmRoom = (): Room | null => (isDm() ? getRoom() : null);

    const syncCombat = (room: Room, mapId: string) => {
      broadcastAll('combat:update', {
        mapId,
        combat: manager.combatOf(room, mapId) ?? { active: false, entries: [] },
      });
    };

    const cleanLabel = (label?: string) => (label?.trim() ? label.trim().slice(0, 80) : undefined);

    const systemMessage = (room: Room, text: string) => {
      const message: ChatMessage = { id: randomUUID(), kind: 'text', author: 'Система', text, ts: Date.now() };
      manager.addMessage(room, message);
      broadcastAll('chat:message', message);
    };

    const emitJoined = (room: Room, selfId: string) => {
      if (!room.resources[selfId]) {
        const sheet = room.sheets[selfId];
        const created = sheet
          ? syncResources(emptyResources(), sheet.classes, sheetMods(sheet.abilities), 'full')
          : emptyResources();
        if (sheet) {
          const hpMax = effectiveMaxHp(sheet);
          created.hp = { ...created.hp, max: hpMax, current: hpMax };
        }
        room.resources[selfId] = created;
        manager.saveSoon(room);
      }
      socket.emit('room:joined', {
        room: manager.toState(room),
        selfId,
        sheet: room.sheets[selfId] ?? null,
        resources: room.resources[selfId] ?? null,
      });
    };

    const classIdentity = (classes?: ClassLevel[]) =>
      (classes ?? []).map((c) => `${c.className}:${c.subclass ?? ''}`).join('|');

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
      emitJoined(room, clientId);
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
        cancelPendingLeave(room.code, clientId);
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
      emitJoined(room, clientId);
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
      roomCode = room.code;
      playerId = clientId;
      socket.join(room.code);
      emitJoined(room, clientId);
      cb({ ok: true });
      broadcast('players:update', manager.toState(room).players);
    });

    socket.on('player:remove', ({ id }) => {
      const room = dmRoom();
      if (!room || typeof id !== 'string' || id === playerId) return;
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

    socket.on('map:add', (payload) => {
      const room = dmRoom();
      if (!room) return;
      const name = typeof payload?.name === 'string' ? payload.name.trim().slice(0, 60) : '';
      const url = typeof payload?.url === 'string' ? payload.url : '';
      const width = Number(payload?.width);
      const height = Number(payload?.height);
      if (!url || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
      manager.addMap(room, { name: name || 'Карта', url, width, height });
      broadcastMaps(room);
    });

    socket.on('map:remove', (id) => {
      const room = dmRoom();
      if (!room) return;
      manager.removeMap(room, id);
      broadcastMaps(room);
    });

    socket.on('map:rename', ({ id, name }) => {
      const room = dmRoom();
      if (!room) return;
      manager.renameMap(room, id, name.trim().slice(0, 60));
      broadcastMaps(room);
    });

    socket.on('map:bring', (id) => {
      const room = dmRoom();
      if (!room) return;
      if (!room.scene.maps.some((m) => m.id === id)) return;
      room.scene.activeMapId = id;
      manager.saveSoon(room);
      broadcastAll('map:bring', { activeMapId: id });
    });

    socket.on('fog:update', ({ mapId, fog }) => {
      const room = dmRoom();
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
      const room = getRoom();
      if (!room) return;
      manager.addLibraryItem(room, payload);
      broadcastAll('library:update', room.library);
    });

    socket.on('library:update', ({ id, patch }) => {
      const room = getRoom();
      if (!room) return;
      manager.updateLibraryItem(room, id, patch);
      broadcastAll('library:update', room.library);
    });

    socket.on('library:remove', (id) => {
      const room = getRoom();
      if (!room) return;
      manager.removeLibraryItem(room, id);
      broadcastAll('library:update', room.library);
    });

    socket.on('combat:start', ({ mapId }) => {
      const room = dmRoom();
      if (!room || typeof mapId !== 'string') return;
      manager.startCombat(room, mapId);
      syncCombat(room, mapId);
    });

    socket.on('combat:end', ({ mapId }) => {
      const room = dmRoom();
      if (!room || typeof mapId !== 'string') return;
      manager.endCombat(room, mapId);
      syncCombat(room, mapId);
    });

    socket.on('combat:clear', ({ mapId }) => {
      const room = dmRoom();
      if (!room || typeof mapId !== 'string') return;
      manager.clearCombat(room, mapId);
      syncCombat(room, mapId);
    });

    socket.on('combat:add', ({ mapId, tokenId }) => {
      const room = dmRoom();
      if (!room || typeof mapId !== 'string' || typeof tokenId !== 'string') return;
      if (manager.addCombatToken(room, mapId, tokenId)) syncCombat(room, mapId);
    });

    socket.on('combat:addMap', ({ mapId }) => {
      const room = dmRoom();
      if (!room || typeof mapId !== 'string') return;
      manager.addMapTokensToCombat(room, mapId);
      syncCombat(room, mapId);
    });

    socket.on('combat:remove', ({ mapId, id }) => {
      const room = dmRoom();
      if (!room || typeof mapId !== 'string' || typeof id !== 'string') return;
      manager.removeCombatant(room, mapId, id);
      syncCombat(room, mapId);
    });

    socket.on('combat:update', ({ mapId, id, patch }) => {
      const room = dmRoom();
      if (!room || typeof mapId !== 'string' || typeof id !== 'string' || !patch || typeof patch !== 'object') return;
      manager.updateCombatant(room, mapId, id, patch);
      syncCombat(room, mapId);
    });

    socket.on('combat:move', ({ mapId, id, toIndex }) => {
      const room = dmRoom();
      if (!room || typeof mapId !== 'string' || typeof id !== 'string' || typeof toIndex !== 'number') return;
      manager.moveCombatant(room, mapId, id, toIndex);
      syncCombat(room, mapId);
    });

    socket.on('combat:roll', (payload) => {
      const room = dmRoom();
      if (!room || typeof payload?.mapId !== 'string') return;
      const id = typeof payload.id === 'string' ? payload.id : undefined;
      manager.rollCombat(room, payload.mapId, id);
      syncCombat(room, payload.mapId);
    });

    socket.on('grid:update', (grid) => {
      const room = dmRoom();
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
      if (!playerId) return;
      const room = getRoom();
      if (!room) return;
      const x = Number(payload?.x);
      const y = Number(payload?.y);
      if (typeof payload?.mapId !== 'string' || typeof payload.libraryItemId !== 'string') return;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const item = room.library.find((i) => i.id === payload.libraryItemId);
      if (!item) return;
      const token = manager.addToken(room, payload.mapId, item, x, y, playerId);
      if (!token) return;
      broadcastAll('token:add', { mapId: payload.mapId, token });
      if (manager.combatOf(room, payload.mapId)?.active) {
        manager.addTokenToCombat(room, payload.mapId, token);
        syncCombat(room, payload.mapId);
      }
    });

    socket.on('token:move', ({ mapId, id, x, y }) => {
      const room = getRoom();
      if (!room) return;
      if (typeof mapId !== 'string' || typeof id !== 'string') return;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const token = manager.findToken(room, mapId, id);
      if (!token) return;
      token.x = x;
      token.y = y;
      manager.saveSoon(room);
      broadcastAll('token:update', { mapId, token });
    });

    socket.on('token:lock', ({ mapId, id, lock }) => {
      if (!playerId) return;
      const room = getRoom();
      if (!room) return;
      const token = manager.findToken(room, mapId, id);
      if (!token) return;
      token.lockedBy = lock ? playerId : null;
      manager.saveSoon(room);
      broadcastAll('token:update', { mapId, token });
    });

    socket.on('token:update', ({ mapId, id, patch }) => {
      const room = getRoom();
      if (!room) return;
      const token = manager.findToken(room, mapId, id);
      if (!token || !patch || typeof patch !== 'object') return;
      if (typeof patch.name === 'string') token.name = patch.name.slice(0, 40);
      if (typeof patch.description === 'string') token.description = patch.description.slice(0, 200);
      if (typeof patch.cells === 'number' && Number.isFinite(patch.cells)) {
        token.cells = Math.min(4, Math.max(1, Math.round(patch.cells)));
        token.w = token.cells * room.scene.grid.size;
        token.h = token.cells * room.scene.grid.size;
      }
      if (typeof patch.round === 'boolean') token.round = patch.round;
      if (typeof patch.initiativeBonus === 'string') token.initiativeBonus = patch.initiativeBonus.slice(0, 10);
      if (typeof patch.scale === 'number' && Number.isFinite(patch.scale)) token.scale = patch.scale;
      if (typeof patch.rotation === 'number' && Number.isFinite(patch.rotation)) token.rotation = patch.rotation;
      if (typeof patch.visible === 'boolean') token.visible = patch.visible;
      manager.saveSoon(room);
      if (typeof patch.name === 'string' && manager.combatOf(room, mapId)?.active) {
        manager.renameCombatantByToken(room, mapId, id, token.name);
      }
      broadcastAll('token:update', { mapId, token });
      if (manager.combatOf(room, mapId)?.active) syncCombat(room, mapId);
    });

    socket.on('token:remove', ({ mapId, id }) => {
      const room = getRoom();
      if (!room) return;
      manager.removeToken(room, mapId, id);
      broadcastAll('token:remove', { mapId, id });
      if (manager.combatOf(room, mapId)?.active) {
        manager.removeTokenFromCombat(room, mapId, id);
        syncCombat(room, mapId);
      }
    });

    socket.on('chat:send', (text) => {
      if (!playerId) return;
      const room = getRoom();
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
      if (!playerId) return;
      const room = getRoom();
      if (!room) return;
      if (!sheet || typeof sheet !== 'object') return;
      const previous = room.sheets[playerId];
      const normalized = normalizeSheet(sheet);
      room.sheets[playerId] = normalized;
      // Имя персонажа из карточки — то же, что имя игрока в чате/списке.
      const charName = normalized.name.trim();
      const selfPlayer = room.players.find((p) => p.id === playerId);
      if (selfPlayer && charName && selfPlayer.name !== charName) {
        selfPlayer.name = charName.slice(0, 30);
      }
      const mode = classIdentity(previous?.classes) === classIdentity(normalized.classes) ? 'soft' : 'full';
      const prevRes = room.resources[playerId];
      const synced = syncResources(
        prevRes ?? emptyResources(),
        normalized.classes,
        sheetMods(normalized.abilities),
        mode
      );
      const hpMax = effectiveMaxHp(normalized);
      synced.hp = {
        ...synced.hp,
        max: hpMax,
        current: prevRes ? Math.min(synced.hp.current, hpMax) : hpMax,
      };
      room.resources[playerId] = synced;
      manager.saveSoon(room);
      socket.emit('sheet:update', { sheet: normalized });
      socket.emit('resources:update', room.resources[playerId]);
      broadcastAll('players:update', manager.toState(room).players);
    });

    socket.on('resources:update', (payload) => {
      if (!playerId) return;
      const room = getRoom();
      if (!room) return;
      if (!payload || typeof payload !== 'object') return;
      const sheet = room.sheets[playerId];
      const classes = sheet?.classes ?? [];
      const mods = sheet ? sheetMods(sheet.abilities) : sheetMods(DEFAULT_ABILITIES);
      const hpMax = sheet ? effectiveMaxHp(sheet) : undefined;
      room.resources[playerId] = sanitizeResources(payload as PlayerResources, classes, mods, hpMax);
      manager.saveSoon(room);
      socket.emit('resources:update', room.resources[playerId]);
      broadcastAll('players:update', manager.toState(room).players);
    });

    socket.on('resources:hitDie', (payload) => {
      if (!playerId) return;
      const room = getRoom();
      if (!room) return;
      const sheet = room.sheets[playerId];
      const res = room.resources[playerId];
      if (!sheet || !res) return;
      const requested = Number(payload?.die);
      const entry =
        res.hitDice.find((h) => h.current > 0 && h.die === requested) ?? res.hitDice.find((h) => h.current > 0);
      if (!entry) return;
      const roll = rollDice(`1d${entry.die}`);
      const heal = Math.max(0, roll.total + sheetMods(sheet.abilities).con);
      entry.current -= 1;
      res.hp.current = Math.min(res.hp.max, res.hp.current + heal);
      manager.saveSoon(room);
      const author = room.players.find((p) => p.id === playerId)?.name ?? '?';
      const message: ChatMessage = {
        id: randomUUID(),
        kind: 'roll',
        author,
        roll,
        label: `Хит дайс d${entry.die} (лечение ${heal})`,
        ts: Date.now(),
      };
      manager.addMessage(room, message);
      socket.emit('resources:update', res);
      broadcastAll('chat:message', message);
      broadcastAll('players:update', manager.toState(room).players);
    });

    socket.on('resources:deathSave', (payload) => {
      if (!playerId) return;
      const room = getRoom();
      if (!room) return;
      const res = room.resources[playerId];
      if (!res) return;
      const expr = typeof payload?.expression === 'string' ? payload.expression : 'd20';
      let roll: DiceRollResult;
      try {
        roll = rollDice(expr);
      } catch {
        roll = rollDice('d20');
      }
      const die = roll.dice.find((d) => d.sides === 20 && d.sign === 1);
      const kept = die ? die.values.find((v) => !die.dropped.includes(v)) ?? die.values[0] : roll.total;
      let outcome: string;
      if (kept === 20) {
        res.hp.deathSuccesses = Math.min(3, res.hp.deathSuccesses + 2);
        outcome = 'критический успех';
      } else if (kept === 1) {
        res.hp.deathFailures = Math.min(3, res.hp.deathFailures + 2);
        outcome = 'критический провал';
      } else if (kept >= 10) {
        res.hp.deathSuccesses = Math.min(3, res.hp.deathSuccesses + 1);
        outcome = 'успех';
      } else {
        res.hp.deathFailures = Math.min(3, res.hp.deathFailures + 1);
        outcome = 'провал';
      }
      manager.saveSoon(room);
      const author = room.players.find((p) => p.id === playerId)?.name ?? '?';
      const message: ChatMessage = {
        id: randomUUID(),
        kind: 'roll',
        author,
        roll,
        label: `Спасбросок от смерти: ${outcome} (успехи ${res.hp.deathSuccesses}/3, провалы ${res.hp.deathFailures}/3)`,
        ts: Date.now(),
      };
      manager.addMessage(room, message);
      socket.emit('resources:update', res);
      broadcastAll('chat:message', message);
    });

    socket.on('dice:roll', ({ expression, label }) => {
      if (!playerId) return;
      const room = getRoom();
      if (!room) return;
      const player = room.players.find((p) => p.id === playerId);
      try {
        const roll = rollDice(expression);
        const message: ChatMessage = {
          id: randomUUID(),
          kind: 'roll',
          author: player?.name ?? '?',
          roll,
          label: cleanLabel(label),
          ts: Date.now(),
        };
        manager.addMessage(room, message);
        broadcastAll('chat:message', message);
      } catch (e) {
        socket.emit('chat:error', e instanceof DiceParseError ? e.message : 'Не удалось распознать бросок');
      }
    });

    socket.on('dice:attack', ({ hit, damage }) => {
      if (!playerId) return;
      const room = getRoom();
      if (!room) return;
      if (!hit || typeof hit.expression !== 'string') return;
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
          label: cleanLabel(hit.label),
          ts: Date.now(),
        };
        manager.addMessage(room, hitMessage);
        broadcastAll('chat:message', hitMessage);

        const damageExpression = typeof damage?.expression === 'string' ? damage.expression.trim() : '';
        if (damageExpression) {
          const damageRoll = rollDice(damageExpression, Math.random, { doubleDice: crit });
          const damageMessage: ChatMessage = {
            id: randomUUID(),
            kind: 'roll',
            author,
            roll: damageRoll,
            label: cleanLabel(damage?.label),
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
      if (!playerId) return;
      const room = getRoom();
      if (!room) return;
      const player = room.players.find((p) => p.id === playerId);
      if (!player || player.socketId !== socket.id) return;
      const lockedTokens: { id: string; token: Token }[] = [];
      for (const map of room.scene.maps) {
        for (const token of map.tokens) {
          if (token.lockedBy === playerId) lockedTokens.push({ id: map.id, token });
        }
      }
      player.socketId = null;
      manager.clearLocks(room, playerId);
      manager.saveSoon(room);
      for (const { id, token } of lockedTokens) broadcastAll('token:update', { mapId: id, token });
      // Не объявляем выход сразу: Socket.IO переподключения создают новый сокет,
      // и игрок успевает вернуться. Даём грейс-период и отменяем при повторном входе.
      const key = `${room.code}:${playerId}`;
      const previous = pendingLeaves.get(key);
      if (previous) clearTimeout(previous);
      pendingLeaves.set(
        key,
        setTimeout(() => {
          pendingLeaves.delete(key);
          const r = manager.get(room.code);
          if (!r) return;
          const p = r.players.find((x) => x.id === playerId);
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
  });
}
