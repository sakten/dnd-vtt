import type { ConnCtx } from './context';

export function registerLibraryHandlers(ctx: ConnCtx) {
  const { manager, getRoom, isDm, broadcastAll, broadcastLibrary } = ctx;

    ctx.on('library:add', (payload) => {
      const room = getRoom();
      if (!room) return;
      manager.addLibraryItem(room, payload);
      broadcastLibrary(room);
    });

    ctx.on('library:update', ({ id, patch }) => {
      const room = getRoom();
      if (!room) return;
      const safePatch = { ...patch };
      if (!isDm() && 'showStats' in safePatch) delete safePatch.showStats;
      manager.updateLibraryItem(room, id, safePatch);
      const item = room.library.find((i) => i.id === id);
      if (item && (!item.isPlayerToken || item.owner.trim())) {
        for (const pid of manager.clearControllersForItem(room, id)) {
          broadcastAll('character:update', { playerId: pid, libraryItemId: null });
        }
      }
      broadcastLibrary(room);
    });

    ctx.on('library:remove', (id) => {
      const room = getRoom();
      if (!room) return;
      manager.removeLibraryItem(room, id);
      for (const pid of manager.clearControllersForItem(room, id)) {
        broadcastAll('character:update', { playerId: pid, libraryItemId: null });
      }
      broadcastLibrary(room);
    });

    ctx.on('player:setCharacter', ({ libraryItemId }, cb) => {
      const room = getRoom();
      if (!room || !ctx.playerId) {
        cb({ error: 'Нет комнаты' });
        return;
      }
      if (libraryItemId === null) {
        delete room.controllers[ctx.playerId];
        manager.saveSoon(room);
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
      room.controllers[ctx.playerId] = libraryItemId;
      manager.saveSoon(room);
      broadcastAll('character:update', { playerId: ctx.playerId, libraryItemId });
      cb({ ok: true });
    });

}
