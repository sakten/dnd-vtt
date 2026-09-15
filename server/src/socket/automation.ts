import { randomUUID } from 'node:crypto';
import {
  attackRollParts,
  autoCrit,
  autoFailSave,
  countAttackAdvantage,
  damageRollParts,
  exhaustionRollPenalty,
  gridDistanceFeet,
  isCriticalFail,
  isCriticalHit,
  resolveAttack,
  rollDice,
  withAdvantage,
  withRollParts,
  type AutomationDef,
  type SpellStats,
  type Token,
} from 'shared';
import type { ConnCtx } from './context';
import type { Room } from '../roomTypes';
import { applyDamage } from './damage';
import { applyEffectTo } from './effectsApply';
import { pushRollMessage } from './messages';
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

function diceExpression(def: AutomationDef): string | null {
  return def.damage?.dice ?? def.heal?.dice ?? null;
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

/** Союзники кастера (совпадение не-нейтральной фракции) в радиусе, включая его самого. */
function alliedTokensInRange(ctx: ConnCtx, room: Room, mapId: string, caster: Token, radiusFeet: number): Token[] {
  const map = ctx.manager.findMap(room, mapId);
  if (!map) return [caster];
  const size = room.scene.grid.size || 50;
  return map.tokens.filter(
    (token) =>
      token.faction === caster.faction && token.faction !== 'neutral' && gridDistanceFeet(token, caster, size) <= radiusFeet
  );
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
  for (const effectDef of effects) {
    const recipients = effectDef.radiusFeet
      ? alliedTokensInRange(ctx, room, mapId, caster, effectDef.radiusFeet)
      : effectDef.to === 'targets'
        ? targets
        : [caster];
    const markedId = effectDef.markTarget ? targets[0]?.id : undefined;
    for (const target of recipients) {
      if (def.save && stats && effectDef.to === 'targets') {
        const ability = def.save.ability;
        const parts = ctx.manager.savePartsForToken(room, target, ability);
        const saveRoll = rollDice(withAdvantage(withRollParts('d20', parts), parts.mode));
        const success = !autoFailSave(target.conditions, ability) && saveRoll.total >= stats.dc;
        pushRollMessage(ctx, room, {
          author,
          roll: saveRoll,
          kind: 'save',
          params: {
            subject: `${def.name} · ${target.name}`,
            saveOutcome: success ? 'success' : 'fail',
          },
        });
        if (success) continue;
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
  const { caster, def, mapId, targets, stats, author } = input;
  const healing = !!def.heal;

  if (def.resolution === 'utility' && def.utility) {
    applyUtility(ctx, input);
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
    applyDefEffects(ctx, input);
    return;
  }

  // Зонная концентрация без целевых эффектов: якорь на кастере — чип и «Прекратить».
  if (def.zone && def.concentration && !def.effects?.length) {
    anchorConcentration(ctx, room, caster, mapId, def);
  }

  const expression = diceExpression(def);
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
    const gridSize = room.scene.grid.size || 50;
    const abilities = ctx.manager.abilitiesForToken(room, caster);
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
        amount: damageRoll.total,
        damageType,
        roll: damageRoll,
        author,
        kind: healing ? 'heal' : 'damage',
        params: { subject: label, damageType },
        crit,
      });
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
      const parts = ctx.manager.savePartsForToken(room, target, saveAbility);
      const saveRoll = rollDice(withAdvantage(withRollParts('d20', parts), parts.mode));
      const success = !autoFailSave(target.conditions, saveAbility) && saveRoll.total >= stats.dc;
      pushRollMessage(ctx, room, {
        author,
        roll: saveRoll,
        kind: 'save',
        params: {
          subject: `${def.name} · ${target.name}`,
          saveOutcome: success ? 'success' : 'fail',
        },
      });
      if (success && !def.save.half) continue;
      applyDamage(ctx, {
        target,
        mapId,
        amount: damageRoll.total,
        damageType,
        halve: success,
        kind: healing ? 'heal' : 'damage',
      });
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
        amount: damageRoll.total,
        damageType,
        roll: damageRoll,
        author,
        kind: healing ? 'heal' : 'damage',
        params: { subject, damageType },
      });
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
      amount: damageRoll.total,
      damageType,
      roll: damageRoll,
      author,
      kind: healing ? 'heal' : 'damage',
      params: { subject: label, damageType },
    });
  }
}
