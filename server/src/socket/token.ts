import {
  movementBlocked,
  normalizeAttacks,
  normalizeConditions,
  normalizeDamageDefenses,
  normalizeEffects,
  normalizeStatblock,
  statNumber,
  statsPaired,
} from 'shared';
import type { ConnCtx } from './context';

export function registerTokenHandlers(ctx: ConnCtx) {
  const { manager, getRoom, isDm, broadcastAll, canControlToken, emitToken, syncCombat, socket } = ctx;

    ctx.on('token:add', (payload) => {
      if (!ctx.playerId) return;
      const room = getRoom();
      if (!room) return;
      const x = Number(payload?.x);
      const y = Number(payload?.y);
      if (typeof payload?.mapId !== 'string' || typeof payload.libraryItemId !== 'string') return;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const item = room.library.find((i) => i.id === payload.libraryItemId);
      if (!item) return;
      const map = manager.findMap(room, payload.mapId);
      if (!map) return;
      if (!isDm()) {
        const characterId = room.controllers[ctx.playerId];
        const characterName = manager.characterName(room, payload.mapId, ctx.playerId);
        const ownCharacter = item.isPlayerToken && item.id === characterId;
        const ownSummon = item.isPlayerToken && !!item.owner && item.owner === characterName;
        if (!ownCharacter && !ownSummon) return;
      }
      if (item.isPlayerToken && map.tokens.some((t) => t.libraryItemId === item.id)) return;
      const token = manager.addToken(room, payload.mapId, item, x, y, ctx.playerId);
      if (!token) return;
      emitToken(room, 'token:add', payload.mapId, token);
      if (manager.combatOf(room, payload.mapId)?.active) {
        manager.addTokenToCombat(room, payload.mapId, token);
        syncCombat(room, payload.mapId);
      }
    });

    ctx.on('token:move', ({ mapId, id, x, y }) => {
      const room = getRoom();
      if (!room) return;
      if (typeof mapId !== 'string' || typeof id !== 'string') return;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const token = manager.findToken(room, mapId, id);
      if (!token) return;
      if (!canControlToken(room, mapId, token)) return;
      if (!isDm() && movementBlocked(token.conditions)) {
        socket.emit('chat:error', 'Существо не может двигаться (состояние)');
        return;
      }
      token.x = x;
      token.y = y;
      manager.saveSoon(room);
      emitToken(room, 'token:update', mapId, token);
    });

    ctx.on('token:lock', ({ mapId, id, lock }) => {
      if (typeof lock !== 'boolean' || !ctx.playerId) return;
      const room = getRoom();
      if (!room) return;
      const token = manager.findToken(room, mapId, id);
      if (!token) return;
      if (!canControlToken(room, mapId, token)) return;
      token.lockedBy = lock ? ctx.playerId : null;
      manager.saveSoon(room);
      emitToken(room, 'token:update', mapId, token);
    });

    ctx.on('token:update', ({ mapId, id, patch }) => {
      const room = getRoom();
      if (!room) return;
      const token = manager.findToken(room, mapId, id);
      if (!token || !patch || typeof patch !== 'object') return;
      if (!isDm() && !(ctx.playerId && manager.controlsToken(room, mapId, ctx.playerId, token))) return;
      if (typeof patch.name === 'string') token.name = patch.name.slice(0, 40);
      if (typeof patch.description === 'string') token.description = patch.description.slice(0, 200);
      if (typeof patch.cells === 'number' && Number.isFinite(patch.cells)) {
        token.cells = Math.min(4, Math.max(1, Math.round(patch.cells)));
        token.w = token.cells * room.scene.grid.size;
        token.h = token.cells * room.scene.grid.size;
      }
      if (typeof patch.round === 'boolean') token.round = patch.round;
      if (typeof patch.initiativeBonus === 'string') token.initiativeBonus = patch.initiativeBonus.slice(0, 10);
      if (typeof patch.scale === 'number' && Number.isFinite(patch.scale)) token.scale = patch.scale;
      if (typeof patch.rotation === 'number' && Number.isFinite(patch.rotation)) token.rotation = patch.rotation;
      if (typeof patch.visible === 'boolean') token.visible = patch.visible;
      if (Array.isArray(patch.attacks)) token.attacks = normalizeAttacks(patch.attacks);
      if (Array.isArray(patch.damageDefenses)) token.damageDefenses = normalizeDamageDefenses(patch.damageDefenses);
      if (typeof patch.ac === 'string' && typeof patch.hpMax === 'string') {
        if (statsPaired(patch.ac, patch.hpMax)) {
          token.ac = patch.ac.slice(0, 10);
          token.hpMax = patch.hpMax.slice(0, 10);
        }
      } else if (typeof patch.ac === 'string') {
        const ac = patch.ac.slice(0, 10);
        if (statsPaired(ac, token.hpMax)) token.ac = ac;
      } else if (typeof patch.hpMax === 'string') {
        const hp = patch.hpMax.slice(0, 10);
        if (statsPaired(token.ac, hp)) token.hpMax = hp;
      }
      if (typeof patch.hpCurrent === 'number' && Number.isFinite(patch.hpCurrent)) {
        token.hpCurrent = Math.max(0, Math.round(patch.hpCurrent));
      }
      if (typeof patch.hpTemp === 'number' && Number.isFinite(patch.hpTemp)) {
        token.hpTemp = Math.max(0, Math.round(patch.hpTemp));
      }
      const maxHp = statNumber(token.hpMax);
      if (maxHp > 0 && token.hpCurrent > maxHp) token.hpCurrent = maxHp;
      if (Array.isArray(patch.conditions)) token.conditions = normalizeConditions(patch.conditions);
      if (Array.isArray(patch.effects)) token.effects = normalizeEffects(patch.effects);
      if (isDm()) {
        if (typeof patch.isPlayerToken === 'boolean') token.isPlayerToken = patch.isPlayerToken;
        if (typeof patch.owner === 'string') token.owner = patch.owner.slice(0, 40);
        if (typeof patch.showStats === 'boolean') token.showStats = patch.showStats;
        if (patch.faction === 'ally' || patch.faction === 'enemy' || patch.faction === 'neutral') {
          token.faction = patch.faction;
        }
        if (typeof patch.speed === 'number' && Number.isFinite(patch.speed)) {
          token.speed = Math.max(0, Math.round(patch.speed));
        }
        if ('statblock' in patch) {
          const statblock = normalizeStatblock(patch.statblock);
          if (statblock) token.statblock = statblock;
          else delete token.statblock;
        }
      }
      manager.saveSoon(room);
      if (typeof patch.name === 'string' && manager.combatOf(room, mapId)?.active) {
        manager.renameCombatantByToken(room, mapId, id, token.name);
      }
      emitToken(room, 'token:update', mapId, token);
      if (manager.combatOf(room, mapId)?.active) syncCombat(room, mapId);
    });

    ctx.on('token:hp', ({ mapId, id, delta }) => {
      const room = getRoom();
      if (!room || typeof mapId !== 'string' || typeof id !== 'string') return;
      if (!isDm() || !Number.isFinite(delta)) return;
      const token = manager.findToken(room, mapId, id);
      if (!token) return;
      const changed = manager.adjustTokenHp(room, mapId, token, Math.round(delta));
      for (const c of changed) emitToken(room, 'token:update', c.mapId, c.token);
      const controllerId = manager.controllerOfToken(room, token);
      if (controllerId) ctx.emitResources(room, controllerId);
      broadcastAll('players:update', manager.toState(room).players);
    });

    ctx.on('token:remove', ({ mapId, id }) => {
      const room = getRoom();
      if (!room) return;
      const token = manager.findToken(room, mapId, id);
      if (!token) return;
      if (!canControlToken(room, mapId, token)) return;
      manager.removeToken(room, mapId, id);
      broadcastAll('token:remove', { mapId, id });
      if (manager.combatOf(room, mapId)?.active) {
        manager.removeTokenFromCombat(room, mapId, id);
        syncCombat(room, mapId);
      }
    });

}
