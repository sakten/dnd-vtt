import { randomUUID } from 'node:crypto';
import {
  autoFailSave,
  combineRollMode,
  d20Expr,
  gridDistanceFeet,
  rollDice,
  sideMatches,
  statNumber,
  withAdvantage,
  withRollParts,
  type AbilityKey,
  type AutomationDef,
  type AutomationEffect,
  type AutomationUtility,
  type DiceRollResult,
  type SpellStats,
  type Token,
  type TurnState,
} from 'shared';
import type { ConnCtx } from '../context';
import type { Room } from '../../roomTypes';
import { gridSizeOfMap } from '../../rooms';
import { checkPartsForToken } from '../../room/effects';
import { bonusDieOptions, spendBonusDie } from '../bonusDice';
import { applyDamage, singleDamageType } from '../damage';
import { fail, type ErrorCode } from '../errors';
import { removeConditionInstances } from '../effectsApply';
import { pushRollMessage, pushSaveMessage } from '../messages';
import { startMovementTurns } from '../moveTurns';
import { executeTeleport, teleportIssue } from '../teleport';
import { maybeRollAnim } from '../rollAnim';
import { audienceOf, type ReactionChoice } from '../reactions/internal';
import { openReactionWindow, type ReactionOfferInput } from '../reactions/queue';
import {
  applyEffectLight,
  proficiencyFor,
  resolveDiceExpression,
  tokensAround,
  type AutomationInput,
} from './core';

/** Результат спасброска цели: хранится для пересчёта Бардовским вдохновением. */
export interface TargetSave {
  target: Token;
  roll: DiceRollResult;
  autoFail: boolean;
  success: boolean;
}

/** Спасбросок цели с сообщением в чат; авто-провал хранится отдельно (для пересчёта костью). */
export function rollTargetSaveFor(
  ctx: ConnCtx,
  room: Room,
  def: AutomationDef,
  author: string,
  target: Token,
  stats: SpellStats,
  ability: AbilityKey,
  advantage?: boolean
): TargetSave {
  const autoFail = autoFailSave(target.conditions, ability);
  const { roll, success } = ctx.manager.rollSave(room, target, ability, stats.dc, {
    conditionsAutoFail: true,
    condition: def.effects?.[0]?.conditions?.[0],
    magical: true,
    ...(advantage ? { advantage: true } : {}),
  });
  pushSaveMessage(ctx, room, { author, subject: `${def.name} · ${target.name}`, roll, success });
  return { target, roll, autoFail, success };
}

/** Окно Бардовского вдохновения на проваленные спасброски: кость к d20 и пересчёт успеха. */
export function openSaveInspiration(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  dc: number,
  subject: string,
  saves: TargetSave[],
  resume: () => void
): boolean {
  const failed = saves.filter((s) => !s.success && s.target.effects.some((e) => e.bonusDie));
  if (!failed.length) return false;
  const offers: ReactionOfferInput[] = failed.map((s) => ({
    token: s.target,
    audience: audienceOf(ctx, room, mapId, s.target),
    options: bonusDieOptions(s.target),
    apply: (choice: ReactionChoice): boolean => {
      const currentRoom = ctx.getRoom();
      const id = choice.optionId ?? '';
      if (!currentRoom || !id.startsWith('bonusdie:')) return true;
      const target = ctx.manager.findToken(currentRoom, choice.mapId, choice.tokenId);
      if (!target) return true;
      const bonus = spendBonusDie(ctx, currentRoom, choice.mapId, target, id.slice('bonusdie:'.length));
      if (bonus > 0 && !s.autoFail && s.roll.total + bonus >= dc) {
        s.success = true;
        ctx.systemMessage(currentRoom, {
          code: 'automation.bardicSuccess',
          params: { name: target.name },
        });
      }
      return true;
    },
  }));
  const opened = openReactionWindow(ctx, room, {
    mapId,
    trigger: 'saveFail',
    sourceName: subject,
    offers,
    done: () => resume(),
  });
  return opened;
}

