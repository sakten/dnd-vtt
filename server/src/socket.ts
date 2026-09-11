import type { RoomManager } from './rooms';
import { createCtx, type AppServer, type AppSocket } from './socket/context';
import { registerAdminHandlers } from './socket/admin';
import { registerRoomHandlers } from './socket/room';
import { registerMapHandlers } from './socket/map';
import { registerLibraryHandlers } from './socket/library';
import { registerCombatHandlers } from './socket/combat';
import { registerTokenHandlers } from './socket/token';
import { registerChatHandlers } from './socket/chat';
import { registerSheetHandlers } from './socket/sheet';
import { registerResourceHandlers } from './socket/resources';
import { registerDiceHandlers } from './socket/dice';

export function registerSocket(io: AppServer, manager: RoomManager) {
  io.on('connection', (socket: AppSocket) => {
    const ctx = createCtx(io, socket, manager);
    socket.on('ping', () => {
      socket.emit('pong');
    });
    registerAdminHandlers(ctx);
    registerRoomHandlers(ctx);
    registerMapHandlers(ctx);
    registerLibraryHandlers(ctx);
    registerCombatHandlers(ctx);
    registerTokenHandlers(ctx);
    registerChatHandlers(ctx);
    registerSheetHandlers(ctx);
    registerResourceHandlers(ctx);
    registerDiceHandlers(ctx);
  });
}
