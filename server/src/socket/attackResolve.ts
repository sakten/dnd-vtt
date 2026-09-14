import {
  applyDamageDefenses,
  attackRange,
  attackRollParts,
  attackSubject,
  autoCrit,
  countAttackAdvantage,
  damageRollParts,
  exhaustionRollPenalty,
  gridDistanceFeet,
  isCriticalFail,
  isCriticalHit,
  resolveAttack,
  rollDice,
  rollMode,
  statNumber,
  weaponRolls,
  withAdvantage,
  withRollParts,
  type AttackEntry,
  type DiceRollResult,
  type RollLabelParams,
  type Token,
} from 'shared';
import type { ConnCtx } from './context';
import { pushRollMessage } from './messages';

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
  /** Атака по возможности: цель уже вышла из досягаемости, дистанцию не проверяем. */
  ignoreRange?: boolean;
}

export interface AttackResolveResult {
  /** Причина, почему атаку нельзя совершить (вне дистанции и т.п.). */
  error?: string;
  hitSuccess?: boolean;
  crit?: boolean;
  hitRoll?: DiceRollResult;
  damageRoll?: DiceRollResult;
}

/** Данные атаки, достаточные для отложенного нанесения урона (после окна реакций). */
export interface WeaponAttackPlan {
  attacker: Token | null;
  attackerMapId: string | null;
  target: Token | null;
  targetMapId: string | null;
  attack: AttackEntry;
  author: string;
  hitRoll?: DiceRollResult;
  hitSuccess: boolean | undefined;
  crit: boolean;
  penalty: number;
  baseParams: RollLabelParams;
  damageExpr: string;
}

export interface WeaponAttackRoll {
  result: AttackResolveResult;
  /** План урона; отсутствует, если атака невозможна/промах без урона. */
  plan?: WeaponAttackPlan;
}

/** Данные атаки, посчитанные до броска (для окна реакций до попадания). */
export interface WeaponAttackPrep {
  input: AttackResolveInput;
  hasTarget: boolean;
  distanceFeet: number;
  advCount: number;
  disCount: number;
  forcedDisadvantageCode?: RollLabelParams['disadvantage'];
  penalty: number;
  baseParams: RollLabelParams;
  targetAc: number;
  attackExpr: string;
  damageExpr: string;
  hasHit: boolean;
  hasDamage: boolean;
}

/**
 * Дистанция/помеха и выражения атаки без броска: окно реакций (`attackRoll`,
 * например Warding Flare) должно открыться до d20.
 */
