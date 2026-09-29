import { randomUUID } from 'node:crypto';
import {
  autoFailSave,
  cellCenter,
  combineRollMode,
  d20Expr,
  findPath,
  gridDistanceFeet,
  gridOfMap,
  isBanished,
  kenseiMonkLevel,
  kenseiWeaponDefOf,
  kenseiWeaponKeyOf,
  passengerIssue,
  pointCell,
  rollDice,
  sideMatches,
  sizeAtMost,
  statNumber,
  teleportCellsNearBoxes,
  wallsWithZones,
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
import { gridSizeOfMap, sheetOfToken } from '../../rooms';
import { checkPartsForToken } from '../../room/effects';
import { applyEffectTo } from '../effectsApply';
import { bonusDieOptions, spendBonusDie } from '../bonusDice';
import { applyDamage, singleDamageType } from '../damage';
import { fail, type ErrorCode } from '../errors';
import { removeConditionInstances } from '../effectsApply';
import { pushRollMessage, pushSaveMessage } from '../messages';
import { startMovementTurns } from '../moveTurns';
import { executeTeleport, teleportIssue } from '../teleport';
import { dispellableEffects, effectSpellLevel, endDispelledEffect, endDispelledZone, zoneSpellLevel } from '../dispel';
import { maybeRollAnim } from '../rollAnim';
import { handleMovementZones } from '../zones';
import { syncSurrounded } from '../surrounded';
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
        anchor: true,
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

/**
 * Dimension Door: точка прибытия занята/непроходима — телепорт не состоялся,
 * ячейка уже потрачена; кастер и действительный пассажир получают `blockedDamage`.
 */
function applyFailedTeleport(ctx: ConnCtx, room: Room, input: AutomationInput, utility: AutomationUtility): void {
  const dice = utility.blockedDamage;
  if (!dice) return;
  const map = ctx.manager.findMap(room, input.mapId);
  const travelers: Token[] = [input.caster];
  const plan = utility.passenger;
  const passenger =
    plan && input.passengerId ? ctx.manager.findToken(room, input.mapId, input.passengerId) : undefined;
  if (passenger && map && passenger.id !== input.caster.id && !isBanished(passenger)) {
    const grid = gridOfMap(map, room.scene.grid);
    if (!passengerIssue(input.caster, passenger, grid, plan!)) travelers.push(passenger);
  }
  const roll = rollDice(dice.dice);
  const damageType = singleDamageType(dice.types);
  for (const target of travelers) {
    applyDamage(ctx, {
      target,
      mapId: input.mapId,
      amount: roll.total,
      damageType,
      roll,
      author: input.author,
      params: { subject: `${input.def.name} · ${target.name}`, damageType },
    });
  }
  ctx.systemMessage(room, {
    code: 'automation.teleportFailed',
    params: { name: input.caster.name, feature: input.def.name, amount: roll.total },
  });
}

/**
 * Пассажир телепорта (Dimension Door/Thunder Step): ближайшая свободная клетка
 * в `destFeet` от точки прибытия кастера. Нет места — пассажир остаётся (Thunder Step).
 */
function teleportPassenger(ctx: ConnCtx, room: Room, input: AutomationInput, utility: AutomationUtility): void {
  const plan = utility.passenger;
  if (!plan || !input.passengerId) return;
  const map = ctx.manager.findMap(room, input.mapId);
  const passenger = ctx.manager.findToken(room, input.mapId, input.passengerId);
  if (!map || !passenger || passenger.id === input.caster.id || isBanished(passenger)) return;
  const grid = gridOfMap(map, room.scene.grid);
  const cells = teleportCellsNearBoxes([input.caster], map.tokens, grid, wallsWithZones(map.walls, map.zones, grid), plan.destFeet, passenger.id);
  if (!cells.length) return;
  const casterCell = pointCell(input.caster, grid);
  let best: { cx: number; cy: number } | null = null;
  let bestDist = Infinity;
  for (const key of cells) {
    const [cx, cy] = key.split(',').map(Number);
    if (cx === undefined || cy === undefined) continue;
    const dist = Math.hypot(cx - casterCell.cx, cy - casterCell.cy);
    if (dist < bestDist) {
      best = { cx, cy };
      bestDist = dist;
    }
  }
  if (!best) return;
  executeTeleport(ctx, room, input.mapId, passenger, cellCenter(best.cx, best.cy, grid));
}

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
  /** Kensei's Shot: дальнобойное кэнсэй-оружие основной руки — +1d4 (1d6 с 6 ур.) до конца хода. */
  kenseisShot: ({ ctx, room, input }) => {
    const { sheet } = sheetOfToken(room, input.caster);
    const weapon = kenseiWeaponDefOf({ attacks: sheet?.attacks, hands: sheet?.hands, classes: sheet?.classes });
    if (!weapon || weapon.rangeType !== 'ranged') {
      fail(ctx, 'kenseiNoRangedWeapon');
      return;
    }
    const dice = kenseiMonkLevel(sheet?.classes) >= 6 ? '1d6' : '1d4';
    applyEffectTo(ctx, room, {
      sourceKey: input.def.key,
      sourceId: input.caster.id,
      mapId: input.mapId,
      effectDef: {
        name: input.def.name,
        duration: { type: 'endOfTurn', of: 'target' },
        modifiers: [
          {
            target: 'damage',
            mode: 'add',
            value: dice,
            filter: { weapon: true, unarmed: false, attackType: 'ranged', kenseiWeapon: true },
          },
        ],
      },
      target: input.caster,
    });
    ctx.emitToken(room, 'token:update', input.mapId, input.caster);
    ctx.syncCombat(room, input.mapId);
    ctx.systemMessage(room, {
      code: 'automation.kenseisShot',
      params: { name: input.caster.name, feature: input.def.name, dice },
    });
  },
  /** Sharpen the Blade: 1–3 ки — бонус к атаке и урону кэнсэй-оружия основной руки на 1 минуту. */
  sharpenBlade: ({ ctx, room, input }) => {
    const { sheet } = sheetOfToken(room, input.caster);
    const key = kenseiWeaponKeyOf({ attacks: sheet?.attacks, hands: sheet?.hands, classes: sheet?.classes });
    if (!key) {
      fail(ctx, 'kenseiNoWeapon');
      return;
    }
    const amount = Math.max(1, Math.min(3, Math.round(input.amount ?? 1)));
    applyEffectTo(ctx, room, {
      sourceKey: input.def.key,
      sourceId: input.caster.id,
      mapId: input.mapId,
      effectDef: {
        name: input.def.name,
        duration: { type: 'rounds', rounds: 10 },
        modifiers: [
          { target: 'attack', mode: 'add', value: amount, filter: { weapon: true, unarmed: false, kenseiWeapon: true } },
          { target: 'damage', mode: 'add', value: amount, filter: { weapon: true, unarmed: false, kenseiWeapon: true } },
        ],
      },
      target: input.caster,
    });
    ctx.emitToken(room, 'token:update', input.mapId, input.caster);
    ctx.syncCombat(room, input.mapId);
    ctx.systemMessage(room, {
      code: 'automation.sharpenTheBlade',
      params: { name: input.caster.name, feature: input.def.name, ki: amount },
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
      ctx.emitChanged(room, changed);
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
      ctx.emitChanged(room, changed);
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
  /** Compulsion: отметить направление над целями источника (движение ведёт мастер). */
  direction: ({ ctx, room, input, utility }) => {
    const direction = utility.direction;
    if (!direction) return;
    let changed = false;
    for (const map of room.scene.maps) {
      for (const token of map.tokens) {
        let tokenChanged = false;
        for (const effect of token.effects) {
          // Плашки-состояния источника: у эффекта-действий на кастере состояний нет.
          if (effect.sourceKey === input.def.key && effect.sourceId === input.caster.id && effect.conditions?.length) {
            effect.commandDirection = direction;
            tokenChanged = true;
          }
        }
        if (tokenChanged) {
          ctx.emitToken(room, 'token:update', map.id, token);
          changed = true;
        }
      }
    }
    if (changed) ctx.manager.saveSoon(room);
  },
  /** Misty Step/DD/Thunder Step: телепорт кастера в выбранную точку. */
  teleport: ({ ctx, room, input, utility }) => {
    if (!input.origin) {
      fail(ctx, 'noAreaPoint');
      return;
    }
    const issue = teleportIssue(room, input.mapId, input.caster, input.origin, utility.amount ?? 30, undefined, {
      skipSight: !!utility.ignoreSight,
    });
    if (issue) {
      // Dimension Door: занятая точка прибытия — провал каста с уроном, а не ошибка.
      if (utility.blockedDamage && issue.code === 'teleportNoSpace') {
        applyFailedTeleport(ctx, room, input, utility);
        return;
      }
      fail(ctx, issue.code as ErrorCode, issue.params);
      return;
    }
    executeTeleport(ctx, room, input.mapId, input.caster, input.origin);
    teleportPassenger(ctx, room, input, utility);
  },
  /**
   * Telekinesis: цель до Huge, спас STR; на провале — вынужденное перемещение
   * по клеткам (A*, зоны срабатывают) в точку ≤30 фт и restrained до вашего
   * следующего хода; успех — цель остаётся на месте.
   */
  telekinesis: ({ ctx, room, input, utility }) => {
    const placement = (input.placements ?? [])[0];
    const target = placement ? ctx.manager.findToken(room, input.mapId, placement.targetId) : undefined;
    if (!placement || !target) {
      fail(ctx, 'spellNoTarget');
      return;
    }
    const map = ctx.manager.findMap(room, input.mapId);
    if (!map) return;
    const grid = gridOfMap(map, room.scene.grid);
    const rangeFeet = input.def.targeting?.range ?? 60;
    const feet = gridDistanceFeet(input.caster, target, grid.size);
    if (feet > rangeFeet) {
      fail(ctx, 'outOfRange', { feet: Math.round(feet) });
      return;
    }
    if (utility.maxSize && !sizeAtMost(target.cells, utility.maxSize)) {
      fail(ctx, 'spellNoTarget');
      return;
    }
    // Точка: ≤30 фт от цели, внутри карты и свободна; путь — по клеткам (A*, не сквозь стены).
    const issue = teleportIssue(room, input.mapId, target, { x: placement.x, y: placement.y }, utility.amount ?? 30, undefined, {
      skipSight: true,
    });
    if (issue) {
      fail(ctx, issue.code as ErrorCode, issue.params);
      return;
    }
    const cell = pointCell({ x: placement.x, y: placement.y }, grid);
    const dest = cellCenter(cell.cx, cell.cy, grid);
    const path = findPath({
      from: { x: target.x, y: target.y },
      to: dest,
      grid,
      bounds:
        map.width > 0 && map.height > 0
          ? { cols: Math.ceil(map.width / grid.size), rows: Math.ceil(map.height / grid.size) }
          : null,
      walls: wallsWithZones(map.walls, map.zones, grid),
      moverCells: target.cells,
    });
    if (!path) {
      fail(ctx, 'noClearPath');
      return;
    }
    const ability = input.def.save?.ability ?? 'str';
    const { roll, success } = ctx.manager.rollSave(room, target, ability, input.stats?.dc ?? 10, {});
    pushSaveMessage(ctx, room, {
      author: input.author,
      subject: `${input.def.name} · ${target.name}`,
      roll,
      success,
    });
    if (success) return;
    for (const point of path.points.slice(1)) {
      const from = { x: target.x, y: target.y };
      target.x = point.x;
      target.y = point.y;
      handleMovementZones(ctx, room, input.mapId, { token: target, from, to: { x: point.x, y: point.y } });
    }
    ctx.emitToken(room, 'token:update', input.mapId, target);
    syncSurrounded(ctx, room, input.mapId);
    // Restrained — до начала следующего хода кастера (снятие — тик эффектов источника).
    const restrained: AutomationEffect = {
      name: input.def.name,
      duration: { type: 'endOfTurn', of: 'source' },
      to: 'targets',
      modifiers: [],
      conditions: ['restrained'],
      concentration: true,
    };
    applyEffectLight(ctx, room, input.mapId, {
      sourceKey: input.def.key,
      sourceId: input.caster.id,
      mapId: input.mapId,
      effectDef: restrained,
      target,
    });
  },
  /**
   * Dispel Magic: цель — существо или зона на карте. Заклинания уровня ≤ круга
   * ячейки (мин. 3) гаснут автоматически; для 4+ — проверка характеристики кастера
   * (d20 + мод + модификаторы проверок, напр. Jack of All Trades) против СЛ 10 + уровень.
   */
  dispel: ({ ctx, room, input }) => {
    const autoLevel = Math.max(3, input.manual?.castLevel ?? 3);
    const ability = input.stats?.ability ?? 'int';
    const check = (level: number, label: string): boolean => {
      if (level <= autoLevel) return true;
      const parts = checkPartsForToken(room, input.caster, { ability });
      const roll = rollDice(withRollParts(d20Expr(input.stats?.mod ?? 0), parts));
      pushRollMessage(ctx, room, {
        author: input.author,
        roll,
        kind: 'check',
        params: { subject: `${input.def.name}: ${label} (${level})` },
      });
      return roll.total >= 10 + level;
    };
    // Цель-зона: заклинание на карте (Web, Wall of Fire, Conjure Fey и подобные).
    if (input.dispelZoneId) {
      const map = ctx.manager.findMap(room, input.mapId);
      const zone = map?.zones?.find((z) => z.id === input.dispelZoneId);
      const level = zone ? zoneSpellLevel(zone) : undefined;
      if (!zone || level === undefined) {
        fail(ctx, 'spellNoTarget');
        return;
      }
      if (!check(level, zone.name)) {
        ctx.systemMessage(room, { code: 'automation.dispelNone', params: { name: zone.name } });
        return;
      }
      endDispelledZone(ctx, room, input.mapId, zone);
      return;
    }
    const target = input.targets[0];
    if (!target) {
      fail(ctx, 'spellNoTarget');
      return;
    }
    let ended = false;
    for (const effect of dispellableEffects(target)) {
      const level = effectSpellLevel(effect);
      if (level === undefined || !check(level, effect.name)) continue;
      endDispelledEffect(ctx, room, input.mapId, target, effect);
      ended = true;
    }
    if (!ended) ctx.systemMessage(room, { code: 'automation.dispelNone', params: { name: target.name } });
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
