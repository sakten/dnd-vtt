import { abilityMod, absorbTypesOf, isIncapacitated, rollDice, superiorityDie, type ReactionOption, type Token } from 'shared';
import type { Room } from '../../roomTypes';
import type { ConnCtx } from '../context';
import { withinFeet } from '../../rooms';
import { availableChoiceRiders } from '../attackRiders';
import {
  applyWeaponAttackDamage,
  prepareWeaponAttack,
  rollPreparedAttack,
  type AttackResolveInput,
  type AttackResolveResult,
  type WeaponAttackPlan,
  type WeaponDamageMods,
} from '../attackResolve';
import { isReactionPending, openReactionWindow, type ReactionOfferInput } from './queue';
import { audienceOf, classLevelOf, diceMax, reactionSlotFree, type ReactionChoice } from './internal';
import {
  applyAttackRollChoices,
  applyCounterAttack,
  applyRollBonusChoices,
  availableFeatureReactions,
  featureOffer,
  featureOption,
  openRedirectWindow,
  preRollOffers,
  rollBonusOffers,
  spendFeatureCost,
} from './features';
import { acBonusOf, applyReactionChoice, reactionSpellOptions } from './spellReactions';

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
      let reduction = rollDice(def.dice ?? '2d6').total;
      if (def.abilityBonus) {
        const abilities = (ctx.manager.abilitiesForToken(room, reactor) ?? {}) as Partial<Record<string, number>>;
        reduction += abilityMod(abilities[def.abilityBonus] ?? 10);
      }
      if (def.levelBonusClass) reduction += classLevelOf(room, reactor, def.levelBonusClass);
      mods.flatReduction = (mods.flatReduction ?? 0) + reduction;
      if (def.redirect) mods.redirect = { reactorId: reactor.id, mapId: choiceMapId };
      ctx.systemMessage(room, `${reactor.name}: ${def.name} (−${reduction} урона)`);
      continue;
    }
    if (def.kind === 'acBonus') {
      const die = superiorityDie(classLevelOf(room, reactor, def.className) || 1);
      const roll = rollDice(`1d${die}`);
      mods.extraAc = (mods.extraAc ?? 0) + roll.total;
      ctx.systemMessage(room, `${reactor.name}: ${def.name} (+${roll.total} к AC)`);
      continue;
    }
    if (def.kind === 'acBonusAlly') {
      const roll = rollDice(def.dice ?? '1d8');
      mods.extraAc = (mods.extraAc ?? 0) + roll.total;
      ctx.systemMessage(room, `${reactor.name}: ${def.name} (+${roll.total} к AC)`);
    }
  }
  return mods;
}

/** Окно «получен урон»: Hellish Rebuke и подобные (после списания HP). */
function offerDamageReactions(ctx: ConnCtx, room: Room, mapId: string, target: Token, source: Token): void {
  if (isReactionPending(room.code)) return;
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
    offers: [{ token: target, audience, options }],
    resume: (choices) => {
      const currentRoom = ctx.getRoom();
      if (!currentRoom) return;
      for (const choice of choices) {
        if (!choice.optionId) continue;
        if (choice.optionId.startsWith('feature:')) applyCounterAttack(ctx, currentRoom, choice, source);
        else applyReactionChoice(ctx, currentRoom, choice, [source]);
      }
      ctx.syncCombat(currentRoom, mapId);
    },
  });
}

