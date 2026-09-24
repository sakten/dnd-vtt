import {
  isIncapacitated,
  isRecord,
  movementBlocked,
  normalizeConditions,
  normalizeEffects,
  normalizeSenses,
  normalizeStatblock,
  normalizeTokenFieldsPatch,
  statNumber,
  type TokenStatblock,
} from 'shared';
import type { ConnCtx } from './context';
import { fail } from './errors';
import { playerScope, rejectIfReaction, scopedToken } from './guards';
import { actorStats } from '../room/actor';
import { endShapeToken } from './forms';
import { handleMovementZones, removeZonesOfSource } from './zones';
import { syncSurrounded } from './surrounded';
import { removeTokenCompletely } from './tokenRemove';

/** Производные поля персонажа: в токене не хранятся, в патче игнорируются. */
const CHARACTER_DERIVED_FIELDS = [
  'name',
  'ac',
  'hpMax',
  'speed',
  'senses',
  'attacks',
  'damageDefenses',
  'initiativeBonus',
  'statblock',
] as const;

/** Сигнатура легендарных возможностей статблока (пул и легендарные способности). */
function legendarySignature(statblock: TokenStatblock | undefined): string {
  if (!statblock) return '';
  const abilities = (statblock.actions ?? [])
    .filter((a) => (a.legendaryCost ?? 0) > 0)
    .map((a) => `${a.id}:${a.legendaryCost}:${a.costs.length}`)
    .join(',');
  return `${statblock.legendary?.max ?? 0}|${abilities}`;
}

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
      syncSurrounded(ctx, room, payload.mapId);
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
      syncSurrounded(ctx, room, mapId);
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
      syncSurrounded(ctx, room, mapId);
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
      // У токена персонажа статы живут в листе/ресурсах: производные поля патча игнорируем,
      // HP-патч применяем к ресурсам (у монстра — как раньше, прямо в токен).
      const stats = actorStats(room, token);
      const legendaryBefore = legendarySignature(token.statblock);
      const fieldPatch = normalizeTokenFieldsPatch(patch, token);
      if (stats.character) {
        for (const key of CHARACTER_DERIVED_FIELDS) delete (fieldPatch as Record<string, unknown>)[key];
        // Пока персонаж в форме, её витрина перекрывает эти поля: правки из меню не принимаем.
        if (token.shape) {
          delete (fieldPatch as Record<string, unknown>).description;
          delete (fieldPatch as Record<string, unknown>).cells;
        }
      }
      Object.assign(token, fieldPatch);
      if (typeof patch.cells === 'number' && Number.isFinite(patch.cells)) {
        const map = ctx.manager.findMap(room, mapId);
        const size = map?.grid.size ?? 50;
        token.w = token.cells * size;
        token.h = token.cells * size;
      }
      if (typeof patch.scale === 'number' && Number.isFinite(patch.scale)) token.scale = patch.scale;
      if (typeof patch.rotation === 'number' && Number.isFinite(patch.rotation)) token.rotation = patch.rotation;
      if (typeof patch.visible === 'boolean') token.visible = patch.visible;
      if (stats.character && stats.controllerId) {
        const res = room.resources[stats.controllerId];
        if (res) {
          if (typeof patch.hpCurrent === 'number' && Number.isFinite(patch.hpCurrent)) {
            const max = res.hp.max > 0 ? res.hp.max : Infinity;
            res.hp.current = Math.max(0, Math.min(max, Math.round(patch.hpCurrent)));
            if (res.hp.current > 0) {
              res.hp.deathSuccesses = 0;
              res.hp.deathFailures = 0;
              delete res.hp.stable;
            }
          }
          if (typeof patch.hpTemp === 'number' && Number.isFinite(patch.hpTemp)) {
            res.hp.temp = Math.max(0, Math.round(patch.hpTemp));
          }
          ctx.emitResources(room, stats.controllerId);
          for (const c of manager.characterTokens(room, stats.controllerId)) {
            emitToken(room, 'token:update', c.mapId, c.token);
          }
        }
      } else {
        if (typeof patch.hpCurrent === 'number' && Number.isFinite(patch.hpCurrent)) {
          token.hpCurrent = Math.max(0, Math.round(patch.hpCurrent));
        }
        if (typeof patch.hpTemp === 'number' && Number.isFinite(patch.hpTemp)) {
          token.hpTemp = Math.max(0, Math.round(patch.hpTemp));
        }
        const maxHp = statNumber(token.hpMax);
        if (maxHp > 0 && token.hpCurrent > maxHp) token.hpCurrent = maxHp;
      }
      if (Array.isArray(patch.conditions)) {
        const hadDead = token.conditions.some((c) => c.key === 'dead');
        token.conditions = normalizeConditions(patch.conditions);
        // Недееспособность с панели условий снимает форму так же, как через эффекты (XPHB).
        if (token.shape && isIncapacitated(token.conditions)) endShapeToken(ctx, room, mapId, token);
        // Ручное снятие «Мёртв» = оживление: death-сейвы сбрасываются, лежачий — «Без сознания».
        if (hadDead && !token.conditions.some((c) => c.key === 'dead') && stats.controllerId) {
          for (const c of manager.clearDeadState(room, stats.controllerId)) {
            emitToken(room, 'token:update', c.mapId, c.token);
          }
          ctx.emitResources(room, stats.controllerId);
        }
      }
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
          ctx.systemMessage(room, { code: 'concentration.ended', params: { name: token.name } });
        } else {
          // Снятие эффекта-цели: если это была последняя цель каста — концентрация гаснет.
          let pruned = false;
          for (const old of removed) {
            if (!old.concentration || !old.sourceId || !old.sourceKey) continue;
            for (const changed of manager.pruneConcentration(room, old.sourceId, old.sourceKey)) {
              emitToken(room, 'token:update', changed.mapId, changed.token);
            }
            pruned = true;
          }
          if (pruned) syncCombat(room, mapId);
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
        if (!stats.character) {
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
      }
      if (typeof patch.name === 'string' && manager.combatOf(room, mapId)?.active) {
        manager.renameCombatantByToken(room, mapId, id, token.name);
      }
      if (legendarySignature(token.statblock) !== legendaryBefore && manager.combatOf(room, mapId)?.active) {
        manager.redistributeSlots(room, mapId);
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
      removeTokenCompletely(ctx, room, mapId, token);
    });

}
