import { type Token } from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { syncFeatureEffects, syncFeatureEffectsForItem } from './features';
import { rejectIfReaction } from './guards';

export function registerLibraryHandlers(ctx: ConnCtx) {
  const { manager, getRoom, isDm, broadcastAll, broadcastLibrary } = ctx;

  /** Рассылка замороженных токенов + своё имя в инициативе (форма снята при заморозке). */
  const emitFrozen = (room: Room, changed: { mapId: string; token: Token }[]) => {
    for (const c of changed) {
      ctx.emitToken(room, 'token:update', c.mapId, c.token);
      if (manager.combatOf(room, c.mapId)?.active) {
        manager.renameCombatantByToken(room, c.mapId, c.token.id, c.token.name);
        ctx.syncCombat(room, c.mapId);
      }
    }
  };

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
      // DM-поля (owner/isPlayerToken/showStats/canInteract/statblock) — как в token:update.
      manager.updateLibraryItem(room, id, patch, isDm());
      const item = room.library.find((i) => i.id === id);
      if (item && (!item.isPlayerToken || item.owner.trim())) {
        emitFrozen(room, manager.freezeCharacterTokensOfItem(room, id));
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
      emitFrozen(room, manager.freezeCharacterTokensOfItem(room, id));
      for (const pid of manager.clearControllersForItem(room, id)) {
        broadcastAll('character:update', { playerId: pid, libraryItemId: null });
      }
      syncFeatureEffectsForItem(ctx, room, id, undefined);
      broadcastLibrary(room);
    });

    ctx.on('player:setCharacter', ({ libraryItemId }, cb) => {
      const room = getRoom();
      if (!room || !ctx.playerId) {
        cb({ error: { code: 'noRoom' } });
        return;
      }
      if (libraryItemId === null) {
        emitFrozen(room, manager.freezeCharacterTokens(room, ctx.playerId));
        const libId = room.controllers[ctx.playerId];
        delete room.controllers[ctx.playerId];
        if (libId) syncFeatureEffectsForItem(ctx, room, libId, undefined);
        broadcastAll('character:update', { playerId: ctx.playerId, libraryItemId: null });
        cb({ ok: true });
        return;
      }
      if (typeof libraryItemId !== 'string') {
        cb({ error: { code: 'invalidCharacter' } });
        return;
      }
      const item = room.library.find((i) => i.id === libraryItemId);
      if (!item) {
        cb({ error: { code: 'tokenNotFound' } });
        return;
      }
      if (!item.isPlayerToken) {
        cb({ error: { code: 'playerTokenOnly' } });
        return;
      }
      if (item.owner.trim()) {
        cb({ error: { code: 'tokenHasOwner' } });
        return;
      }
      const takenByOther = Object.entries(room.controllers).some(
        ([pid, lid]) => lid === libraryItemId && pid !== ctx.playerId
      );
      if (takenByOther) {
        cb({ error: { code: 'characterTaken' } });
        return;
      }
      emitFrozen(room, manager.freezeCharacterTokens(room, ctx.playerId));
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
