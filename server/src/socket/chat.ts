import type { ConnCtx } from './context';
import { playerScope } from './guards';
import { pushTextMessage } from './messages';

export function registerChatHandlers(ctx: ConnCtx) {
    ctx.on('chat:send', (text) => {
      if (typeof text !== 'string') return;
      const scope = playerScope(ctx);
      if (!scope) return;
      const { room, playerId } = scope;
      const trimmed = text.trim().slice(0, 500);
      if (!trimmed) return;
      const player = room.players.find((p) => p.id === playerId);
      pushTextMessage(ctx, room, trimmed, player?.name ?? '?');
    });

}
