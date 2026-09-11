import type { ConnCtx } from './context';

export function registerCombatHandlers(ctx: ConnCtx) {
  const { manager, dmRoom, syncCombat, getRoom, isDm } = ctx;

    ctx.on('combat:start', ({ mapId }) => {
      const room = dmRoom();
      if (!room || typeof mapId !== 'string') return;
      manager.startCombat(room, mapId);
      syncCombat(room, mapId);
    });

    ctx.on('combat:end', ({ mapId }) => {
      const room = dmRoom();
      if (!room || typeof mapId !== 'string') return;
      manager.endCombat(room, mapId);
      syncCombat(room, mapId);
    });

    ctx.on('combat:clear', ({ mapId }) => {
      const room = dmRoom();
      if (!room || typeof mapId !== 'string') return;
      manager.clearCombat(room, mapId);
      syncCombat(room, mapId);
    });

    ctx.on('combat:add', ({ mapId, tokenId }) => {
      const room = dmRoom();
      if (!room || typeof mapId !== 'string' || typeof tokenId !== 'string') return;
      if (manager.addCombatToken(room, mapId, tokenId)) syncCombat(room, mapId);
    });

    ctx.on('combat:addMap', ({ mapId }) => {
      const room = dmRoom();
      if (!room || typeof mapId !== 'string') return;
      manager.addMapTokensToCombat(room, mapId);
      syncCombat(room, mapId);
    });

    ctx.on('combat:remove', ({ mapId, id }) => {
      const room = dmRoom();
      if (!room || typeof mapId !== 'string' || typeof id !== 'string') return;
      manager.removeCombatant(room, mapId, id);
      syncCombat(room, mapId);
    });

    ctx.on('combat:update', ({ mapId, id, patch }) => {
      const room = dmRoom();
      if (!room || typeof mapId !== 'string' || typeof id !== 'string' || !patch || typeof patch !== 'object') return;
      manager.updateCombatant(room, mapId, id, patch);
      syncCombat(room, mapId);
    });

    ctx.on('combat:move', ({ mapId, id, toIndex }) => {
      const room = dmRoom();
      if (!room || typeof mapId !== 'string' || typeof id !== 'string' || typeof toIndex !== 'number') return;
      manager.moveCombatant(room, mapId, id, toIndex);
      syncCombat(room, mapId);
    });

    ctx.on('combat:roll', (payload) => {
      const room = dmRoom();
      if (!room || typeof payload?.mapId !== 'string') return;
      const id = typeof payload.id === 'string' ? payload.id : undefined;
      manager.rollCombat(room, payload.mapId, id);
      syncCombat(room, payload.mapId);
    });

    ctx.on('combat:endTurn', ({ mapId }) => {
      const room = getRoom();
      if (!room || typeof mapId !== 'string') return;
      const combat = manager.combatOf(room, mapId);
      if (!combat?.active || combat.currentIndex < 0) return;
      const active = combat.entries[combat.currentIndex];
      if (!isDm()) {
        if (!ctx.playerId || !active?.tokenId) return;
        const token = manager.findToken(room, mapId, active.tokenId);
        if (!token || !manager.controlsToken(room, mapId, ctx.playerId, token)) return;
      }
      manager.endTurn(room, mapId);
      syncCombat(room, mapId);
    });

    ctx.on('combat:setTurn', ({ mapId, id, index }) => {
      const room = dmRoom();
      if (!room || typeof mapId !== 'string') return;
      manager.setTurn(room, mapId, {
        id: typeof id === 'string' ? id : undefined,
        index: typeof index === 'number' ? index : undefined,
      });
      syncCombat(room, mapId);
    });

}