/** Накладывает эффекты заклинания (баффы/дебаффы), включая спасброски целей. */
export function applyDefEffects(ctx: ConnCtx, input: AutomationInput): void {
  const room = ctx.getRoom();
  if (!room) return;
  const { caster, def, mapId, targets, stats, author } = input;
  const effects = def.effects;
  if (!effects?.length) return;

  const applied: string[] = [];
  let anchor: string | undefined;
  // Dominate: в активном бою первый спас цели — с преимуществом (решение владельца).
  const combatAdvantage = !!def.saveAdvantageInCombat && ctx.manager.combatOf(room, mapId)?.active === true;
  // Карающая нежить: урон по провалившим спас до наложения изгнания (урон не снимает его).
  const abilities = ctx.manager.abilitiesForToken(room, caster);
  const searExpr = def.damage && !def.heal ? resolveDiceExpression(def.damage, abilities, proficiencyFor(ctx, room, caster)) : null;
  const searType = searExpr ? singleDamageType(def.damage?.types) : undefined;
  let searRoll: DiceRollResult | null = null;
  let searSent = false;

  // Сначала спасброски всех цели (окно вдохновения успевает пересчитать успех), затем эффекты.
  const applications: { effectDef: AutomationEffect; target: Token; save?: TargetSave }[] = [];
  for (const effectDef of effects) {
    const recipients = effectDef.radiusFeet
      ? tokensAround(ctx, room, mapId, caster, effectDef.radiusFeet, 'ally', true)
      : effectDef.to === 'targets'
        ? targets
        : [caster];
    for (const target of recipients) {
      if (def.save && stats && effectDef.to === 'targets') {
        applications.push({
          effectDef,
          target,
          save: rollTargetSaveFor(ctx, room, def, author, target, stats, def.save.ability, combatAdvantage),
        });
      } else {
        applications.push({ effectDef, target });
      }
    }
  }

  const applyAll = () => {
    for (const app of applications) {
      if (app.save?.success) {
        // Эффекты успешного спасброска (Irresistible Dance: короткий танец) — один раз на цель.
        if (def.saveSuccess?.length && app.effectDef === effects[0]) {
          for (const successDef of def.saveSuccess) {
            applyEffectLight(ctx, room, mapId, {
              sourceKey: def.key,
              sourceId: caster.id,
              mapId,
              effectDef: successDef,
              target: app.target,
              maxRounds: def.maxRounds,
              untilSaveDc: stats?.dc,
              escapeDc: stats?.dc,
            });
          }
        }
        // Eyebite: успешный спас помечаем скрытой меткой (до конца каста повторно не выбрать).
        if (app.effectDef.markSaved) {
          ctx.manager.applyEffect(room, app.target, {
            id: randomUUID(),
            name: def.name,
            sourceKey: def.key,
            sourceId: caster.id,
            concentration: true,
            duration: { type: 'concentration' },
            modifiers: [],
            hidden: true,
            saveMarker: true,
          });
          ctx.emitToken(room, 'token:update', mapId, app.target);
        }
        continue;
      }
      if (app.save && searExpr) {
        if (!searRoll) searRoll = rollDice(searExpr);
        if (!searSent) {
          pushRollMessage(ctx, room, {
            author,
            roll: searRoll,
            kind: 'damage',
            params: { subject: `${def.name}: ${caster.name}`, damageType: searType },
          });
          searSent = true;
        }
        applyDamage(ctx, { target: app.target, mapId, amount: searRoll.total, damageType: searType, parts: searRoll.damageParts });
      }
      const effectId = applyEffectLight(ctx, room, mapId, {
        sourceKey: def.key,
        sourceId: caster.id,
        mapId,
        effectDef: app.effectDef,
        target: app.target,
        markedId: app.effectDef.markTarget ? targets[0]?.id : undefined,
        maxRounds: def.maxRounds,
        untilSaveDc: stats?.dc,
        escapeDc: stats?.dc,
      });
      applied.push(app.target.name);
      if (!anchor) anchor = effectId;
    }
    // Если эффекты ни на кого не легли и зоны нет — концентрации не остаётся
    // (Hypnotic Pattern: все цели прошли спас). У зоны триггеры живут и без жертв.
    const worthwhile = applied.length > 0 || !!def.zone;
    if (worthwhile && def.concentration && !effects.some((d) => d.to !== 'targets')) {
      // Чистый target-only каст: на кастере держим якорь концентрации для чипа.
      const anchorId = randomUUID();
      ctx.manager.applyEffect(room, caster, {
        id: anchorId,
        name: def.name,
        sourceKey: def.key,
        sourceId: caster.id,
        concentration: true,
        duration: { type: 'concentration' },
        modifiers: [],
      });
      ctx.emitToken(room, 'token:update', mapId, caster);
      if (!anchor) anchor = anchorId;
    }
    if (worthwhile && def.concentration && anchor) ctx.manager.setConcentration(room, mapId, caster, anchor);
    ctx.syncCombat(room, mapId);
    ctx.systemMessage(
      room,
      applied.length
        ? {
            code: 'automation.effectsApplied',
            params: { name: caster.name, feature: def.name, targets: applied.join(', ') },
          }
        : { code: 'automation.effectsNone', params: { name: caster.name, feature: def.name } }
    );
  };

  const saves = applications.map((a) => a.save).filter((s): s is TargetSave => !!s);
  if (stats && openSaveInspiration(ctx, room, mapId, stats.dc, def.name, saves, applyAll)) return;
  applyAll();
}

