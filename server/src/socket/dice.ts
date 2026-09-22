import {
  DiceParseError,
  rollDice,
  weaponHasProperty,
  type AttackEntry,
  type RollKind,
  type RollLabelParams,
  type Token,
} from 'shared';
import type { ConnCtx } from './context';
import { fail } from './errors';
import { actorStats } from '../room/actor';
import { playerScope, rejectIfReaction, scopedToken } from './guards';
import { pushRollMessage } from './messages';
import { resolveWeaponAttackWithReactions } from './reactions';
import { maybeRollAnim } from './rollAnim';

export function registerDiceHandlers(ctx: ConnCtx) {
  const { socket, manager, isDm, syncCombat, cleanLabel } = ctx;

    ctx.on('dice:roll', ({ expression, label, rollKind, subject }) => {
      const scope = playerScope(ctx);
      if (!scope) return;
      const { room } = scope;
      const player = room.players.find((p) => p.id === ctx.playerId);
      const kind: RollKind | undefined = rollKind === 'save' || rollKind === 'check' ? rollKind : undefined;
      const author = player?.name ?? '?';
      const params: RollLabelParams | undefined = kind ? { subject } : undefined;
      try {
        const roll = rollDice(expression);
        pushRollMessage(
          ctx,
          room,
          kind
            ? { author, roll, kind, params }
            : { author, roll, label: cleanLabel(label) }
        );
        // Проверка игрока может показать анимацию d20 (шанс в личной настройке).
        if (kind === 'check') maybeRollAnim(ctx, roll);
      } catch (e) {
        if (e instanceof DiceParseError) socket.emit('chat:error', { code: e.code, params: e.params });
        else throw e;
      }
    });

    ctx.on('dice:attack', ({ tokenId, targetId, attackIndex, advantage }) => {
      const scope = playerScope(ctx);
      if (!scope) return;
      const { room, playerId } = scope;
      if (rejectIfReaction(ctx)) return;
      const player = room.players.find((p) => p.id === playerId);
      const author = player?.name ?? '?';

      let attacks: AttackEntry[] | undefined;
      let prefix: string | undefined;
      let attacker: Token | null = null;
      let attackerMapId: string | null = null;
      if (typeof tokenId === 'string' && tokenId) {
        const found = manager.locateToken(room, tokenId);
        if (!found) return;
        const scope = scopedToken(ctx, found.mapId, tokenId);
        if (!scope) return;
        const stats = actorStats(room, found.token);
        attacks = stats.attacks;
        prefix = stats.name;
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

      // Единая экономика: в бою атака списывает действие/запас мультиатаки в момент броска.
      const combatant = attacker && attackerMapId ? { token: attacker, mapId: attackerMapId } : null;
      const inCombat = !!combatant && manager.combatOf(room, combatant.mapId)?.active === true;
      const canSpend = () => {
        if (!inCombat || !combatant) return true;
        if (!isDm() && !manager.isActiveToken(room, combatant.mapId, combatant.token.id)) {
          fail(ctx, 'notYourTurn');
          return false;
        }
        if (!isDm() && !manager.canAttack(room, combatant.mapId, combatant.token, { unarmed: entry.kind === 'unarmed' })) {
          fail(ctx, 'actionSpent');
          return false;
        }
        return true;
      };

      const targetFound = typeof targetId === 'string' && targetId ? manager.locateToken(room, targetId) : null;

      const result = resolveWeaponAttackWithReactions(
        ctx,
        {
          attacker,
          attackerMapId,
          target: targetFound?.token ?? null,
          targetMapId: targetFound?.mapId ?? null,
          attack: entry,
          prefix,
          advantage,
          author,
        },
        {
          beforeRoll: () => {
            if (!canSpend()) return false;
            if (inCombat && combatant) {
              manager.consumeAttack(room, combatant.mapId, combatant.token, {
                unarmed: entry.kind === 'unarmed',
                loading: weaponHasProperty(entry, 'LD'),
              });
              syncCombat(room, combatant.mapId);
            }
            return true;
          },
        }
      );
      if (result.error) socket.emit('chat:error', result.error);
    });

}
