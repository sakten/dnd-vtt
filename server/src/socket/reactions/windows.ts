import {
  abilityMod,
  absorbTypesOf,
  hostileTokens,
  isIncapacitated,
  rollDice,
  superiorityDie,
  type AttackEntry,
  type DiceRollResult,
  type ReactionOption,
  type Token,
} from 'shared';
import type { Room } from '../../roomTypes';
import type { ConnCtx } from '../context';
import { withinFeet } from '../../rooms';
import type { WeaponDamageMods } from '../attackResolve';
import { applyBonusDieChoices, applyCombatInspirationChoices, bonusDieOptions } from '../bonusDice';
import { pushRollMessage } from '../messages';
import {
  applyCounterAttack,
  applyRollBonusChoices,
  availableFeatureReactions,
  featureOffer,
  featureOption,
  reactionDieExpr,
  rollBonusOffers,
  spendFeatureCost,
} from './features';
import { audienceOf, classLevelOf, diceMax, reactionCanSee, reactionSlotFree, type ReactionChoice } from './internal';
import { openReactionWindow, type ReactionOfferInput } from './queue';
import { acBonusOf, applyReactionChoice, reactionSpellOptions } from './spellReactions';

/**
 * Окна реакций на бросок атаки (R2/R8.8): общий слой для оружия и заклинательных
 * атак. Резолверы передают минимальный план атаки и колбэк продолжения; выбор
 * реакций превращается в бонус к броску / модификаторы урона.
 */

/** Данные атаки, нужные окнам реакций (общие для оружия и заклинаний/способностей). */
export interface AttackWindowPlan {
  attacker: Token | null;
  attackerMapId: string | null;
  target: Token | null;
  targetMapId: string | null;
  damageType?: string;
  rangeType?: AttackEntry['rangeType'];
  hitRoll?: DiceRollResult;
  hitSuccess: boolean | undefined;
  crit: boolean;
  penalty: number;
}

/** Выбранные в окне попадания черты → модификаторы урона (половина/AC/снижение). */
function attackWindowMods(ctx: ConnCtx, room: Room, mapId: string, choices: ReactionChoice[]): WeaponDamageMods {
  const mods: WeaponDamageMods = {};
  for (const choice of choices) {
    if (!choice.optionId?.startsWith('feature:')) continue;
    const id = choice.optionId.slice('feature:'.length);
    const choiceMapId = choice.mapId ?? mapId;
    const reactor = ctx.manager.findToken(room, choiceMapId, choice.tokenId);
    if (!reactor) continue;
    const def = availableFeatureReactions(room, reactor, 'attackHit').find((d) => d.id === id);
    if (!def) continue;
    if (!spendFeatureCost(ctx, room, reactor, choiceMapId, def)) continue;
    if (def.kind === 'halveDamage') {
      mods.halveDamage = true;
      continue;
    }
    if (def.kind === 'reduceDamage') {
      const roll = rollDice(def.dice ?? '2d6');
      let reduction = roll.total;
      if (def.abilityBonus) {
        const abilities = (ctx.manager.abilitiesForToken(room, reactor) ?? {}) as Partial<Record<string, number>>;
        reduction += abilityMod(abilities[def.abilityBonus] ?? 10);
      }
      if (def.levelBonusClass) reduction += classLevelOf(room, reactor, def.levelBonusClass);
      mods.flatReduction = (mods.flatReduction ?? 0) + reduction;
      if (def.redirect) mods.redirect = { reactorId: reactor.id, mapId: choiceMapId };
      pushRollMessage(ctx, room, {
        author: reactor.name,
        roll,
        kind: 'plain',
        params: { subject: `${def.name} (−${reduction} урона)` },
      });
      continue;
    }
    if (def.kind === 'acBonus') {
      const die = superiorityDie(classLevelOf(room, reactor, def.className) || 1);
      const roll = rollDice(`1d${die}`);
      mods.extraAc = (mods.extraAc ?? 0) + roll.total;
      pushRollMessage(ctx, room, {
        author: reactor.name,
        roll,
        kind: 'plain',
        params: { subject: `${def.name} (+${roll.total} к AC)` },
      });
      continue;
    }
    if (def.kind === 'acBonusAlly') {
      const roll = rollDice(def.dice ?? '1d8');
      mods.extraAc = (mods.extraAc ?? 0) + roll.total;
      pushRollMessage(ctx, room, {
        author: reactor.name,
        roll,
        kind: 'plain',
        params: { subject: `${def.name} (+${roll.total} к AC)` },
      });
      continue;
    }
    if (def.kind === 'rollPenalty' || def.kind === 'damagePenalty') {
      const expr = reactionDieExpr(def, room, reactor);
      if (!expr) continue;
      const roll = rollDice(expr);
      if (def.kind === 'rollPenalty') {
        mods.extraAc = (mods.extraAc ?? 0) + roll.total;
        pushRollMessage(ctx, room, {
          author: reactor.name,
          roll,
          kind: 'plain',
          params: { subject: `${def.name} (−${roll.total} к атаке)` },
        });
      } else {
        mods.flatReduction = (mods.flatReduction ?? 0) + roll.total;
        pushRollMessage(ctx, room, {
          author: reactor.name,
          roll,
          kind: 'plain',
          params: { subject: `${def.name} (−${roll.total} урона)` },
        });
      }
    }
  }
  return mods;
}

