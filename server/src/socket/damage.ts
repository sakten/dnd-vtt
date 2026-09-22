import {
  applyDamageToParts,
  statNumber,
  type DamagePartAmount,
  type DiceRollResult,
  type RollLabelParams,
  type Token,
} from 'shared';
import { controllerIdOfToken } from '../rooms';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
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
}

/** Есть ли у токена учёт HP: свои max HP или ресурсы персонажа-контролёра. */
export function hasHpTracking(room: Room, token: Token): boolean {
  return statNumber(token.hpMax) > 0 || controllerIdOfToken(room, token) !== undefined;
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
  ctx.applyHp(room, mapId, target, input.kind === 'heal' ? amount : -amount, { crit: input.crit });
  checkSummonDeath(ctx, room, mapId, target);
  if (input.kind !== 'heal') {
    // Триггеры монстра: «при получении урона» — на каждый урон, «при смерти» — переход HP к 0.
    runAbilityTriggers(ctx, room, mapId, target, 'takeDamage');
    if (hpBefore > 0 && (target.hpCurrent ?? 0) <= 0) runAbilityTriggers(ctx, room, mapId, target, 'death');
  }
  return { amount, applied: true };
}
