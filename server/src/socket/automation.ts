import { randomUUID } from 'node:crypto';
import {
  abilityMod,
  attackRollParts,
  autoCrit,
  autoFailSave,
  characterLevel,
  collectAttackSources,
  combineRollMode,
  combineRollParts,
  d20Expr,
  damageRollParts,
  exhaustionRollPenalty,
  gridDistanceFeet,
  hostileTokens,
  isBanished,
  isSurrounded,
  maximizeHealing,
  maximizedRollTotal,
  proficiencyBonus,
  resolveAbilityMods,
  resolveAttack,
  rollDice,
  saveNoDamage,
  seesInvisible,
  sideMatches,
  sourcesCounts,
  statNumber,
  takenDamageParts,
  withAdvantage,
  withRollParts,
  type AbilityKey,
  type AreaSpec,
  type AutomationDice,
  type AutomationDef,
  type AutomationEffect,
  type AutomationUtility,
  type DiceRollResult,
  type SpellStats,
  type Token,
  type TurnState,
} from 'shared';
import type { ConnCtx } from './context';
import type { Room } from '../roomTypes';
import { gridSizeOfMap, sheetOfToken } from '../rooms';
import { creatureTypeOf } from '../room/actor';
import { checkPartsForToken } from '../room/effects';
import { bonusDieOptions, spendBonusDie } from './bonusDice';
import { applyDamage, singleDamageType } from './damage';
import { attackDamageRoll, attackHitRoll, attackUnseen, type WeaponDamageMods } from './attackResolve';
import { fail, type ErrorCode } from './errors';
import { applyEffectTo, removeConditionInstances, type ApplyEffectArgs } from './effectsApply';
import { applyForcedMovement } from './force';
import { executeTeleport, teleportIssue } from './teleport';
import { emitSpellFx } from './fx';
import { pushRollMessage, pushSaveMessage } from './messages';
import { misdirectCheck } from './misdirect';
import { startMovementTurns } from './moveTurns';
import { audienceOf, type ReactionChoice } from './reactions/internal';
import { openReactionWindow, type ReactionOfferInput } from './reactions/queue';
import { openAttackHitWindows, openAttackMissWindows, offerDamageReactions } from './reactions/windows';
import { openRedirectWindow } from './reactions/features';
import { maybeRollAnim } from './rollAnim';
import { runSummon, familiarCannotAttack } from './summons';
import { applyPolymorphForm } from './forms';
import { createZoneFromDef, resolveLightDispels } from './zones';
import { endConcentrationOf } from './effects';

/**
 * Generic-executor автоматизации (R8.1): выполняет `AutomationDef` — атаку,
 * спасбросок, авто-урон/лечение, эффекты и `manual` — без веток по конкретным
 * заклинаниям. Экономика, права и валидация — на вызывающем.
 */
export interface AutomationInput {
  caster: Token;
  mapId: string;
  def: AutomationDef;
  targets: Token[];
  /** Боевые характеристики кастера; null — нет заклинательной характеристики. */
  stats: SpellStats | null;
  author: string;
  advantage?: 'a' | 'd';
  /** Для manual-сообщения: описание и круг источника (у черт может не быть). */
  manual?: { description?: string[]; level?: number; castLevel?: number };
  /** Точка привязки/направление каста — для создания зон (`def.zone`). */
  origin?: { x: number; y: number } | null;
  direction?: { x: number; y: number } | null;
  /** Область применения, если её нет в `def` (заклинания: `spell.areaSpec`). */
  area?: AreaSpec | null;
  /** Выбранная форма призыва (Find Familiar): ключ каталога бестиария. */
  summonKey?: string;
  /** Выбор состояния для снятия (Lesser/Greater Restoration). */
  choice?: string;
  /** Scatter: точки назначения по целям. */
  placements?: { targetId: string; x: number; y: number }[];
}

/** Бонус владения кастера по его листу (монстры и токены без листа — 2). */
function proficiencyFor(ctx: ConnCtx, room: Room, caster: Token): number {
  const { sheet } = sheetOfToken(room, caster);
  return proficiencyBonus(characterLevel(sheet?.classes ?? []) || 1);
}

