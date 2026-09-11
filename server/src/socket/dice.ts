import { randomUUID } from 'node:crypto';
import {
  DiceParseError,
  rollDice,
  rollLabelText,
  type AttackEntry,
  type ChatMessage,
  type RollKind,
  type RollLabelParams,
  type Token,
} from 'shared';
import type { ConnCtx } from './context';
import { resolveWeaponAttack } from './attackResolve';

export function registerDiceHandlers(ctx: ConnCtx) {
  const { socket, manager, getRoom, isDm, broadcastAll, syncCombat, cleanLabel } = ctx;

    ctx.on('dice:roll', ({ expression, label, rollKind, subject }) => {
      if (!ctx.playerId) return;
      const room = getRoom();
      if (!room) return;
      const player = room.players.find((p) => p.id === ctx.playerId);
      const kind: RollKind | undefined = rollKind === 'save' || rollKind === 'check' ? rollKind : undefined;
      const params: RollLabelParams | undefined = kind ? { subject } : undefined;
      try {
        const roll = rollDice(expression);
        const message: ChatMessage = {
          id: randomUUID(),
          kind: 'roll',
          author: player?.name ?? '?',
          roll,
          label: cleanLabel(kind ? rollLabelText(kind, params) : label),
          rollKind: kind,
          labelParams: params,
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

      const result = resolveWeaponAttack(ctx, {
        attacker,
        attackerMapId,
        target: targetTok,
        targetMapId,
        attack: entry,
        prefix,
        advantage,
        author,
      });
      if (result.error) socket.emit('chat:error', result.error);
    });

}
