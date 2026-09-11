import { randomUUID } from 'node:crypto';
import type { Server as SocketServer, Socket } from 'socket.io';
import {
  effectiveMaxHp,
  emptyCombatState,
  emptyResources,
  sheetMods,
  syncResources,
  type ChatMessage,
  type ClassLevel,
  type ClientToServerEvents,
  type LibraryItem,
  type ServerToClientEvents,
  type Token,
} from 'shared';
import type { RoomManager } from '../rooms';
import type { Room } from '../roomTypes';

export const LEAVE_GRACE_MS = 8000;

export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
export type AppServer = SocketServer<ClientToServerEvents, ServerToClientEvents>;

export interface ConnCtx {
  io: AppServer;
  socket: AppSocket;
  manager: RoomManager;
  roomCode: string | null;
  playerId: string | null;
  pendingLeaves: Map<string, ReturnType<typeof setTimeout>>;
  on: <E extends keyof ClientToServerEvents>(
    event: E,
    handler: (...args: Parameters<ClientToServerEvents[E]>) => void
  ) => void;
  onDisconnect: (handler: () => void) => void;
  broadcast: <E extends keyof ServerToClientEvents>(
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ) => void;
  broadcastAll: <E extends keyof ServerToClientEvents>(
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ) => void;
  broadcastMaps: (room: Room) => void;
  getRoom: () => Room | null;
  cancelPendingLeave: (code: string, id: string) => void;
  isDm: () => boolean;
  dmRoom: () => Room | null;
  canControlToken: (room: Room, mapId: string, token: Token) => boolean;
  visibleToken: (room: Room, token: Token, viewerId: string | null) => Token;
  visibleLibrary: (room: Room, viewerId: string | null) => LibraryItem[];
  broadcastLibrary: (room: Room) => void;
  emitToken: (room: Room, event: 'token:add' | 'token:update', mapId: string, token: Token) => void;
  syncCombat: (room: Room, mapId: string) => void;
  cleanLabel: (label?: string) => string | undefined;
  systemMessage: (room: Room, text: string) => void;
  emitJoined: (room: Room, selfId: string) => void;
  classIdentity: (classes?: ClassLevel[]) => string;
}

export function createCtx(io: AppServer, socket: AppSocket, manager: RoomManager): ConnCtx {
  const pendingLeaves = new Map<string, ReturnType<typeof setTimeout>>();

  const ctx: ConnCtx = {
    io,
    socket,
    manager,
    roomCode: null,
    playerId: null,
    pendingLeaves,
    on: (event, handler) => {
      socket.on(event, ((...args: unknown[]) => {
        try {
          (handler as unknown as (...a: unknown[]) => void)(...args);
        } catch (err) {
          console.error(`socket ${String(event)} error:`, err);
        }
      }) as never);
    },
    onDisconnect: (handler) => {
      socket.on('disconnect', () => {
        try {
          handler();
        } catch (err) {
          console.error('socket disconnect error:', err);
        }
      });
    },
    broadcast: (event, ...args) => {
      if (ctx.roomCode) socket.to(ctx.roomCode).emit(event, ...args);
    },
    broadcastAll: (event, ...args) => {
      if (ctx.roomCode) io.to(ctx.roomCode).emit(event, ...args);
    },
    broadcastMaps: (room) => {
      for (const p of room.players) {
        if (!p.socketId) continue;
        const s = io.sockets.sockets.get(p.socketId);
        if (!s) continue;
        const maps = room.scene.maps.map((m) => ({
          ...m,
          tokens: m.tokens.map((t) => ctx.visibleToken(room, t, p.id)),
        }));
        (s as { emit: (ev: string, payload: unknown) => void }).emit('maps:update', {
          maps,
          activeMapId: room.scene.activeMapId,
        });
      }
    },
    getRoom: () => (ctx.roomCode ? manager.get(ctx.roomCode) ?? null : null),
    cancelPendingLeave: (code, id) => {
      const key = `${code}:${id}`;
      const t = pendingLeaves.get(key);
      if (t) {
        clearTimeout(t);
        pendingLeaves.delete(key);
      }
    },
    isDm: () => {
      const room = ctx.getRoom();
      if (!room || !ctx.playerId) return false;
      return room.players.some((p) => p.id === ctx.playerId && p.role === 'dm');
    },
    dmRoom: () => (ctx.isDm() ? ctx.getRoom() : null),
    canControlToken: (room, mapId, token) => {
      if (ctx.isDm()) return true;
      if (!ctx.playerId) return false;
      return manager.controlsToken(room, mapId, ctx.playerId, token);
    },
    // AC/HP/статблок токена видят: DM — всегда; игрок — только для токенов, которыми
    // управляет (свой персонаж/призыв). Остальным AC/HP/статблок не отдаём.
    visibleToken: (room, token, viewerId) => {
      if (viewerId) {
        const viewer = room.players.find((p) => p.id === viewerId);
        if (viewer?.role === 'dm') return token;
      }
      if (token.showStats) return token;
      if (viewerId) {
        let mapId = '';
        for (const m of room.scene.maps) {
          if (m.tokens.some((t) => t.id === token.id)) {
            mapId = m.id;
            break;
          }
        }
        if (mapId && manager.controlsToken(room, mapId, viewerId, token)) return token;
      }
      return { ...token, ac: '', hpMax: '', hpCurrent: 0, statblock: undefined };
    },
    visibleLibrary: (room, viewerId) => {
      if (viewerId) {
        const viewer = room.players.find((p) => p.id === viewerId);
        if (viewer?.role === 'dm') return room.library;
      }
      return room.library.map((item) =>
        item.showStats ? item : { ...item, ac: '', hpMax: '', attacks: [] }
      );
    },
    broadcastLibrary: (room) => {
      for (const p of room.players) {
        if (!p.socketId) continue;
        const s = io.sockets.sockets.get(p.socketId);
        if (!s) continue;
        (s as { emit: (ev: string, payload: unknown) => void }).emit('library:update', ctx.visibleLibrary(room, p.id));
      }
    },
    emitToken: (room, event, mapId, token) => {
      for (const p of room.players) {
        if (!p.socketId) continue;
        const s = io.sockets.sockets.get(p.socketId);
        if (!s) continue;
        (s as { emit: (ev: string, payload: unknown) => void }).emit(event, {
          mapId,
          token: ctx.visibleToken(room, token, p.id),
        });
      }
    },
    syncCombat: (room, mapId) => {
      ctx.broadcastAll('combat:update', {
        mapId,
        combat: manager.combatOf(room, mapId) ?? emptyCombatState(),
      });
    },
    cleanLabel: (label) => (label?.trim() ? label.trim().slice(0, 80) : undefined),
    systemMessage: (room, text) => {
      const message: ChatMessage = { id: randomUUID(), kind: 'text', author: 'Система', text, ts: Date.now() };
      manager.addMessage(room, message);
      ctx.broadcastAll('chat:message', message);
    },
    emitJoined: (room, selfId) => {
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
      const state = manager.toState(room);
      socket.emit('room:joined', {
        room: {
          ...state,
          library: ctx.visibleLibrary(room, selfId),
          scene: {
            ...state.scene,
            maps: state.scene.maps.map((m) => ({
              ...m,
              tokens: m.tokens.map((t) => ctx.visibleToken(room, t, selfId)),
            })),
          },
        },
        selfId,
        sheet: room.sheets[selfId] ?? null,
        resources: room.resources[selfId] ?? null,
      });
    },
    classIdentity: (classes) => (classes ?? []).map((c) => `${c.className}:${c.subclass ?? ''}`).join('|'),
  };

  return ctx;
}
