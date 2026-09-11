import { randomUUID } from 'node:crypto';
import {
  actionSlotAvailable,
  findBaseAction,
  rollDice,
  rollLabelText,
  type ActionCost,
  type ActionDef,
  type AttackEntry,
  type ChatMessage,
  type Token,
  type TurnState,
} from 'shared';
import type { ConnCtx } from './context';
import { resolveWeaponAttack } from './attackResolve';

/** Слот, которым будет оплачено действие: запрошенный, если доступен, иначе первый доступный. */
function chooseSlot(turn: TurnState | null, costs: ActionCost[], requested?: ActionCost): ActionCost {
  const order = requested && costs.includes(requested) ? [requested, ...costs.filter((c) => c !== requested)] : costs;
  if (!turn) return order[0] ?? 'action';
  return order.find((c) => actionSlotAvailable(turn, c)) ?? order[order.length - 1] ?? 'action';
}

export function registerActionHandlers(ctx: ConnCtx) {
  const { socket, manager, getRoom, isDm, broadcastAll, syncCombat, systemMessage } = ctx;

    ctx.on('action:use', ({ mapId, tokenId, actionId, targetIds, attackIndex, advantage, slot }) => {
      if (!ctx.playerId) return;
      const room = getRoom();
      if (!room || typeof mapId !== 'string' || typeof tokenId !== 'string' || typeof actionId !== 'string') return;
      const token = manager.findToken(room, mapId, tokenId);
      if (!token) return;
      if (!isDm() && !manager.controlsToken(room, mapId, ctx.playerId, token)) return;

      const action: ActionDef | undefined =
        token.statblock?.actions?.find((a) => a.id === actionId) ?? findBaseAction(actionId);
      if (!action) return;

      const combat = manager.combatOf(room, mapId);
      if (combat?.active && !isDm() && !manager.isActiveToken(room, mapId, token.id)) {
        socket.emit('chat:error', 'Сейчас не ваш ход');
        return;
      }

      const author = room.players.find((p) => p.id === ctx.playerId)?.name ?? '?';

      if (action.id === 'attack') {
        const isCharacter = room.controllers[ctx.playerId] === token.libraryItemId;
        const attacks: AttackEntry[] = isCharacter ? room.sheets[ctx.playerId]?.attacks ?? [] : token.attacks;
        const index = Math.round(Number(attackIndex));
        const entry = attacks[index];
        if (!entry || !Number.isFinite(index)) {
          socket.emit('chat:error', 'Не выбрано оружие');
          return;
        }
        if (!manager.canAttack(room, mapId, token)) {
          socket.emit('chat:error', 'Действие уже потрачено');
          return;
        }
        manager.consumeAttack(room, mapId, token);
        syncCombat(room, mapId);

        const targetId = targetIds?.[0];
        const target: Token | null = typeof targetId === 'string' ? manager.findToken(room, mapId, targetId) ?? null : null;
        const result = resolveWeaponAttack(ctx, {
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
      const turn = manager.turnForToken(room, mapId, token);
      const chosen = chooseSlot(turn, action.costs, slot);
      if (!manager.spendSlot(room, mapId, token, chosen)) {
        socket.emit('chat:error', 'Недостаточно действий');
        return;
      }
      syncCombat(room, mapId);

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
          const message: ChatMessage = {
            id: randomUUID(),
            kind: 'roll',
            author,
            roll,
            label: rollLabelText('check', { subject: `${action.name}: ${token.name}` }),
            rollKind: 'check',
            labelParams: { subject: `${action.name}: ${token.name}` },
            ts: Date.now(),
          };
          manager.addMessage(room, message);
          broadcastAll('chat:message', message);
        } catch {
          socket.emit('chat:error', 'Не удалось выполнить проверку');
        }
        return;
      }

      // Заглушки: Dodge/Help/Disengage/Ready/Grapple/Shove/UnarmedStrike/UseObject.
      systemMessage(room, `${token.name}: ${action.name}`);
    });
}
