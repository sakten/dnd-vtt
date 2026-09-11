import {
  effectiveMaxHp,
  emptyResources,
  normalizeSheet,
  sheetMods,
  syncResources,
} from 'shared';
import type { ConnCtx } from './context';

export function registerSheetHandlers(ctx: ConnCtx) {
  const { socket, manager, getRoom, broadcastAll, emitToken, classIdentity } = ctx;

    ctx.on('sheet:update', (sheet) => {
      if (!ctx.playerId) return;
      const room = getRoom();
      if (!room) return;
      if (!sheet || typeof sheet !== 'object') return;
      const previous = room.sheets[ctx.playerId];
      const normalized = normalizeSheet(sheet);
      room.sheets[ctx.playerId] = normalized;
      // Имя персонажа из карточки — то же, что имя игрока в чате/списке.
      const charName = normalized.name.trim();
      const selfPlayer = room.players.find((p) => p.id === ctx.playerId);
      if (selfPlayer && charName && selfPlayer.name !== charName) {
        selfPlayer.name = charName.slice(0, 30);
      }
      const mode = classIdentity(previous?.classes) === classIdentity(normalized.classes) ? 'soft' : 'full';
      const prevRes = room.resources[ctx.playerId];
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
      room.resources[ctx.playerId] = synced;
      const changed = manager.syncSheetToTokens(room, ctx.playerId);
      manager.saveSoon(room);
      socket.emit('sheet:update', { sheet: normalized });
      socket.emit('resources:update', room.resources[ctx.playerId]);
      for (const c of changed) emitToken(room, 'token:update', c.mapId, c.token);
      broadcastAll('players:update', manager.toState(room).players);
    });

}