/** Окно «получен урон»: Hellish Rebuke и подобные (после списания HP). */
export function offerDamageReactions(ctx: ConnCtx, room: Room, mapId: string, target: Token, source: Token): void {
  if (isIncapacitated(target.conditions)) return;
  if (!reactionSlotFree(ctx.manager, room, mapId, target)) return;
  const features = availableFeatureReactions(room, target, 'damage').filter((def) => {
    if (def.kind !== 'counterAttack') return false;
    if (def.rangeFeet && !withinFeet(room, target, source, def.rangeFeet)) return false;
    return true;
  });
  const options: ReactionOption[] = [
    ...reactionSpellOptions(room, target, 'damage'),
    ...features.map((def) => featureOption(def, room, target)),
  ];
  if (!options.length) return;
  const audience = audienceOf(ctx, room, mapId, target);
  if (!audience.length) return;
  openReactionWindow(ctx, room, {
    mapId,
    trigger: 'damage',
    sourceName: source.name,
    offers: [
      {
        token: target,
        audience,
        options,
        apply: (choice: ReactionChoice): boolean => {
          const currentRoom = ctx.getRoom();
          if (!choice.optionId || !currentRoom) return true;
          if (choice.optionId.startsWith('feature:')) applyCounterAttack(ctx, currentRoom, choice, source);
          else applyReactionChoice(ctx, currentRoom, choice, [source]);
          return true;
        },
      },
    ],
    done: () => {
      const currentRoom = ctx.getRoom();
      if (currentRoom) ctx.syncCombat(currentRoom, mapId);
    },
  });
}

