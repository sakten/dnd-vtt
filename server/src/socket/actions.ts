import {
  actionSlotAvailable,
  automationForAction,
  casterStats,
  classFeatures,
  featureActionAutomation,
  findBaseAction,
  findUnarmedAttack,
  firstSentence,
  gridDistanceFeet,
  legendaryOnly,
  monsterStats,
  rollDice,
  tokensInArea,
  unarmedStrikeEntry as computedUnarmedStrike,
  withAdvantage,
  type ActionCost,
  type ActionDef,
  type AttackEntry,
  type CharacterSheet,
  type DiceRollResult,
  type Token,
  type TurnState,
} from 'shared';
import type { ConnCtx } from './context';
import { executeAutomation } from './automation';
import { fail } from './errors';
import { rejectIfIncapacitated, rejectIfReaction, rejectIfSpellsBlocked, scopedToken, type Scope } from './guards';
import { pushRollMessage } from './messages';
import { resolveSpellCastWithReactions, resolveWeaponAttackWithReactions } from './reactions';
import { maybeRollAnim } from './rollAnim';
import { findSpell } from '../spells';
import { spellStatsFor } from './spellStats';
import { collectSpellCast } from './spellTargeting';
import { validateSpellCast } from './spellResolve';

/** Слот, которым будет оплачено действие: запрошенный, если доступен, иначе первый доступный. */
function chooseSlot(turn: TurnState | null, costs: ActionCost[], requested?: ActionCost): ActionCost {
  const order = requested && costs.includes(requested) ? [requested, ...costs.filter((c) => c !== requested)] : costs;
  if (!turn) return order[0] ?? 'action';
  return order.find((c) => actionSlotAvailable(turn, c)) ?? order[order.length - 1] ?? 'action';
}

/** Действие «Выпутаться»: проверка характеристики снимает эффект (Web: STR/Athletics). */
function escapeEffect(
  ctx: ConnCtx,
  scope: Scope,
  effectId: string,
  advantage?: 'a' | 'd'
): void {
  const { room, mapId, token } = scope;
  const effect = token.effects.find((e) => e.id === effectId);
  const escape = effect?.escape;
  if (!effect || !escape) return;

  const combat = ctx.manager.combatOf(room, mapId);
  const isActive = !combat?.active || ctx.manager.isActiveToken(room, mapId, token.id);
  if (combat?.active && !isActive && !ctx.isDm()) {
    fail(ctx, 'notYourTurn');
    return;
  }

  const expression = withAdvantage(
    ctx.manager.abilityCheckExprForToken(room, token, escape.ability, escape.skill),
    advantage === 'a' || advantage === 'd' ? advantage : null
  );
  const applyCheck = (roll: DiceRollResult) => {
    const success = roll.total >= escape.dc;
    pushRollMessage(ctx, room, {
      author: token.name,
      roll,
      kind: 'check',
      params: { subject: `Выпутаться: ${effect.name}` },
    });
    maybeRollAnim(ctx, roll);
    if (!success) return;
    ctx.manager.removeEffect(room, token, effect.id);
    ctx.emitToken(room, 'token:update', mapId, token);
    ctx.systemMessage(room, { code: 'actions.escaped', params: { name: token.name, effect: effect.name } });
  };

  if (!ctx.manager.spendSlot(room, mapId, token, 'action')) {
    fail(ctx, 'noActions');
    return;
  }
  ctx.syncCombat(room, mapId);
  applyCheck(rollDice(expression));
}

/** Безоружный удар: явная атака из листа переопределяет расчёт, иначе — общие правила. */
function unarmedStrikeEntry(
  ctx: ConnCtx,
  room: Scope['room'],
  token: Token,
  sheet: CharacterSheet | undefined
): AttackEntry {
  const explicit = findUnarmedAttack(sheet?.attacks) ?? findUnarmedAttack(token.attacks);
  const abilities = ctx.manager.abilitiesForToken(room, token) ?? {};
  return computedUnarmedStrike(explicit, {
    abilities,
    classes: sheet?.classes ?? [],
    choices: sheet?.choices,
  });
}