/**
 * Выражение костей черты: число костей по характеристике (`abilityDice`,
 * Sear Undead) и подстановка токенов характеристик (`1d8+wis`).
 */
function resolveDiceExpression(
  dice: AutomationDice | undefined,
  abilities: Partial<Record<AbilityKey, number>> | undefined,
  proficiency: number
): string | null {
  if (!dice) return null;
  let expression = dice.dice;
  if (dice.abilityDice) {
    const count = Math.max(dice.abilityDice.min ?? 1, abilityMod(abilities?.[dice.abilityDice.ability] ?? 10));
    expression = expression.replace(/^\d*/, String(count));
  }
  return resolveAbilityMods(expression, abilities, proficiency);
}

/** Бонус лечения Домена жизни: Ученик жизни (2+круг) и Целитель-благословенный (самолечение). */
function lifeHealing(
  room: Room,
  caster: Token,
  def: AutomationDef,
  castLevel: number | undefined
): { bonus: number; selfHeal: boolean } {
  if (!def.heal || !castLevel || castLevel < 1) return { bonus: 0, selfHeal: false };
  const { sheet } = sheetOfToken(room, caster);
  const life = sheet?.classes.find((c) => c.className === 'cleric' && c.subclass === 'life')?.level ?? 0;
  if (life < 3) return { bonus: 0, selfHeal: false };
  return { bonus: 2 + castLevel, selfHeal: life >= 6 };
}

/** Токены в радиусе от кастера: враждебные (`hostile`), союзные (`ally`) или любые (`any`). */
function tokensAround(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  caster: Token,
  feet: number,
  side: 'hostile' | 'ally' | 'any',
  includeSelf = false
): Token[] {
  const map = ctx.manager.findMap(room, mapId);
  if (!map) return includeSelf ? [caster] : [];
  const size = gridSizeOfMap(map);
  return map.tokens.filter((token) => {
    // Изгнанные (Banishment) вне поля: радиус-способности их не задевают.
    if (isBanished(token)) return false;
    if (token.id === caster.id) return includeSelf;
    if (gridDistanceFeet(token, caster, size) > feet) return false;
    return side === 'any' || sideMatches(caster, token, side);
  });
}

/** Снимает прежнюю концентрацию кастера: эффекты на всех токенах и его зоны. */
export function dropConcentration(ctx: ConnCtx, room: Room, caster: Token): void {
  endConcentrationOf(ctx, room, caster);
}

/** Якорь концентрации на кастере для зон без целевых эффектов (HoH, Spirit Guardians). */
export function anchorConcentration(ctx: ConnCtx, room: Room, caster: Token, mapId: string, def: AutomationDef): void {
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
  ctx.manager.setConcentration(room, mapId, caster, anchorId);
}

/** Результат спасброска цели: хранится для пересчёта Бардовским вдохновением. */
interface TargetSave {
  target: Token;
  roll: DiceRollResult;
  autoFail: boolean;
  success: boolean;
}

/** Спасбросок цели с сообщением в чат; авто-провал хранится отдельно (для пересчёта костью). */
function rollTargetSaveFor(
  ctx: ConnCtx,
  room: Room,
  def: AutomationDef,
  author: string,
  target: Token,
  stats: SpellStats,
  ability: AbilityKey
): TargetSave {
  const autoFail = autoFailSave(target.conditions, ability);
  const { roll, success } = ctx.manager.rollSave(room, target, ability, stats.dc, {
    conditionsAutoFail: true,
    condition: def.effects?.[0]?.conditions?.[0],
    magical: true,
  });
  pushSaveMessage(ctx, room, { author, subject: `${def.name} · ${target.name}`, roll, success });
  return { target, roll, autoFail, success };
}