/** Окно после промаха: Ответный удар цели, Направленный удар (+10) и кости вдохновения. */
export function openAttackMissWindows(
  ctx: ConnCtx,
  room: Room,
  plan: Pick<AttackWindowPlan, 'attacker' | 'attackerMapId' | 'target' | 'targetMapId' | 'rangeType'>,
  onResolved: (outcome: { bonus: number; inspiration: number }) => void
): boolean {
  const { target, targetMapId } = plan;
  if (!target || !targetMapId) return false;
  const melee = plan.rangeType !== 'ranged';
  const features = availableFeatureReactions(room, target, 'attackMiss').filter((def) => def.kind === 'counterAttack');
  const offers: ReactionOfferInput[] = [];
  let bonus = 0;
  let inspiration = 0;
  if (melee && features.length && reactionSlotFree(ctx.manager, room, targetMapId, target)) {
    offers.push({
      token: target,
      audience: audienceOf(ctx, room, targetMapId, target),
      options: features.map((def) => featureOption(def, room, target)),
      apply: (choice: ReactionChoice): boolean => {
        const currentRoom = ctx.getRoom();
        if (currentRoom && choice.optionId) applyCounterAttack(ctx, currentRoom, choice, plan.attacker);
        return true;
      },
    });
  }
  for (const offer of rollBonusOffers(ctx, room, plan)) {
    offers.push({
      ...offer,
      apply: (choice: ReactionChoice): boolean => {
        const currentRoom = ctx.getRoom();
        if (currentRoom) bonus += applyRollBonusChoices(ctx, currentRoom, [choice]);
        return true;
      },
    });
  }
  // Бардовское вдохновение: кости на самом атакующем (без реакции).
  if (plan.attacker && plan.attackerMapId) {
    const dice = bonusDieOptions(plan.attacker);
    if (dice.length) {
      offers.push({
        token: plan.attacker,
        audience: audienceOf(ctx, room, plan.attackerMapId, plan.attacker),
        options: dice,
        apply: (choice: ReactionChoice): boolean => {
          const currentRoom = ctx.getRoom();
          if (currentRoom) inspiration += applyBonusDieChoices(ctx, currentRoom, plan, [choice]);
          return true;
        },
      });
    }
  }
  if (!offers.length) return false;
  return openReactionWindow(ctx, room, {
    mapId: targetMapId,
    trigger: 'attackMiss',
    sourceName: plan.attacker?.name,
    offers,
    done: () => {
      const currentRoom = ctx.getRoom();
      if (!currentRoom) {
        onResolved({ bonus: 0, inspiration: 0 });
        return;
      }
      ctx.syncCombat(currentRoom, targetMapId);
      onResolved({ bonus, inspiration });
    },
  });
}

/** Условия открытия окна попадания: AC и итог броска уже посчитаны резолвером. */
export interface AttackHitWindowInput {
  ac: number;
  total: number;
  melee: boolean;
}

