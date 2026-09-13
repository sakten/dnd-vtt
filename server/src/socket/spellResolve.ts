import { randomUUID } from 'node:crypto';
import {
  advantageAgainst,
  applyDamageDefenses,
  attackRollParts,
  attackerAdvantage,
  attackerDisadvantage,
  autoCrit,
  autoFailSave,
  damageRollParts,
  disadvantageAgainst,
  exhaustionRollPenalty,
  gridDistanceFeet,
  isCriticalFail,
  isCriticalHit,
  isHealingSpell,
  resolveAttack,
  rollDice,
  rollLabelText,
  spellAttackCount,
  spellDamageExpression,
  spellEffectDefs,
  spellIsSelf,
  spellRangeFeet,
  statNumber,
  withAdvantage,
  withRollParts,
  type ChatMessage,
  type DiceRollResult,
  type EffectInstance,
  type RollKind,
  type RollLabelParams,
  type Spell,
  type SpellStats,
  type Token,
} from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { rollConcentrationOnDamage } from './effects';

export interface SpellCastInput {
  caster: Token;
  mapId: string;
  spell: Spell;
  castLevel: number;
  characterLevel: number;
  /** Боевые характеристики кастера; null — нет заклинательной характеристики. */
  stats: SpellStats | null;
  targets: Token[];
  advantage?: 'a' | 'd';
  /** Цели собраны из области (origin уже проверен вызывающим). */
  area?: boolean;
  author: string;
}

/** Проверка возможности накладывания (до списания ячейки/слота). */
export function validateSpellCast(room: Room, input: SpellCastInput): string | undefined {
  const { caster, spell } = input;
  const expression = spellDamageExpression(spell, input.castLevel, input.characterLevel);
  const targets = input.targets.filter((t) => !!t);

  if (spellEffectDefs(spell.key)?.some((d) => d.markTarget) && !targets[0]) {
    return 'Не выбрана цель';
  }

  if (spell.spellAttack && expression) {
    if (!input.stats) return 'Нет заклинательной атаки';
    if (!targets[0]) return 'Не выбрана цель';
  } else if (spell.save && expression) {
    if (!input.stats) return 'Нет сложности заклинаний';
    if (!targets.length && !input.area) return 'Не выбрана цель';
  }

  if (input.area) return undefined;
  const rangeFeet = spellRangeFeet(spell);
  if (rangeFeet === null || spellIsSelf(spell)) return undefined;
  const gridSize = room.scene.grid.size || 50;
  for (const target of targets) {
    if (target.id === caster.id) continue;
    const feet = gridDistanceFeet(caster, target, gridSize);
    if (feet > rangeFeet) return `Вне дистанции: ${Math.round(feet)} фт`;
  }
  return undefined;
}

/** Сообщение-бросок в чат. */
function pushRoll(
  ctx: ConnCtx,
  room: Room,
  author: string,
  roll: DiceRollResult,
  kind: RollKind,
  params: RollLabelParams,
  crit?: boolean
) {
  const message: ChatMessage = {
    id: randomUUID(),
    kind: 'roll',
    author,
    roll,
    label: ctx.cleanLabel(rollLabelText(kind, params)),
    rollKind: kind,
    labelParams: params,
    crit,
    ts: Date.now(),
  };
  ctx.manager.addMessage(room, message);
  ctx.broadcastAll('chat:message', message);
}

function applyHp(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  target: Token,
  amount: number,
  opts: { crit?: boolean } = {}
) {
  if (!amount) return;
  const changed = ctx.manager.adjustTokenHp(room, mapId, target, amount, opts);
  for (const c of changed) ctx.emitToken(room, 'token:update', c.mapId, c.token);
  const controllerId = ctx.manager.controllerOfToken(room, target);
  if (controllerId) ctx.emitResources(room, controllerId);
  ctx.broadcastAll('players:update', ctx.manager.toState(room).players);
  if (amount < 0) rollConcentrationOnDamage(ctx, room, target, -amount);
}

/** Тип урона заклинания, если он однозначен (иначе защиты не применяются). */
function spellDamageType(spell: Spell): string | undefined {
  const types = spell.damage?.types ?? [];
  return types.length === 1 ? types[0] : undefined;
}

/**
 * Резолв заклинания: spell-атака / спасбросок / лечение / auto-урон / manual.
 * Экономика (ячейка, слот действия) и права — на вызывающем.
 */
