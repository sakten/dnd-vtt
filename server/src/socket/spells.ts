import {
  abilityMod,
  actionSlotAvailable,
  casterStats,
  characterLevel,
  grantedSpells,
  isIncapacitated,
  spellActionCost,
  spellAreaOrigin,
  spellHasArea,
  spellIsSelf,
  spellRangeFeet,
  tokensInArea,
  type SpellStats,
  type Token,
} from 'shared';
import type { ConnCtx } from './context';
import { findSpell } from '../spells';
import { resolveSpellCast, validateSpellCast, type SpellCastInput } from './spellResolve';

const isPoint = (p: unknown): p is { x: number; y: number } =>
  !!p && typeof p === 'object' && Number.isFinite((p as { x?: unknown }).x) && Number.isFinite((p as { y?: unknown }).y);

export function registerSpellHandlers(ctx: ConnCtx) {
  const { socket, manager, getRoom, isDm, syncCombat } = ctx;

  ctx.on('spell:cast', ({ mapId, tokenId, spellKey, slotLevel, targetIds, advantage, origin, direction }) => {
    if (!ctx.playerId) return;
    const room = getRoom();
    if (!room || typeof mapId !== 'string' || typeof tokenId !== 'string' || typeof spellKey !== 'string') return;
    const token = manager.findToken(room, mapId, tokenId);
    if (!token) return;
    if (!isDm() && !manager.controlsToken(room, mapId, ctx.playerId, token)) return;
    if (!isDm() && isIncapacitated(token.conditions)) {
      socket.emit('chat:error', 'Существо недееспособно');
      return;
    }

    const spell = findSpell(spellKey);
    if (!spell) return;

    const isCharacter = room.controllers[ctx.playerId] === token.libraryItemId;
    const sheet = isCharacter ? room.sheets[ctx.playerId] : undefined;

    let className: string | undefined;
    if (isCharacter && sheet) {
      const own = sheet.spells.find((s) => s.key === spellKey);
      className = own?.className ?? grantedSpells(sheet.classes).find((g) => g.key === spellKey)?.className;
      if (!className) {
        socket.emit('chat:error', 'Заклинание не выбрано в листе');
        return;
      }
    }

    let stats: SpellStats | null = null;
    if (sheet && className) {
      stats = casterStats(sheet, className);
    } else if (token.statblock?.spellcasting) {
      const sc = token.statblock.spellcasting;
      const mod = abilityMod(token.statblock.abilities[sc.ability] ?? 10);
      stats = { ability: sc.ability, mod, dc: sc.dc ?? 8 + mod, attack: sc.attack ?? mod };
    }

    const combat = manager.combatOf(room, mapId);
    if (combat?.active && !isDm() && !manager.isActiveToken(room, mapId, token.id)) {
      socket.emit('chat:error', 'Сейчас не ваш ход');
      return;
    }

    let castLevel = spell.level;
    if (spell.level > 0) {
      const requested = Math.round(Number(slotLevel));
      castLevel = Number.isFinite(requested) ? Math.max(spell.level, Math.min(9, requested)) : spell.level;
    }

    const targets: Token[] = [];
    let area = false;
    if (spellHasArea(spell) && spell.areaSpec) {
      const map = manager.findMap(room, mapId);
      const grid = {
        size: room.scene.grid.size || 50,
        offsetX: room.scene.grid.offsetX,
        offsetY: room.scene.grid.offsetY,
      };
      const originKind = spellAreaOrigin(spell);
      const originPt = originKind === 'self' ? { x: token.x, y: token.y } : isPoint(origin) ? origin : null;
      if (!originPt) {
        socket.emit('chat:error', 'Не выбрана точка области');
        return;
      }
      if (originKind === 'point') {
        const range = spellRangeFeet(spell);
        const feet = (Math.hypot(originPt.x - token.x, originPt.y - token.y) / grid.size) * 5;
        if (range !== null && feet > range) {
          socket.emit('chat:error', `Вне дистанции: ${Math.round(feet)} фт`);
          return;
        }
      }
      const affected = map ? tokensInArea(map.tokens, spell.areaSpec, originPt, isPoint(direction) ? direction : null, grid) : [];
      for (const t of affected) {
        if (t.id !== token.id) targets.push(t);
      }
      area = true;
    } else {
      for (const id of Array.isArray(targetIds) ? targetIds : []) {
        if (typeof id !== 'string') continue;
        const found = manager.findToken(room, mapId, id);
        if (found) targets.push(found);
      }
      if (spellIsSelf(spell) && !targets.some((t) => t.id === token.id)) targets.push(token);
    }

    const input: SpellCastInput = {
      caster: token,
      mapId,
      spell,
      castLevel,
      characterLevel: sheet ? characterLevel(sheet.classes) : 1,
      stats,
      targets,
      advantage,
      area,
      author: room.players.find((p) => p.id === ctx.playerId)?.name ?? '?',
    };

    const invalid = validateSpellCast(room, input);
    if (invalid) {
      socket.emit('chat:error', invalid);
      return;
    }

    const cost = spellActionCost(spell);
    const turn = manager.turnForToken(room, mapId, token);
    if (turn && (cost === 'action' || cost === 'bonus' || cost === 'reaction') && !actionSlotAvailable(turn, cost)) {
      socket.emit('chat:error', 'Недостаточно действий');
      return;
    }

    if (spell.level > 0) {
      if (!manager.spendSpellSlot(room, ctx.playerId, castLevel)) {
        socket.emit('chat:error', 'Нет ячейки нужного круга');
        return;
      }
      const res = room.resources[ctx.playerId];
      if (res) socket.emit('resources:update', res);
    }
    manager.spendSlot(room, mapId, token, cost);
    syncCombat(room, mapId);

    const result = resolveSpellCast(ctx, input);
    if (result.error) socket.emit('chat:error', result.error);
  });
}
