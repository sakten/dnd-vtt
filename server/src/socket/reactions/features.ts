import {
  abilityMod,
  bardicDie,
  characterLevel,
  isIncapacitated,
  martialArtsDie,
  monsterAbilityAutomation,
  monsterStats,
  proficiencyBonus,
  reactionFeatures,
  rollDice,
  sideMatches,
  superiorityDie,
  type AttackEntry,
  type ReactionFeatureDef,
  type ReactionOption,
  type ReactionTriggerKind,
  type Token,
} from 'shared';
import type { Room } from '../../roomTypes';
import type { ConnCtx } from '../context';
import { controllerIdOfToken, hasResourceFor, sheetOfToken, withinFeet } from '../../rooms';
import { shapeStatblock } from '../../room/shape';
import { pushSaveMessage } from '../messages';
import { applyDamage } from '../damage';
import { executeAutomation } from '../automation';
import type { WeaponAttackPrep } from '../attackResolve';
import { resolveWeaponAttackWithReactions } from './attack';
import { openReactionWindow, type ReactionOfferInput } from './queue';
import { audienceOf, choiceToken, classLevelOf, reactionSlotFree, type ReactionChoice } from './internal';
import { opportunityAttack } from './opportunity';

/** Доступные персонажу реакционные черты под триггер (с оплатой ресурсов). */
export function availableFeatureReactions(
  room: Room,
  token: Token,
  trigger: ReactionTriggerKind
): ReactionFeatureDef[] {
  const { controllerId: cid, sheet } = sheetOfToken(room, token);
  if (!cid || !sheet) return [];
  return reactionFeatures(sheet.classes).filter((def) => {
    if (def.trigger !== trigger) return false;
    if (!def.resourceKey) return true;
    return hasResourceFor(room, cid, def.resourceKey, def.resourceAmount ?? 1);
  });
}

/** Вариант-черта с остатком ресурса в названии. */
export function featureOption(def: ReactionFeatureDef, room: Room, token: Token): ReactionOption {
  let name = def.name;
  if (def.resourceKey) {
    const cid = controllerIdOfToken(room, token);
    const item = cid ? room.resources[cid]?.resources.find((r) => r.key === def.resourceKey) : undefined;
    if (item) name = `${def.name} (${item.current})`;
  }
  return {
    id: `feature:${def.id}`,
    name,
    kind: 'feature',
    resourceKey: def.resourceKey,
    resourceAmount: def.resourceAmount,
  };
}

/** Черта-реакция по id варианта: ищем по триггерам (attackMiss/damage и т.п.). */
export function findFeatureReaction(
  room: Room,
  token: Token,
  triggers: ReactionTriggerKind[],
  id: string
): ReactionFeatureDef | undefined {
  for (const trigger of triggers) {
    const def = availableFeatureReactions(room, token, trigger).find((d) => d.id === id);
    if (def) return def;
  }
  return undefined;
}

/** Оффер окна реакции: токен + его варианты-черты. */
export function featureOffer(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  token: Token,
  defs: ReactionFeatureDef[]
): ReactionOfferInput {
  return {
    token,
    audience: audienceOf(ctx, room, mapId, token),
    options: defs.map((def) => featureOption(def, room, token)),
  };
}

/** Кость реакционной черты: фиксированная или по уровню класса (Режущие слова — бардовская). */
export function reactionDieExpr(def: ReactionFeatureDef, room: Room, token: Token): string | undefined {
  if (def.diceFrom === 'bard') return `1d${bardicDie(classLevelOf(room, token, 'bard') || 1)}`;
  return def.dice;
}

/** Тратит реакцию и ресурс черты (сначала проверка обоих). */
export function spendFeatureCost(ctx: ConnCtx, room: Room, token: Token, mapId: string, def: ReactionFeatureDef): boolean {
  const cid = controllerIdOfToken(room, token);
  if (def.resourceKey) {
    if (!cid || !hasResourceFor(room, cid, def.resourceKey, def.resourceAmount ?? 1)) return false;
  }
  if (!ctx.manager.spendSlot(room, mapId, token, 'reaction')) return false;
  if (def.resourceKey && cid) {
    ctx.manager.spendResource(room, cid, def.resourceKey, def.resourceAmount ?? 1);
    ctx.emitResources(room, cid);
  }
  return true;
}

