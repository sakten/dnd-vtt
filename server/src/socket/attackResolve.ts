import { randomUUID } from 'node:crypto';
import {
  attackRange,
  attackSubject,
  gridDistanceFeet,
  isCriticalFail,
  isCriticalHit,
  resolveAttack,
  rollDice,
  rollLabelText,
  statNumber,
  weaponRolls,
  withAdvantage,
  type AttackEntry,
  type ChatMessage,
  type DiceRollResult,
  type RollLabelParams,
  type Token,
} from 'shared';
import type { ConnCtx } from './context';

export interface AttackResolveInput {
  /** Атакующий токен; null — атака только по листу (без токена на карте). */
  attacker: Token | null;
  attackerMapId: string | null;
  target: Token | null;
  targetMapId: string | null;
  attack: AttackEntry;
  prefix?: string;
  advantage?: 'a' | 'd';
  author: string;
}

export interface AttackResolveResult {
  /** Причина, почему атаку нельзя совершить (вне дистанции и т.п.). */
  error?: string;
  hitSuccess?: boolean;
  crit?: boolean;
  hitRoll?: DiceRollResult;
  damageRoll?: DiceRollResult;
}

/**
 * Общая логика атаки оружием: дистанция/помеха → бросок попадания и крит →
 * урон → списание HP цели (через канон монстр/персонаж). Используется и
 * `dice:attack`, и `action:use(attack)`. Экономика действий — на вызывающем.
 */
export function resolveWeaponAttack(ctx: ConnCtx, input: AttackResolveInput): AttackResolveResult {
  const { manager, socket, broadcastAll, emitToken, cleanLabel } = ctx;
  const room = ctx.getRoom();
  if (!room) return {};
  const { attacker, attackerMapId, target, targetMapId, attack, prefix, author } = input;

  let distanceFeet = 0;
  let hasTarget = false;
  let forcedDisadvantage = false;
  let forcedDisadvantageCode: RollLabelParams['disadvantage'];

  if (attacker && attackerMapId && target && targetMapId === attackerMapId && target.id !== attacker.id) {
    const map = manager.findMap(room, attackerMapId);
    if (map) {
      const size = room.scene.grid.size || 50;
      distanceFeet = gridDistanceFeet(attacker, target, size);
      const adjacentEnemy = map.tokens.some(
        (t) => t.id !== attacker.id && t.isPlayerToken === false && gridDistanceFeet(attacker, t, size) <= 5
      );
      const range = attackRange(attack, distanceFeet, adjacentEnemy);
      if (range.outOfRange) {
        return { error: `${range.reason ?? 'Вне зоны'}: ${Math.round(distanceFeet)} фт` };
      }
      forcedDisadvantage = range.disadvantage;
      forcedDisadvantageCode = range.disadvantageCode;
      hasTarget = true;
    }
  }

  const { hit, damage } = weaponRolls(attack);
  if (!hit && !damage) return {};
  const baseParams: RollLabelParams = {
    subject: attackSubject(attack, prefix),
    distanceFeet: hasTarget ? Math.round(distanceFeet) : undefined,
    disadvantage: forcedDisadvantageCode,
  };

  let adv: 'a' | 'd' | undefined = input.advantage === 'a' || input.advantage === 'd' ? input.advantage : undefined;
  if (forcedDisadvantage) adv = adv === 'a' ? undefined : 'd';

  const targetAc = target ? statNumber(target.ac) : 0;
  const result: AttackResolveResult = {};

  try {
    let crit = false;
    let hitSuccess: boolean | undefined;
    if (hit) {
      const hitRoll = rollDice(withAdvantage(hit, adv));
      crit = isCriticalHit(hitRoll);
      if (targetAc > 0) {
        hitSuccess = resolveAttack(hitRoll.total, crit, isCriticalFail(hitRoll), targetAc);
      }
      const params: RollLabelParams = {
        ...baseParams,
        hit: hitSuccess === undefined ? undefined : hitSuccess ? 'hit' : 'miss',
      };
      const hitMessage: ChatMessage = {
        id: randomUUID(),
        kind: 'roll',
        author,
        roll: hitRoll,
        label: cleanLabel(rollLabelText('attack', params)),
        rollKind: 'attack',
        labelParams: params,
        ts: Date.now(),
      };
      manager.addMessage(room, hitMessage);
      broadcastAll('chat:message', hitMessage);
      result.hitRoll = hitRoll;
      result.hitSuccess = hitSuccess;
      result.crit = crit;
    }
    if (damage && hitSuccess !== false) {
      const damageRoll = rollDice(damage, Math.random, { doubleDice: crit });
      const damageMessage: ChatMessage = {
        id: randomUUID(),
        kind: 'roll',
        author,
        roll: damageRoll,
        label: cleanLabel(rollLabelText('damage', baseParams)),
        rollKind: 'damage',
        labelParams: baseParams,
        crit,
        ts: Date.now(),
      };
      manager.addMessage(room, damageMessage);
      broadcastAll('chat:message', damageMessage);
      result.damageRoll = damageRoll;

      if (target && targetMapId) {
        const isCharacter = Object.values(room.controllers).includes(target.libraryItemId);
        if (statNumber(target.hpMax) > 0 || isCharacter) {
          const changed = manager.adjustTokenHp(room, targetMapId, target, -damageRoll.total);
          for (const c of changed) emitToken(room, 'token:update', c.mapId, c.token);
          broadcastAll('players:update', manager.toState(room).players);
        }
      }
    }
  } catch {
    socket.emit('chat:error', 'Не удалось распознать бросок');
  }

  return result;
}
