import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from 'shared';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createSocket(): AppSocket {
  return io({
    autoConnect: true,
    // Polling первым: websocket-попытка не блокирует вход (Firefox/прокси),
    // после handshake engine.io сам апгрейдится до websocket.
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
  }) as AppSocket;
}
