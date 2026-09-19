import { randomUUID } from 'node:crypto';
import {
  abilityMod,
  attackRollParts,
  autoCrit,
  autoFailSave,
  characterLevel,
  countAttackAdvantage,
  damageRollParts,
  exhaustionRollPenalty,
  gridDistanceFeet,
  hostileTokens,
  isCriticalFail,
  isCriticalHit,
  proficiencyBonus,
  resolveAbilityMods,
  resolveAttack,
  rollDice,
  statNumber,
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
import { bonusDieOptions, spendBonusDie } from './bonusDice';
import { applyDamage } from './damage';
import { applyEffectTo } from './effectsApply';
import { emitSpellFx } from './fx';
import { pushRollMessage, pushSaveMessage } from './messages';
import { misdirectCheck } from './misdirect';
import { startMovementTurns } from './moveTurns';
import { audienceOf } from './reactions/internal';
import { openReactionWindow, type ReactionOfferInput } from './reactions/queue';
import { maybeRollAnim } from './rollAnim';
import { createZoneFromDef, removeZonesOfSource } from './zones';

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
}

/** Единственный тип урона, если он однозначен (иначе защиты не применяются). */
function singleDamageType(def: AutomationDef): string | undefined {
  const types = def.damage?.types ?? [];
  return types.length === 1 ? types[0] : undefined;
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

/** Токены в радиусе от кастера: враждебные (`hostile`) или союзные (без нейтралов). */
function tokensAround(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  caster: Token,
  feet: number,
  side: 'hostile' | 'ally',
  includeSelf = false
): Token[] {
  const map = ctx.manager.findMap(room, mapId);
  if (!map) return includeSelf ? [caster] : [];
  return map.tokens.filter((token) => {
    if (token.id === caster.id) return includeSelf;
    if (gridDistanceFeet(token, caster, gridSizeOfMap(map)) > feet) return false;
    return side === 'hostile'
      ? hostileTokens(caster, token)
      : token.faction === caster.faction && token.faction !== 'neutral';
  });
}

/** Снимает прежнюю концентрацию кастера: эффекты на всех токенах и его зоны. */
function dropConcentration(ctx: ConnCtx, room: Room, caster: Token): void {
  // Концентрация принадлежит персонажу, а не токену: у персонажа бывают токены на разных картах.
  const sourceIds = new Set<string>([caster.id]);
  if (caster.libraryItemId) {
    for (const map of room.scene.maps) {
      for (const token of map.tokens) {
        if (token.libraryItemId === caster.libraryItemId) sourceIds.add(token.id);
      }
    }
  }
  for (const sourceId of sourceIds) {
    for (const changed of ctx.manager.clearConcentration(room, sourceId)) {
      ctx.emitToken(room, 'token:update', changed.mapId, changed.token);
    }
    removeZonesOfSource(ctx, room, sourceId);
  }
}

/** Якорь концентрации на кастере для зон без целевых эффектов (HoH, Spirit Guardians). */
function anchorConcentration(ctx: ConnCtx, room: Room, caster: Token, mapId: string, def: AutomationDef): void {
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
  const { roll, success } = ctx.manager.rollSave(room, target, ability, stats.dc, { conditionsAutoFail: true });
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
  }));
  const opened = openReactionWindow(ctx, room, {
    mapId,
    trigger: 'saveFail',
    sourceName: subject,
    offers,
    resume: (choices) => {
      const currentRoom = ctx.getRoom();
      if (!currentRoom) return;
      for (const choice of choices) {
        const id = choice.optionId ?? '';
        if (!id.startsWith('bonusdie:')) continue;
        const save = failed.find((s) => s.target.id === choice.tokenId);
        const target = ctx.manager.findToken(currentRoom, choice.mapId, choice.tokenId);
        if (!save || !target) continue;
        const bonus = spendBonusDie(ctx, currentRoom, choice.mapId, target, id.slice('bonusdie:'.length));
        if (bonus > 0 && !save.autoFail && save.roll.total + bonus >= dc) {
          save.success = true;
          ctx.systemMessage(currentRoom, {
            code: 'automation.bardicSuccess',
            params: { name: target.name },
          });
        }
      }
      resume();
    },
  });
  return opened;
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
  const searType = searExpr ? singleDamageType(def) : undefined;
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
      if (app.save?.success) continue;
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
        applyDamage(ctx, { target: app.target, mapId, amount: searRoll.total, damageType: searType });
      }
      const effectId = applyEffectTo(ctx, room, {
        sourceKey: def.key,
        sourceId: caster.id,
        mapId,
        effectDef: app.effectDef,
        target: app.target,
        markedId: app.effectDef.markTarget ? targets[0]?.id : undefined,
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
          applyEffectTo(ctx, room, {
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
    const base = mod >= 0 ? `d20+${mod}` : `d20${mod}`;
    // Галка Adv/Dis над ROLL: преимущество/помеха на проверку (Скрыться, Поиск).
    const roll = rollDice(withAdvantage(base, input.advantage ?? null));
    pushRollMessage(ctx, room, {
      author: input.author,
      roll,
      kind: 'check',
      params: { subject: `${input.def.name}: ${input.caster.name}` },
    });
    maybeRollAnim(ctx, roll);
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

/** Единая точка урона/лечения прогона: бонус Ученика жизни, сообщение, самолечение Целителя. */
function applyResult(
  run: AutomationRun,
  target: Token,
  roll: DiceRollResult,
  opts: { subject?: string; halve?: boolean; kind?: 'damage' | 'heal'; crit?: boolean; silent?: boolean } = {}
): void {
  applyDamage(run.ctx, {
    target,
    mapId: run.mapId,
    amount: healValue(run, roll.total),
    damageType: run.damageType,
    ...(opts.silent ? {} : { roll, author: run.author, params: { subject: opts.subject ?? run.subject, damageType: run.damageType } }),
    kind: opts.kind ?? (run.healing ? 'heal' : 'damage'),
    ...(opts.halve !== undefined && { halve: opts.halve }),
    ...(opts.crit !== undefined && { crit: opts.crit }),
  });
  healAfter(run, target);
}

/** Атака заклинанием (лучи/снаряды): попадание, урон, эффекты на попадании. */
function runWeaponAttacks(run: AutomationRun, stats: SpellStats): void {
  const { ctx, room, def, caster, mapId, targets, author, abilities, expression, subject, damageType, adv, count } = run;
  if (!def.attack) return;
  const { rangeType } = def.attack;
  const castMap = ctx.manager.findMap(room, mapId);
  const gridSize = castMap ? gridSizeOfMap(castMap) : 50;
  for (let i = 0; i < count; i++) {
    // Каждый луч/снаряд бьёт свою цель (если задана), иначе — последнюю/первую.
    const target = targets[i] ?? targets[targets.length - 1] ?? targets[0];
    if (!target) continue;
    const label = count > 1 ? `${subject} (${i + 1}/${count})` : subject;
    const effectParts = attackRollParts(caster.effects, target.effects, { rangeType, attackType: rangeType }, abilities);
    const { mode: advMode } = countAttackAdvantage({
      explicit: adv,
      attackerConditions: caster.conditions,
      targetConditions: target.conditions,
      rangeType,
      effectMode: effectParts.mode,
    });
    const distance = castMap ? gridDistanceFeet(caster, target, gridSize) : 0;
    const penalty = exhaustionRollPenalty(caster.conditions);
    const hitExpr = withRollParts(`d20+${stats.attack + penalty}`, { flat: effectParts.flat, dice: effectParts.dice });
    const hitRoll = rollDice(withAdvantage(hitExpr, advMode));
    const crit = isCriticalHit(hitRoll) || autoCrit(target.conditions, distance, rangeType);
    const targetAc = ctx.manager.acForToken(room, target);
    const hitSuccess = targetAc > 0 ? resolveAttack(hitRoll.total, crit, isCriticalFail(hitRoll), targetAc) : true;
    pushRollMessage(ctx, room, {
      author,
      roll: hitRoll,
      kind: 'attack',
      params: { subject: label, hit: hitSuccess ? 'hit' : 'miss' },
    });
    // Лучи/снаряды: анимируем d20 только для первого, иначе анимации перебивают друг друга.
    if (count === 1 || i === 0) maybeRollAnim(ctx, hitRoll);
    if (!hitSuccess) continue;
    // Mirror Image: попадание может принять образ вместо цели.
    if (misdirectCheck(ctx, room, mapId, target, caster)) continue;
    if (expression) {
      const damageParts = damageRollParts(caster.effects, { rangeType, damageType, targetId: target.id }, abilities);
      const damageRoll = rollDice(withRollParts(expression, damageParts), Math.random, { doubleDice: crit });
      applyResult(run, target, damageRoll, { subject: label, crit });
    }
    if (def.save && def.effects?.length) {
      const save = rollTargetSaveFor(ctx, room, def, author, target, stats, def.save.ability);
      if (save.success) continue;
    }
    applyTargetEffects(run, target, stats);
  }
}

/** Эффекты способности/заклинания цели: при попадании или провале спасброска. */
function applyTargetEffects(run: AutomationRun, target: Token, stats: SpellStats | null): void {
  const { ctx, room, def, caster, mapId } = run;
  for (const effectDef of def.effects ?? []) {
    const recipients = effectDef.to === 'targets' ? [target] : [caster];
    for (const recipient of recipients) {
      applyEffectTo(ctx, room, {
        sourceKey: def.key,
        sourceId: caster.id,
        mapId,
        effectDef,
        target: recipient,
        markedId: effectDef.markTarget ? target.id : undefined,
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
      if (save.success && !def.save.half) continue;
      halve = save.success;
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
    for (const save of saves) {
      if (!save.success) applyTargetEffects(run, save.target, stats);
      if (!damageRoll) continue;
      if (save.success && !half) continue;
      applyResult(run, save.target, damageRoll, { halve: save.success, silent: true });
    }
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
  const targets = def.autoTargets
    ? tokensAround(ctx, room, mapId, caster, def.autoTargets.feet, def.autoTargets.side)
    : input.targets;

  if (def.resolution === 'utility' && def.utility) {
    applyUtility(ctx, { ...input, targets });
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

  // Зона создаётся независимо от мгновенного payload'а (спас/урон/эффекты — сразу).
  // Для ауры на источнике точка берётся с кастера, даже если клиент её не прислал.
  const zoneOrigin = input.origin ?? (def.zone?.anchor === 'source' ? { x: caster.x, y: caster.y } : null);
  if (def.zone && zoneOrigin) {
    createZoneFromDef(ctx, { caster, mapId, def, stats, origin: zoneOrigin, direction: input.direction });
  }

  if (def.resolution === 'effect' && def.effects?.length) {
    applyDefEffects(ctx, { ...input, targets });
    return;
  }

  // Зонная концентрация без целевых эффектов: якорь на кастере — чип и «Прекратить».
  if (def.zone && def.concentration && !def.effects?.length) {
    anchorConcentration(ctx, room, caster, mapId, def);
  }

  const abilities = ctx.manager.abilitiesForToken(room, caster);
  const proficiency = proficiencyFor(ctx, room, caster);
  const expression = resolveDiceExpression(def.damage ?? def.heal, abilities, proficiency);

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
    damageType: singleDamageType(def),
    count: Math.max(1, def.count ?? 1),
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
