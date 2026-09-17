import {
  isRecord,
  movementBlocked,
  normalizeConditions,
  normalizeEffects,
  normalizeSenses,
  normalizeStatblock,
  normalizeTokenFieldsPatch,
  statNumber,
} from 'shared';
import type { ConnCtx } from './context';
import { fail } from './errors';
import { playerScope, rejectIfReaction, scopedToken } from './guards';
import { handleMovementZones, removeZonesOfSource } from './zones';

export function registerTokenHandlers(ctx: ConnCtx) {
  const { manager, isDm, broadcastAll, emitToken, syncCombat } = ctx;

    ctx.on('token:add', (payload) => {
      const scope = playerScope(ctx);
      if (!scope) return;
      if (rejectIfReaction(ctx)) return;
      const { room, playerId } = scope;
      const x = Number(payload?.x);
      const y = Number(payload?.y);
      if (typeof payload?.mapId !== 'string' || typeof payload.libraryItemId !== 'string') return;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const item = room.library.find((i) => i.id === payload.libraryItemId);
      if (!item) return;
      const map = manager.findMap(room, payload.mapId);
      if (!map) return;
      if (!isDm()) {
        const characterId = room.controllers[playerId];
        const characterName = manager.characterName(room, payload.mapId, playerId);
        const ownCharacter = item.isPlayerToken && item.id === characterId;
        const ownSummon = item.isPlayerToken && !!item.owner && item.owner === characterName;
        if (!ownCharacter && !ownSummon) return;
      }
      if (item.isPlayerToken && map.tokens.some((t) => t.libraryItemId === item.id)) return;
      const token = manager.addToken(room, payload.mapId, item, x, y, playerId);
      if (!token) return;
      emitToken(room, 'token:add', payload.mapId, token);
      if (manager.combatOf(room, payload.mapId)?.active) {
        manager.addTokenToCombat(room, payload.mapId, token);
        syncCombat(room, payload.mapId);
      }
    });

    ctx.on('token:move', ({ mapId, id, x, y }) => {
      if (rejectIfReaction(ctx, true)) return;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const scope = scopedToken(ctx, mapId, id);
      if (!scope) return;
      const { room, token } = scope;
      if (!isDm() && movementBlocked(token.conditions)) {
        fail(ctx, 'immobile');
        return;
      }
      token.x = x;
      token.y = y;
      emitToken(room, 'token:update', mapId, token);
      // Перетаскивание (в т.ч. в чужой ход): аура и enter/exit зон тоже срабатывают.
      handleMovementZones(ctx, room, mapId);
    });

    ctx.on('token:walk', ({ mapId, id, path, moveId }) => {
      const scope = scopedToken(ctx, mapId, id);
      if (!scope) return;
      if (!Array.isArray(path) || path.length < 2) return;
      const walkPath = path
        .filter((p) => isRecord(p) && Number.isFinite(p.x) && Number.isFinite(p.y))
        .map((p) => ({ x: Number(p.x), y: Number(p.y) }))
        .slice(0, 400);
      if (walkPath.length < 2) return;
      const walkId = typeof moveId === 'string' && moveId ? moveId.slice(0, 64) : undefined;
      broadcastAll('token:walk', { mapId, id, path: walkPath, ...(walkId ? { moveId: walkId } : {}) });
    });

    ctx.on('token:step', ({ mapId, id, x, y }) => {
      const scope = scopedToken(ctx, mapId, id);
      if (!scope) return;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const { room, token } = scope;
      if (token.x === x && token.y === y) return;
      token.x = x;
      token.y = y;
      // Вход/выход зон по ходу движения; позицию фиксирует финальный token:move.
      handleMovementZones(ctx, room, mapId);
    });

    ctx.on('token:lock', ({ mapId, id, lock }) => {
      if (typeof lock !== 'boolean') return;
      const scope = scopedToken(ctx, mapId, id);
      if (!scope) return;
      const { room, token } = scope;
      token.lockedBy = lock ? ctx.playerId : null;
      emitToken(room, 'token:update', mapId, token);
    });

    ctx.on('token:update', ({ mapId, id, patch }) => {
      if (!isRecord(patch)) return;
      if (rejectIfReaction(ctx)) return;
      const scope = scopedToken(ctx, mapId, id);
      if (!scope) return;
      const { room, token } = scope;
      Object.assign(token, normalizeTokenFieldsPatch(patch, token));
      if (typeof patch.cells === 'number' && Number.isFinite(patch.cells)) {
        const map = ctx.manager.findMap(room, mapId);
        const size = map?.grid.size ?? 50;
        token.w = token.cells * size;
        token.h = token.cells * size;
      }
      if (typeof patch.scale === 'number' && Number.isFinite(patch.scale)) token.scale = patch.scale;
      if (typeof patch.rotation === 'number' && Number.isFinite(patch.rotation)) token.rotation = patch.rotation;
      if (typeof patch.visible === 'boolean') token.visible = patch.visible;
      if (typeof patch.hpCurrent === 'number' && Number.isFinite(patch.hpCurrent)) {
        token.hpCurrent = Math.max(0, Math.round(patch.hpCurrent));
      }
      if (typeof patch.hpTemp === 'number' && Number.isFinite(patch.hpTemp)) {
        token.hpTemp = Math.max(0, Math.round(patch.hpTemp));
      }
      const maxHp = statNumber(token.hpMax);
      if (maxHp > 0 && token.hpCurrent > maxHp) token.hpCurrent = maxHp;
      if (Array.isArray(patch.conditions)) token.conditions = normalizeConditions(patch.conditions);
      if (Array.isArray(patch.effects)) {
        const next = normalizeEffects(patch.effects);
        const nextIds = new Set(next.map((e) => e.id));
        const removed = token.effects.filter((e) => !nextIds.has(e.id));
        for (const old of removed) manager.changeMaxHp(room, token, old, -1);
        const oldIds = new Set(token.effects.map((e) => e.id));
        for (const effect of next) {
          if (!oldIds.has(effect.id)) manager.changeMaxHp(room, token, effect, 1);
        }
        token.effects = next;
        // Ручное снятие якоря концентрации (меню токена): гасим связанные эффекты и зоны.
        if (removed.some((e) => e.concentration && e.sourceId === token.id)) {
          for (const changed of manager.clearConcentration(room, token.id)) {
            if (changed.token !== token) emitToken(room, 'token:update', changed.mapId, changed.token);
          }
          removeZonesOfSource(ctx, room, token.id);
          ctx.systemMessage(room, `${token.name}: концентрация прекращена`);
        }
      }
      if (isDm()) {
        if (typeof patch.isPlayerToken === 'boolean') token.isPlayerToken = patch.isPlayerToken;
        if (typeof patch.canInteract === 'boolean') token.canInteract = patch.canInteract;
        if (typeof patch.owner === 'string') token.owner = patch.owner.slice(0, 40);
        if (typeof patch.showStats === 'boolean') token.showStats = patch.showStats;
        if (patch.faction === 'ally' || patch.faction === 'enemy' || patch.faction === 'neutral') {
          token.faction = patch.faction;
        }
        if (typeof patch.speed === 'number' && Number.isFinite(patch.speed)) {
          token.speed = Math.max(0, Math.round(patch.speed));
        }
        if (Array.isArray(patch.senses)) {
          token.senses = normalizeSenses(patch.senses);
        }
        if ('statblock' in patch) {
          const statblock = normalizeStatblock(patch.statblock);
          if (statblock) token.statblock = statblock;
          else delete token.statblock;
        }
      }
      if (typeof patch.name === 'string' && manager.combatOf(room, mapId)?.active) {
        manager.renameCombatantByToken(room, mapId, id, token.name);
      }
      emitToken(room, 'token:update', mapId, token);
      if (manager.combatOf(room, mapId)?.active) syncCombat(room, mapId);
    });

    ctx.on('token:hp', ({ mapId, id, delta }) => {
      if (!Number.isFinite(delta)) return;
      const scope = scopedToken(ctx, mapId, id, { dmOnly: true });
      if (!scope) return;
      const { room, token } = scope;
      ctx.applyHp(room, mapId, token, Math.round(delta), { concentration: false });
    });

    ctx.on('token:remove', ({ mapId, id }) => {
      const scope = scopedToken(ctx, mapId, id);
      if (!scope) return;
      const { room, token } = scope;
      // Эффекты снимаемого токена откатываются, его концентрация и зоны гаснут на всех картах.
      for (const effect of [...token.effects]) manager.removeEffect(room, token, effect.id);
      for (const c of manager.clearConcentration(room, id)) emitToken(room, 'token:update', c.mapId, c.token);
      removeZonesOfSource(ctx, room, id);
      manager.removeToken(room, mapId, id);
      broadcastAll('token:remove', { mapId, id });
      if (manager.combatOf(room, mapId)?.active) {
        manager.removeTokenFromCombat(room, mapId, id);
        syncCombat(room, mapId);
      }
    });

}
