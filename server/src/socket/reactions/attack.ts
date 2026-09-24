import type { Room } from '../../roomTypes';
import type { ConnCtx } from '../context';
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
import { applySmiteChoice, availableSmites } from '../smites';
import { sanctuaryBlocks } from '../sanctuary';
import { openReactionWindow } from './queue';
import { audienceOf, type ReactionChoice } from './internal';
import { applyAttackRollChoices, openRedirectWindow, preRollOffers } from './features';
import { offerDamageReactions, openAttackHitWindows, openAttackMissWindows } from './windows';

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
  const windowPlan = {
    attacker: plan.attacker,
    attackerMapId: plan.attackerMapId,
    target,
    targetMapId,
    damageType: plan.attack.damageType,
    rangeType: plan.attack.rangeType,
  };

  const applyDamage = (mods: WeaponDamageMods = {}) => {
    // Наездник заклинания (Green-Flame Blade) суммируется со смайтом из окна.
    const combined: WeaponDamageMods = input.riderDice
      ? { ...mods, smiteDice: [mods.smiteDice, input.riderDice].filter(Boolean).join(' + ') }
      : mods;
    const damage = applyWeaponAttackDamage(ctx, plan, combined);
    if (!damage) return;
    result.damageRoll = damage.roll;
    input.afterHit?.(damage);
    // Отражение атак: полностью погашен удар — окно «перенаправить» (1 фокус).
    if (mods.redirect && damage.roll.total <= (mods.flatReduction ?? 0) && plan.attacker && targetMapId) {
      openRedirectWindow(ctx, room, targetMapId, plan, mods.redirect);
      return;
    }
    if (damage.applied > 0 && target && targetMapId && plan.attacker) {
      offerDamageReactions(ctx, room, targetMapId, target, plan.attacker, {
        amount: damage.applied,
        damageType: plan.attack.damageType,
      });
    }
  };

  // Необязательные наездники и смайты атакующего (Ошеломляющий удар, Searing/Ensnaring): окно после попадания.
  const applyDamageWithRiders = (mods: WeaponDamageMods = {}) => {
    const currentRoom = ctx.getRoom();
    const riders = currentRoom && plan.attacker ? availableChoiceRiders(ctx, currentRoom, plan.attacker, plan.attack) : [];
    const smites =
      currentRoom && plan.attacker
        ? availableSmites(
            ctx,
            currentRoom,
            plan.attackerMapId ?? targetMapId ?? '',
            plan.attacker,
            plan.attack,
            plan.attack.rangeType !== 'ranged'
          )
        : [];
    if ((!riders.length && !smites.length) || !plan.attacker || !plan.attackerMapId || !currentRoom) {
      applyDamage(mods);
      return;
    }
    const windowMapId = targetMapId ?? plan.attackerMapId;
    const activated: string[] = [];
    let smiteDice = '';
    openReactionWindow(ctx, currentRoom, {
      mapId: windowMapId,
      trigger: 'attackHit',
      sourceName: target?.name,
      offers: [
        {
          token: plan.attacker,
          audience: audienceOf(ctx, currentRoom, plan.attackerMapId, plan.attacker),
          options: [
            ...riders.map((rider) => ({
              id: `rider:${rider.id}`,
              name: rider.name,
              kind: 'feature' as const,
              resourceKey: rider.resourceKey,
              resourceAmount: rider.resourceAmount,
            })),
            ...smites.map((smite) => ({
              id: smite.id,
              name: smite.name,
              kind: 'spell' as const,
              spellKey: smite.spellKey,
            })),
          ],
          apply: (choice: ReactionChoice): boolean => {
            const roomAfter = ctx.getRoom();
            if (!choice.optionId || !roomAfter) return true;
            if (choice.optionId.startsWith('rider:')) {
              activated.push(choice.optionId.slice('rider:'.length));
              return true;
            }
            if (choice.optionId.startsWith('smite:') && plan.attacker && target && targetMapId) {
              const applied = applySmiteChoice(ctx, roomAfter, targetMapId, plan.attacker, target, choice.optionId);
              if (applied?.dice) smiteDice = smiteDice ? `${smiteDice} + ${applied.dice}` : applied.dice;
            }
            return true;
          },
        },
      ],
      done: () => {
        const roomAfter = ctx.getRoom();
        if (!roomAfter) return;
        applyDamage({ ...mods, riders: activated, ...(smiteDice ? { smiteDice } : {}) });
        ctx.syncCombat(roomAfter, windowMapId);
      },
    });
  };

  // Атака по возможности не проверяет дистанцию, но окна реакций открывает как обычная:
  // вложенные паузы (промах/попадание) отыгрывают до продолжения очереди реакций.
  const openHitWindows = (): boolean => {
    if (!target || !targetMapId || result.hitSuccess !== true || result.crit) return false;
    const ac = ctx.manager.acForToken(room, target);
    const total = result.hitRoll ? result.hitRoll.total + plan.penalty : 0;
    return openAttackHitWindows(
      ctx,
      room,
      windowPlan,
      { ac, total, melee: plan.attack.rangeType !== 'ranged' },
      (mods) => applyDamageWithRiders(mods)
    );
  };

  // Промах: Ответный удар цели (реакция), Направленный удар (+10) и кости вдохновения.
  if (result.hitSuccess === false && target && targetMapId) {
    const opened = openAttackMissWindows(ctx, room, windowPlan, ({ bonus, inspiration }) => {
      const currentRoom = ctx.getRoom();
      if (!currentRoom) {
        applyDamage();
        return;
      }
      if (bonus + inspiration > 0) {
        plan.penalty += bonus + inspiration;
        plan.hitSuccess = true;
        result.hitSuccess = true;
        if (!openHitWindows()) applyDamageWithRiders();
      } else {
        // Graze: промах оружием с мастерством — урон по модификатору характеристики.
        applyWeaponAttackDamage(ctx, plan);
      }
    });
    if (opened) return result;
    // Graze без окна реакций.
    applyWeaponAttackDamage(ctx, plan);
    return result;
  }

  // Попадание: Shield/черты цели перед уроном.
  if (openHitWindows()) return result;
  applyDamageWithRiders();
  return result;
}

