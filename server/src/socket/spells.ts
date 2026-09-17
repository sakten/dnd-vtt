import {
  actionSlotAvailable,
  characterLevel,
  featSpellGrants,
  isRecord,
  restrictionsFor,
  rollDice,
  spellActionCost,
  spellAreaOrigin,
  spellHasArea,
  spellIsSelf,
  spellRangeFeet,
  tokensInArea,
  type Token,
} from 'shared';
import type { ConnCtx } from './context';
import { fail } from './errors';
import { findSpell } from '../spells';
import { pushRollMessage } from './messages';
import { rejectIfIncapacitated, rejectIfReaction, rejectIfSpellsBlocked, scopedToken } from './guards';
import { spellClassFor, spellStatsFor } from './spellStats';
import { validateSpellCast, type SpellCastInput } from './spellResolve';
import { resolveSpellCastWithReactions } from './reactions';
import { removeZonesOfSource } from './zones';

const isPoint = (p: unknown): p is { x: number; y: number } =>
  isRecord(p) && Number.isFinite(p.x) && Number.isFinite(p.y);

export function registerSpellHandlers(ctx: ConnCtx) {
  const { socket, manager, isDm, syncCombat, emitToken } = ctx;

  ctx.on('spell:cast', ({ mapId, tokenId, spellKey, slotLevel, targetIds, advantage, origin, direction }) => {
    if (!ctx.playerId || typeof spellKey !== 'string') return;
    if (rejectIfReaction(ctx)) return;
    const scope = scopedToken(ctx, mapId, tokenId);
    if (!scope) return;
    const { room, token } = scope;
    if (rejectIfIncapacitated(ctx, token)) return;
    if (rejectIfSpellsBlocked(ctx, token)) return;

    const spell = findSpell(spellKey);
    if (!spell) return;
    const cost = spellActionCost(spell);

    const isCharacter = room.controllers[ctx.playerId] === token.libraryItemId;
    const sheet = isCharacter ? room.sheets[ctx.playerId] : undefined;

    let className: string | undefined;
    if (isCharacter && sheet) {
      className = spellClassFor(sheet, spellKey);
      if (!className) {
        fail(ctx, 'spellNotPrepared');
        return;
      }
    } else if (token.statblock?.spellcasting?.spells && !token.statblock.spellcasting.spells.includes(spellKey)) {
      fail(ctx, 'spellNotInStatblock');
      return;
    }

    // Боевые характеристики: лист персонажа (класс) или статблок монстра.
    const stats = spellStatsFor(room, token, sheet && className ? className : undefined);

    const combat = manager.combatOf(room, mapId);
    const isActive = !combat?.active || manager.isActiveToken(room, mapId, token.id);
    // В чужой ход игрок может кастовать только реакционные заклинания.
    if (combat?.active && !isActive && !isDm() && cost !== 'reaction') {
      fail(ctx, 'notYourTurn');
      return;
    }

    let castLevel = spell.level;
    if (spell.level > 0) {
      const requested = Math.round(Number(slotLevel));
      castLevel = Number.isFinite(requested) ? Math.max(spell.level, Math.min(9, requested)) : spell.level;
    }

    const targets: Token[] = [];
    let area = false;
    let areaOrigin: { x: number; y: number } | null = null;
    if (spellHasArea(spell) && spell.areaSpec) {
      const map = manager.findMap(room, mapId);
      const grid = {
        size: map?.grid.size || room.scene.grid.size || 50,
        offsetX: map?.grid.offsetX ?? room.scene.grid.offsetX,
        offsetY: map?.grid.offsetY ?? room.scene.grid.offsetY,
      };
      const originKind = spellAreaOrigin(spell);
      const originPt = originKind === 'self' ? { x: token.x, y: token.y } : isPoint(origin) ? origin : null;
      if (!originPt) {
        fail(ctx, 'noAreaPoint');
        return;
      }
      if (originKind === 'point') {
        const range = spellRangeFeet(spell);
        const feet = (Math.hypot(originPt.x - token.x, originPt.y - token.y) / grid.size) * 5;
        if (range !== null && feet > range) {
          fail(ctx, 'outOfRange', { feet });
          return;
        }
      }
      const affected = map ? tokensInArea(map.tokens, spell.areaSpec, originPt, isPoint(direction) ? direction : null, grid) : [];
      for (const t of affected) {
        if (t.id !== token.id) targets.push(t);
      }
      area = true;
      areaOrigin = originPt;
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
      // Для area-каста точка — серверная (эманация — от кастера), не доверяем payload.
      origin: areaOrigin ?? (isPoint(origin) ? origin : null),
      direction: isPoint(direction) ? direction : null,
      author: room.players.find((p) => p.id === ctx.playerId)?.name ?? '?',
    };

    const invalid = validateSpellCast(room, input);
    if (invalid) {
      socket.emit('chat:error', invalid);
      return;
    }

    const turn =
      cost === 'reaction' ? manager.turnStateFor(room, mapId, token) : manager.turnForToken(room, mapId, token);
    if (turn && (cost === 'action' || cost === 'bonus' || cost === 'reaction') && !actionSlotAvailable(turn, cost)) {
      fail(ctx, 'noActions');
      return;
    }

    // Magic Initiate: заклинание 1 круга можно скастовать бесплатно раз в долгий отдых.
    const featGrant = sheet ? featSpellGrants(sheet.choices).find((g) => g.key === spellKey && g.level > 0) : undefined;
    const featChargeKey = featGrant ? `${featGrant.className}:freeCast` : undefined;
    const freeCast = !!featChargeKey && !!ctx.playerId && manager.hasResource(room, ctx.playerId, featChargeKey, 1);

    if (spell.level > 0 && freeCast && featChargeKey) {
      manager.spendResource(room, ctx.playerId!, featChargeKey, 1);
      ctx.emitResources(room, ctx.playerId!);
      ctx.systemMessage(room, `${token.name}: ${spell.name} — каст без ячейки (фит)`);
    } else if (spell.level > 0) {
      if (className) {
        if (!manager.spendSpellSlot(room, ctx.playerId, castLevel)) {
          fail(ctx, 'noSlot');
          return;
        }
        ctx.emitResources(room, ctx.playerId);
      } else if (token.statblock?.spellcasting) {
        if (!manager.spendTokenSpellSlot(room, token, castLevel)) {
          fail(ctx, 'noSlot');
          return;
        }
        emitToken(room, 'token:update', mapId, token);
      } else {
        fail(ctx, 'noSlot');
        return;
      }
    }
    manager.spendSlot(room, mapId, token, cost);
    syncCombat(room, mapId);

    // Замедление (и подобное): шанс провала заклинания с соматическим компонентом.
    const failureChance = restrictionsFor(token.conditions, token.effects).spellFailureChance;
    if (failureChance && spell.components.s) {
      const d100 = rollDice('d100');
      if (d100.total <= failureChance) {
        pushRollMessage(ctx, room, {
          author: token.name,
          roll: d100,
          kind: 'plain',
          params: { subject: `${spell.name} — провал (${failureChance}%)` },
        });
        return;
      }
    }

    const result = resolveSpellCastWithReactions(ctx, input);
    if (result.error) socket.emit('chat:error', result.error);
  });

  ctx.on('spell:endConcentration', ({ mapId, tokenId }) => {
    const scope = scopedToken(ctx, mapId, tokenId);
    if (!scope) return;
    const { room, token } = scope;
    const changed = manager.clearConcentration(room, token.id);
    removeZonesOfSource(ctx, room, token.id);
    if (!changed.length) return;
    for (const c of changed) ctx.emitToken(room, 'token:update', c.mapId, c.token);
    ctx.systemMessage(room, `${token.name}: концентрация прекращена`);
    syncCombat(room, mapId);
  });
}