/** Окно попадания: Shield/Absorb/Отражение/Режущие слова у цели и защитников-союзников. */
export function openAttackHitWindows(
  ctx: ConnCtx,
  room: Room,
  plan: Pick<AttackWindowPlan, 'attacker' | 'attackerMapId' | 'target' | 'targetMapId' | 'damageType'>,
  input: AttackHitWindowInput,
  onResolved: (mods: WeaponDamageMods) => void
): boolean {
  const { target, targetMapId } = plan;
  if (!target || !targetMapId) return false;
  const { ac, total, melee } = input;
  const features = availableFeatureReactions(room, target, 'attackHit').filter((def) => {
    if (def.kind === 'halveDamage') return true;
    if (def.kind === 'reduceDamage') {
      // Отражение атак — только когда бьют самого монаха (self), не союзника.
      if (def.targets !== 'self') return false;
      return (
        plan.damageType === 'bludgeoning' || plan.damageType === 'piercing' || plan.damageType === 'slashing'
      );
    }
    if (def.kind === 'acBonus') {
      if (!melee) return false;
      return total < ac + superiorityDie(classLevelOf(room, target, def.className) || 1);
    }
    // Режущие слова носителя (Знание): −кость к атаке врага или к урону.
    if (def.kind === 'rollPenalty' || def.kind === 'damagePenalty') {
      if (!plan.attacker || !hostileTokens(target, plan.attacker)) return false;
      if (def.rangeFeet && !withinFeet(room, target, plan.attacker, def.rangeFeet)) return false;
      if (def.kind === 'damagePenalty') return true;
      const expr = reactionDieExpr(def, room, target);
      return !!expr && total - diceMax(expr) < ac;
    }
    return false;
  });
  const spellOpts = reactionSpellOptions(room, target, 'attackHit').filter((o) => {
    const absorb = absorbTypesOf(o.spellKey ?? '');
    if (absorb.length) return !!plan.damageType && absorb.includes(plan.damageType);
    return total < ac + acBonusOf(o);
  });
  const options: ReactionOption[] = [
    ...spellOpts,
    ...features.map((def) => featureOption(def, room, target)),
    ...bonusDieOptions(target, 'ac'),
  ];
  // Опции защитников-союзников: Щит духов (снижение урона) и Защитный манёвр (+AC).
  const helperOffers: ReactionOfferInput[] = [];
  for (const helper of ctx.manager.findMap(room, targetMapId)?.tokens ?? []) {
    if (helper.id === target.id || helper.id === plan.attacker?.id) continue;
    if (isIncapacitated(helper.conditions)) continue;
    if (!reactionSlotFree(ctx.manager, room, targetMapId, helper)) continue;
    const defs = availableFeatureReactions(room, helper, 'attackHit').filter((def) => {
      // Режущие слова (Знание): кость снимается с атаки/урона врага, дистанция — до атакующего.
      if (def.kind === 'rollPenalty' || def.kind === 'damagePenalty') {
        if (!plan.attacker || !hostileTokens(helper, plan.attacker)) return false;
        if (def.rangeFeet && !withinFeet(room, helper, plan.attacker, def.rangeFeet)) return false;
        if (!reactionCanSee(ctx, room, targetMapId, helper, plan.attacker)) return false;
        if (def.kind === 'damagePenalty') return true;
        const expr = reactionDieExpr(def, room, helper);
        return !!expr && total - diceMax(expr) < ac;
      }
      if (def.kind !== 'reduceDamage' && def.kind !== 'acBonusAlly') return false;
      // Черты защиты себя (Отражение атак) в цикле защитников-союзников не предлагаем.
      if (def.kind === 'reduceDamage' && def.targets !== 'creature') return false;
      if (def.rangeFeet && !withinFeet(room, helper, target, def.rangeFeet)) return false;
      // RAW (Щит духов, Защитный манёвр): существо в пределах дистанции, которое видишь.
      if (!reactionCanSee(ctx, room, targetMapId, helper, target)) return false;
      if (def.kind === 'reduceDamage') return total > 0;
      return total < ac + diceMax(def.dice);
    });
    if (!defs.length) continue;
    helperOffers.push(featureOffer(ctx, room, targetMapId, helper, defs));
  }
  // Боевое вдохновение (Доблесть): кость атакующего в урон — без реакции.
  const attackerOffers: ReactionOfferInput[] = [];
  if (plan.attacker && plan.attackerMapId) {
    const dice = bonusDieOptions(plan.attacker, 'damage');
    if (dice.length) {
      attackerOffers.push({
        token: plan.attacker,
        audience: audienceOf(ctx, room, plan.attackerMapId, plan.attacker),
        options: dice,
      });
    }
  }
  const mods: WeaponDamageMods = {};
  const applyChoice = (choice: ReactionChoice): boolean => {
    const currentRoom = ctx.getRoom();
    if (!choice.optionId || !currentRoom) return true;
    const combat = applyCombatInspirationChoices(ctx, currentRoom, plan, target, [choice]);
    if (combat.extraDamage) mods.extraDamage = (mods.extraDamage ?? 0) + combat.extraDamage;
    if (combat.extraAc) mods.extraAc = (mods.extraAc ?? 0) + combat.extraAc;
    const extra = attackWindowMods(ctx, currentRoom, targetMapId, [choice]);
    if (extra.halveDamage) mods.halveDamage = true;
    if (extra.flatReduction) mods.flatReduction = (mods.flatReduction ?? 0) + extra.flatReduction;
    if (extra.extraAc) mods.extraAc = (mods.extraAc ?? 0) + extra.extraAc;
    if (extra.redirect) mods.redirect = extra.redirect;
    if (choice.optionId.startsWith('spell:')) {
      applyReactionChoice(ctx, currentRoom, choice, [target], plan.damageType);
    }
    return true;
  };
  const offers: ReactionOfferInput[] = [];
  if (options.length && reactionSlotFree(ctx.manager, room, targetMapId, target)) {
    offers.push({
      token: target,
      audience: audienceOf(ctx, room, targetMapId, target),
      options,
      apply: applyChoice,
    });
  }
  for (const offer of helperOffers) offers.push({ ...offer, apply: applyChoice });
  for (const offer of attackerOffers) offers.push({ ...offer, apply: applyChoice });
  if (!offers.length) return false;
  return openReactionWindow(ctx, room, {
    mapId: targetMapId,
    trigger: 'attackHit',
    sourceName: plan.attacker?.name,
    offers,
    done: () => {
      const currentRoom = ctx.getRoom();
      if (!currentRoom) {
        onResolved({});
        return;
      }
      ctx.syncCombat(currentRoom, targetMapId);
      onResolved(mods);
    },
  });
}