export function registerActionHandlers(ctx: ConnCtx) {
  const { socket, manager, isDm, syncCombat, systemMessage } = ctx;

    ctx.on('action:use', ({ mapId, tokenId, actionId, targetIds, attackIndex, advantage, slot, origin, direction }) => {
      if (!ctx.playerId || typeof actionId !== 'string') return;
      if (rejectIfReaction(ctx)) return;
      const scope = scopedToken(ctx, mapId, tokenId);
      if (!scope) return;
      const { room, token, character } = scope;
      if (rejectIfIncapacitated(ctx, token)) return;

      // «Выпутаться» (Web и подобные): действие, проверка характеристики против СЛ эффекта.
      if (actionId.startsWith('escape:')) {
        escapeEffect(ctx, scope, actionId.slice('escape:'.length), advantage);
        return;
      }

      const sheet = character?.sheet;
      const classAction = sheet ? classFeatures(sheet.classes).find((a) => a.id === actionId) : undefined;
      const action: ActionDef | undefined =
        token.statblock?.actions?.find((a) => a.id === actionId) ?? findBaseAction(actionId) ?? classAction;
      if (!action) return;

      const combat = manager.combatOf(room, mapId);
      const isActive = !combat?.active || manager.isActiveToken(room, mapId, token.id);
      // В чужой ход игрок может тратить только реакцию; DM — любые действия (как раньше).
      if (combat?.active && !isActive && !isDm() && !action.costs.includes('reaction')) {
        fail(ctx, 'notYourTurn');
        return;
      }

      const activeEntry =
        combat?.active && combat.currentIndex >= 0 ? combat.entries[combat.currentIndex] : undefined;
      const legendarySlot = !!activeEntry?.legendaryOwnerId;
      const legendaryCost = action.legendaryCost ?? 0;
      const ownedLegendary = legendaryOnly(action);
      if (legendarySlot && !ownedLegendary) {
        fail(ctx, 'legendarySlotOnly');
        return;
      }
      if (!legendarySlot && ownedLegendary) {
        fail(ctx, 'legendaryOnly');
        return;
      }
      const ownerTurn = manager.turnStateFor(room, mapId, token);
      if (action.recharge && (ownerTurn?.abilityCooldowns?.[action.id] ?? 0) > 0) {
        fail(ctx, 'recharging', { name: action.name });
        return;
      }

      // Проверки способности до списания действия: точка области и дистанция до целей.
      const abilityArea = action.ability?.targeting?.kind === 'area' ? action.ability.targeting.area : undefined;
      const abilityOrigin = origin && Number.isFinite(origin.x) && Number.isFinite(origin.y) ? origin : null;
      if (action.ability) {
        const range = action.ability.targeting?.range ?? (action.ability.attack?.rangeType === 'melee' ? 5 : 30);
        const map = manager.findMap(room, mapId);
        const size = map?.grid.size || room.scene.grid.size || 50;
        if (abilityArea) {
          if (!abilityOrigin) {
            fail(ctx, 'noAreaPoint');
            return;
          }
          const feet = (Math.hypot(abilityOrigin.x - token.x, abilityOrigin.y - token.y) / size) * 5;
          if (range > 0 && feet > range) {
            fail(ctx, 'outOfRange', { feet: Math.round(feet) });
            return;
          }
        } else if (action.ability.attack) {
          for (const id of Array.isArray(targetIds) ? targetIds : []) {
            if (typeof id !== 'string') continue;
            const found = manager.findToken(room, mapId, id);
            if (!found) continue;
            const feet = gridDistanceFeet(token, found, size);
            if (range > 0 && feet > range) {
              fail(ctx, 'outOfRange', { feet: Math.round(feet) });
              return;
            }
          }
        }
      }

      const author = room.players.find((p) => p.id === ctx.playerId)?.name ?? '?';

      if (action.id === 'attack' || action.id === 'unarmedStrike') {
        const index = Math.round(Number(attackIndex));
        const attacks: AttackEntry[] = character ? sheet?.attacks ?? [] : token.attacks;
        const entry = action.id === 'unarmedStrike' ? unarmedStrikeEntry(ctx, room, token, sheet) : attacks[index];
        if (!entry || (action.id === 'attack' && !Number.isFinite(index))) {
          fail(ctx, 'noWeapon');
          return;
        }
        const unarmed = action.id === 'unarmedStrike' || entry.kind === 'unarmed';
        if (!manager.canAttack(room, mapId, token, { unarmed })) {
          fail(ctx, 'actionSpent');
          return;
        }

        const targetId = targetIds?.[0];
        const target: Token | null = typeof targetId === 'string' ? manager.findToken(room, mapId, targetId) ?? null : null;
        const result = resolveWeaponAttackWithReactions(
          ctx,
          {
            attacker: token,
            attackerMapId: mapId,
            target,
            targetMapId: target ? mapId : null,
            attack: entry,
            prefix: token.name,
            advantage,
            author,
          },
          {
            // Атака списывается в момент броска; ошибки до броска не тратят ресурс.
            beforeRoll: () => {
              if (!manager.canAttack(room, mapId, token, { unarmed })) {
                fail(ctx, 'actionSpent');
                return false;
              }
              manager.consumeAttack(room, mapId, token, { unarmed });
              syncCombat(room, mapId);
              return true;
            },
          }
        );
        if (result.error) {
          socket.emit('chat:error', result.error);
          return;
        }
        return;
      }

      if (action.spellKey) {
        if (rejectIfSpellsBlocked(ctx, token)) return;
        const spell = findSpell(action.spellKey);
        if (!spell) return;
        const stats = spellStatsFor(room, token) ?? monsterStats(token.statblock, undefined);
        const input = collectSpellCast(ctx, {
          mapId,
          caster: token,
          spell,
          castLevel: spell.level,
          characterLevel: 1,
          stats,
          targetIds,
          advantage,
          origin,
          direction,
          author,
        });
        if (!input) return;
        const invalid = validateSpellCast(room, input);
        if (invalid) {
          socket.emit('chat:error', invalid);
          return;
        }
        if (legendarySlot) {
          if (!manager.spendLegendary(room, mapId, token, legendaryCost)) {
            fail(ctx, 'noLegendary');
            return;
          }
        } else {
          const turn = isActive ? manager.turnForToken(room, mapId, token) : null;
          const offTurnReaction = !!combat?.active && !isActive && action.costs.includes('reaction');
          const chosen: ActionCost = offTurnReaction ? 'reaction' : chooseSlot(turn, action.costs, slot);
          if (!manager.spendSlot(room, mapId, token, chosen)) {
            fail(ctx, offTurnReaction ? 'reactionSpent' : 'noActions');
            return;
          }
          if (legendaryCost && !manager.spendLegendary(room, mapId, token, legendaryCost)) {
            fail(ctx, 'noLegendary');
            return;
          }
        }
        if (action.recharge) manager.startAbilityCooldown(room, mapId, token, action.id, action.recharge);
        syncCombat(room, mapId);
        const result = resolveSpellCastWithReactions(ctx, input);
        if (result.error) socket.emit('chat:error', result.error);
        return;
      }

      // Прочие действия: списываем слот, дальше эффект.
      const resourceAmount = action.resourceKey ? Math.max(1, action.resourceAmount ?? 1) : 0;
      if (resourceAmount && !manager.hasResource(room, ctx.playerId, action.resourceKey!, resourceAmount)) {
        fail(ctx, 'noResource', action.resourceKey ? { key: action.resourceKey, name: action.name } : { name: action.name });
        return;
      }

      const turn = isActive ? manager.turnForToken(room, mapId, token) : null;
      const offTurnReaction = !!combat?.active && !isActive && action.costs.includes('reaction');
      if (legendarySlot) {
        if (!manager.spendLegendary(room, mapId, token, legendaryCost)) {
          fail(ctx, 'noLegendary');
          return;
        }
      } else {
        const chosen: ActionCost = offTurnReaction ? 'reaction' : chooseSlot(turn, action.costs, slot);
        if (!manager.spendSlot(room, mapId, token, chosen)) {
          fail(ctx, offTurnReaction ? 'reactionSpent' : 'noActions');
          return;
        }
        if (legendaryCost && !manager.spendLegendary(room, mapId, token, legendaryCost)) {
          fail(ctx, 'noLegendary');
          return;
        }
      }
      syncCombat(room, mapId);
      if (action.recharge) manager.startAbilityCooldown(room, mapId, token, action.id, action.recharge);

      if (resourceAmount) {
        manager.spendResource(room, ctx.playerId, action.resourceKey!, resourceAmount);
        ctx.emitResources(room, ctx.playerId);
      }

      // Автоматизированные действия (базовые/классовые) — через общий executor.
      const def = automationForAction(action, { classes: sheet?.classes }) ?? featureActionAutomation(action.id, sheet?.classes);
      if (def) {
        const targets: Token[] = [];
        if (abilityArea) {
          const map = manager.findMap(room, mapId);
          const grid = {
            size: map?.grid.size || room.scene.grid.size || 50,
            offsetX: map?.grid.offsetX ?? room.scene.grid.offsetX,
            offsetY: map?.grid.offsetY ?? room.scene.grid.offsetY,
          };
          const affected = map && abilityOrigin ? tokensInArea(map.tokens, abilityArea, abilityOrigin, direction ?? null, grid) : [];
          for (const found of affected) {
            if (found.id !== token.id) targets.push(found);
          }
        } else {
          for (const id of Array.isArray(targetIds) ? targetIds : []) {
            if (typeof id !== 'string') continue;
            const found = manager.findToken(room, mapId, id);
            if (found) targets.push(found);
          }
        }
        if (!targets.length && def.targeting?.kind === 'self') targets.push(token);
        // Классовые черты со спасбросками (Изгнание нежити, Сияние рассвета): СЛ из листа.
        const classKey = actionId.startsWith('class:') ? actionId.slice('class:'.length).split(/[:.]/)[0] : undefined;
        const stats = action.ability
          ? monsterStats(token.statblock, action.ability)
          : sheet && classKey
            ? casterStats(sheet, classKey)
            : null;
      executeAutomation(ctx, {
        caster: token,
        mapId,
        def: { ...def, name: action.name },
        targets,
        stats,
        author,
        advantage,
        manual: { description: action.description ? [action.description] : undefined },
      });
        return;
      }

      // Заглушки: Help/Ready/Grapple/Shove/UseObject и черты без механики.
      const summary = action.description ? firstSentence(action.description) : '';
      systemMessage(
        room,
        summary
          ? {
              code: 'actions.usedSummary',
              params: { name: token.name, action: action.name, summary },
            }
          : { code: 'actions.used', params: { name: token.name, action: action.name } }
      );
    });
}
