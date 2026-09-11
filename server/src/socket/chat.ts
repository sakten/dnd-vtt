import { randomUUID } from 'node:crypto';
import type { ChatMessage } from 'shared';
import type { ConnCtx } from './context';

export function registerChatHandlers(ctx: ConnCtx) {
  const { socket, manager, getRoom, broadcastAll } = ctx;

    socket.on('chat:send', (text) => {
      if (!ctx.playerId) return;
      const room = getRoom();
      if (!room) return;
      const trimmed = text.trim().slice(0, 500);
      if (!trimmed) return;
      const player = room.players.find((p) => p.id === ctx.playerId);
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

}
