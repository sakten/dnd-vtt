import {
  abilityMod,
  actionSlotAvailable,
  automationForSpell,
  CAREFUL_SPELL_KEY,
  characterLevel,
  DISTANT_SPELL_KEY,
  EXTENDED_SPELL_KEY,
  extendedSpellEligible,
  featSpellGrants,
  HEIGHTENED_SPELL_KEY,
  invocationActionCast,
  invocationAtWillSelfOnly,
  invocationCoversSpell,
  knownMetamagic,
  metamagicDef,
  QUICKENED_SPELL_KEY,
  restrictionsFor,
  rollDice,
  SEEKING_SPELL_KEY,
  SMITE_SPELLS,
  spellActionCost,
  spellRangeFeet,
  SUBTLE_SPELL_KEY,
  TRANSMUTABLE_DAMAGE_TYPES,
  TRANSMUTED_SPELL_KEY,
  triggersOn,
  TWINNED_SPELL_KEY,
  twinnedSpellEligible,
} from 'shared';
import type { ConnCtx } from './context';
import { fail } from './errors';
import { findSpell } from '../spells';
import { pushRollMessage } from './messages';
import { rejectIfIncapacitated, rejectIfReaction, rejectIfSpellsBlocked, scopedToken } from './guards';
import { casterStatsFor, spellClassFor } from './spellStats';
import { collectSpellCast, expandChainTargets } from './spellTargeting';
import { validateSpellCast } from './spellResolve';
import { resolveSpellCastWithReactions } from './reactions';
import { gateAttackOnTarget } from './triggers';
import { removeBrokenEffects } from './effectsApply';
import { endConcentrationOf } from './effects';
import { spellsInShapeAllowed } from './forms';

