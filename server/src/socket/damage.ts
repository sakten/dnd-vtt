import {
  applyDamageToParts,
  damageLinks,
  gridDistanceFeet,
  retaliationOf,
  statNumber,
  type DamagePartAmount,
  type DiceRollResult,
  type RollLabelParams,
  type Token,
} from 'shared';
import { controllerIdOfToken, gridSizeOfMap } from '../rooms';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { actorStats } from '../room/actor';
import { runAbilityTriggers } from './abilityTriggers';
import { pushRollMessage } from './messages';
import { checkSummonDeath } from './summons';

export interface DamageApplication {
  /** Итог после защит и половины. */
  amount: number;
  /** Ушло ли в HP (false — у цели нет учёта HP или урона не осталось). */
  applied: boolean;
}

export interface ApplyDamageInput {
  target: Token | null;
  mapId: string | null;
  /** Урон до защит; для лечения — положительное число. */
  amount: number;
  damageType?: string;
  /** Разбивка составного урона по типам; части без типа наследуют `damageType`. */
  parts?: DamagePartAmount[];
  /** Половина после защит (успешный спасбросок, Невероятное уклонение). */
  halve?: boolean;
  /** Сообщение в чат — только когда переданы roll, author и params. */
  roll?: DiceRollResult;
  author?: string;
  kind?: 'damage' | 'heal';
  params?: RollLabelParams;
  crit?: boolean;
  /** Атакующий (для ответных триггеров цели: Armor of Agathys). */
  attacker?: Token;
  /** Ближняя атака — ответный урон срабатывает. */
  melee?: boolean;
}

/** Есть ли у токена учёт HP: свои max HP или ресурсы персонажа-контролёра. */
export function hasHpTracking(room: Room, token: Token): boolean {
  return statNumber(token.hpMax) > 0 || controllerIdOfToken(room, token) !== undefined;
}

/** Снимает все связи Warding Bond, ведущие на павшего/исчезнувшего источника. */
function dropDamageLinks(ctx: ConnCtx, room: Room, sourceId: string): void {
  for (const map of room.scene.maps) {
    for (const token of map.tokens) {
      for (const effect of [...token.effects]) {
        if (effect.damageLink?.tokenId !== sourceId) continue;
        if (ctx.manager.removeEffect(room, token, effect.id)) ctx.emitToken(room, 'token:update', map.id, token);
      }
    }
  }
}

/** Warding Bond: урон носителя переносится на источник тем же количеством (без защит, ≤60 фт). */
function transferLinkedDamage(ctx: ConnCtx, room: Room, mapId: string, target: Token, amount: number): void {
  const sourceIds = damageLinks(target.effects);
  if (!sourceIds.length) return;
  const mapInfo = ctx.manager.findMap(room, mapId);
  if (!mapInfo) return;
  const grid = gridSizeOfMap(mapInfo);
  for (const sourceId of sourceIds) {
    const effect = target.effects.find((e) => e.damageLink?.tokenId === sourceId);
    if (!effect) continue;
    const drop = (): void => {
      if (ctx.manager.removeEffect(room, target, effect.id)) ctx.emitToken(room, 'token:update', mapId, target);
    };
    const located = ctx.manager.locateToken(room, sourceId);
    if (!located || located.mapId !== mapId || gridDistanceFeet(target, located.token, grid) > 60) {
      drop();
      continue;
    }
    ctx.applyHp(room, located.mapId, located.token, -amount);
    if ((located.token.hpCurrent ?? 0) <= 0) dropDamageLinks(ctx, room, sourceId);
  }
}

/**
 * Единая точка урона/лечения: защиты → половина → сообщение → HP по гейту учёта.
 * Заменяет четыре копии «roll → defenses → applyHp» в атаках и заклинаниях.
 */
export function applyDamage(ctx: ConnCtx, input: ApplyDamageInput): DamageApplication {
  const room = ctx.getRoom();
  if (!room) return { amount: 0, applied: false };
  const { target, mapId, damageType } = input;

  const defenses = target ? ctx.manager.damageDefensesForToken(room, target) : [];
  const groups =
    input.kind === 'heal' || !input.parts?.length
      ? [{ amount: input.amount, ...(damageType ? { damageType } : {}) }]
      : input.parts.map((part) => ({ amount: part.amount, ...(part.damageType ?? damageType ? { damageType: part.damageType ?? damageType } : {}) }));
  const adjusted = applyDamageToParts(groups, defenses);
  const amount = input.halve ? Math.floor(adjusted.amount / 2) : adjusted.amount;

  if (input.roll && input.author && input.params) {
    pushRollMessage(ctx, room, {
      author: input.author,
      roll: input.roll,
      kind: input.kind ?? 'damage',
      params: { ...input.params, damageNote: adjusted.note },
      crit: input.crit,
    });
  }

  if (!target || !mapId || amount <= 0 || !hasHpTracking(room, target)) {
    return { amount, applied: false };
  }
  const hpBefore = target.hpCurrent ?? 0;
  // Armor of Agathys: ответка — если врем. HP были в момент попадания (снапшот до урона).
  const tempBefore = actorStats(room, target).hp.temp;
  ctx.applyHp(room, mapId, target, input.kind === 'heal' ? amount : -amount, { crit: input.crit });
  checkSummonDeath(ctx, room, mapId, target);
  if (input.kind !== 'heal') {
    // Warding Bond: цель получила урон — источник получает столько же.
    transferLinkedDamage(ctx, room, mapId, target, amount);
    // Триггеры монстра: «при получении урона» — на каждый урон, «при смерти» — переход HP к 0.
    runAbilityTriggers(ctx, room, mapId, target, 'takeDamage');
    if (hpBefore > 0 && (target.hpCurrent ?? 0) <= 0) runAbilityTriggers(ctx, room, mapId, target, 'death');
    // Ответный урон атакующему в ближнем бою (Armor of Agathys и подобные).
    const attacker = input.attacker;
    if (input.melee && attacker && attacker.id !== target.id && tempBefore > 0) {
      const retaliation = retaliationOf(target.effects);
      if (retaliation) {
        applyDamage(ctx, {
          target: attacker,
          mapId,
          amount: retaliation.amount,
          damageType: retaliation.damageType,
        });
        ctx.systemMessage(room, {
          code: 'automation.retaliate',
          params: {
            name: target.name,
            target: attacker.name,
            amount: retaliation.amount,
            type: retaliation.damageType,
          },
        });
      }
    }
  }
  return { amount, applied: true };
}
