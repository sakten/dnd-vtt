import {
  applyDamageDefenses,
  applyDamageToParts,
  damageLinks,
  gridDistanceFeet,
  healBlocked,
  retaliationOf,
  rollDice,
  statNumber,
  type DamagePartAmount,
  type DiceRollResult,
  type EffectInstance,
  type RollLabelParams,
  type Token,
} from 'shared';
import { controllerIdOfToken, gridSizeOfMap } from '../rooms';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { actorStats } from '../room/actor';
import { runAbilityTriggers } from './abilityTriggers';
import { removeBrokenEffects } from './effectsApply';
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

/** Resistance: первый подходящий по типу урона заряд снижения у цели. */
function damageReductionFor(
  target: Token,
  damageTypes: string[]
): { effect: EffectInstance; type: string } | undefined {
  for (const effect of target.effects) {
    const reduce = effect.damageReduce;
    if (!reduce || (effect.charges?.remaining ?? 0) <= 0) continue;
    const type = damageTypes.find((t) => reduce.types.includes(t));
    if (type) return { effect, type };
  }
  return undefined;
}

/** Ключ текущего хода карты (round:entryId) для «раз за ход»; вне боя — null. */
function currentTurnKey(ctx: ConnCtx, room: Room, mapId: string | null): string | null {
  const map = mapId ? ctx.manager.findMap(room, mapId) : undefined;
  const combat = map?.combat;
  if (!combat?.active || combat.currentIndex < 0) return null;
  const entry = combat.entries[combat.currentIndex];
  return entry ? `${combat.round}:${entry.id}` : null;
}

/** Elemental Bane: эффект носителя, чей тип есть в уроне и не срабатывал в текущем ходу. */
function elementalBaneFor(
  target: Token,
  damageTypes: string[],
  turn: string | null
): EffectInstance | undefined {
  for (const effect of target.effects) {
    const bane = effect.elementalBane;
    if (bane && bane.usedTurn !== turn && damageTypes.includes(bane.damageType)) return effect;
  }
  return undefined;
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
  const adjusted = input.unreducible
    ? { amount: groups.reduce((sum, g) => sum + g.amount, 0), note: undefined }
    : applyDamageToParts(groups, defenses);
  const groupTypes = groups.map((g) => g.damageType).filter((t): t is string => !!t);
  const reduction = !input.unreducible && input.kind !== 'heal' && target ? damageReductionFor(target, groupTypes) : undefined;
  let reducedBy = 0;
  if (reduction) {
    reducedBy = rollDice(reduction.effect.damageReduce!.dice).total;
    const charges = reduction.effect.charges;
    if (charges) charges.remaining = Math.max(0, charges.remaining - 1);
  }
  let amount = Math.max(0, (input.halve ? Math.floor(adjusted.amount / 2) : adjusted.amount) - reducedBy);

  if (input.roll && input.author && input.params) {
    pushRollMessage(ctx, room, {
      author: input.author,
      roll: input.roll,
      kind: input.kind ?? 'damage',
      params: { ...input.params, damageNote: adjusted.note },
      crit: input.crit,
    });
  }

  if (reduction) {
    if (mapId) ctx.emitToken(room, 'token:update', mapId, target!);
    ctx.systemMessage(room, {
      code: 'automation.damageReduce',
      params: { name: target!.name, amount: reducedBy, type: reduction.type },
    });
  }

  // Elemental Bane: первый урон выбранного типа за ход — доп. кости того же типа.
  const turn = currentTurnKey(ctx, room, mapId);
  const bane = target && input.kind !== 'heal' && amount > 0 ? elementalBaneFor(target, groupTypes, turn) : undefined;
  if (bane && target) {
    const baneRoll = rollDice(bane.elementalBane!.dice);
    const defense = input.unreducible
      ? { amount: baneRoll.total }
      : applyDamageDefenses(baneRoll.total, bane.elementalBane!.damageType, defenses);
    amount += defense.amount;
    bane.elementalBane!.usedTurn = turn;
    const source = bane.sourceId ? ctx.manager.locateToken(room, bane.sourceId)?.token : undefined;
    pushRollMessage(ctx, room, {
      author: source?.name ?? bane.name,
      roll: baneRoll,
      kind: 'damage',
      params: {
        subject: `${bane.name} · ${target.name}`,
        damageType: bane.elementalBane!.damageType,
        damageNote: defense.note,
      },
    });
  }

  // Chill Touch: носитель не восстанавливает HP, пока эффект жив.
  if (input.kind === 'heal' && target && healBlocked(target.effects)) {
    ctx.systemMessage(room, { code: 'automation.healBlocked', params: { name: target.name } });
    return { amount: 0, applied: false };
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
    // Warding Bond: цель получила урон — источник получает столько же (кроме неуменьшаемого).
    if (!input.unreducible) transferLinkedDamage(ctx, room, mapId, target, amount);
    // Триггеры монстра: «при получении урона» — на каждый урон, «при смерти» — переход HP к 0.
    runAbilityTriggers(ctx, room, mapId, target, 'takeDamage');
    if (hpBefore > 0 && (target.hpCurrent ?? 0) <= 0) runAbilityTriggers(ctx, room, mapId, target, 'death');
    // Носитель эффекта с `breakOn:'damage'` нанёс урон — эффект обрывается (Sanctuary).
    if (input.attacker && input.attacker.id !== target.id) {
      removeBrokenEffects(ctx, room, mapId, input.attacker, 'damage');
    }
    // Ответный урон атакующему в ближнем бою (Armor of Agathys и подобные).
    const attacker = input.attacker;
    if (input.melee && attacker && attacker.id !== target.id && tempBefore > 0) {
      const retaliation = retaliationOf(target.effects);
      const retaliationAmount = retaliation?.dice
        ? rollDice(retaliation.dice).total
        : retaliation?.amount ?? 0;
      if (retaliation && retaliationAmount > 0) {
        applyDamage(ctx, {
          target: attacker,
          mapId,
          amount: retaliationAmount,
          damageType: retaliation.damageType,
          // Ответку наносит носитель — его `breakOn:'damage'` (Sanctuary) срабатывает.
          attacker: target,
        });
        ctx.systemMessage(room, {
          code: 'automation.retaliate',
          params: {
            name: target.name,
            target: attacker.name,
            amount: retaliationAmount,
            type: retaliation.damageType,
          },
        });
      }
    }
  }
  return { amount, applied: true };
}
