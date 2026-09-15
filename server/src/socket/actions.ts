import {
  actionSlotAvailable,
  automationForAction,
  classFeatures,
  findBaseAction,
  rollDice,
  type ActionCost,
  type ActionDef,
  type AttackEntry,
  type Token,
  type TurnState,
} from 'shared';
import type { ConnCtx } from './context';
import { executeAutomation } from './automation';
import { fail } from './errors';
import { rejectIfIncapacitated, rejectIfReaction, scopedToken, type Scope } from './guards';
import { pushRollMessage } from './messages';
import { resolveWeaponAttackWithReactions } from './reactions';

/** Слот, которым будет оплачено действие: запрошенный, если доступен, иначе первый доступный. */
function chooseSlot(turn: TurnState | null, costs: ActionCost[], requested?: ActionCost): ActionCost {
  const order = requested && costs.includes(requested) ? [requested, ...costs.filter((c) => c !== requested)] : costs;
  if (!turn) return order[0] ?? 'action';
  return order.find((c) => actionSlotAvailable(turn, c)) ?? order[order.length - 1] ?? 'action';
}

/** Действие «Выпутаться»: проверка характеристики снимает эффект (Web: STR/Athletics). */
function escapeEffect(ctx: ConnCtx, scope: Scope, effectId: string): void {
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
  if (!ctx.manager.spendSlot(room, mapId, token, 'action')) {
    fail(ctx, 'noActions');
    return;
  }
  ctx.syncCombat(room, mapId);

  const mod = ctx.manager.abilityCheckModForToken(room, token, escape.ability, escape.skill);
  const expression = mod >= 0 ? `d20+${mod}` : `d20${mod}`;
  const roll = rollDice(expression);
  const success = roll.total >= escape.dc;
  pushRollMessage(ctx, room, {
    author: token.name,
    roll,
    kind: 'check',
    params: { subject: `Выпутаться: ${effect.name}` },
  });
  if (!success) return;
  ctx.manager.removeEffect(room, token, effect.id);
  ctx.emitToken(room, 'token:update', mapId, token);
  ctx.systemMessage(room, `${token.name}: выпутался из «${effect.name}»`);
}

export function registerActionHandlers(ctx: ConnCtx) {
  const { socket, manager, isDm, syncCombat, systemMessage } = ctx;

    ctx.on('action:use', ({ mapId, tokenId, actionId, targetIds, attackIndex, advantage, slot }) => {
      if (!ctx.playerId || typeof actionId !== 'string') return;
      if (rejectIfReaction(ctx)) return;
      const scope = scopedToken(ctx, mapId, tokenId);
      if (!scope) return;
      const { room, token, character } = scope;
      if (rejectIfIncapacitated(ctx, token)) return;

      // «Выпутаться» (Web и подобные): действие, проверка характеристики против СЛ эффекта.
      if (actionId.startsWith('escape:')) {
        escapeEffect(ctx, scope, actionId.slice('escape:'.length));
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

      const author = room.players.find((p) => p.id === ctx.playerId)?.name ?? '?';

      if (action.id === 'attack') {
        const attacks: AttackEntry[] = character ? sheet?.attacks ?? [] : token.attacks;
        const index = Math.round(Number(attackIndex));
        const entry = attacks[index];
        if (!entry || !Number.isFinite(index)) {
          fail(ctx, 'noWeapon');
          return;
        }
        if (!manager.canAttack(room, mapId, token)) {
          fail(ctx, 'actionSpent');
          return;
        }
        manager.consumeAttack(room, mapId, token);
        syncCombat(room, mapId);

        const targetId = targetIds?.[0];
        const target: Token | null = typeof targetId === 'string' ? manager.findToken(room, mapId, targetId) ?? null : null;
        const result = resolveWeaponAttackWithReactions(ctx, {
          attacker: token,
          attackerMapId: mapId,
          target,
          targetMapId: target ? mapId : null,
          attack: entry,
          prefix: token.name,
          advantage,
          author,
        });
        if (result.error) socket.emit('chat:error', result.error);
        return;
      }

      // Прочие действия: списываем слот, дальше эффект.
      const resourceAmount = action.resourceKey ? Math.max(1, action.resourceAmount ?? 1) : 0;
      if (resourceAmount && !manager.hasResource(room, ctx.playerId, action.resourceKey!, resourceAmount)) {
        fail(ctx, 'noResource', { name: action.name });
        return;
      }

      const turn = isActive ? manager.turnForToken(room, mapId, token) : null;
      const offTurnReaction = !!combat?.active && !isActive && action.costs.includes('reaction');
      const chosen: ActionCost = offTurnReaction ? 'reaction' : chooseSlot(turn, action.costs, slot);
      if (!manager.spendSlot(room, mapId, token, chosen)) {
        fail(ctx, offTurnReaction ? 'reactionSpent' : 'noActions');
        return;
      }
      syncCombat(room, mapId);

      if (resourceAmount) {
        manager.spendResource(room, ctx.playerId, action.resourceKey!, resourceAmount);
        ctx.emitResources(room, ctx.playerId);
      }

      // Автоматизированные действия (базовые/классовые) — через общий executor.
      const def = automationForAction(action, { classes: sheet?.classes });
      if (def) {
        const targets: Token[] = [];
        for (const id of Array.isArray(targetIds) ? targetIds : []) {
          if (typeof id !== 'string') continue;
          const found = manager.findToken(room, mapId, id);
          if (found) targets.push(found);
        }
        if (!targets.length && def.targeting?.kind === 'self') targets.push(token);
        executeAutomation(ctx, {
          caster: token,
          mapId,
          def: { ...def, name: action.name },
          targets,
          stats: null,
          author,
        });
        return;
      }

      // Заглушки: Help/Ready/Grapple/Shove/UnarmedStrike/UseObject.
      systemMessage(room, `${token.name}: ${action.name}`);
    });
}