/** Выбранные в окне до броска черты: возвращает true, если наложена помеха. */
export function applyAttackRollChoices(
  ctx: ConnCtx,
  room: Room,
  prep: WeaponAttackPrep,
  choices: ReactionChoice[],
  mapId: string
): boolean {
  const target = prep.input.target;
  if (!target) return false;
  let imposed = false;
  for (const choice of choices) {
    if (choice.optionId?.startsWith('feature:')) {
      const id = choice.optionId.slice('feature:'.length);
      const def = findFeatureReaction(room, target, ['attackRoll'], id);
      if (!def || def.kind !== 'disadvantage') continue;
      if (imposed) continue; // помеха не складывается — остальным ресурс не тратим
      if (!spendFeatureCost(ctx, room, target, choice.mapId, def)) continue;
      imposed = true;
      ctx.systemMessage(room, {
        code: 'reactions.disadvantage',
        params: { name: target.name, feature: def.name },
      });
    }
  }
  if (imposed) ctx.syncCombat(room, mapId);
  return imposed;
}

/** Ответная атака реактора (Riposte, Retaliation): черта kind counterAttack. */
export function applyCounterAttack(
  ctx: ConnCtx,
  room: Room,
  choice: ReactionChoice,
  opponent: Token | null | undefined
): void {
  if (!opponent) return;
  const id = choice.optionId?.startsWith('feature:') ? choice.optionId.slice('feature:'.length) : '';
  const reactor = choiceToken(ctx, room, choice);
  if (!reactor) return;
  const def = findFeatureReaction(room, reactor, ['attackMiss', 'damage'], id);
  if (!def || def.kind !== 'counterAttack') return;
  if (!spendFeatureCost(ctx, room, reactor, choice.mapId, def)) return;
  const source = opportunityAttack(ctx, room, reactor);
  if (!source) return;
  const die =
    def.resourceKey === 'fighter.battleMaster:superiorityDice'
      ? superiorityDie(classLevelOf(room, reactor, def.className) || 1)
      : 0;
  const dieExpr = die ? `1d${die}` : '';
  ctx.systemMessage(
    room,
    dieExpr
      ? {
          code: 'reactions.counterAttackDie',
          params: { name: reactor.name, feature: def.name, die: dieExpr, target: opponent.name },
        }
      : {
          code: 'reactions.counterAttack',
          params: { name: reactor.name, feature: def.name, target: opponent.name },
        }
  );
  if (source.weapon) {
    const boosted: AttackEntry = dieExpr
      ? { ...source.weapon, damage: source.weapon.damage ? `${source.weapon.damage} + ${dieExpr}` : dieExpr }
      : source.weapon;
    // Полный резолв: ответная атака тоже может спровоцировать реакции (Shield/Guided Strike) —
    // они станут дочерними окнами текущей и отыграют до её продолжения.
    resolveWeaponAttackWithReactions(ctx, {
      attacker: reactor,
      attackerMapId: choice.mapId,
      target: opponent,
      targetMapId: choice.mapId,
      attack: boosted,
      prefix: reactor.name,
      author: reactor.name,
      ignoreRange: true,
    });
  } else if (source.action) {
    const base = monsterAbilityAutomation(source.action);
    if (base) {
      const def2 =
        dieExpr && base.damage
          ? { ...base, damage: { ...base.damage, dice: `${base.damage.dice} + ${dieExpr}` } }
          : base;
      executeAutomation(ctx, {
        caster: reactor,
        mapId: choice.mapId,
        def: def2,
        targets: [opponent],
        stats: monsterStats(shapeStatblock(reactor), source.action.ability),
        author: reactor.name,
      });
    }
  }
  ctx.syncCombat(room, choice.mapId);
}

