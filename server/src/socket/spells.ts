import {
  actionSlotAvailable,
  characterLevel,
  featSpellGrants,
  invocationAtWillSelfOnly,
  invocationCoversSpell,
  restrictionsFor,
  rollDice,
  SMITE_SPELLS,
  spellActionCost,
} from 'shared';
import type { ConnCtx } from './context';
import { fail } from './errors';
import { findSpell } from '../spells';
import { pushRollMessage } from './messages';
import { rejectIfIncapacitated, rejectIfReaction, rejectIfSpellsBlocked, scopedToken } from './guards';
import { spellClassFor, spellStatsFor } from './spellStats';
import { collectSpellCast } from './spellTargeting';
import { validateSpellCast } from './spellResolve';
import { resolveSpellCastWithReactions } from './reactions';
import { sanctuaryBlocks } from './sanctuary';
import { removeBrokenEffects } from './effectsApply';
import { removeConcSummonsOf, summonSourceIds } from './summons';
import { endShapesOf, spellsInShapeAllowed } from './forms';
import { removeZonesOfSource } from './zones';

export function registerSpellHandlers(ctx: ConnCtx) {
  const { socket, manager, isDm, syncCombat, emitToken } = ctx;

  ctx.on('spell:cast', ({ mapId, tokenId, spellKey, slotLevel, targetIds, advantage, origin, direction, summonKey, variant, condition }) => {
    if (!ctx.playerId || typeof spellKey !== 'string') return;
    if (rejectIfReaction(ctx)) return;
    const scope = scopedToken(ctx, mapId, tokenId);
    if (!scope) return;
    const { room, token } = scope;
    if (rejectIfIncapacitated(ctx, token)) return;
    if (rejectIfSpellsBlocked(ctx, token)) return;
    // В форме зверя каст запрещён (кроме Beast Spells, друид 18+).
    if (token.shape && !spellsInShapeAllowed(room, token)) {
      fail(ctx, 'shapeInForm');
      return;
    }

    const spell = findSpell(spellKey);
    if (!spell) return;
    // Смайты не кастуются напрямую: применяются райдером после попадания оружием.
    if (SMITE_SPELLS.has(spellKey)) {
      fail(ctx, 'smiteOnHitOnly');
      return;
    }
    const cost = spellActionCost(spell);

    const isCharacter = room.controllers[ctx.playerId] === token.libraryItemId;
    const sheet = isCharacter ? room.sheets[ctx.playerId] : undefined;
    // Инвокация (Armor of Shadows, Mask of Many Faces…): каст без ячейки и подготовки.
    const atWill = isCharacter && !!sheet && invocationCoversSpell(sheet, spellKey);
    // At-will «на себя» (Armor of Shadows и подобные): цель — только сам кастер.
    if (atWill && invocationAtWillSelfOnly(spellKey)) {
      const ids = Array.isArray(targetIds) ? targetIds : [];
      if (ids.some((id) => id !== token.id)) {
        fail(ctx, 'spellSelfOnly');
        return;
      }
      targetIds = [token.id];
    }

    let className: string | undefined;
    if (isCharacter && sheet) {
      className = spellClassFor(sheet, spellKey);
      if (!className && !atWill) {
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
    if (atWill) castLevel = spell.level;

    const input = collectSpellCast(ctx, {
      mapId,
      caster: token,
      spell,
      castLevel,
      characterLevel: sheet ? characterLevel(sheet.classes) : 1,
      stats,
      targetIds,
      advantage,
      origin,
      direction,
      summonKey,
      variant,
      condition,
      author: room.players.find((p) => p.id === ctx.playerId)?.name ?? '?',
    });
    if (!input) return;

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

    if (atWill) {
      // Инвокация: ячейка не тратится (действие списывается ниже общим путём).
    } else if (spell.level > 0 && freeCast && featChargeKey) {
      manager.spendResource(room, ctx.playerId!, featChargeKey, 1);
      ctx.emitResources(room, ctx.playerId!);
      ctx.systemMessage(room, { code: 'spells.featCast', params: { name: token.name, spell: spell.name } });
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

    // Sanctuary: атака или дамажащий каст по защищённой цели — спас Мдр или потеря заклинания.
    if (!input.area && (spell.spellAttack || (spell.damage && !spell.healing))) {
      const blocked = input.targets.filter((t) => sanctuaryBlocks(ctx, room, token, t));
      if (blocked.length) input.targets = input.targets.filter((t) => !blocked.includes(t));
    }

    // Invisibility: применение заклинания досрочно обрывает эффект носителя.
    // Снимок до каста — чтобы рекаст не снял только что наложенный эффект.
    const breakIds = new Set(token.effects.filter((e) => e.breakOn?.includes('spell')).map((e) => e.id));
    const result = resolveSpellCastWithReactions(ctx, input);
    if (result.error) {
      socket.emit('chat:error', result.error);
    } else if (breakIds.size) {
      removeBrokenEffects(ctx, room, mapId, token, 'spell', breakIds);
    }
  });

  ctx.on('spell:endConcentration', ({ mapId, tokenId }) => {
    const scope = scopedToken(ctx, mapId, tokenId);
    if (!scope) return;
    const { room, token } = scope;
    const changed = manager.clearConcentration(room, token.id);
    removeZonesOfSource(ctx, room, token.id);
    removeConcSummonsOf(ctx, room, summonSourceIds(room, token));
    endShapesOf(ctx, room, summonSourceIds(room, token));
    if (!changed.length) return;
    for (const c of changed) ctx.emitToken(room, 'token:update', c.mapId, c.token);
    ctx.systemMessage(room, { code: 'concentration.ended', params: { name: token.name } });
    syncCombat(room, mapId);
  });
}
