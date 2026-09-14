import {
  actionSlotAvailable,
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
import { fail } from './errors';
import { rejectIfIncapacitated, rejectIfReaction, scopedToken } from './guards';
import { pushRollMessage } from './messages';
import { resolveWeaponAttackWithReactions } from './reactions';

/** Слот, которым будет оплачено действие: запрошенный, если доступен, иначе первый доступный. */
function chooseSlot(turn: TurnState | null, costs: ActionCost[], requested?: ActionCost): ActionCost {
  const order = requested && costs.includes(requested) ? [requested, ...costs.filter((c) => c !== requested)] : costs;
  if (!turn) return order[0] ?? 'action';
  return order.find((c) => actionSlotAvailable(turn, c)) ?? order[order.length - 1] ?? 'action';
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

      if (action.id === 'class:fighter:actionSurge') {
        if (turn) {
          turn.extraActions += 1;
          syncCombat(room, mapId);
        }
        systemMessage(room, `${token.name}: Всплеск действия (+1 действие)`);
        return;
      }

      if (action.id === 'class:fighter:secondWind') {
        const fighterLevel = sheet?.classes.find((c) => c.className === 'fighter')?.level ?? 1;
        const heal = Math.max(0, rollDice(`1d10+${Math.max(1, fighterLevel)}`).total);
        ctx.applyHp(room, mapId, token, heal);
        systemMessage(room, `${token.name}: Второе дыхание (+${heal} HP)`);
        return;
      }

      if (action.id === 'dash') {
        const speed = manager.tokenSpeed(room, token);
        manager.grantExtraMovement(room, mapId, token, speed);
        syncCombat(room, mapId);
        systemMessage(room, `${token.name}: Рывок (+${speed} фт передвижения)`);
        return;
      }

      if (action.id === 'hide' || action.id === 'search') {
        const ability = action.id === 'hide' ? 'dex' : 'wis';
        const mod = manager.abilityModForToken(room, token, ability);
        const expression = mod >= 0 ? `d20+${mod}` : `d20${mod}`;
        try {
          const roll = rollDice(expression);
          pushRollMessage(ctx, room, {
            author,
            roll,
            kind: 'check',
            params: { subject: `${action.name}: ${token.name}` },
          });
        } catch {
          fail(ctx, 'checkFailed');
        }
        return;
      }

      if (action.id === 'disengage') {
        // Действие «Отход»: движение в этом ходу не провоцирует атаки по возможности.
        if (turn) turn.disengaged = true;
        syncCombat(room, mapId);
        systemMessage(room, `${token.name}: Отход`);
        return;
      }

      if (action.id === 'dodge') {
        // Действие «Уклонение»: помеха на атаки по токену до начала его следующего хода.
        if (turn) turn.dodge = true;
        syncCombat(room, mapId);
        systemMessage(room, `${token.name}: Уклонение`);
        return;
      }

      // Заглушки: Help/Ready/Grapple/Shove/UnarmedStrike/UseObject.
      systemMessage(room, `${token.name}: ${action.name}`);
    });
}