/** Офферы окна до броска (attackRoll): Warding Flare и подобные. */
export function preRollOffers(ctx: ConnCtx, room: Room, prep: WeaponAttackPrep): ReactionOfferInput[] {
  const input = prep.input;
  const target = input.target;
  if (!target || !input.targetMapId || !input.attacker || target.id === input.attacker.id) return [];
  if (!input.targetMapId) return [];
  if (!reactionSlotFree(ctx.manager, room, input.targetMapId, target)) return [];
  const features = availableFeatureReactions(room, target, 'attackRoll').filter((def) => {
    if (def.kind !== 'disadvantage') return false;
    return withinFeet(room, target, input.attacker!, 30);
  });
  if (!features.length) return [];
  return [featureOffer(ctx, room, input.targetMapId, target, features)];
}

/** Отражение атак: удар полностью погашен — окно «потратить 1 фокус и перенаправить». */
export function openRedirectWindow(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  plan: { attacker: Token | null; attack: Pick<AttackEntry, 'rangeType' | 'damageType'> },
  redirect: { reactorId: string; mapId: string },
  opts: { onDone?: () => void } = {}
): void {
  const monk = ctx.manager.findToken(room, redirect.mapId, redirect.reactorId);
  const attacker = plan.attacker;
  if (!monk || !attacker) return;
  const cid = controllerIdOfToken(room, monk);
  if (!cid || !hasResourceFor(room, cid, 'monk:focus', 1)) return;
  const def = availableFeatureReactions(room, monk, 'attackHit').find((d) => d.id === 'monk:deflectAttacks');
  if (!def?.redirect) return;
  const melee = plan.attack.rangeType !== 'ranged';
  const reach = melee ? def.redirect.meleeRangeFeet : def.redirect.rangedRangeFeet;
  if (!withinFeet(room, monk, attacker, reach)) return;

  openReactionWindow(ctx, room, {
    mapId,
    trigger: 'attackHit',
    sourceName: attacker.name,
    offers: [
      {
        token: monk,
        audience: audienceOf(ctx, room, mapId, monk),
        options: [
          {
            id: 'feature:monk:deflectAttacks:redirect',
            name: 'Перенаправить (1 фокус)',
            kind: 'feature',
            resourceKey: 'monk:focus',
            resourceAmount: 1,
          },
        ],
        apply: (choice: ReactionChoice): boolean => {
          const currentRoom = ctx.getRoom();
          if (currentRoom && choice.optionId === 'feature:monk:deflectAttacks:redirect') {
            applyDeflectRedirect(ctx, currentRoom, choice, plan, def);
          }
          return true;
        },
      },
    ],
    done: () => {
      const currentRoom = ctx.getRoom();
      if (currentRoom) ctx.syncCombat(currentRoom, mapId);
      opts.onDone?.();
    },
  });
}

/** Перенаправление: спасбросок Ловкости атакующего или 2 кости боевых искусств + Ловкость. */
export function applyDeflectRedirect(
  ctx: ConnCtx,
  room: Room,
  choice: ReactionChoice,
  plan: { attacker: Token | null; attack: Pick<AttackEntry, 'damageType'> },
  def: ReactionFeatureDef
): void {
  const monk = ctx.manager.findToken(room, choice.mapId, choice.tokenId);
  const attacker = plan.attacker;
  if (!monk || !attacker || !def.redirect) return;
  const { controllerId: cid, sheet } = sheetOfToken(room, monk);
  if (!cid || !hasResourceFor(room, cid, 'monk:focus', 1)) return;
  ctx.manager.spendResource(room, cid, 'monk:focus', 1);
  ctx.emitResources(room, cid);

  const level = classLevelOf(room, monk, 'monk') || 1;
  const die = martialArtsDie(level);
  const abilities = (ctx.manager.abilitiesForToken(room, monk) ?? {}) as Partial<Record<string, number>>;
  const dexMod = abilityMod(abilities.dex ?? 10);
  const totalLevel = characterLevel(sheet?.classes ?? []);
  const dc = 8 + proficiencyBonus(totalLevel) + abilityMod(abilities.wis ?? 10);

  const { roll, success } = ctx.manager.rollSave(room, attacker, def.redirect.save, dc, { conditionsAutoFail: true });
  pushSaveMessage(ctx, room, { author: monk.name, subject: `Отражение атак · ${attacker.name}`, roll, success });
  if (!success) {
    const expr = `${def.redirect.martialArtsDice}d${die}${dexMod ? (dexMod > 0 ? `+${dexMod}` : `${dexMod}`) : ''}`;
    const damageRoll = rollDice(expr);
    applyDamage(ctx, {
      target: attacker,
      mapId: choice.mapId,
      amount: damageRoll.total,
      damageType: plan.attack.damageType,
      roll: damageRoll,
      author: monk.name,
      params: { subject: 'Отражение атак' },
    });
  }
  ctx.systemMessage(room, {
    code: success ? 'reactions.deflectDodged' : 'reactions.deflectRedirected',
    params: { name: monk.name, attacker: attacker.name },
  });
}

