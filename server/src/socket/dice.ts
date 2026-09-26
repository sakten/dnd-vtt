import {
  DiceParseError,
  loadoutOf,
  parseZoneTargetId,
  restrictionsFor,
  rollDice,
  weaponContextOf,
  weaponHasProperty,
  type AttackEntry,
  type RollKind,
  type RollLabelParams,
  type Token,
} from 'shared';
import type { ConnCtx } from './context';
import { fail } from './errors';
import { actorStats } from '../room/actor';
import { sheetOfToken } from '../room/helpers';
import { playerScope, rejectIfReaction, scopedToken } from './guards';
import { pushRollMessage } from './messages';
import { resolveWeaponAttackWithReactions } from './reactions';
import { maybeRollAnim } from './rollAnim';
import { markShadowBladeThrown, shadowBladeAttackAllowed } from './shadowBlade';
import { resolveZoneSectionAttack } from './zoneAttacks';

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
        const sheet = sheetOfToken(room, found.token).sheet;
        attacks =
          sheet && !found.token.shape
            ? loadoutOf({
                attacks: sheet.attacks,
                hands: sheet.hands,
                effects: found.token.effects,
                ...weaponContextOf(sheet),
              }).attacks
            : stats.attacks;
        prefix = stats.name;
        attacker = found.token;
        attackerMapId = found.mapId;
      } else {
        const sheet = room.sheets[playerId];
        attacks = sheet
          ? loadoutOf({ attacks: sheet.attacks, hands: sheet.hands, ...weaponContextOf(sheet) }).attacks
          : undefined;
      }
      if (!attacks) return;
      const index = Math.round(Number(attackIndex));
      if (!Number.isFinite(index) || index < 0 || index >= attacks.length) return;
      const entry = attacks[index];
      if (!entry) return;
      // Синтетический клинок тени: у записи должен быть живой эффект с клинком в руке.
      if (entry.id?.startsWith('shadow:') && (!attacker || !shadowBladeAttackAllowed(attacker, entry))) {
        fail(ctx, 'noWeapon');
        return;
      }

      // Единая экономика: в бою атака списывает действие/запас мультиатаки в момент броска.
      const combatant = attacker && attackerMapId ? { token: attacker, mapId: attackerMapId } : null;
      const inCombat = !!combatant && manager.combatOf(room, combatant.mapId)?.active === true;
      const canSpend = () => {
        if (!inCombat || !combatant) return true;
        if (!isDm() && !manager.isActiveToken(room, combatant.mapId, combatant.token.id)) {
          fail(ctx, 'notYourTurn');
          return false;
        }
        const blocked = !manager.canAttack(room, combatant.mapId, combatant.token, {
          unarmed: entry.kind === 'unarmed',
        });
        // Запрет действий от эффекта (Command/Slow) не обходит даже DM.
        const effectBlock = restrictionsFor(
          combatant.token.conditions,
          combatant.token.effects
        ).noActionsFromEffect === true;
        if (blocked && (!isDm() || effectBlock)) {
          fail(ctx, 'actionSpent');
          return false;
        }
        return true;
      };

      // Списание атаки в момент броска (общее для цели-токена и секции стены).
      const spendAttack = () => {
        if (!canSpend()) return false;
        if (inCombat && combatant) {
          manager.consumeAttack(room, combatant.mapId, combatant.token, {
            unarmed: entry.kind === 'unarmed',
            loading: weaponHasProperty(entry, 'LD'),
          });
          syncCombat(room, combatant.mapId);
        }
        return true;
      };

      // Атака по секции тонкой стены (бросок со листа): тот же путь, что у способностей.
      const zoneRef = parseZoneTargetId(typeof targetId === 'string' ? targetId : undefined);
      if (zoneRef) {
        if (!attacker || !attackerMapId) {
          fail(ctx, 'spellNoTarget');
          return;
        }
        resolveZoneSectionAttack(ctx, room, {
          attacker,
          mapId: attackerMapId,
          attack: entry,
          ref: zoneRef,
          author,
          advantage,
          beforeRoll: spendAttack,
        });
        return;
      }

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
          beforeRoll: spendAttack,
          afterCommit: () => {
            if (attackerMapId) markShadowBladeThrown(ctx, room, attackerMapId, attacker, entry);
          },
        }
      );
      if (result.error) socket.emit('chat:error', result.error);
    });

}
