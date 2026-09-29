import {
  applyDamageToParts,
  healBlocked,
  retaliationOf,
  rollDice,
  statNumber,
  type DamagePartAmount,
  type DiceRollResult,
  type RollLabelParams,
  type Token,
} from 'shared';
import { controllerIdOfToken } from '../rooms';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { actorStats } from '../room/actor';
import { afterDamage, beforeDamage, type DamageEvent } from './triggers';
import { pushRollMessage } from './messages';
import { checkSummonDeath } from './summons';

export interface DamageApplication {
  /** Итог после защит и половины. */
  amount: number;
  /** Ушло ли в HP (false — у цели нет учёта HP или урона не осталось). */
  applied: boolean;
}

/** Единственный тип урона из списка; undefined — типов нет или больше одного. */
export function singleDamageType(types: string[] | undefined): string | undefined {
  return types && types.length === 1 ? types[0] : undefined;
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
  /** Урон нельзя уменьшить: защиты, Resistance и перенос Warding Bond пропускаются. */
  unreducible?: boolean;
}

/** Есть ли у токена учёт HP: свои max HP или ресурсы персонажа-контролёра. */
export function hasHpTracking(room: Room, token: Token): boolean {
  return statNumber(token.hpMax) > 0 || controllerIdOfToken(room, token) !== undefined;
}

/**
 * Единая точка урона/лечения: защиты → половина → карточка → триггеры (`damaged`:
 * снижение/бейн до HP, перенос/обрыв после) → HP по гейту учёта. Ручные правки HP
 * мастера (`token:hp`) идут мимо события урона и триггеров не зажигают.
 */
export function applyDamage(ctx: ConnCtx, input: ApplyDamageInput): DamageApplication {
  const room = ctx.getRoom();
  if (!room) return { amount: 0, applied: false };
  const { target, mapId, damageType } = input;
  const kind = input.kind ?? 'damage';

  const defenses = target ? ctx.manager.damageDefensesForToken(room, target) : [];
  const groups =
    kind === 'heal' || !input.parts?.length
      ? [{ amount: input.amount, ...(damageType ? { damageType } : {}) }]
      : input.parts.map((part) => ({
          amount: part.amount,
          ...(part.damageType ?? damageType ? { damageType: part.damageType ?? damageType } : {}),
        }));
  const adjusted = input.unreducible
    ? { amount: groups.reduce((sum, g) => sum + g.amount, 0), note: undefined }
    : applyDamageToParts(groups, defenses);
  const groupTypes = groups.map((g) => g.damageType).filter((t): t is string => !!t);
  const baseAmount = input.halve ? Math.floor(adjusted.amount / 2) : adjusted.amount;

  // Событие урона: фаза `before` (снижение Resistance, Elemental Bane) до применения HP.
  const event: DamageEvent | null = target
    ? {
        target,
        mapId: mapId ?? '',
        attacker: input.attacker,
        melee: input.melee,
        unreducible: input.unreducible,
        defenses,
        groups,
        groupTypes,
        amount: Math.max(0, baseAmount),
        note: adjusted.note,
        hpBefore: target.hpCurrent ?? 0,
        tempBefore: actorStats(room, target).hp.temp,
        roll: input.roll,
        author: input.author,
        params: input.params,
        crit: input.crit,
      }
    : null;

  if (kind !== 'heal' && event) {
    beforeDamage(ctx, room, event);
  } else if (input.roll && input.author && input.params) {
    pushRollMessage(ctx, room, {
      author: input.author,
      roll: input.roll,
      kind,
      params: { ...input.params, damageNote: adjusted.note },
      crit: input.crit,
    });
  }
  const amount = event ? event.amount : Math.max(0, baseAmount);

  // Chill Touch: носитель не восстанавливает HP, пока эффект жив.
  if (kind === 'heal' && target && healBlocked(target.effects)) {
    ctx.systemMessage(room, { code: 'automation.healBlocked', params: { name: target.name } });
    return { amount: 0, applied: false };
  }

  if (!target || !mapId || amount <= 0 || !hasHpTracking(room, target)) {
    return { amount, applied: false };
  }
  // Применение HP: hp-level триггеры (wake/Death Ward/repeatSave) зажигаются событием урона.
  ctx.applyHp(room, mapId, target, kind === 'heal' ? amount : -amount, {
    crit: input.crit,
    damageEvent: kind !== 'heal',
  });
  checkSummonDeath(ctx, room, mapId, target);
  if (kind !== 'heal' && event) {
    afterDamage(ctx, room, event);
    // Ответный урон атакующему в ближнем бою (Armor of Agathys и подобные).
    const attacker = input.attacker;
    if (input.melee && attacker && attacker.id !== target.id && event.tempBefore > 0) {
      const retaliation = retaliationOf(target.effects);
      const retaliationAmount = retaliation?.dice ? rollDice(retaliation.dice).total : retaliation?.amount ?? 0;
      if (retaliation && retaliationAmount > 0) {
        applyDamage(ctx, {
          target: attacker,
          mapId,
          amount: retaliationAmount,
          damageType: retaliation.damageType,
          // Ответку наносит носитель — его триггер `ownDamageDealt` (Sanctuary) срабатывает.
          attacker: target,
        });
        ctx.systemMessage(room, {
          code: 'automation.retaliate',
          params: {
            name: target.name,
            target: attacker.name,
            amount: retaliationAmount,
            type: retaliation.damageType ?? '',
          },
        });
      }
    }
  }
  return { amount, applied: true };
}
