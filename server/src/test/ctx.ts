import { vi } from 'vitest';
import type { ClientToServerEvents } from 'shared';
import { RoomManager } from '../rooms';
import type { Room } from '../roomTypes';
import { createCtx, type AppServer, type AppSocket, type ConnCtx } from '../socket/context';
import { registerHandlers } from '../socket';

/**
 * Тест-кит сервера: реальный `createCtx` поверх in-memory транспорта.
 * Вместо ручного дубля ~30 членов `ConnCtx` (и «дрейфа» при добавлении метода)
 * подменяется только socket.io: события пишутся в `emitted`, хендлеры — в `invoke`.
 */

export interface RecordedEvent {
  /** id сокета-получателя (self-сокет — `s:self`), для broadcast — код комнаты. */
  to: string;
  event: string;
  payload: unknown;
}

interface FakeSocket {
  id: string;
  emit(event: string, ...args: unknown[]): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  to(room: string): { emit(event: string, ...args: unknown[]): void };
  join(): void;
  disconnect(): void;
}

interface SocketHandle {
  socket: FakeSocket;
  handlers: Map<string, ((...args: unknown[]) => void)[]>;
}

function makeFakeSocket(id: string, record: (e: RecordedEvent) => void): SocketHandle {
  const handlers = new Map<string, ((...args: unknown[]) => void)[]>();
  const socket: FakeSocket = {
    id,
    emit: (event, ...args) => record({ to: id, event, payload: args[0] }),
    on: (event, handler) => {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
    to: (room) => ({ emit: (event, ...args) => record({ to: room, event, payload: args[0] }) }),
    join: () => void 0,
    disconnect: () => void 0,
  };
  return { socket, handlers };
}

export interface TestCtxInit {
  playerId?: string | null;
  /** Участник считается ведущим (роль dm), даже если его не было в комнате. */
  dm?: boolean;
  /** Подключить все регистраторы, как реальное соединение (по умолчанию тест регистрирует сам). */
  all?: boolean;
  overrides?: Partial<ConnCtx>;
}

export interface TestCtx {
  ctx: ConnCtx;
  manager: RoomManager;
  room: Room;
  emitted: RecordedEvent[];
  invoke: <E extends keyof ClientToServerEvents>(
    event: E,
    ...args: Parameters<ClientToServerEvents[E]>
  ) => void;
  /** События socket.io `disconnect` для этого соединения. */
  disconnect: () => void;
  /** Прокрутить таймеры (только при `vi.useFakeTimers()`). */
  advance: (ms: number) => void;
  /** Записи, отправленные лично этому сокету. */
  selfEvents: (event: string) => RecordedEvent[];
}

export function makeConnCtx(room: Room, opts: TestCtxInit = {}): TestCtx {
  const emitted: RecordedEvent[] = [];
  const manager = new RoomManager();
  vi.spyOn(manager, 'saveSoon').mockImplementation(() => void 0);
  (manager as unknown as { rooms: Map<string, Room> }).rooms.set(room.code, room);

  const self = makeFakeSocket('s:self', (e) => emitted.push(e));
  const sockets = new Map<string, FakeSocket>([[self.socket.id, self.socket]]);
  for (const player of room.players) {
    if (!player.socketId) player.socketId = `s:${player.id}`;
    if (!sockets.has(player.socketId)) {
      sockets.set(player.socketId, makeFakeSocket(player.socketId, (e) => emitted.push(e)).socket);
    }
  }

  const roomEmitter = (target: string) => ({
    emit: (event: string, ...args: unknown[]) => emitted.push({ to: target, event, payload: args[0] }),
    disconnectSockets: () => void 0,
  });
  const io = {
    to: roomEmitter,
    in: roomEmitter,
    sockets: { sockets },
  } as unknown as AppServer;
  const playerId = opts.playerId ?? (opts.dm ? 'dm' : null);
  if (playerId) {
    const existing = room.players.find((p) => p.id === playerId);
    if (existing) {
      if (opts.dm) existing.role = 'dm';
      existing.socketId = self.socket.id;
      existing.isConnected = true;
    } else {
      room.players.push({
        id: playerId,
        name: playerId,
        role: opts.dm ? 'dm' : 'player',
        isConnected: true,
        socketId: self.socket.id,
      });
    }
  }

  const ctx = createCtx(io, self.socket as unknown as AppSocket, manager);
  ctx.roomCode = room.code;
  ctx.playerId = playerId;

  if (opts.all) registerHandlers(ctx);
  if (opts.overrides) Object.assign(ctx, opts.overrides);

  const invoke = <E extends keyof ClientToServerEvents>(
    event: E,
    ...args: Parameters<ClientToServerEvents[E]>
  ) => {
    const list = self.handlers.get(event as string);
    if (!list?.length) throw new Error(`handler ${String(event)} не зарегистрирован`);
    for (const handler of list) handler(...(args as unknown[]));
  };

  return {
    ctx,
    manager,
    room,
    emitted,
    invoke,
    disconnect: () => {
      for (const handler of self.handlers.get('disconnect') ?? []) handler();
    },
    advance: (ms) => vi.advanceTimersByTime(ms),
    selfEvents: (event) => emitted.filter((e) => e.to === self.socket.id && e.event === event),
  };
}