/** Фазы после броска: промах → attackMiss, попадание → attackHit, затем урон. */
function continueAfterRoll(
  ctx: ConnCtx,
  room: Room,
  input: AttackResolveInput,
  result: AttackResolveResult,
  plan: WeaponAttackPlan
): AttackResolveResult {
  const target = plan.target;
  const targetMapId = plan.targetMapId;

  const applyDamage = (mods: WeaponDamageMods = {}) => {
    const damage = applyWeaponAttackDamage(ctx, plan, mods);
    if (!damage) return;
    result.damageRoll = damage.roll;
    // Отражение атак: полностью погашен удар — окно «перенаправить» (1 фокус).
    if (mods.redirect && damage.roll.total <= (mods.flatReduction ?? 0) && plan.attacker && targetMapId) {
      openRedirectWindow(ctx, room, targetMapId, plan, mods.redirect);
      return;
    }
    if (damage.applied > 0 && target && targetMapId && plan.attacker && !input.ignoreRange) {
      offerDamageReactions(ctx, room, targetMapId, target, plan.attacker);
    }
  };

  // Необязательные наездники атакующего (Ошеломляющий удар): окно после попадания.
  const applyDamageWithRiders = (mods: WeaponDamageMods = {}) => {
    const currentRoom = ctx.getRoom();
    const riders = currentRoom && plan.attacker ? availableChoiceRiders(ctx, currentRoom, plan.attacker) : [];
    if (!riders.length || !plan.attacker || !plan.attackerMapId || !currentRoom) {
      applyDamage(mods);
      return;
    }
    const windowMapId = targetMapId ?? plan.attackerMapId;
    openReactionWindow(ctx, currentRoom, {
      mapId: windowMapId,
      trigger: 'attackHit',
      sourceName: target?.name,
      offers: [
        {
          token: plan.attacker,
          audience: audienceOf(ctx, currentRoom, plan.attackerMapId, plan.attacker),
          options: riders.map((rider) => ({
            id: `rider:${rider.id}`,
            name: rider.name,
            kind: 'feature',
            resourceKey: rider.resourceKey,
            resourceAmount: rider.resourceAmount,
          })),
        },
      ],
      resume: (riderChoices) => {
        const roomAfter = ctx.getRoom();
        if (!roomAfter) return;
        const activated = riderChoices
          .map((choice) => choice.optionId)
          .filter((id): id is string => !!id && id.startsWith('rider:'))
          .map((id) => id.slice('rider:'.length));
        applyDamage({ ...mods, riders: activated });
        ctx.syncCombat(roomAfter, windowMapId);
      },
    });
  };

  // Атака по возможности сама окон не открывает (нет вложенных пауз).
  if (input.ignoreRange) {
    applyDamage();
    return result;
  }

  // Промах: Ответный удар цели (реакция) и Направленный удар (+10; свой — без реакции).
  if (result.hitSuccess === false && target && targetMapId) {
    const melee = plan.attack.rangeType !== 'ranged';
    const features = availableFeatureReactions(room, target, 'attackMiss').filter((def) => def.kind === 'counterAttack');
    const offers: ReactionOfferInput[] = [];
    if (melee && features.length && reactionSlotFree(ctx.manager, room, targetMapId, target)) {
      offers.push({
        token: target,
        audience: audienceOf(ctx, room, targetMapId, target),
        options: features.map((def) => featureOption(def, room, target)),
      });
    }
    offers.push(...rollBonusOffers(ctx, room, plan));
    if (offers.length) {
      const opened = openReactionWindow(ctx, room, {
        mapId: targetMapId,
        trigger: 'attackMiss',
        sourceName: plan.attacker?.name,
        offers,
        resume: (choices) => {
          const currentRoom = ctx.getRoom();
          if (!currentRoom) return;
          for (const choice of choices) {
            if (choice.optionId?.startsWith('feature:')) applyCounterAttack(ctx, currentRoom, choice, plan.attacker);
          }
          const bonus = applyRollBonusChoices(ctx, currentRoom, plan, choices);
          ctx.syncCombat(currentRoom, targetMapId);
          if (bonus > 0) {
            plan.penalty += bonus;
            plan.hitSuccess = true;
            result.hitSuccess = true;
            if (!openHitWindows()) applyDamageWithRiders();
          }
        },
      });
      if (opened) return result;
    }
    return result;
  }

  // Попадание: Shield/черты цели перед уроном (объявление — после промаха тоже зовёт).
  function openHitWindows(): boolean {
    if (!target || !targetMapId || result.hitSuccess !== true || result.crit) return false;
    const ac = ctx.manager.acForToken(room, target);
    const total = result.hitRoll ? result.hitRoll.total + plan.penalty : 0;
    const melee = plan.attack.rangeType !== 'ranged';
    const features = availableFeatureReactions(room, target, 'attackHit').filter((def) => {
      if (def.kind === 'halveDamage') return true;
      if (def.kind === 'reduceDamage') {
        if (!def.redirect) return false;
        return (
          plan.attack.damageType === 'bludgeoning' ||
          plan.attack.damageType === 'piercing' ||
          plan.attack.damageType === 'slashing'
        );
      }
      if (def.kind === 'acBonus') {
        if (!melee) return false;
        return total < ac + superiorityDie(classLevelOf(room, target, def.className) || 1);
      }
      return false;
    });
    const spellOpts = reactionSpellOptions(room, target, 'attackHit').filter((o) => {
      const absorb = absorbTypesOf(o.spellKey ?? '');
      if (absorb.length) return !!plan.attack.damageType && absorb.includes(plan.attack.damageType);
      return total < ac + acBonusOf(o);
    });
    const options: ReactionOption[] = [...spellOpts, ...features.map((def) => featureOption(def, room, target))];
    // Опции защитников-союзников: Щит духов (снижение урона) и Защитный манёвр (+AC).
    const helperOffers: ReactionOfferInput[] = [];
    for (const helper of ctx.manager.findMap(room, targetMapId)?.tokens ?? []) {
      if (helper.id === target.id || helper.id === plan.attacker?.id) continue;
      if (isIncapacitated(helper.conditions)) continue;
      if (!reactionSlotFree(ctx.manager, room, targetMapId, helper)) continue;
      const defs = availableFeatureReactions(room, helper, 'attackHit').filter((def) => {
        if (def.kind !== 'reduceDamage' && def.kind !== 'acBonusAlly') return false;
        if (def.rangeFeet && !withinFeet(room, helper, target, def.rangeFeet)) return false;
        if (def.kind === 'reduceDamage') return total > 0;
        return total < ac + diceMax(def.dice);
      });
      if (!defs.length) continue;
      helperOffers.push(featureOffer(ctx, room, targetMapId, helper, defs));
    }
    const offers: ReactionOfferInput[] = [];
    if (options.length && reactionSlotFree(ctx.manager, room, targetMapId, target)) {
      offers.push({ token: target, audience: audienceOf(ctx, room, targetMapId, target), options });
    }
    offers.push(...helperOffers);
    if (offers.length) {
      const opened = openReactionWindow(ctx, room, {
        mapId: targetMapId,
        trigger: 'attackHit',
        sourceName: plan.attacker?.name,
        offers,
        resume: (choices) => {
          const currentRoom = ctx.getRoom();
          if (!currentRoom) {
            applyDamage();
            return;
          }
          const mods = attackWindowMods(ctx, currentRoom, targetMapId, choices);
          for (const choice of choices) {
            if (choice.optionId?.startsWith('spell:')) {
              applyReactionChoice(ctx, currentRoom, choice, [target], plan.attack.damageType);
            }
          }
          ctx.syncCombat(currentRoom, targetMapId);
          applyDamageWithRiders(mods);
        },
      });
      if (opened) return true;
    }
    return false;
  }

  if (openHitWindows()) return result;
  applyDamageWithRiders();
  return result;
}

