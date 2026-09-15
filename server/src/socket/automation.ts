import { randomUUID } from 'node:crypto';
import {
  abilityMod,
  attackRollParts,
  autoCrit,
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
  type AutomationDice,
  type AutomationDef,
  type DiceRollResult,
  type SpellStats,
  type Token,
} from 'shared';
import type { ConnCtx } from './context';
import type { Room } from '../roomTypes';
import { gridSizeOf, sheetOfToken } from '../rooms';
import { applyDamage } from './damage';
import { applyEffectTo } from './effectsApply';
import { pushRollMessage, pushSaveMessage } from './messages';
import { misdirectCheck } from './misdirect';
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
}

/** Единственный тип урона, если он однозначен (иначе защиты не применяются). */
function singleDamageType(def: AutomationDef): string | undefined {
  const types = def.damage?.types ?? [];
  return types.length === 1 ? types[0] : undefined;
}

/** Бонус владения кастера по его листу (монстры и токены без листа — 2). */
function proficiencyFor(ctx: ConnCtx, room: Room, caster: Token): number {
  const { sheet } = sheetOfToken(room, caster);
  const totalLevel = (sheet?.classes ?? []).reduce((acc, entry) => acc + Math.max(1, entry.level), 0);
  return proficiencyBonus(totalLevel || 1);
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
    if (gridDistanceFeet(token, caster, gridSizeOf(room)) > feet) return false;
    return side === 'hostile'
      ? hostileTokens(caster, token)
      : token.faction === caster.faction && token.faction !== 'neutral';
  });
}

/** Снимает прежнюю концентрацию кастера: эффекты на всех токенах и его зоны. */
function dropConcentration(ctx: ConnCtx, room: Room, casterId: string): void {
  for (const changed of ctx.manager.clearConcentration(room, casterId)) {
    ctx.emitToken(room, 'token:update', changed.mapId, changed.token);
  }
  removeZonesOfSource(ctx, room, casterId);
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
  for (const effectDef of effects) {
    const recipients = effectDef.radiusFeet
      ? tokensAround(ctx, room, mapId, caster, effectDef.radiusFeet, 'ally', true)
      : effectDef.to === 'targets'
        ? targets
        : [caster];
    const markedId = effectDef.markTarget ? targets[0]?.id : undefined;
    for (const target of recipients) {
      if (def.save && stats && effectDef.to === 'targets') {
        const ability = def.save.ability;
        const { roll: saveRoll, success } = ctx.manager.rollSave(room, target, ability, stats.dc, {
          conditionsAutoFail: true,
        });
        pushSaveMessage(ctx, room, { author, subject: `${def.name} · ${target.name}`, roll: saveRoll, success });
        if (success) continue;
        if (searExpr) {
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
          applyDamage(ctx, { target, mapId, amount: searRoll.total, damageType: searType });
        }
      }
      const effectId = applyEffectTo(ctx, room, {
        sourceKey: def.key,
        sourceId: caster.id,
        mapId,
        effectDef,
        target,
        markedId,
        untilSaveDc: stats?.dc,
        escapeDc: stats?.dc,
      });
      applied.push(target.name);
      if (!anchor) anchor = effectId;
    }
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
      ? `${caster.name}: ${def.name} → ${applied.join(', ')}`
      : `${caster.name}: ${def.name} — без эффекта`
  );
}