/** Окно Бардовского вдохновения на проваленные спасброски: кость к d20 и пересчёт успеха. */
function openSaveInspiration(
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

/** Накладывает эффект; для светящих эффектов сразу разрешает диспел-пересечения со тьмой. */
function applyEffectLight(ctx: ConnCtx, room: Room, mapId: string, args: ApplyEffectArgs): string {
  const id = applyEffectTo(ctx, room, args);
  if (args.effectDef.light) resolveLightDispels(ctx, room, mapId);
  return id;
}

/** Накладывает эффекты заклинания (баффы/дебаффы), включая спасброски целей. */
function applyDefEffects(ctx: ConnCtx, input: AutomationInput): void {
  const room = ctx.getRoom();
  if (!room) return;
  const { caster, def, mapId, targets, stats, author } = input;
  const effects = def.effects;
  if (!effects?.length) return;

  const applied: string[] = [];
  let anchor: string | undefined;
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
          save: rollTargetSaveFor(ctx, room, def, author, target, stats, def.save.ability),
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
function applyUtility(ctx: ConnCtx, input: AutomationInput): void {
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

/** Данные прогона автоматизации: всё, что нужно резолверам урона/лечения. */
interface AutomationRun {
  ctx: ConnCtx;
  room: Room;
  caster: Token;
  def: AutomationDef;
  mapId: string;
  targets: Token[];
  author: string;
  abilities: Partial<Record<AbilityKey, number>> | undefined;
  proficiency: number;
  healing: boolean;
  healMods: { bonus: number; selfHeal: boolean };
  expression: string | null;
  subject: string;
  damageType: string | undefined;
  adv: 'a' | 'd' | undefined;
  count: number;
  /** Выбранная форма Polymorph (ключ каталога бестиария). */
  shapeForm?: string;
}

/** Лечение с бонусом Ученика жизни. */
function healValue(run: AutomationRun, total: number): number {
  return run.healing ? total + run.healMods.bonus : total;
}

/** Целитель-благословенный: леча других заклинанием с ячейкой, кастер лечится сам. */
function healAfter(run: AutomationRun, target: Token): void {
  if (run.healing && run.healMods.selfHeal && target.id !== run.caster.id) {
    applyDamage(run.ctx, { target: run.caster, mapId: run.mapId, amount: run.healMods.bonus, kind: 'heal' });
  }
}

/** Flame Blade: + модификатор заклинательной характеристики кастера к урону. */
function withSpellAbilityMod(expression: string | null, def: AutomationDef, stats: SpellStats | null): string | null {
  const mod = stats ? Math.round(stats.mod) : 0;
  if (!expression || !def.damage?.abilityMod || !mod) return expression;
  return `${expression}${mod > 0 ? '+' : ''}${mod}`;
}

/** Единая точка урона/лечения прогона: бонус Ученика жизни, сообщение, самолечение Целителя. */
function applyResult(
  run: AutomationRun,
  target: Token,
  roll: DiceRollResult,
  opts: {
    subject?: string;
    halve?: boolean;
    kind?: 'damage' | 'heal';
    crit?: boolean;
    silent?: boolean;
    /** Модификаторы реакций (половина/снижение/добавка к урону) из окна попадания. */
    mods?: WeaponDamageMods;
  } = {}
): ReturnType<typeof applyDamage> {
  const mods = run.healing ? undefined : opts.mods;
  const parts = roll.damageParts.map((part) => ({ ...part }));
  const bonus = (mods?.extraDamage ?? 0) - (mods?.flatReduction ?? 0);
  if (bonus && parts.length) {
    const main = parts.find((part) => (part.damageType ?? run.damageType) === run.damageType) ?? parts[0]!;
    main.amount += bonus;
  }
  const result = applyDamage(run.ctx, {
    target,
    mapId: run.mapId,
    // Beacon of Hope: лечение цели берёт максимум костей.
    amount: Math.max(0, healValue(run, run.healing && maximizeHealing(target.effects) ? maximizedRollTotal(roll) : roll.total) + bonus),
    damageType: run.damageType,
    ...(run.healing ? {} : { parts }),
    ...(opts.silent ? {} : { roll, author: run.author, params: { subject: opts.subject ?? run.subject, damageType: run.damageType } }),
    kind: opts.kind ?? (run.healing ? 'heal' : 'damage'),
    ...(opts.halve !== undefined ? { halve: opts.halve } : mods?.halveDamage ? { halve: true } : {}),
    ...(opts.crit !== undefined && { crit: opts.crit }),
    // Ближние заклинательные атаки (Shocking Grasp/Vampiric Touch) — триггер ответок цели.
    ...(run.def.attack ? { attacker: run.caster, melee: run.def.attack.rangeType === 'melee' } : {}),
  });
  // Heal и подобные: состояния снимаются независимо от броска лечения.
  if (run.def.endConditions?.length) {
    removeConditionInstances(run.ctx, run.room, run.mapId, target, run.def.endConditions);
  }
  healAfter(run, target);
  // Vampiric Touch: лечение кастера на половину фактически нанесённого урона.
  if (run.def.lifesteal && !run.healing && result.applied && result.amount > 0) {
    const heal = Math.floor(result.amount / 2);
    if (heal > 0) {
      applyDamage(run.ctx, { target: run.caster, mapId: run.mapId, amount: heal, kind: 'heal' });
      run.ctx.systemMessage(run.room, {
        code: 'automation.lifesteal',
        params: { name: run.caster.name, feature: run.def.name, target: target.name, amount: heal },
      });
    }
  }
  return result;
}

/** Атака заклинанием (лучи/снаряды): попадание, урон, эффекты на попадании. */
function runWeaponAttacks(run: AutomationRun, stats: SpellStats): void {
  const { ctx, room, def, caster, mapId, targets, author, abilities, expression, subject, damageType, adv, count } = run;
  if (!def.attack) return;
  const { rangeType } = def.attack;
  const castMap = ctx.manager.findMap(room, mapId);
  const gridSize = castMap ? gridSizeOfMap(castMap) : 50;
  const penalty = exhaustionRollPenalty(caster.conditions);

  /**
   * Каждый луч/снаряд бьёт свою цель (если задана), иначе — последнюю/первую.
   * Окна реакций приостанавливают резолв, поэтому лучи — рекурсивная
   * последовательность: следующий запускается из resume окна.
   */
  const resolveRay = (i: number): void => {
    if (i >= count) return;
    const target = targets[i] ?? targets[targets.length - 1] ?? targets[0];
    if (!target) return resolveRay(i + 1);
    const label = count > 1 ? `${subject} (${i + 1}/${count})` : subject;
    const effectCtx = { rangeType, attackType: rangeType, attackerType: creatureTypeOf(room, caster) } as const;
    const effectParts = attackRollParts(caster.effects, target.effects, effectCtx, abilities);
    // Состояния/невидимость и авто-крит — как в оружейной атаке (общие ядра attackResolve).
    const unseen = castMap ? attackUnseen(room, caster, target, castMap) : undefined;
    const distance = castMap ? gridDistanceFeet(caster, target, gridSize) : 0;
    // Опциональное правило «Окружение»: преимущество смежным врагам окружённой цели.
    const surrounded =
      !!castMap &&
      room.optionalRules.surrounded &&
      distance <= 5 &&
      hostileTokens(caster, target) &&
      isSurrounded({
        target,
        tokens: castMap.tokens,
        grid: { size: gridSize, offsetX: castMap.grid.offsetX, offsetY: castMap.grid.offsetY },
        walls: castMap.walls,
        bounds: { width: castMap.width, height: castMap.height },
      });
    const sources = collectAttackSources({
      explicit: adv,
      attackerConditions: caster.conditions,
      targetConditions: target.conditions,
      rangeType,
      effectMode: effectParts.mode,
      attackerEffects: caster.effects,
      targetEffects: target.effects,
      effectContext: effectCtx,
      abilities,
      includeTarget: true,
      unseenTarget: unseen?.unseenTarget,
      unseenAttacker: unseen?.unseenAttacker,
      surrounded,
      attackerSeesInvisible: seesInvisible(caster.effects),
      targetSeesInvisible: seesInvisible(target.effects),
    });
    const { advantage, disadvantage } = sourcesCounts(sources);
    const ac = ctx.manager.acForToken(room, target);
    const hit = attackHitRoll({
      attackExpr: withRollParts(d20Expr(stats.attack), { flat: effectParts.flat, dice: effectParts.dice }),
      advCount: advantage,
      disCount: disadvantage,
      penalty,
      critMin: 20,
      targetAc: ac,
      autoCrit: autoCrit(target.conditions, distance, rangeType),
    });
    pushRollMessage(ctx, room, {
      author,
      roll: hit.hitRoll,
      kind: 'attack',
      params: {
        subject: label,
        hit: hit.hitSuccess ? 'hit' : 'miss',
        penalty: penalty || undefined,
        sources: sources.length ? sources : undefined,
      },
    });
    // Лучи/снаряды: анимируем d20 только для первого, иначе анимации перебивают друга.
    if (count === 1 || i === 0) maybeRollAnim(ctx, hit.hitRoll);

    const windowPlan = { attacker: caster, attackerMapId: mapId, target, targetMapId: mapId, damageType, rangeType };
    const nextRay = () => resolveRay(i + 1);

    /** Урон и эффекты луча; выполняется после окон (промах мог стать попаданием). */
    const applyRayHit = (mods: WeaponDamageMods, done: () => void) => {
      // Mirror Image: попадание может принять образ вместо цели.
      if (misdirectCheck(ctx, room, mapId, target, caster)) return done();
      let damageRoll: DiceRollResult | undefined;
      if (expression) {
        const damageParts = combineRollParts([
          damageRollParts(caster.effects, { rangeType, damageType, targetId: target.id }, abilities),
          // Доп. урон по цели от атак кастера (Spirit Shroud: цель под аурой).
          takenDamageParts(target.effects, caster.id),
        ]);
        damageRoll = attackDamageRoll(expression, damageParts, hit.crit);
      }
      const applied = damageRoll
        ? applyResult(run, target, damageRoll, { subject: label, crit: hit.crit, mods })
        : undefined;
      // Отражение атак: удар полностью погашен — окно перенаправления.
      if (damageRoll && mods.redirect && damageRoll.total <= (mods.flatReduction ?? 0)) {
        openRedirectWindow(
          ctx,
          room,
          mapId,
          { attacker: caster, attack: { rangeType, damageType } },
          mods.redirect,
          { onDone: done }
        );
        return;
      }
      if (applied?.applied) {
        offerDamageReactions(ctx, room, mapId, target, caster, { amount: applied.amount, damageType });
      }
      if (def.save && def.effects?.length) {
        const save = rollTargetSaveFor(ctx, room, def, author, target, stats, def.save.ability);
        if (save.success) return done();
      }
      applyTargetEffects(run, target, stats);
      if (def.force) applyForcedMovement(ctx, room, mapId, caster, target, def.force);
      done();
    };

    /** Окно попадания: Shield/Absorb/Отражение/Режущие слова; onDone — попадание после реакций. */
    const withHitWindows = (total: number, onDone: (ok: boolean, mods?: WeaponDamageMods) => void) => {
      if (!castMap) return onDone(true);
      const opened = openAttackHitWindows(ctx, room, windowPlan, { ac, total, melee: rangeType !== 'ranged' }, (mods) => {
        if (!ctx.getRoom()) return;
        // Shield/Парирование: AC мог вырасти после реакций — пересчитываем попадание.
        const acNow = ctx.manager.acForToken(room, target) + (mods.extraAc ?? 0);
        onDone(resolveAttack(total, hit.crit, false, acNow), mods);
      });
      if (!opened) onDone(true);
    };

    // Промах: окно реакций (Направленный удар +10, кости вдохновения).
    if (hit.hitSuccess === false) {
      const opened = openAttackMissWindows(ctx, room, windowPlan, ({ bonus, inspiration }) => {
        if (!ctx.getRoom()) return;
        const total = hit.hitRoll.total + penalty + bonus + inspiration;
        if (bonus + inspiration <= 0 || !resolveAttack(total, hit.crit, false, ac)) return nextRay();
        withHitWindows(total, (ok, mods) => {
          if (ok) applyRayHit(mods ?? {}, nextRay);
          else nextRay();
        });
      });
      if (opened) return;
      return nextRay();
    }

    // Попадание: окно защитных реакций цели и защитников-союзников.
    withHitWindows(hit.hitRoll.total + penalty, (ok, mods) => {
      if (ok) applyRayHit(mods ?? {}, nextRay);
      else nextRay();
    });
  };

  resolveRay(0);
}

/** Эффекты способности/заклинания цели: при попадании или провале спасброска. */
function applyTargetEffects(run: AutomationRun, target: Token, stats: SpellStats | null): void {
  const { ctx, room, def, caster, mapId } = run;
  for (const effectDef of def.effects ?? []) {
    // Self-эффекты наложены один раз до резолва (Vampiric Touch, Sunbeam).
    if (effectDef.to === 'self') continue;
    const recipients = effectDef.to === 'targets' ? [target] : [caster];
    for (const recipient of recipients) {
      applyEffectLight(ctx, room, mapId, {
        sourceKey: def.key,
        sourceId: caster.id,
        mapId,
        effectDef,
        target: recipient,
        markedId: effectDef.markTarget ? target.id : undefined,
        maxRounds: def.maxRounds,
        untilSaveDc: stats?.dc,
        escapeDc: stats?.dc,
      });
    }
  }
}

/** Способность без атаки и сейва: урон и эффекты срабатывают сразу. */
function runAutoAbility(run: AutomationRun, stats: SpellStats | null): void {
  const { targets, expression } = run;
  for (const target of targets) {
    if (expression) applyResult(run, target, rollDice(expression));
    applyTargetEffects(run, target, stats);
  }
}

/** Божественная искра: союзник лечится, враждебная цель — спасбросок и урон (половина при успехе). */
function runHealOrDamage(run: AutomationRun, stats: SpellStats): void {
  const { def, caster, targets, abilities, proficiency } = run;
  if (!def.save || !def.heal || !def.damage) return;
  const healExpr = resolveDiceExpression(def.heal, abilities, proficiency);
  const damageExpr = resolveDiceExpression(def.damage, abilities, proficiency);
  for (const target of targets) {
    const hostile = hostileTokens(caster, target);
    const targetExpr = hostile ? damageExpr : healExpr;
    if (!targetExpr) continue;
    const roll = rollDice(targetExpr);
    let halve: boolean | undefined;
    if (hostile) {
      const save = rollTargetSaveFor(run.ctx, run.room, def, run.author, target, stats, def.save.ability);
      if (save.success && (!def.save.half || saveNoDamage(target.effects))) continue;
      halve = save.success && !saveNoDamage(target.effects);
    }
    applyResult(run, target, roll, { kind: hostile ? 'damage' : 'heal', ...(halve !== undefined && { halve }) });
  }
}

/** Спасбросок по площади: один бросок урона, половина при успехе; эффекты — при провале. */
function runSave(run: AutomationRun, stats: SpellStats): void {
  const { ctx, room, def, caster, targets, abilities, expression } = run;
  if (!def.save) return;
  // Один бросок урона на всё заклинание (5e: AoE кидает урон один раз).
  let damageRoll: DiceRollResult | null = null;
  if (expression) {
    const damageParts = damageRollParts(caster.effects, { damageType: run.damageType }, abilities);
    damageRoll = rollDice(withRollParts(expression, damageParts));
    pushRollMessage(ctx, room, {
      author: run.author,
      roll: damageRoll,
      kind: run.healing ? 'heal' : 'damage',
      params: { subject: run.subject, damageType: run.damageType },
    });
  }
  const saves: TargetSave[] = [];
  const half = def.save.half;
  for (const target of targets) {
    const save = rollTargetSaveFor(run.ctx, run.room, def, run.author, target, stats, def.save.ability);
    saves.push(save);
  }
  const applyAll = () => {
    let shaped = false;
    for (const save of saves) {
      if (!save.success) applyTargetEffects(run, save.target, stats);
      // Polymorph: провалившийся сейв превращается в выбранного зверя (концентрация — до конца).
      if (run.def.shape && !save.success) {
        shaped = applyPolymorphForm(run.ctx, run.room, run.mapId, run.caster, save.target, run.shapeForm, run.def.key) || shaped;
      }
      if (run.def.force && !save.success) {
        applyForcedMovement(run.ctx, run.room, run.mapId, run.caster, save.target, run.def.force);
      }
      if (!damageRoll) continue;
      if (save.success && (!half || saveNoDamage(save.target.effects))) continue;
      applyResult(run, save.target, damageRoll, { halve: save.success, silent: true });
    }
    // Форма — не эффект: якорь концентрации на кастере нужен для проверки уроном и снятия.
    if (run.def.concentration && shaped) anchorConcentration(run.ctx, run.room, run.caster, run.mapId, run.def);
  };
  if (openSaveInspiration(ctx, room, run.mapId, stats.dc, def.name, saves, applyAll)) return;
  applyAll();
}

/** Массовая цель без области (Mass Healing Word): каждая выбранная цель — один раз. */
function runMultiTarget(run: AutomationRun): void {
  const { def, targets, expression } = run;
  if (!def.targets || !expression) return;
  for (const target of targets.slice(0, Math.max(1, def.targets))) {
    applyResult(run, target, rollDice(expression));
  }
}

/** Одиночная цель (или повтор той же): по броску урона/лечения на цель. */
function runSingleTargets(run: AutomationRun): void {
  const { targets, subject, expression, count } = run;
  if (!expression) return;
  for (let i = 0; i < count; i++) {
    const target = targets[i] ?? targets[targets.length - 1] ?? targets[0];
    if (!target) continue;
    const label = count > 1 ? `${subject} (${i + 1}/${count})` : subject;
    applyResult(run, target, rollDice(expression), { subject: label });
  }
}

export function executeAutomation(ctx: ConnCtx, input: AutomationInput): void {
  const room = ctx.getRoom();
  if (!room) return;
  const { caster, def, mapId, stats, author } = input;
  // Черты без выбора целей (Изгнание нежити): цели собираются по радиусу от кастера.
  const rawTargets = def.autoTargets
    ? tokensAround(
        ctx,
        room,
        mapId,
        caster,
        def.autoTargets.feet,
        def.autoTargets.side,
        def.autoTargets.includeSelf === true
      )
    : input.targets;
  // Фильтр по отношению к кастеру (Conjure Woodland Beings: только враги).
  const sided = def.side ? rawTargets.filter((t) => sideMatches(caster, t, def.side!)) : rawTargets;
  // Типы-исключения (Command: нежить) — такие цели пропускаются, каст может уйти впустую.
  const targets = def.excludeCreatureTypes?.length
    ? sided.filter((t) => !def.excludeCreatureTypes!.includes(creatureTypeOf(room, t) ?? ''))
    : sided;

  if (def.resolution === 'utility' && def.utility) {
    applyUtility(ctx, { ...input, targets });
    // Far Step: телепорт при касте + выданное бонусное действие (эффект на кастера).
    if (def.effects?.length) applyDefEffects(ctx, { ...input, targets });
    return;
  }

  // Фамильяр (Find Familiar) не атакует без Pact of the Chain — ни оружием, ни способностью.
  if (def.attack && familiarCannotAttack(caster)) {
    fail(ctx, 'familiarNoAttack', { name: caster.name });
    return;
  }

  // Косметический эффект применения: клиент рисует по этому событию (в т.ч. зоны/ауры).
  emitSpellFx(
    ctx,
    {
      caster,
      mapId,
      def,
      origin: input.origin ?? null,
      direction: input.direction ?? null,
      area: input.area ?? def.area ?? null,
    },
    targets
  );

  // Новая концентрация: прошлые эффекты и зоны снимаются до создания новой зоны.
  if (def.concentration) dropConcentration(ctx, room, caster);

  // Призыв: спавн токенов по шаблону каталога (скейл круга/кастера, владелец-контролёр).
  if (def.resolution === 'summon' && def.summon) {
    runSummon(ctx, {
      caster,
      mapId,
      level: def.summon.level ?? input.manual?.castLevel ?? 1,
      def: def.summon,
      stats,
      origin: input.origin ?? null,
      ...(input.summonKey ? { summonKey: input.summonKey } : {}),
      spellKey: def.key,
    });
    if (def.concentration) anchorConcentration(ctx, room, caster, mapId, def);
    return;
  }

  // Зона создаётся независимо от мгновенного payload'а (спас/урон/эффекты — сразу).
  // Для ауры на источнике точка берётся с кастера, даже если клиент её не прислал.
  const zoneOrigin = input.origin ?? (def.zone?.anchor === 'source' ? { x: caster.x, y: caster.y } : null);
  if (def.zone && zoneOrigin) {
    createZoneFromDef(ctx, { caster, mapId, def, stats, origin: zoneOrigin, direction: input.direction });
  }

  if (def.resolution === 'effect' && def.effects?.length) {
    applyDefEffects(ctx, { ...input, targets });
    // Снятие состояний при касте (Protection from Poison): независимо от эффекта.
    if (def.endConditions?.length) {
      for (const target of targets) removeConditionInstances(ctx, room, mapId, target, def.endConditions);
    }
    return;
  }

  // Self-эффекты не-effect резолвов (Vampiric Touch, Sunbeam, Conjure Woodland Beings):
  // один раз на кастера + якорь концентрации (зоны/эффекты живут до её снятия).
  const selfEffects = (def.effects ?? []).filter((e) => e.to === 'self');
  if (selfEffects.length) {
    for (const effectDef of selfEffects) {
      applyEffectLight(ctx, room, mapId, {
        sourceKey: def.key,
        sourceId: caster.id,
        mapId,
        effectDef,
        target: caster,
        maxRounds: def.maxRounds,
        untilSaveDc: stats?.dc,
        escapeDc: stats?.dc,
      });
    }
    if (def.concentration) anchorConcentration(ctx, room, caster, mapId, def);
  }

  // Зонная концентрация без целевых эффектов: якорь на кастере — чип и «Прекратить».
  if (def.zone && def.concentration && !def.effects?.length) {
    anchorConcentration(ctx, room, caster, mapId, def);
  }

  const abilities = ctx.manager.abilitiesForToken(room, caster);
  const proficiency = proficiencyFor(ctx, room, caster);
  const expression = withSpellAbilityMod(resolveDiceExpression(def.damage ?? def.heal, abilities, proficiency), def, stats);

  const run: AutomationRun = {
    ctx,
    room,
    caster,
    def,
    mapId,
    targets,
    author,
    abilities,
    proficiency,
    // Ученик жизни / Целитель-благословенный: бонус к лечению заклинанием с ячейкой.
    healing: !!def.heal,
    healMods: lifeHealing(room, caster, def, input.manual?.castLevel),
    expression,
    subject: `${caster.name} — ${def.name}`,
    adv: input.advantage === 'a' || input.advantage === 'd' ? input.advantage : undefined,
    damageType: singleDamageType(def.damage?.types),
    count: Math.max(1, def.count ?? 1),
    ...(input.summonKey ? { shapeForm: input.summonKey } : {}),
  };

  if (def.attack && stats) return runWeaponAttacks(run, stats);
  if (def.save && stats && def.heal && def.damage) return runHealOrDamage(run, stats);
  if (def.save && stats) return runSave(run, stats);
  if (!def.save && !def.attack && def.effects?.length) return runAutoAbility(run, stats);

  if (!expression) {
    if (def.zone) return; // зона уже создана; отдельного сообщения не нужно
    const level = input.manual?.level;
    const detail = input.manual?.description?.[0] ? `\n${input.manual.description[0]}` : '';
    const params = { name: caster.name, feature: def.name, detail };
    if (level === undefined) ctx.systemMessage(room, { code: 'automation.manual', params });
    else if (level === 0) ctx.systemMessage(room, { code: 'automation.manualCantrip', params });
    else
      ctx.systemMessage(room, {
        code: 'automation.manualLevel',
        params: { ...params, level: input.manual?.castLevel ?? level },
      });
    return;
  }

  if (def.targets) return runMultiTarget(run);
  runSingleTargets(run);
}