/** Атака с окнами: до броска (Warding Flare), после броска (Shield/черты/промах), затем урон. */
export function resolveWeaponAttackWithReactions(ctx: ConnCtx, input: AttackResolveInput): AttackResolveResult {
  const room = ctx.getRoom();
  const prepared = prepareWeaponAttack(ctx, input);
  if (prepared.error) return { error: prepared.error };
  const prep = prepared.prep;
  if (!room || !prep) return {};

  // Окно до броска (attackRoll): Warding Flare и подобные.
  const preOffers = input.ignoreRange ? [] : preRollOffers(ctx, room, prep);
  if (preOffers.length) {
    const holder: AttackResolveResult = {};
    const mapId = prep.input.targetMapId ?? prep.input.attackerMapId ?? '';
    openReactionWindow(ctx, room, {
      mapId,
      trigger: 'attackRoll',
      sourceName: prep.input.attacker?.name,
      offers: preOffers,
      resume: (choices) => {
        const currentRoom = ctx.getRoom();
        const imposed = currentRoom ? applyAttackRollChoices(ctx, currentRoom, prep, choices, mapId) : false;
        const rolled = rollPreparedAttack(ctx, prep, { extraDisadvantage: imposed });
        Object.assign(holder, rolled.result);
        if (rolled.plan) continueAfterRoll(ctx, currentRoom ?? room, prep.input, holder, rolled.plan);
      },
    });
    return holder;
  }

  const rolled = rollPreparedAttack(ctx, prep);
  if (!rolled.plan) return rolled.result;
  return continueAfterRoll(ctx, room, input, rolled.result, rolled.plan);
}