/** Простые утилиты действий (базовые и классовые): доп. действие/движение, отход, проверка. */
function applyUtility(ctx: ConnCtx, input: AutomationInput): void {
  const room = ctx.getRoom();
  const utility = input.def.utility;
  if (!room || !utility) return;
  const { caster, mapId, def } = input;
  const turn = ctx.manager.turnForToken(room, mapId, caster);

  switch (utility.kind) {
    case 'extraAction': {
      const amount = Math.max(1, Math.round(utility.amount ?? 1));
      if (turn) turn.extraActions += amount;
      ctx.syncCombat(room, mapId);
      ctx.systemMessage(room, `${caster.name}: ${def.name} (+${amount} действие)`);
      return;
    }
    case 'extraMovement': {
      const speed = ctx.manager.tokenSpeed(room, caster);
      ctx.manager.grantExtraMovement(room, mapId, caster, speed);
      ctx.syncCombat(room, mapId);
      ctx.systemMessage(room, `${caster.name}: ${def.name} (+${speed} фт передвижения)`);
      return;
    }
    case 'disengage': {
      if (turn) turn.disengaged = true;
      ctx.syncCombat(room, mapId);
      ctx.systemMessage(room, `${caster.name}: ${def.name}`);
      return;
    }
    case 'extraAttacks': {
      const amount = Math.max(1, Math.round(utility.amount ?? 2));
      if (turn) turn.flurryAttacks += amount;
      ctx.syncCombat(room, mapId);
      ctx.systemMessage(room, `${caster.name}: ${def.name} (+${amount})`);
      return;
    }
    case 'weaponAttack': {
      const amount = Math.max(1, Math.round(utility.amount ?? 1));
      if (turn) turn.attacksRemaining += amount;
      ctx.syncCombat(room, mapId);
      ctx.systemMessage(room, `${caster.name}: ${def.name} (+${amount} атака оружием)`);
      return;
    }
    case 'healPool': {
      // Поддержание жизни: пул HP распределяется по раненым союзникам до половины максимума.
      let pool = Math.max(0, Math.round(utility.amount ?? 0));
      const halfOf = (token: Token) => Math.floor(statNumber(token.hpMax) / 2);
      const wounded = [...input.targets]
        .filter((token) => token.hpCurrent <= halfOf(token) && token.hpCurrent < statNumber(token.hpMax))
        .sort(
          (a, b) =>
            a.hpCurrent / Math.max(1, statNumber(a.hpMax)) - b.hpCurrent / Math.max(1, statNumber(b.hpMax))
        );
      const healed: string[] = [];
      for (const target of wounded) {
        if (pool <= 0) break;
        const space = Math.min(halfOf(target) - target.hpCurrent, statNumber(target.hpMax) - target.hpCurrent);
        const amount = Math.min(pool, Math.max(0, space));
        if (amount <= 0) continue;
        applyDamage(ctx, { target, mapId, amount, kind: 'heal' });
        pool -= amount;
        healed.push(`${target.name} +${amount}`);
      }
      ctx.syncCombat(room, mapId);
      ctx.systemMessage(
        room,
        healed.length ? `${caster.name}: ${def.name} → ${healed.join(', ')}` : `${caster.name}: ${def.name} — нет раненых`
      );
      return;
    }
    case 'patientDefense': {
      if (turn) turn.disengaged = true;
      ctx.manager.applyEffect(room, caster, {
        id: randomUUID(),
        name: 'Уклонение',
        sourceKey: `${def.key}:dodge`,
        sourceId: caster.id,
        duration: { type: 'endOfTurn', of: 'target' },
        modifiers: [
          { id: randomUUID(), target: 'attack', mode: 'disadvantage', filter: { direction: 'against' } },
          { id: randomUUID(), target: 'save', mode: 'advantage', filter: { ability: 'dex' } },
        ],
      });
      ctx.emitToken(room, 'token:update', mapId, caster);
      ctx.syncCombat(room, mapId);
      ctx.systemMessage(room, `${caster.name}: ${def.name} (Отход + Уклонение)`);
      return;
    }
    case 'stepOfTheWind': {
      if (turn) turn.disengaged = true;
      const speed = ctx.manager.tokenSpeed(room, caster);
      ctx.manager.grantExtraMovement(room, mapId, caster, speed);
      ctx.syncCombat(room, mapId);
      ctx.systemMessage(room, `${caster.name}: ${def.name} (Отход + Рывок)`);
      return;
    }
    case 'check': {
      const ability = utility.ability ?? 'dex';
      const mod = ctx.manager.abilityModForToken(room, caster, ability);
      const expression = mod >= 0 ? `d20+${mod}` : `d20${mod}`;
      const roll = rollDice(expression);
      pushRollMessage(ctx, room, {
        author: input.author,
        roll,
        kind: 'check',
        params: { subject: `${def.name}: ${caster.name}` },
      });
      return;
    }
  }
}