type UtilityHandler = (u: {
  ctx: ConnCtx;
  room: Room;
  input: AutomationInput;
  utility: AutomationUtility;
  turn: TurnState | null;
}) => void;

/** Обработчики простых утилит: доп. действие/движение, отход, доп. атаки, пул лечения, проверка. */
const UTILITY_HANDLERS: Record<AutomationUtility['kind'], UtilityHandler> = {
  // Shadow Blade: возврат клинка обрабатывается в `useGrantedAction` (флаг эффекта).
  recallWeapon: () => {},
  extraAction: ({ ctx, room, input, utility, turn }) => {
    const amount = Math.max(1, Math.round(utility.amount ?? 1));
    if (turn) turn.extraActions += amount;
    ctx.syncCombat(room, input.mapId);
    ctx.systemMessage(room, {
      code: 'automation.extraAction',
      params: { name: input.caster.name, feature: input.def.name, amount },
    });
  },
  extraMovement: ({ ctx, room, input }) => {
    const speed = ctx.manager.tokenSpeed(room, input.caster);
    ctx.manager.grantExtraMovement(room, input.mapId, input.caster, speed);
    ctx.syncCombat(room, input.mapId);
    ctx.systemMessage(room, {
      code: 'automation.extraMovement',
      params: { name: input.caster.name, feature: input.def.name, speed },
    });
  },
  disengage: ({ ctx, room, input, turn }) => {
    if (turn) turn.disengaged = true;
    ctx.syncCombat(room, input.mapId);
    ctx.systemMessage(room, {
      code: 'automation.utility',
      params: { name: input.caster.name, feature: input.def.name },
    });
  },
  extraAttacks: ({ ctx, room, input, utility, turn }) => {
    const amount = Math.max(1, Math.round(utility.amount ?? 2));
    if (turn) turn.flurryAttacks += amount;
    ctx.syncCombat(room, input.mapId);
    ctx.systemMessage(room, {
      code: 'automation.extraAttacks',
      params: { name: input.caster.name, feature: input.def.name, amount },
    });
  },
  weaponAttack: ({ ctx, room, input, utility, turn }) => {
    const amount = Math.max(1, Math.round(utility.amount ?? 1));
    if (turn) turn.attacksRemaining += amount;
    ctx.syncCombat(room, input.mapId);
    ctx.systemMessage(room, {
      code: 'automation.weaponAttacks',
      params: { name: input.caster.name, feature: input.def.name, amount },
    });
  },
  healPool: ({ ctx, room, input, utility }) => {
    // Поддержание жизни: пул HP распределяется по раненым союзникам до половины максимума.
    let pool = Math.max(0, Math.round(utility.amount ?? 0));
    const halfOf = (token: Token) => Math.floor(statNumber(token.hpMax) / 2);
    const wounded = [...input.targets]
      .filter((token) => token.hpCurrent <= halfOf(token) && token.hpCurrent < statNumber(token.hpMax))
      .sort(
        (a, b) => a.hpCurrent / Math.max(1, statNumber(a.hpMax)) - b.hpCurrent / Math.max(1, statNumber(b.hpMax))
      );
    const healed: string[] = [];
    for (const target of wounded) {
      if (pool <= 0) break;
      const space = Math.min(halfOf(target) - target.hpCurrent, statNumber(target.hpMax) - target.hpCurrent);
      const amount = Math.min(pool, Math.max(0, space));
      if (amount <= 0) continue;
      applyDamage(ctx, { target, mapId: input.mapId, amount, kind: 'heal' });
      pool -= amount;
      healed.push(`${target.name} +${amount}`);
    }
    ctx.syncCombat(room, input.mapId);
    ctx.systemMessage(
      room,
      healed.length
        ? {
            code: 'automation.healPool',
            params: { name: input.caster.name, feature: input.def.name, targets: healed.join(', ') },
          }
        : { code: 'automation.healPoolNone', params: { name: input.caster.name, feature: input.def.name } }
    );
  },
  tempHp: ({ ctx, room, input, utility }) => {
    // Временные HP одной костью на всех (Мантия вдохновения: 2×кость).
    const roll = rollDice(utility.dice ?? '1d6');
    const amount = roll.total * (utility.multiplier ?? 1);
    if (amount <= 0) return;
    const combat = ctx.manager.combatOf(room, input.mapId);
    for (const target of input.targets) {
      ctx.manager.grantTempHp(room, target, amount);
      // Эффекты дара (движение без провокации атак по возможности и подобные):
      // только в бою — вне боя эффект нечему завершать (нет ходов).
      const inCombat = !!combat?.active && combat.entries.some((e) => e.tokenId === target.id);
      if (inCombat) {
        for (const effectDef of input.def.effects ?? []) {
          applyEffectLight(ctx, room, input.mapId, {
            sourceKey: input.def.key,
            sourceId: input.caster.id,
            mapId: input.mapId,
            effectDef,
            target,
          });
        }
      }
      const cid = ctx.manager.controllerOfToken(room, target);
      if (cid) ctx.emitResources(room, cid);
      ctx.emitToken(room, 'token:update', input.mapId, target);
    }
    ctx.syncCombat(room, input.mapId);
    ctx.systemMessage(room, {
      code: 'automation.tempHp',
      params: {
        name: input.caster.name,
        feature: input.def.name,
        targets: input.targets.map((t) => `${t.name} +${amount} врем. HP`).join(', '),
      },
    });
    if (utility.thenMove) startMovementTurns(ctx, room, input.mapId, input.caster, input.targets);
  },
  patientDefense: ({ ctx, room, input, turn }) => {
    if (turn) turn.disengaged = true;
    ctx.manager.applyEffect(room, input.caster, {
      id: randomUUID(),
      name: 'Уклонение',
      sourceKey: `${input.def.key}:dodge`,
      sourceId: input.caster.id,
      duration: { type: 'endOfTurn', of: 'target' },
      modifiers: [
        { id: randomUUID(), target: 'attack', mode: 'disadvantage', filter: { direction: 'against' } },
        { id: randomUUID(), target: 'save', mode: 'advantage', filter: { ability: 'dex' } },
      ],
    });
    ctx.emitToken(room, 'token:update', input.mapId, input.caster);
    ctx.syncCombat(room, input.mapId);
    ctx.systemMessage(room, {
      code: 'automation.patientDefense',
      params: { name: input.caster.name, feature: input.def.name },
    });
  },
  stepOfTheWind: ({ ctx, room, input, turn }) => {
    if (turn) turn.disengaged = true;
    const speed = ctx.manager.tokenSpeed(room, input.caster);
    ctx.manager.grantExtraMovement(room, input.mapId, input.caster, speed);
    ctx.syncCombat(room, input.mapId);
    ctx.systemMessage(room, {
      code: 'automation.stepOfTheWind',
      params: { name: input.caster.name, feature: input.def.name },
    });
  },
  check: ({ ctx, room, input, utility }) => {
    const ability = utility.ability ?? 'dex';
    const mod = ctx.manager.abilityModForToken(room, input.caster, ability);
    const base = d20Expr(mod);
    // Галка Adv/Dis над ROLL: преимущество/помеха на проверку (Скрыться, Поиск); плюс эффекты.
    const parts = checkPartsForToken(room, input.caster, { ability });
    const roll = rollDice(withRollParts(withAdvantage(base, combineRollMode(parts, input.advantage ?? null)), parts));
    pushRollMessage(ctx, room, {
      author: input.author,
      roll,
      kind: 'check',
      params: { subject: `${input.def.name}: ${input.caster.name}` },
    });
    maybeRollAnim(ctx, roll);
  },
  /** Помощь: разбудить союзника/нейтрала в 5 фт — снять «сонные» эффекты с их состояниями. */
  wake: ({ ctx, room, input }) => {
    const target = input.targets.find((t) => t.id !== input.caster.id);
    if (!target) {
      fail(ctx, 'spellNoTarget');
      return;
    }
    if (sideMatches(input.caster, target, 'hostile')) {
      fail(ctx, 'helpHostile');
      return;
    }
    const map = ctx.manager.findMap(room, input.mapId);
    if (!map) return;
    const feet = gridDistanceFeet(input.caster, target, gridSizeOfMap(map));
    if (feet > 5) {
      fail(ctx, 'outOfRange', { feet: Math.round(feet) });
      return;
    }
    const asleep = target.effects.filter((e) => e.wakeOnDamage);
    if (!asleep.length) {
      fail(ctx, 'nothingToWake');
      return;
    }
    for (const effect of asleep) ctx.manager.removeEffect(room, target, effect.id);
    ctx.emitToken(room, 'token:update', input.mapId, target);
    ctx.systemMessage(room, { code: 'actions.wokeUp', params: { name: target.name } });
  },
  /** Revivify: вернуть мёртвую цель к жизни с 1 HP. */
  revive: ({ ctx, room, input }) => {
    const revived: string[] = [];
    for (const target of input.targets) {
      const changed = ctx.manager.reviveToken(room, input.mapId, target);
      if (!changed.length) continue;
      for (const c of changed) ctx.emitToken(room, 'token:update', c.mapId, c.token);
      const cid = ctx.manager.controllerOfToken(room, target);
      if (cid) ctx.emitResources(room, cid);
      revived.push(target.name);
    }
    if (!revived.length) {
      fail(ctx, 'reviveNotDead');
      return;
    }
    ctx.syncCombat(room, input.mapId);
    ctx.systemMessage(room, {
      code: 'automation.revive',
      params: { name: input.caster.name, feature: input.def.name, targets: revived.join(', ') },
    });
  },
  /** Spare the Dying: цель на 0 HP становится стабильной (death-сейвы не бросаются). */
  stabilize: ({ ctx, room, input }) => {
    const stabilized: string[] = [];
    for (const target of input.targets) {
      const changed = ctx.manager.stabilizeToken(room, target);
      if (!changed.length) continue;
      for (const c of changed) ctx.emitToken(room, 'token:update', c.mapId, c.token);
      const cid = ctx.manager.controllerOfToken(room, target);
      if (cid) ctx.emitResources(room, cid);
      stabilized.push(target.name);
    }
    if (!stabilized.length) {
      fail(ctx, 'stabilizeNotDying');
      return;
    }
    ctx.systemMessage(room, {
      code: 'automation.stabilize',
      params: { name: input.caster.name, feature: input.def.name, targets: stabilized.join(', ') },
    });
  },
  /** Lesser/Greater Restoration: снять выбранное состояние (или единственное подходящее). */
  endCondition: ({ ctx, room, input }) => {
    const target = input.targets[0];
    if (!target) {
      fail(ctx, 'spellNoTarget');
      return;
    }
    const allowed = input.def.endConditions ?? [];
    const chosen = input.choice && allowed.includes(input.choice as (typeof allowed)[number]) ? input.choice : undefined;
    const keys = chosen
      ? [chosen as (typeof allowed)[number]]
      : allowed.filter((key) => target.conditions.some((c) => c.key === key));
    if (!keys.length) {
      fail(ctx, 'restoreNoCondition');
      return;
    }
    const removed = removeConditionInstances(ctx, room, input.mapId, target, keys);
    if (!removed.length) {
      fail(ctx, 'restoreNoCondition');
      return;
    }
    ctx.systemMessage(room, {
      code: 'automation.restore',
      params: {
        name: input.caster.name,
        feature: input.def.name,
        target: target.name,
        conditions: removed.join(', '),
      },
    });
  },
  // Перемещение зоны обрабатывается веткой `zone:` в action:use — до executeAutomation.
  moveZone: () => void 0,
  /** Misty Step: телепорт кастера в выбранную точку в пределах дистанции. */
  teleport: ({ ctx, room, input, utility }) => {
    if (!input.origin) {
      fail(ctx, 'noAreaPoint');
      return;
    }
    const issue = teleportIssue(room, input.mapId, input.caster, input.origin, utility.amount ?? 30);
    if (issue) {
      fail(ctx, issue.code as ErrorCode, issue.params);
      return;
    }
    executeTeleport(ctx, room, input.mapId, input.caster, input.origin);
  },
  /** Scatter: не-союзники кидают WIS-спас (успех — остаётся); невалидные точки пропускаем. */
  scatter: ({ ctx, room, input, utility }) => {
    const placements = input.placements ?? [];
    if (!placements.length) {
      fail(ctx, 'spellNoTarget');
      return;
    }
    const limit = utility.destinationFeet ?? 120;
    const dc = input.stats?.dc ?? 10;
    for (const placement of placements) {
      const target = ctx.manager.findToken(room, input.mapId, placement.targetId);
      if (!target) continue;
      const issue = teleportIssue(room, input.mapId, target, { x: placement.x, y: placement.y }, limit, input.caster);
      if (issue) continue;
      const willing = target.id === input.caster.id || sideMatches(input.caster, target, 'ally');
      if (!willing) {
        const { roll, success } = ctx.manager.rollSave(room, target, 'wis', dc, {
          advantage: input.advantage === 'a' ? true : undefined,
        });
        pushSaveMessage(ctx, room, {
          author: input.author,
          subject: `${input.def.name} · ${target.name}`,
          roll,
          success,
        });
        if (success) continue;
      }
      executeTeleport(ctx, room, input.mapId, target, { x: placement.x, y: placement.y });
    }
  },
};

/** Простые утилиты действий (базовые и классовые): доп. действие/движение, отход, проверка. */
export function applyUtility(ctx: ConnCtx, input: AutomationInput): void {
  const room = ctx.getRoom();
  const utility = input.def.utility;
  if (!room || !utility) return;
  UTILITY_HANDLERS[utility.kind]({
    ctx,
    room,
    input,
    utility,
    turn: ctx.manager.turnForToken(room, input.mapId, input.caster),
  });
}