export function registerSpellHandlers(ctx: ConnCtx) {
  const { socket, manager, isDm, syncCombat, emitToken } = ctx;

  ctx.on('spell:cast', ({ mapId, tokenId, spellKey, slotLevel, targetIds, advantage, metamagic, origin, direction, path, pushSide, summonKey, variant, condition, passengerId, placements }) => {
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

    const spell = findSpell(spellKey, room);
    if (!spell) {
      fail(ctx, 'spellNotFound');
      return;
    }
    // Смайты не кастуются напрямую: применяются райдером после попадания оружием.
    if (SMITE_SPELLS.has(spellKey)) {
      fail(ctx, 'smiteOnHitOnly');
      return;
    }
    let cost = spellActionCost(spell);

    const isCharacter = room.controllers[ctx.playerId] === token.libraryItemId;
    const sheet = isCharacter ? room.sheets[ctx.playerId] : undefined;
    // Инвокация (Armor of Shadows, Mask of Many Faces…): каст без ячейки и подготовки.
    const atWill = isCharacter && !!sheet && invocationCoversSpell(sheet, spellKey);
    // Pact of the Chain: Find Familiar кастуется действием (Magic action), а не 1 час.
    if (atWill && sheet && invocationActionCast(sheet, spellKey)) cost = 'action';
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

    // Метамагия: только известная опция чародея, оплата ОЧ до каста.
    let primaryMetamagic: ReturnType<typeof metamagicDef>;
    let twinned = false;
    if (metamagic) {
      const known = isCharacter && sheet ? knownMetamagic(sheet.choices) : [];
      const key = metamagic.key;
      primaryMetamagic = key === SEEKING_SPELL_KEY ? undefined : metamagicDef(key);
      const seeking = metamagic.seeking === true || key === SEEKING_SPELL_KEY;
      const unknownPrimary = key !== SEEKING_SPELL_KEY && !primaryMetamagic;
      if (unknownPrimary || !known.includes(key) || (seeking && !known.includes(SEEKING_SPELL_KEY))) {
        fail(ctx, 'metamagicUnknown');
        return;
      }
      if (primaryMetamagic?.key === QUICKENED_SPELL_KEY) {
        if (cost !== 'action') {
          fail(ctx, 'metamagicNotApplicable');
          return;
        }
        cost = 'bonus';
      }
      if (primaryMetamagic?.key === TRANSMUTED_SPELL_KEY) {
        const type = metamagic.damageType;
        const spellTypes = spell.damage?.types ?? [];
        if (
          !type ||
          !TRANSMUTABLE_DAMAGE_TYPES.includes(type as (typeof TRANSMUTABLE_DAMAGE_TYPES)[number]) ||
          !spellTypes.some((t) => TRANSMUTABLE_DAMAGE_TYPES.includes(t as (typeof TRANSMUTABLE_DAMAGE_TYPES)[number]))
        ) {
          fail(ctx, 'metamagicNotApplicable');
          return;
        }
      }
      if (primaryMetamagic?.key === DISTANT_SPELL_KEY) {
        const range = spellRangeFeet(spell);
        if (range === null || range < 5) {
          fail(ctx, 'metamagicNotApplicable');
          return;
        }
      }
      if (primaryMetamagic?.key === EXTENDED_SPELL_KEY && !extendedSpellEligible(spell)) {
        fail(ctx, 'metamagicNotApplicable');
        return;
      }
      if (primaryMetamagic?.key === HEIGHTENED_SPELL_KEY && !(spell.save?.length ?? 0)) {
        fail(ctx, 'metamagicNotApplicable');
        return;
      }
      if (primaryMetamagic?.key === CAREFUL_SPELL_KEY) {
        if (!(spell.save?.length ?? 0)) {
          fail(ctx, 'metamagicNotApplicable');
          return;
        }
        const limit = Math.max(1, abilityMod(sheet?.abilities.cha ?? 10));
        const protectedIds = [...new Set(metamagic.careful ?? [])].filter((id) => typeof id === 'string' && id);
        if (protectedIds.length > limit) {
          fail(ctx, 'metamagicNotApplicable');
          return;
        }
        metamagic.careful = protectedIds;
      }
      if (primaryMetamagic?.key === TWINNED_SPELL_KEY) {
        if (!twinnedSpellEligible(spell) || spell.level < 1) {
          fail(ctx, 'metamagicNotApplicable');
          return;
        }
        twinned = true;
      }
      if (seeking && !spell.spellAttack) {
        fail(ctx, 'metamagicNotApplicable');
        return;
      }
      if (seeking && automationForSpell(spell, { castLevel: spell.level }).weaponAttack) {
        fail(ctx, 'metamagicNotApplicable');
        return;
      }
      const reserve = (primaryMetamagic?.cost ?? 0) + (seeking ? 1 : 0);
      if (!manager.hasResource(room, ctx.playerId, 'sorcerer:sorceryPoints', reserve)) {
        fail(ctx, 'noResource', { key: 'sorcerer:sorceryPoints', name: primaryMetamagic?.name ?? 'Метамагия' });
        return;
      }
    }

    // Боевые характеристики: лист персонажа (класс) или статблок монстра.
    const stats = casterStatsFor(room, token, spellKey);

    const combat = manager.combatOf(room, mapId);
    // Долгое накладывание (1 минута и больше): в бою недоступно.
    if (combat?.active && cost === 'special') {
      fail(ctx, 'spellLongCast', { name: spell.name });
      return;
    }
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
    if (twinned && castLevel >= 9) {
      fail(ctx, 'metamagicNotApplicable');
      return;
    }
    // Сдвоенное заклинание: эффективный уровень +1, ячейка тратится прежняя.
    const effectiveCastLevel = twinned ? Math.min(9, castLevel + 1) : castLevel;

    const input = collectSpellCast(ctx, {
      mapId,
      caster: token,
      spell,
      castLevel: effectiveCastLevel,
      characterLevel: sheet ? characterLevel(sheet.classes) : 1,
      stats,
      targetIds,
      advantage,
      origin,
      direction,
      path,
      pushSide,
      summonKey,
      variant,
      condition,
      passengerId: typeof passengerId === 'string' && passengerId ? passengerId : undefined,
      placements,
      author: room.players.find((p) => p.id === ctx.playerId)?.name ?? '?',
    });
    if (!input) return;
    if (metamagic) input.metamagic = metamagic;

    const invalid = validateSpellCast(room, input);
    if (invalid) {
      socket.emit('chat:error', invalid);
      return;
    }

    // Chain Lightning: скачки добираются авто по врагам вокруг первой цели.
    expandChainTargets(ctx, room, input);

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
    if (primaryMetamagic) {
      manager.spendResource(room, ctx.playerId, 'sorcerer:sorceryPoints', primaryMetamagic.cost);
      ctx.emitResources(room, ctx.playerId);
      if (!primaryMetamagic.automated) {
        ctx.systemMessage(room, {
          code: 'metamagic.manual',
          params: { name: token.name, option: primaryMetamagic.name },
        });
      }
    }

    // Замедление (и подобное): шанс провала заклинания с соматическим компонентом.
    const failureChance = restrictionsFor(token.conditions, token.effects).spellFailureChance;
    if (failureChance && spell.components.s && metamagic?.key !== SUBTLE_SPELL_KEY) {
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
      const blocked = input.targets.filter((t) => gateAttackOnTarget(ctx, room, token, t));
      if (blocked.length) input.targets = input.targets.filter((t) => !blocked.includes(t));
    }

    // Invisibility: применение заклинания досрочно обрывает эффект носителя.
    // Снимок до каста — чтобы рекаст не снял только что наложенный эффект.
    const breakIds = new Set(
      token.effects.filter((e) => triggersOn([e], 'ownSpellCast').some((t) => t.endEffect)).map((e) => e.id)
    );
    const result = resolveSpellCastWithReactions(ctx, input);
    if (result.error) {
      socket.emit('chat:error', result.error);
    } else if (breakIds.size) {
      removeBrokenEffects(ctx, room, mapId, token, 'ownSpellCast', breakIds);
    }
  });

  ctx.on('spell:endConcentration', ({ mapId, tokenId }) => {
    const scope = scopedToken(ctx, mapId, tokenId);
    if (!scope) return;
    const { room, token } = scope;
    const changed = endConcentrationOf(ctx, room, token, { zones: 'all' });
    if (!changed.length) return;
    ctx.systemMessage(room, { code: 'concentration.ended', params: { name: token.name } });
    syncCombat(room, mapId);
  });
}
