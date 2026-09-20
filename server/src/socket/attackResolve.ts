import { randomUUID } from 'node:crypto';
import {
  attackRange,
  attackRollParts,
  attackSubject,
  autoCrit,
  canSee,
  characterLevel,
  countAttackAdvantage,
  critRangeFor,
  damageRollParts,
  exhaustionRollPenalty,
  gridDistanceFeet,
  isCriticalFail,
  isCriticalHit,
  modifiedValue,
  proficiencyBonus,
  attackRollExpression,
  resolveAbilityMods,
  resolveAttack,
  rollDice,
  rollMode,
  sightContextOf,
  tokenVisibleFrom,
  weaponRolls,
  withAdvantage,
  withRollParts,
  type AttackEntry,
  type DiceRollResult,
  type ErrorPayload,
  type RollLabelParams,
  type Token,
} from 'shared';
import type { ConnCtx } from './context';
import type { Room } from '../roomTypes';
import { actorStats } from '../room/actor';
import { applyAttackRiders } from './attackRiders';
import { applyDamage } from './damage';
import { fail } from './errors';
import { pushRollMessage } from './messages';
import { misdirectCheck } from './misdirect';
import { maybeRollAnim } from './rollAnim';
import { familiarCannotAttack } from './summons';
import { controllerIdOfToken } from '../rooms';

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
  error?: ErrorPayload;
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
  critMin: number;
}

/**
 * Дистанция/помеха и выражения атаки без броска: окно реакций (`attackRoll`,
 * например Warding Flare) должно открыться до d20.
 */
export function prepareWeaponAttack(
  ctx: ConnCtx,
  input: AttackResolveInput
): { error?: ErrorPayload; prep?: WeaponAttackPrep } {
  const { manager } = ctx;
  const room = ctx.getRoom();
  if (!room) return {};
  const { attacker, attackerMapId, target, targetMapId, attack } = input;
  // Фамильяр (Find Familiar) не атакует без Pact of the Chain.
  if (familiarCannotAttack(attacker)) {
    return { error: { code: 'familiarNoAttack', params: { name: attacker?.name ?? '' } } };
  }
  const attackerControllerId = attacker ? controllerIdOfToken(room, attacker) : undefined;
  const attackerSheet = attackerControllerId ? room.sheets[attackerControllerId] : undefined;
  const critMin = attackerSheet ? critRangeFor(attackerSheet.classes) : 20;
  const proficiency = attackerSheet
    ? proficiencyBonus(characterLevel(attackerSheet.classes) || 1)
    : 2;

  let distanceFeet = 0;
  let hasTarget = false;
  let forcedDisadvantage = false;
  let forcedDisadvantageCode: RollLabelParams['disadvantage'];
  let unseenTarget = false;
  let unseenAttacker = false;

  // Досягаемость: бонус эффекта учитывается только в свой ход (Battering Roots).
  const reachBonus =
    attacker && attackerMapId
      ? (() => {
          const combat = manager.combatOf(room, attackerMapId);
          if (combat?.active && !manager.isActiveToken(room, attackerMapId, attacker.id)) return 0;
          return modifiedValue(0, attacker.effects, 'reach');
        })()
      : 0;

  if (attacker && attackerMapId && target && targetMapId === attackerMapId && target.id !== attacker.id) {
    const map = manager.findMap(room, attackerMapId);
    if (map) {
      const size = map.grid.size || 50;
      distanceFeet = gridDistanceFeet(attacker, target, size);
      if (!input.ignoreRange) {
        const adjacentEnemy = map.tokens.some(
          (t) => t.id !== attacker.id && t.isPlayerToken === false && gridDistanceFeet(attacker, t, size) <= 5
        );
        const range = attackRange(attack, distanceFeet, adjacentEnemy, reachBonus);
        if (range.outOfRange) {
          return {
            error: range.error ?? { code: 'attackOutOfRange', params: { feet: Math.round(distanceFeet) } },
          };
        }
        forcedDisadvantage = range.disadvantage;
        forcedDisadvantageCode = range.disadvantageCode;
      }
      // 5e: атака требует видимой цели — достаточно одной видимой клетки подошвы.
      if (!input.ignoreRange && !tokenVisibleFrom(attacker, target, map.walls, { size, offsetX: map.grid.offsetX, offsetY: map.grid.offsetY })) {
        return { error: { code: 'noClearPath' } };
      }
      hasTarget = true;
      const sight = sightContextOf(map, {
        size,
        offsetX: map.grid.offsetX,
        offsetY: map.grid.offsetY,
      });
      unseenTarget = !canSee(attacker, target, actorStats(room, attacker).senses, sight);
      unseenAttacker = !canSee(target, attacker, actorStats(room, target).senses, sight);
    }
  }

  const { hit: rawHit, damage: rawDamage } = weaponRolls(attack);
  if (!rawHit && !rawDamage) return {};

  // Преимущество/помеха: явный выбор + состояния + эффекты атакующего/цели + дистанция.
  const abilities = attacker ? manager.abilitiesForToken(room, attacker) : undefined;
  // Формулы могут содержать характеристики и бонус владения: d20+str, d20+pb.
  const hit = rawHit ? resolveAbilityMods(rawHit, abilities, proficiency) : '';
  const damage = rawDamage ? resolveAbilityMods(rawDamage, abilities, proficiency) : '';
  const effectParts = attackRollParts(
    attacker?.effects,
    target?.effects,
    {
      rangeType: attack.rangeType,
      attackType: attack.rangeType === 'melee' || attack.rangeType === 'ranged' ? attack.rangeType : undefined,
      weapon: true,
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
    unseenTarget,
    unseenAttacker,
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
  const attackExpr = hit ? withRollParts(attackRollExpression(hit), { flat: effectParts.flat, dice: effectParts.dice }) : '';
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
      critMin,
    },
  };
}

