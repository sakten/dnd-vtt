import {
  DiceParseError,
  rollDice,
  type AttackEntry,
  type RollKind,
  type RollLabelParams,
  type Token,
} from 'shared';
import type { ConnCtx } from './context';
import { playerScope, rejectIfReaction } from './guards';
import { pushRollMessage } from './messages';
import { resolveWeaponAttackWithReactions } from './reactions';

export function registerDiceHandlers(ctx: ConnCtx) {
  const { socket, manager, isDm, syncCombat, cleanLabel } = ctx;

    ctx.on('dice:roll', ({ expression, label, rollKind, subject }) => {
      const scope = playerScope(ctx);
      if (!scope) return;
      const { room } = scope;
      const player = room.players.find((p) => p.id === ctx.playerId);
      const kind: RollKind | undefined = rollKind === 'save' || rollKind === 'check' ? rollKind : undefined;
      const params: RollLabelParams | undefined = kind ? { subject } : undefined;
      try {
        const roll = rollDice(expression);
        pushRollMessage(
          ctx,
          room,
          kind
            ? { author: player?.name ?? '?', roll, kind, params }
            : { author: player?.name ?? '?', roll, label: cleanLabel(label) }
        );
      } catch (e) {
        socket.emit('chat:error', e instanceof DiceParseError ? e.message : 'Не удалось распознать бросок');
      }
    });

    ctx.on('dice:attack', ({ tokenId, targetId, attackIndex, advantage }) => {
      const scope = playerScope(ctx);
      if (!scope) return;
      const { room, playerId } = scope;
      if (rejectIfReaction(ctx)) return;
      const author = room.players.find((p) => p.id === playerId)?.name ?? '?';

      let attacks: AttackEntry[] | undefined;
      let prefix: string | undefined;
      let attacker: Token | null = null;
      let attackerMapId: string | null = null;
      if (typeof tokenId === 'string' && tokenId) {
        const found = manager.locateToken(room, tokenId);
        if (!found) return;
        if (!isDm() && !manager.controlsToken(room, found.mapId, playerId, found.token)) return;
        const isCharacter = room.controllers[playerId] === found.token.libraryItemId;
        attacks = isCharacter ? room.sheets[playerId]?.attacks : found.token.attacks;
        prefix = found.token.name;
        attacker = found.token;
        attackerMapId = found.mapId;
      } else {
        attacks = room.sheets[playerId]?.attacks;
      }
      if (!attacks) return;
      const index = Math.round(Number(attackIndex));
      if (!Number.isFinite(index) || index < 0 || index >= attacks.length) return;
      const entry = attacks[index];
      if (!entry) return;

      // Единая экономика: в бою атака списывает действие/запас мультиатаки.
      if (attacker && attackerMapId && manager.combatOf(room, attackerMapId)?.active) {
        if (!isDm() && !manager.isActiveToken(room, attackerMapId, attacker.id)) {
          socket.emit('chat:error', 'Сейчас не ваш ход');
          return;
        }
        if (!isDm() && !manager.canAttack(room, attackerMapId, attacker)) {
          socket.emit('chat:error', 'Действие уже потрачено');
          return;
        }
        manager.consumeAttack(room, attackerMapId, attacker);
        syncCombat(room, attackerMapId);
      }

      const targetFound = typeof targetId === 'string' && targetId ? manager.locateToken(room, targetId) : null;

      const result = resolveWeaponAttackWithReactions(ctx, {
        attacker,
        attackerMapId,
        target: targetFound?.token ?? null,
        targetMapId: targetFound?.mapId ?? null,
        attack: entry,
        prefix,
        advantage,
        author,
      });
      if (result.error) socket.emit('chat:error', result.error);
    });

}