export function resolveSpellCast(ctx: ConnCtx, input: SpellCastInput): { error?: string } {
  const room = ctx.getRoom();
  if (!room) return {};
  const invalid = validateSpellCast(room, input);
  if (invalid) return { error: invalid };

  const { caster, spell, castLevel, characterLevel, stats, author } = input;
  const expression = spellDamageExpression(spell, castLevel, characterLevel);
  const healing = isHealingSpell(spell);
  const subject = `${caster.name} — ${spell.name}`;
  const targets = input.targets.filter((t) => !!t);
  const adv: 'a' | 'd' | undefined = input.advantage === 'a' || input.advantage === 'd' ? input.advantage : undefined;
  const damageType = spellDamageType(spell);

  // Эффекты Ф8: баффы/дебаффы без урона (Shield, Bless, Haste…). Раньше веток
  // урона: у Bless/Bane в данных есть «фантомный» 1d4 из описания.
  const effectDefs = spellEffectDefs(spell.key);
  if (effectDefs?.length) {
    if (spell.concentration) {
      for (const changed of ctx.manager.clearConcentration(room, caster.id)) {
        ctx.emitToken(room, 'token:update', changed.mapId, changed.token);
      }
    }
    const applied: string[] = [];
    let anchor: string | undefined;
    for (const def of effectDefs) {
      const recipients = def.to === 'targets' ? targets : [caster];
      const markedId = def.markTarget ? targets[0]?.id : undefined;
      for (const target of recipients) {
        if (spell.save?.length && stats && def.to === 'targets' && spell.save[0]) {
          const ability = spell.save[0];
          const parts = ctx.manager.savePartsForToken(room, target, ability);
          const saveRoll = rollDice(withAdvantage(withRollParts('d20', parts), parts.mode));
          const success = !autoFailSave(target.conditions, ability) && saveRoll.total >= stats.dc;
          pushRoll(ctx, room, author, saveRoll, 'save', {
            subject: `${spell.name} · ${target.name}`,
            saveOutcome: success ? 'success' : 'fail',
          });
          if (success) continue;
        }
        for (const stale of target.effects.filter((e) => e.sourceKey === spell.key && e.sourceId === caster.id)) {
          ctx.manager.removeEffect(room, target, stale.id);
        }
        const effectId = randomUUID();
        let duration = def.duration;
        if (duration.type === 'untilSave' && stats) duration = { ...duration, dc: stats.dc };
        const effect: EffectInstance = {
          id: effectId,
          name: def.name,
          sourceKey: spell.key,
          sourceId: caster.id,
          concentration: def.concentration,
          duration,
          modifiers: def.modifiers.map((m, i) => ({
            ...m,
            id: `${effectId}:m${i}`,
            ...(markedId ? { filter: { ...m.filter, targetId: markedId } } : {}),
          })),
          conditions: def.conditions,
        };
        ctx.manager.applyEffect(room, target, effect);
        ctx.emitToken(room, 'token:update', input.mapId, target);
        applied.push(target.name);
        if (!anchor) anchor = effectId;
      }
    }
    if (spell.concentration && !effectDefs.some((d) => d.to !== 'targets')) {
      // Чистый target-only каст: на кастере держим якорь концентрации для чипа.
      const anchorId = randomUUID();
      ctx.manager.applyEffect(room, caster, {
        id: anchorId,
        name: spell.name,
        sourceKey: spell.key,
        sourceId: caster.id,
        concentration: true,
        duration: { type: 'concentration' },
        modifiers: [],
      });
      ctx.emitToken(room, 'token:update', input.mapId, caster);
      if (!anchor) anchor = anchorId;
    }
    if (spell.concentration && anchor) ctx.manager.setConcentration(room, input.mapId, caster, anchor);
    ctx.syncCombat(room, input.mapId);
    ctx.systemMessage(
      room,
      applied.length
        ? `${caster.name}: ${spell.name} → ${applied.join(', ')}`
        : `${caster.name}: ${spell.name} — без эффекта`
    );
    return {};
  }

  if (spell.spellAttack && expression && stats) {
    const count = spellAttackCount(spell, castLevel, characterLevel);
    const rangeType = spell.spellAttack;
    const castMap = ctx.manager.findMap(room, input.mapId);
    const gridSize = room.scene.grid.size || 50;
    const abilities = ctx.manager.abilitiesForToken(room, caster);
    for (let i = 0; i < count; i++) {
      // Каждый луч/снаряд бьёт свою цель (если задана), иначе — последнюю/первую.
      const target = targets[i] ?? targets[targets.length - 1] ?? targets[0];
      const label = count > 1 ? `${subject} (${i + 1}/${count})` : subject;
      let advCount = adv === 'a' ? 1 : 0;
      let disCount = adv === 'd' ? 1 : 0;
      if (attackerAdvantage(caster.conditions)) advCount += 1;
      if (attackerDisadvantage(caster.conditions)) disCount += 1;
      if (advantageAgainst(target.conditions, rangeType)) advCount += 1;
      if (disadvantageAgainst(target.conditions, rangeType)) disCount += 1;
      const effectParts = attackRollParts(
        caster.effects,
        target.effects,
        { rangeType, attackType: rangeType },
        abilities
      );
      if (effectParts.mode === 'a') advCount += 1;
      if (effectParts.mode === 'd') disCount += 1;
      const advMode: 'a' | 'd' | undefined = advCount > disCount ? 'a' : disCount > advCount ? 'd' : undefined;
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
      pushRoll(ctx, room, author, hitRoll, 'attack', { subject: label, hit: hitSuccess ? 'hit' : 'miss' });
      if (!hitSuccess) continue;
      const damageParts = damageRollParts(caster.effects, { rangeType, damageType, targetId: target?.id }, abilities);
      const damageRoll = rollDice(withRollParts(expression, damageParts), Math.random, { doubleDice: crit });
      const adjusted = applyDamageDefenses(
        damageRoll.total,
        damageType,
        ctx.manager.damageDefensesForToken(room, target)
      );
      pushRoll(ctx, room, author, damageRoll, healing ? 'heal' : 'damage', {
        subject: label,
        damageType,
        damageNote: adjusted.note,
      }, crit);
      applyHp(ctx, room, input.mapId, target, healing ? adjusted.amount : -adjusted.amount, { crit });
    }
    return {};
  }

  if (spell.save && expression && stats && spell.save[0]) {
    // Один бросок урона на всё заклинание (5e: AoE кидает урон один раз).
    const damageParts = damageRollParts(caster.effects, { damageType }, ctx.manager.abilitiesForToken(room, caster));
    const damageRoll = rollDice(withRollParts(expression, damageParts));
    pushRoll(ctx, room, author, damageRoll, healing ? 'heal' : 'damage', { subject, damageType });
    for (const target of targets) {
      const saveAbility = spell.save[0];
      const parts = ctx.manager.savePartsForToken(room, target, saveAbility);
      const saveRoll = rollDice(withAdvantage(withRollParts('d20', parts), parts.mode));
      const success = !autoFailSave(target.conditions, saveAbility) && saveRoll.total >= stats.dc;
      pushRoll(ctx, room, author, saveRoll, 'save', {
        subject: `${spell.name} · ${target.name}`,
        saveOutcome: success ? 'success' : 'fail',
      });
      if (success && !spell.saveHalf) continue;
      let amount = success ? Math.floor(damageRoll.total / 2) : damageRoll.total;
      amount = applyDamageDefenses(amount, damageType, ctx.manager.damageDefensesForToken(room, target)).amount;
      if (amount) applyHp(ctx, room, input.mapId, target, healing ? amount : -amount);
    }
    return {};
  }

  if (expression) {
    const count = spellAttackCount(spell, castLevel, characterLevel);
    for (let i = 0; i < count; i++) {
      const target = targets[i] ?? targets[targets.length - 1] ?? targets[0];
      const label = count > 1 ? `${subject} (${i + 1}/${count})` : subject;
      const damageRoll = rollDice(expression);
      const adjusted = applyDamageDefenses(
        damageRoll.total,
        damageType,
        target ? ctx.manager.damageDefensesForToken(room, target) : []
      );
      pushRoll(ctx, room, author, damageRoll, healing ? 'heal' : 'damage', {
        subject: label,
        damageType,
        damageNote: adjusted.note,
      });
      if (target && (statNumber(target.hpMax) > 0 || target.id === caster.id)) {
        applyHp(ctx, room, input.mapId, target, healing ? adjusted.amount : -adjusted.amount);
      }
    }
    return {};
  }

  // Manual: механику ведёт DM, в чат — название и описание.
  const detail = spell.description[0] ? `\n${spell.description[0]}` : '';
  const levelText = spell.level === 0 ? ' (фокус)' : ` (${castLevel} круг)`;
  ctx.systemMessage(room, `${caster.name}: ${spell.name}${levelText}${detail}`);
  return {};
}