/** Бросок попадания/крита по подготовленным данным + сообщение в чат. */
export function rollPreparedAttack(
  ctx: ConnCtx,
  prep: WeaponAttackPrep,
  opts: { extraDisadvantage?: boolean } = {}
): WeaponAttackRoll {
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
      // Анимация d20 у бросающего — по личному шансу (ничего не ждёт).
      maybeRollAnim(ctx, hitRoll);
      crit =
        isCriticalHit(hitRoll, prep.critMin) ||
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
    fail(ctx, 'badRoll');
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
  /** Снижение урона до применения (Щит духов и подобные). */
  flatReduction?: number;
  /** Прибавка к урону (Боевое вдохновение: кость в урон). */
  extraDamage?: number;
  /** Отражение атак монаха: после полного снижения можно перенаправить (окно). */
  redirect?: { reactorId: string; mapId: string };
  /** Выбранные в окне наездники атакующего (choiceOnHit). */
  riders?: string[];
}

export interface WeaponDamageResult {
  roll: DiceRollResult;
  /** Сколько урона реально ушло в HP (0 — защита/нет учёта HP). */
  applied: number;
}

/** Метка «Свирепый атакующий уже сработал в этом ходу». */
const SAVAGE_MARKER = 'feat:XPHB:savageAttacker:used';

/** Свирепый атакующий: раз в ход перебрасывает кости урона оружия и берёт лучший бросок. */
function savageAttackerRoll(
  ctx: ConnCtx,
  room: Room,
  plan: WeaponAttackPlan,
  expression: string,
  crit: boolean
): DiceRollResult {
  let roll = rollDice(expression, Math.random, { doubleDice: crit });
  const attacker = plan.attacker;
  if (!attacker) return roll;
  const controllerId = controllerIdOfToken(room, attacker);
  const hasFeat = (controllerId ? room.sheets[controllerId]?.choices : undefined)?.some(
    (c) => c.kind === 'feat' && c.key === 'XPHB:savageAttacker'
  );
  if (!hasFeat || attacker.effects.some((e) => e.sourceKey === SAVAGE_MARKER)) return roll;
  const again = rollDice(expression, Math.random, { doubleDice: crit });
  if (again.total > roll.total) roll = again;
  ctx.manager.applyEffect(room, attacker, {
    id: randomUUID(),
    name: 'Свирепый атакующий',
    sourceKey: SAVAGE_MARKER,
    sourceId: attacker.id,
    duration: { type: 'rounds', rounds: 1 },
    modifiers: [],
    hidden: true,
  });
  if (plan.attackerMapId) ctx.emitToken(room, 'token:update', plan.attackerMapId, attacker);
  return roll;
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
  // Mirror Image: попадание может принять образ вместо цели (урона нет).
  if (target && targetMapId && misdirectCheck(ctx, room, targetMapId, target, plan.attacker)) return undefined;

  try {
    const ride = plan.attacker && plan.attackerMapId
      ? applyAttackRiders(ctx, room, plan.attacker, plan.attackerMapId, plan.target, mods.riders)
      : { expr: '', notes: [] };
    for (const note of ride.notes) ctx.systemMessage(room, { code: 'attack.riderNote', params: { note } });
    const fullDamageExpr = ride.expr ? `${damageExpr} + ${ride.expr}` : damageExpr;
    const damageRoll = savageAttackerRoll(ctx, room, plan, fullDamageExpr, crit);
    // Составной урон: части броска по типам; реакции (+/-) идут в основной тип.
    const parts = damageRoll.damageParts.map((part) => ({ ...part }));
    const bonus = (mods.extraDamage ?? 0) - (mods.flatReduction ?? 0);
    if (bonus && parts.length) {
      const main = parts.find((part) => (part.damageType ?? attack.damageType) === attack.damageType) ?? parts[0]!;
      main.amount += bonus;
    }
    const damage = applyDamage(ctx, {
      target,
      mapId: targetMapId,
      amount: Math.max(0, damageRoll.total + (mods.extraDamage ?? 0) - (mods.flatReduction ?? 0)),
      damageType: attack.damageType,
      ...(parts.length ? { parts } : {}),
      halve: mods.halveDamage,
      roll: damageRoll,
      author: plan.author,
      params: baseParams,
      crit,
    });
    return { roll: damageRoll, applied: damage.applied ? damage.amount : 0 };
  } catch {
    fail(ctx, 'badRoll');
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