/** Офферы Направленного удара (+10 к промаху): сам атакующий (без реакции) и союзники в 30 фт. */
export function rollBonusOffers(
  ctx: ConnCtx,
  room: Room,
  plan: { attacker: Token | null; attackerMapId: string | null }
): ReactionOfferInput[] {
  const attacker = plan.attacker;
  const attackerMapId = plan.attackerMapId;
  if (!attacker || !attackerMapId) return [];
  const offers: ReactionOfferInput[] = [];
  for (const helper of ctx.manager.findMap(room, attackerMapId)?.tokens ?? []) {
    const self = helper.id === attacker.id;
    if (!self) {
      if (isIncapacitated(helper.conditions)) continue;
      // +10 к чужому промаху — только союзникам (та же ненейтральная фракция):
      // враг и нейтрал бонус не получают.
      if (!sideMatches(attacker, helper, 'ally')) continue;
      if (!reactionSlotFree(ctx.manager, room, attackerMapId, helper)) continue;
    }
    const defs = availableFeatureReactions(room, helper, 'attackMiss').filter((def) => {
      if (def.kind !== 'rollBonus') return false;
      if (!self && def.rangeFeet && !withinFeet(room, helper, attacker, def.rangeFeet)) return false;
      return true;
    });
    if (!defs.length) continue;
    offers.push({
      token: helper,
      audience: audienceOf(ctx, room, attackerMapId, helper),
      options: defs.map((def) => ({
        ...featureOption(def, room, helper),
        ...(self ? { id: `feature:${def.id}:self`, name: `${def.name} (без реакции)` } : {}),
      })),
    });
  }
  return offers;
}

/** Тратит ресурсы выбранных Направленных ударов; возвращает суммарный бонус к броску. */
export function applyRollBonusChoices(ctx: ConnCtx, room: Room, choices: ReactionChoice[]): number {
  let bonus = 0;
  for (const choice of choices) {
    const id = choice.optionId ?? '';
    if (!id.startsWith('feature:')) continue;
    const key = id.slice('feature:'.length);
    const self = key.endsWith(':self');
    const defId = self ? key.slice(0, -':self'.length) : key;
    const owner = ctx.manager.findToken(room, choice.mapId, choice.tokenId);
    if (!owner) continue;
    const def = availableFeatureReactions(room, owner, 'attackMiss').find((d) => d.id === defId && d.kind === 'rollBonus');
    if (!def) continue;
    const cid = controllerIdOfToken(room, owner);
    if (self) {
      if (def.resourceKey) {
        if (!cid || !hasResourceFor(room, cid, def.resourceKey, def.resourceAmount ?? 1)) continue;
        ctx.manager.spendResource(room, cid, def.resourceKey, def.resourceAmount ?? 1);
        ctx.emitResources(room, cid);
      }
    } else if (!spendFeatureCost(ctx, room, owner, choice.mapId, def)) continue;
    bonus += def.amount ?? 0;
    ctx.systemMessage(room, {
      code: 'reactions.rollBonus',
      params: { name: owner.name, feature: def.name, amount: def.amount ?? 0 },
    });
  }
  return bonus;
}
