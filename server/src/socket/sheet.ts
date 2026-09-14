import {
  effectiveMaxHp,
  emptyResources,
  normalizeSheet,
  sheetMods,
  syncResources,
} from 'shared';
import type { ConnCtx } from './context';
import { playerScope, rejectIfReaction } from './guards';

export function registerSheetHandlers(ctx: ConnCtx) {
  const { socket, manager, emitToken, classIdentity } = ctx;

    ctx.on('sheet:update', (sheet) => {
      const scope = playerScope(ctx);
      if (!scope) return;
      if (rejectIfReaction(ctx, true)) return;
      const { room, playerId } = scope;
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
      const changed = manager.syncSheetToTokens(room, playerId);
      socket.emit('sheet:update', { sheet: normalized });
      ctx.emitResources(room, playerId);
      for (const c of changed) emitToken(room, 'token:update', c.mapId, c.token);
      ctx.notifyPlayers(room);
    });

}