export function executeAutomation(ctx: ConnCtx, input: AutomationInput): void {
  const room = ctx.getRoom();
  if (!room) return;
  const { caster, def, mapId, stats, author } = input;
  const healing = !!def.heal;
  // Черты без выбора целей (Изгнание нежити): цели собираются по радиусу от кастера.
  const targets = def.autoTargets
    ? tokensAround(ctx, room, mapId, caster, def.autoTargets.feet, def.autoTargets.side)
    : input.targets;
  const abilities = ctx.manager.abilitiesForToken(room, caster);
  const proficiency = proficiencyFor(ctx, room, caster);
  // Ученик жизни / Целитель-благословенный: бонус к лечению заклинанием с ячейкой.
  const healMods = lifeHealing(room, caster, def, input.manual?.castLevel);
  const healValue = (total: number) => (healing ? total + healMods.bonus : total);
  const healAfter = (target: Token) => {
    if (healing && healMods.selfHeal && target.id !== caster.id) {
      applyDamage(ctx, { target: caster, mapId, amount: healMods.bonus, kind: 'heal' });
    }
  };

  if (def.resolution === 'utility' && def.utility) {
    applyUtility(ctx, { ...input, targets });
    return;
  }

  // Новая концентрация: прошлые эффекты и зоны снимаются до создания новой зоны.
  if (def.concentration) dropConcentration(ctx, room, caster.id);

  // Зона создаётся независимо от мгновенного payload'а (спас/урон/эффекты — сразу).
  // Для ауры на источнике точка берётся с кастера, даже если клиент её не прислал.
  const zoneOrigin = input.origin ?? (def.zone?.anchor === 'source' ? { x: caster.x, y: caster.y } : null);
  if (def.zone && zoneOrigin) {
    createZoneFromDef(ctx, {
      caster,
      mapId,
      def,
      stats,
      origin: zoneOrigin,
      direction: input.direction,
    });
  }

  if (def.resolution === 'effect' && def.effects?.length) {
    applyDefEffects(ctx, { ...input, targets });
    return;
  }

  // Зонная концентрация без целевых эффектов: якорь на кастере — чип и «Прекратить».
  if (def.zone && def.concentration && !def.effects?.length) {
    anchorConcentration(ctx, room, caster, mapId, def);
  }

  const expression = resolveDiceExpression(def.damage ?? def.heal, abilities, proficiency);
  if (!expression) {
    if (def.zone) return; // зона уже создана; отдельного сообщения не нужно
    const level = input.manual?.level;
    const levelText =
      level === undefined ? '' : level === 0 ? ' (фокус)' : ` (${input.manual?.castLevel ?? level} круг)`;
    const detail = input.manual?.description?.[0] ? `\n${input.manual.description[0]}` : '';
    ctx.systemMessage(room, `${caster.name}: ${def.name}${levelText}${detail}`);
    return;
  }

  const subject = `${caster.name} — ${def.name}`;
  const adv: 'a' | 'd' | undefined = input.advantage === 'a' || input.advantage === 'd' ? input.advantage : undefined;
  const damageType = singleDamageType(def);
  const count = Math.max(1, def.count ?? 1);

  if (def.attack && stats) {
    const { rangeType } = def.attack;
    const castMap = ctx.manager.findMap(room, mapId);
    const gridSize = gridSizeOf(room);
    for (let i = 0; i < count; i++) {
      // Каждый луч/снаряд бьёт свою цель (если задана), иначе — последнюю/первую.
      const target = targets[i] ?? targets[targets.length - 1] ?? targets[0];
      if (!target) continue;
      const label = count > 1 ? `${subject} (${i + 1}/${count})` : subject;
      const effectParts = attackRollParts(
        caster.effects,
        target.effects,
        { rangeType, attackType: rangeType },
        abilities
      );
      const { mode: advMode } = countAttackAdvantage({
        explicit: adv,
        attackerConditions: caster.conditions,
        targetConditions: target.conditions,
        rangeType,
        effectMode: effectParts.mode,
      });
      const distance = castMap ? gridDistanceFeet(caster, target, gridSize) : 0;
      const penalty = exhaustionRollPenalty(caster.conditions);
      const hitExpr = withRollParts(`d20+${stats.attack + penalty}`, {
        flat: effectParts.flat,
        dice: effectParts.dice,
      });
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
      if (!hitSuccess) continue;
      // Mirror Image: попадание может принять образ вместо цели.
      if (misdirectCheck(ctx, room, mapId, target, caster)) continue;
      const damageParts = damageRollParts(caster.effects, { rangeType, damageType, targetId: target.id }, abilities);
      const damageRoll = rollDice(withRollParts(expression, damageParts), Math.random, { doubleDice: crit });
      applyDamage(ctx, {
        target,
        mapId,
        amount: healValue(damageRoll.total),
        damageType,
        roll: damageRoll,
        author,
        kind: healing ? 'heal' : 'damage',
        params: { subject: label, damageType },
        crit,
      });
      healAfter(target);
      // Эффекты на попадании (Shocking Grasp: запрет OA до начала следующего хода).
      if (def.effects?.length) {
        for (const effectDef of def.effects) {
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
    }
    return;
  }

  // Божественная искра: союзник лечится, враждебная цель — спасбросок и урон (половина при успехе).
  if (def.save && stats && def.heal && def.damage) {
    const healExpr = resolveDiceExpression(def.heal, abilities, proficiency);
    const sparkDamageExpr = resolveDiceExpression(def.damage, abilities, proficiency);
    for (const target of targets) {
      const hostile = hostileTokens(caster, target);
      const targetExpr = hostile ? sparkDamageExpr : healExpr;
      if (!targetExpr) continue;
      const roll = rollDice(targetExpr);
      let halve = false;
      if (hostile) {
        const saveAbility = def.save.ability;
        const { roll: saveRoll, success } = ctx.manager.rollSave(room, target, saveAbility, stats.dc, {
          conditionsAutoFail: true,
        });
        pushSaveMessage(ctx, room, { author, subject: `${def.name} · ${target.name}`, roll: saveRoll, success });
        if (success && !def.save.half) continue;
        halve = success;
      }
      applyDamage(ctx, {
        target,
        mapId,
        amount: roll.total,
        damageType,
        halve,
        roll,
        author,
        kind: hostile ? 'damage' : 'heal',
        params: { subject, damageType },
      });
    }
    return;
  }

  if (def.save && stats) {
    // Один бросок урона на всё заклинание (5e: AoE кидает урон один раз).
    const damageParts = damageRollParts(caster.effects, { damageType }, ctx.manager.abilitiesForToken(room, caster));
    const damageRoll = rollDice(withRollParts(expression, damageParts));
    pushRollMessage(ctx, room, {
      author,
      roll: damageRoll,
      kind: healing ? 'heal' : 'damage',
      params: { subject, damageType },
    });
    for (const target of targets) {
      const saveAbility = def.save.ability;
      const { roll: saveRoll, success } = ctx.manager.rollSave(room, target, saveAbility, stats.dc, {
        conditionsAutoFail: true,
      });
      pushSaveMessage(ctx, room, { author, subject: `${def.name} · ${target.name}`, roll: saveRoll, success });
      if (success && !def.save.half) continue;
      applyDamage(ctx, {
        target,
        mapId,
        amount: healValue(damageRoll.total),
        damageType,
        halve: success,
        kind: healing ? 'heal' : 'damage',
      });
      healAfter(target);
    }
    return;
  }

  // Массовая цель без области (Mass Healing Word): каждая выбранная цель — один раз.
  if (def.targets) {
    for (const target of targets.slice(0, Math.max(1, def.targets))) {
      const damageRoll = rollDice(expression);
      applyDamage(ctx, {
        target,
        mapId,
        amount: healValue(damageRoll.total),
        damageType,
        roll: damageRoll,
        author,
        kind: healing ? 'heal' : 'damage',
        params: { subject, damageType },
      });
      healAfter(target);
    }
    return;
  }

  for (let i = 0; i < count; i++) {
    const target = targets[i] ?? targets[targets.length - 1] ?? targets[0];
    if (!target) continue;
    const label = count > 1 ? `${subject} (${i + 1}/${count})` : subject;
    const damageRoll = rollDice(expression);
    applyDamage(ctx, {
      target,
      mapId,
      amount: healValue(damageRoll.total),
      damageType,
      roll: damageRoll,
      author,
      kind: healing ? 'heal' : 'damage',
      params: { subject: label, damageType },
    });
    healAfter(target);
  }
}