/** Атака с окнами: до броска (Warding Flare), после броска (Shield/черты/промах), затем урон. */
export function resolveWeaponAttackWithReactions(
  ctx: ConnCtx,
  input: AttackResolveInput,
  opts: { beforeRoll?: () => boolean } = {}
): AttackResolveResult {
  const room = ctx.getRoom();
  // Sanctuary: защищённая цель заставляет атакующего пройти спас или потерять атаку.
  if (room && sanctuaryBlocks(ctx, room, input.attacker, input.target)) return {};
  const prepared = prepareWeaponAttack(ctx, input);
  if (prepared.error) return { error: prepared.error };
  const prep = prepared.prep;
  if (!room || !prep) return {};

  const rollAndContinue = (extraDisadvantage: boolean): AttackResolveResult => {
    if (opts.beforeRoll && !opts.beforeRoll()) return {};
    const rolled = rollPreparedAttack(ctx, prep, { extraDisadvantage });
    if (!rolled.plan) return rolled.result;
    return continueAfterRoll(ctx, room, input, rolled.result, rolled.plan);
  };

  // Окно до броска (attackRoll): Warding Flare и подобные.
  const preOffers = preRollOffers(ctx, room, prep);
  if (preOffers.length) {
    const holder: AttackResolveResult = {};
    const mapId = prep.input.targetMapId ?? prep.input.attackerMapId ?? '';
    let imposed = false;
    openReactionWindow(ctx, room, {
      mapId,
      trigger: 'attackRoll',
      sourceName: prep.input.attacker?.name,
      offers: preOffers.map((offer) => ({
        ...offer,
        apply: (choice: ReactionChoice): boolean => {
          const currentRoom = ctx.getRoom();
          if (currentRoom && choice.optionId) {
            imposed = applyAttackRollChoices(ctx, currentRoom, prep, [choice], mapId) || imposed;
          }
          return true;
        },
      })),
      done: () => {
        Object.assign(holder, rollAndContinue(imposed));
      },
    });
    return holder;
  }

  return rollAndContinue(false);
}
