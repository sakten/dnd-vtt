import { randomUUID } from 'node:crypto';
import {
  DiceParseError,
  attackRange,
  gridDistanceFeet,
  isCriticalFail,
  isCriticalHit,
  resolveAttack,
  rollDice,
  statNumber,
  weaponRolls,
  withAdvantage,
  type AttackEntry,
  type ChatMessage,
  type Token,
} from 'shared';
import type { ConnCtx } from './context';

export function registerDiceHandlers(ctx: ConnCtx) {
  const { socket, manager, getRoom, isDm, broadcastAll, emitToken, cleanLabel } = ctx;

    ctx.on('dice:roll', ({ expression, label }) => {
      if (!ctx.playerId) return;
      const room = getRoom();
      if (!room) return;
      const player = room.players.find((p) => p.id === ctx.playerId);
      try {
        const roll = rollDice(expression);
        const message: ChatMessage = {
          id: randomUUID(),
          kind: 'roll',
          author: player?.name ?? '?',
          roll,
          label: cleanLabel(label),
          ts: Date.now(),
        };
        manager.addMessage(room, message);
        broadcastAll('chat:message', message);
      } catch (e) {
        socket.emit('chat:error', e instanceof DiceParseError ? e.message : 'Не удалось распознать бросок');
      }
    });

    ctx.on('dice:attack', ({ tokenId, targetId, attackIndex, advantage }) => {
      if (!ctx.playerId) return;
      const room = getRoom();
      if (!room) return;
      const player = room.players.find((p) => p.id === ctx.playerId);
      const author = player?.name ?? '?';

      let attacks: AttackEntry[] | undefined;
      let prefix: string | undefined;
      let attacker: Token | null = null;
      let attackerMapId: string | null = null;
      if (typeof tokenId === 'string' && tokenId) {
        let found: { mapId: string; token: Token } | null = null;
        for (const map of room.scene.maps) {
          const token = map.tokens.find((t) => t.id === tokenId);
          if (token) {
            found = { mapId: map.id, token };
            break;
          }
        }
        if (!found) return;
        if (!isDm() && !manager.controlsToken(room, found.mapId, ctx.playerId, found.token)) return;
        const isCharacter = room.controllers[ctx.playerId] === found.token.libraryItemId;
        attacks = isCharacter ? room.sheets[ctx.playerId]?.attacks : found.token.attacks;
        prefix = found.token.name;
        attacker = found.token;
        attackerMapId = found.mapId;
      } else {
        attacks = room.sheets[ctx.playerId]?.attacks;
      }
      if (!attacks) return;
      const index = Math.round(Number(attackIndex));
      if (!Number.isFinite(index) || index < 0 || index >= attacks.length) return;
      const entry = attacks[index];
      if (!entry) return;

      let distanceFeet = 0;
      let hasTarget = false;
      let forcedDisadvantage = false;
      let disadvantageReason: string | undefined;
      let targetTok: Token | null = null;
      let targetMapId: string | null = null;
      if (typeof targetId === 'string' && targetId) {
        for (const map of room.scene.maps) {
          const t = map.tokens.find((x) => x.id === targetId);
          if (t) {
            targetTok = t;
            targetMapId = map.id;
            break;
          }
        }
      }
      if (attacker && attackerMapId && targetTok && targetMapId === attackerMapId && targetTok.id !== attacker.id) {
        const map = room.scene.maps.find((m) => m.id === attackerMapId);
        if (map) {
          const size = room.scene.grid.size || 50;
          distanceFeet = gridDistanceFeet(attacker, targetTok, size);
          const adjacentEnemy = map.tokens.some(
            (t) => t.id !== attacker.id && t.isPlayerToken === false && gridDistanceFeet(attacker, t, size) <= 5
          );
          const range = attackRange(entry, distanceFeet, adjacentEnemy);
          if (range.outOfRange) {
            socket.emit('chat:error', `${range.reason ?? 'Вне зоны'}: ${Math.round(distanceFeet)} фт`);
            return;
          }
          forcedDisadvantage = range.disadvantage;
          disadvantageReason = range.disadvantageReason;
          hasTarget = true;
        }
      }

      const { hit, damage } = weaponRolls(entry, prefix);
      if (!hit && !damage) return;
      const suffix = hasTarget ? ` · ${Math.round(distanceFeet)} фт` : '';
      const disNote = forcedDisadvantage && disadvantageReason ? ` (помеха: ${disadvantageReason})` : '';
      if (hit) hit.label += suffix + disNote;
      if (damage) damage.label += suffix + disNote;

      let adv: 'a' | 'd' | undefined = advantage === 'a' || advantage === 'd' ? advantage : undefined;
      if (forcedDisadvantage) adv = adv === 'a' ? undefined : 'd';

      const targetAc = targetTok ? statNumber(targetTok.ac) : 0;

      try {
        let crit = false;
        let hitSuccess: boolean | undefined;
        if (hit) {
          const hitRoll = rollDice(withAdvantage(hit.expression, adv));
          crit = isCriticalHit(hitRoll);
          if (targetAc > 0) {
            hitSuccess = resolveAttack(hitRoll.total, crit, isCriticalFail(hitRoll), targetAc);
            hit.label += hitSuccess ? ' — Попал' : ' — Промах';
          }
          const hitMessage: ChatMessage = {
            id: randomUUID(),
            kind: 'roll',
            author,
            roll: hitRoll,
            label: cleanLabel(hit.label),
            ts: Date.now(),
          };
          manager.addMessage(room, hitMessage);
          broadcastAll('chat:message', hitMessage);
        }
        if (damage && hitSuccess !== false) {
          const damageRoll = rollDice(damage.expression, Math.random, { doubleDice: crit });
          const damageMessage: ChatMessage = {
            id: randomUUID(),
            kind: 'roll',
            author,
            roll: damageRoll,
            label: cleanLabel(damage.label),
            crit,
            ts: Date.now(),
          };
          manager.addMessage(room, damageMessage);
          broadcastAll('chat:message', damageMessage);

          if (targetTok && targetMapId && statNumber(targetTok.hpMax) > 0) {
            targetTok.hpCurrent = Math.max(0, targetTok.hpCurrent - damageRoll.total);
            manager.saveSoon(room);
            emitToken(room, 'token:update', targetMapId, targetTok);
          }
        }
      } catch (e) {
        socket.emit('chat:error', e instanceof DiceParseError ? e.message : 'Не удалось распознать бросок');
      }
    });

}
