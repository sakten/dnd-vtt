import type { RoomManager } from './rooms';
import { createCtx, type AppServer, type AppSocket, type ConnCtx } from './socket/context';
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
import { registerActionHandlers } from './socket/actions';
import { registerSpellHandlers } from './socket/spells';
import { registerReactionHandlers } from './socket/reactions';

/** Все регистраторы поверх готового контекста (используют и socket, и тест-кит). */
export function registerHandlers(ctx: ConnCtx) {
  ctx.socket.on('ping', () => {
    ctx.socket.emit('pong');
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
  registerActionHandlers(ctx);
  registerSpellHandlers(ctx);
  registerReactionHandlers(ctx);
}

export function registerSocket(io: AppServer, manager: RoomManager) {
  io.on('connection', (socket: AppSocket) => {
    registerHandlers(createCtx(io, socket, manager));
  });
}