export function prepareWeaponAttack(
  ctx: ConnCtx,
  input: AttackResolveInput
): { error?: string; prep?: WeaponAttackPrep } {
  const { manager } = ctx;
  const room = ctx.getRoom();
  if (!room) return {};
  const { attacker, attackerMapId, target, targetMapId, attack } = input;

  let distanceFeet = 0;
  let hasTarget = false;
  let forcedDisadvantage = false;
  let forcedDisadvantageCode: RollLabelParams['disadvantage'];

  if (attacker && attackerMapId && target && targetMapId === attackerMapId && target.id !== attacker.id) {
    const map = manager.findMap(room, attackerMapId);
    if (map) {
      const size = room.scene.grid.size || 50;
      distanceFeet = gridDistanceFeet(attacker, target, size);
      if (!input.ignoreRange) {
        const adjacentEnemy = map.tokens.some(
          (t) => t.id !== attacker.id && t.isPlayerToken === false && gridDistanceFeet(attacker, t, size) <= 5
        );
        const range = attackRange(attack, distanceFeet, adjacentEnemy);
        if (range.outOfRange) {
          return { error: `${range.reason ?? 'Вне зоны'}: ${Math.round(distanceFeet)} фт` };
        }
        forcedDisadvantage = range.disadvantage;
        forcedDisadvantageCode = range.disadvantageCode;
      }
      hasTarget = true;
    }
  }

  const { hit, damage } = weaponRolls(attack);
  if (!hit && !damage) return {};

  // Преимущество/помеха: явный выбор + состояния + эффекты атакующего/цели + дистанция.
  const abilities = attacker ? manager.abilitiesForToken(room, attacker) : undefined;
  const effectParts = attackRollParts(
    attacker?.effects,
    target?.effects,
    {
      rangeType: attack.rangeType,
      attackType: attack.rangeType === 'melee' || attack.rangeType === 'ranged' ? attack.rangeType : undefined,
    },
    abilities
  );
  const { advantage: advCount, disadvantage: disCount } = countAttackAdvantage({
    explicit: input.advantage,
    attackerConditions: attacker?.conditions,
    targetConditions: target?.conditions,
    rangeType: attack.rangeType,
    forcedDisadvantage,
    effectMode: effectParts.mode,
    includeTarget: hasTarget,
  });

  const penalty = exhaustionRollPenalty(attacker?.conditions);
  const baseParams: RollLabelParams = {
    subject: attackSubject(attack, input.prefix),
    distanceFeet: hasTarget ? Math.round(distanceFeet) : undefined,
    disadvantage: forcedDisadvantageCode,
    damageType: attack.damageType,
    penalty: penalty || undefined,
  };

  const targetAc = target ? manager.acForToken(room, target) : 0;
  const attackExpr = hit ? withRollParts(hit, { flat: effectParts.flat, dice: effectParts.dice }) : '';
  const damageParts = damageRollParts(
    attacker?.effects,
    {
      rangeType: attack.rangeType,
      attackType: attack.rangeType === 'melee' || attack.rangeType === 'ranged' ? attack.rangeType : undefined,
      damageType: attack.damageType,
      targetId: target?.id,
    },
    abilities
  );
  const damageExpr = damage ? withRollParts(damage, damageParts) : '';

  return {
    prep: {
      input,
      hasTarget,
      distanceFeet,
      advCount,
      disCount,
      forcedDisadvantageCode,
      penalty,
      baseParams,
      targetAc,
      attackExpr,
      damageExpr,
      hasHit: !!hit,
      hasDamage: !!damage,
    },
  };
}

/** Бросок попадания/крита по подготовленным данным + сообщение в чат. */
export function rollPreparedAttack(
  ctx: ConnCtx,
  prep: WeaponAttackPrep,
  opts: { extraDisadvantage?: boolean } = {}
): WeaponAttackRoll {
  const { socket } = ctx;
  const room = ctx.getRoom();
  if (!room) return { result: {} };
  const { attacker, attackerMapId, target, targetMapId, attack, author } = prep.input;

  const disCount = prep.disCount + (opts.extraDisadvantage ? 1 : 0);
  const adv = rollMode(prep.advCount, disCount);
  const result: AttackResolveResult = {};

  try {
    let crit = false;
    let hitSuccess: boolean | undefined;
    if (prep.hasHit) {
      const hitRoll = rollDice(withAdvantage(prep.attackExpr, adv));
      crit =
        isCriticalHit(hitRoll) ||
        (prep.hasTarget && !!target && autoCrit(target.conditions, prep.distanceFeet, attack.rangeType));
      if (prep.targetAc > 0) {
        hitSuccess = resolveAttack(hitRoll.total + prep.penalty, crit, isCriticalFail(hitRoll), prep.targetAc);
      }
      const params: RollLabelParams = {
        ...prep.baseParams,
        hit: hitSuccess === undefined ? undefined : hitSuccess ? 'hit' : 'miss',
      };
      pushRollMessage(ctx, room, { author, roll: hitRoll, kind: 'attack', params });
      result.hitRoll = hitRoll;
      result.hitSuccess = hitSuccess;
      result.crit = crit;
    }
    // План отдаём и при промахе: окно после промаха (Riposte) должно успеть сработать,
    // урон в этом случае не наносится (`applyWeaponAttackDamage` вернёт undefined).
    if (prep.hasDamage) {
      return {
        result,
        plan: {
          attacker,
          attackerMapId,
          target,
          targetMapId,
          attack,
          author,
          hitRoll: result.hitRoll,
          hitSuccess,
          crit,
          penalty: prep.penalty,
          baseParams: prep.baseParams,
          damageExpr: prep.damageExpr,
        },
      };
    }
  } catch {
    socket.emit('chat:error', 'Не удалось распознать бросок');
  }

  return { result };
}

