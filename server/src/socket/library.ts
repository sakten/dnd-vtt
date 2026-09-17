import type { ConnCtx } from './context';
import { syncFeatureEffects, syncFeatureEffectsForItem } from './features';
import { rejectIfReaction } from './guards';

export function registerLibraryHandlers(ctx: ConnCtx) {
  const { manager, getRoom, isDm, broadcastAll, broadcastLibrary } = ctx;

    ctx.on('library:add', (payload) => {
      const room = getRoom();
      if (!room) return;
      if (rejectIfReaction(ctx)) return;
      manager.addLibraryItem(room, payload);
      broadcastLibrary(room);
    });

    ctx.on('library:update', ({ id, patch }) => {
      const room = getRoom();
      if (!room) return;
      if (rejectIfReaction(ctx)) return;
      const safePatch = { ...patch };
      if (!isDm() && 'showStats' in safePatch) delete safePatch.showStats;
      manager.updateLibraryItem(room, id, safePatch);
      const item = room.library.find((i) => i.id === id);
      if (item && (!item.isPlayerToken || item.owner.trim())) {
        for (const c of manager.freezeCharacterTokensOfItem(room, id)) {
          ctx.emitToken(room, 'token:update', c.mapId, c.token);
        }
        for (const pid of manager.clearControllersForItem(room, id)) {
          broadcastAll('character:update', { playerId: pid, libraryItemId: null });
        }
        syncFeatureEffectsForItem(ctx, room, id, undefined);
      }
      broadcastLibrary(room);
    });

    ctx.on('library:remove', (id) => {
      const room = getRoom();
      if (!room) return;
      if (rejectIfReaction(ctx)) return;
      manager.removeLibraryItem(room, id);
      for (const c of manager.freezeCharacterTokensOfItem(room, id)) {
        ctx.emitToken(room, 'token:update', c.mapId, c.token);
      }
      for (const pid of manager.clearControllersForItem(room, id)) {
        broadcastAll('character:update', { playerId: pid, libraryItemId: null });
      }
      syncFeatureEffectsForItem(ctx, room, id, undefined);
      broadcastLibrary(room);
    });

    ctx.on('player:setCharacter', ({ libraryItemId }, cb) => {
      const room = getRoom();
      if (!room || !ctx.playerId) {
        cb({ error: 'Нет комнаты' });
        return;
      }
      if (libraryItemId === null) {
        for (const c of manager.freezeCharacterTokens(room, ctx.playerId)) {
          ctx.emitToken(room, 'token:update', c.mapId, c.token);
        }
        const libId = room.controllers[ctx.playerId];
        delete room.controllers[ctx.playerId];
        if (libId) syncFeatureEffectsForItem(ctx, room, libId, undefined);
        broadcastAll('character:update', { playerId: ctx.playerId, libraryItemId: null });
        cb({ ok: true });
        return;
      }
      if (typeof libraryItemId !== 'string') {
        cb({ error: 'Некорректный персонаж' });
        return;
      }
      const item = room.library.find((i) => i.id === libraryItemId);
      if (!item) {
        cb({ error: 'Токен не найден' });
        return;
      }
      if (!item.isPlayerToken) {
        cb({ error: 'Только токены с галкой «Это токен игрока»' });
        return;
      }
      if (item.owner.trim()) {
        cb({ error: 'Нельзя выбрать токен с владельцем' });
        return;
      }
      const takenByOther = Object.entries(room.controllers).some(
        ([pid, lid]) => lid === libraryItemId && pid !== ctx.playerId
      );
      if (takenByOther) {
        cb({ error: 'Этот персонаж уже выбран другим игроком' });
        return;
      }
      for (const c of manager.freezeCharacterTokens(room, ctx.playerId)) {
        ctx.emitToken(room, 'token:update', c.mapId, c.token);
      }
      room.controllers[ctx.playerId] = libraryItemId;
      broadcastAll('character:update', { playerId: ctx.playerId, libraryItemId });
      const sheet = room.sheets[ctx.playerId];
      if (sheet) {
        for (const c of manager.characterTokens(room, ctx.playerId)) {
          syncFeatureEffects(ctx, room, c.mapId, c.token, sheet.classes, sheet.choices);
          ctx.emitToken(room, 'token:update', c.mapId, c.token);
        }
      }
      cb({ ok: true });
    });

}