/**
 * Бросок атаки оружием: подготовка → бросок. Урон наносит `applyWeaponAttackDamage`
 * (после окна реакций, если оно было).
 */
export function rollWeaponAttack(ctx: ConnCtx, input: AttackResolveInput): WeaponAttackRoll {
  const { error, prep } = prepareWeaponAttack(ctx, input);
  if (error) return { result: { error } };
  if (!prep) return { result: {} };
  return rollPreparedAttack(ctx, prep);
}

/** Модификаторы урона от реакций (Uncanny Dodge, Parry). */
export interface WeaponDamageMods {
  /** Половина урона (Невероятное уклонение). */
  halveDamage?: boolean;
  /** Прибавка к AC при пересчёте попадания (Парирование и т.п.). */
  extraAc?: number;
}

export interface WeaponDamageResult {
  roll: DiceRollResult;
  /** Сколько урона реально ушло в HP (0 — защита/нет учёта HP). */
  applied: number;
}

/** Урон по плану атаки; пересчитывает попадание (реакции могли поднять AC). */
export function applyWeaponAttackDamage(
  ctx: ConnCtx,
  plan: WeaponAttackPlan,
  mods: WeaponDamageMods = {}
): WeaponDamageResult | undefined {
  const { manager } = ctx;
  const room = ctx.getRoom();
  if (!room) return undefined;
  const { target, targetMapId, attack, crit, baseParams, damageExpr } = plan;

  let hitSuccess = plan.hitSuccess;
  if (hitSuccess !== false && plan.hitRoll && target) {
    const ac = manager.acForToken(room, target) + (mods.extraAc ?? 0);
    if (ac > 0) hitSuccess = resolveAttack(plan.hitRoll.total + plan.penalty, crit, false, ac);
  }
  if (hitSuccess === false) return undefined;

  try {
    const damageRoll = rollDice(damageExpr, Math.random, { doubleDice: crit });
    const defenses = target ? manager.damageDefensesForToken(room, target) : [];
    const adjusted = applyDamageDefenses(damageRoll.total, attack.damageType, defenses);
    const amount = mods.halveDamage ? Math.floor(adjusted.amount / 2) : adjusted.amount;
    const damageParams: RollLabelParams = { ...baseParams, damageNote: adjusted.note };
    pushRollMessage(ctx, room, {
      author: plan.author,
      roll: damageRoll,
      kind: 'damage',
      params: damageParams,
      crit,
    });

    let applied = 0;
    if (target && targetMapId && amount > 0) {
      const isCharacter = Object.values(room.controllers).includes(target.libraryItemId);
      if (statNumber(target.hpMax) > 0 || isCharacter) {
        ctx.applyHp(room, targetMapId, target, -amount, { crit });
        applied = amount;
      }
    }
    return { roll: damageRoll, applied };
  } catch {
    ctx.socket.emit('chat:error', 'Не удалось распознать бросок');
    return undefined;
  }
}

/**
 * Общая логика атаки оружием: дистанция/помеха → бросок попадания и крит →
 * урон → списание HP цели (через канон монстр/персонаж). Используется и
 * `dice:attack`, и `action:use(attack)`. Экономика действий — на вызывающем.
 * Окон реакций не открывает; для них есть `resolveWeaponAttackWithReactions`.
 */
export function resolveWeaponAttack(ctx: ConnCtx, input: AttackResolveInput): AttackResolveResult {
  const { result, plan } = rollWeaponAttack(ctx, input);
  if (plan) {
    const damage = applyWeaponAttackDamage(ctx, plan);
    if (damage) result.damageRoll = damage.roll;
  }
  return result;
}
