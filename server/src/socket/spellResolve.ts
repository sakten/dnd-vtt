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
  isHealingSpell,
  resolveAttack,
  rollDice,
  spellAttackCount,
  spellDamageExpression,
  spellEffectDefs,
  spellIsSelf,
  spellRangeFeet,
  withAdvantage,
  withRollParts,
  type EffectInstance,
  type Spell,
  type SpellStats,
  type Token,
} from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { applyDamage } from './damage';
import { pushRollMessage } from './messages';

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

/** Тип урона заклинания, если он однозначен (иначе защиты не применяются). */
function spellDamageType(spell: Spell): string | undefined {
  const types = spell.damage?.types ?? [];
  return types.length === 1 ? types[0] : undefined;
}

export interface SpellEffectApplyInput {
  caster: Token;
  spell: Spell;
  mapId: string;
  targets: Token[];
  stats: SpellStats | null;
  author: string;
}

/** Накладывает эффекты заклинания (баффы/дебаффы), включая спасброски целей. */
export function applySpellEffects(ctx: ConnCtx, input: SpellEffectApplyInput): void {
  const room = ctx.getRoom();
  if (!room) return;
  const { caster, spell, mapId, targets, stats, author } = input;
  const effectDefs = spellEffectDefs(spell.key);
  if (!effectDefs?.length) return;

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
        pushRollMessage(ctx, room, {
          author,
          roll: saveRoll,
          kind: 'save',
          params: {
            subject: `${spell.name} · ${target.name}`,
            saveOutcome: success ? 'success' : 'fail',
          },
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
      ctx.emitToken(room, 'token:update', mapId, target);
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
    ctx.emitToken(room, 'token:update', mapId, caster);
    if (!anchor) anchor = anchorId;
  }
  if (spell.concentration && anchor) ctx.manager.setConcentration(room, mapId, caster, anchor);
  ctx.syncCombat(room, mapId);
  ctx.systemMessage(
    room,
    applied.length
      ? `${caster.name}: ${spell.name} → ${applied.join(', ')}`
      : `${caster.name}: ${spell.name} — без эффекта`
  );
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
    applySpellEffects(ctx, { caster, spell, mapId: input.mapId, targets, stats, author });
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
        targetDodging: ctx.manager.turnStateFor(room, input.mapId, target)?.dodge === true,
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
      const damageParts = damageRollParts(caster.effects, { rangeType, damageType, targetId: target?.id }, abilities);
      const damageRoll = rollDice(withRollParts(expression, damageParts), Math.random, { doubleDice: crit });
      applyDamage(ctx, {
        target,
        mapId: input.mapId,
        amount: damageRoll.total,
        damageType,
        roll: damageRoll,
        author,
        kind: healing ? 'heal' : 'damage',
        params: { subject: label, damageType },
        crit,
      });
    }
    return {};
  }

  if (spell.save && expression && stats && spell.save[0]) {
    // Один бросок урона на всё заклинание (5e: AoE кидает урон один раз).
    const damageParts = damageRollParts(caster.effects, { damageType }, ctx.manager.abilitiesForToken(room, caster));
    const damageRoll = rollDice(withRollParts(expression, damageParts));
    pushRollMessage(ctx, room, { author, roll: damageRoll, kind: healing ? 'heal' : 'damage', params: { subject, damageType } });
    for (const target of targets) {
      const saveAbility = spell.save[0];
      const parts = ctx.manager.savePartsForToken(room, target, saveAbility);
      const saveRoll = rollDice(withAdvantage(withRollParts('d20', parts), parts.mode));
      const success = !autoFailSave(target.conditions, saveAbility) && saveRoll.total >= stats.dc;
      pushRollMessage(ctx, room, {
        author,
        roll: saveRoll,
        kind: 'save',
        params: { subject: `${spell.name} · ${target.name}`, saveOutcome: success ? 'success' : 'fail' },
      });
      if (success && !spell.saveHalf) continue;
      applyDamage(ctx, {
        target,
        mapId: input.mapId,
        amount: damageRoll.total,
        damageType,
        halve: success,
        kind: healing ? 'heal' : 'damage',
      });
    }
    return {};
  }

  if (expression) {
    const count = spellAttackCount(spell, castLevel, characterLevel);
    for (let i = 0; i < count; i++) {
      const target = targets[i] ?? targets[targets.length - 1] ?? targets[0];
      const label = count > 1 ? `${subject} (${i + 1}/${count})` : subject;
      const damageRoll = rollDice(expression);
      applyDamage(ctx, {
        target,
        mapId: input.mapId,
        amount: damageRoll.total,
        damageType,
        roll: damageRoll,
        author,
        kind: healing ? 'heal' : 'damage',
        params: { subject: label, damageType },
      });
    }
    return {};
  }

  // Manual: механику ведёт DM, в чат — название и описание.
  const detail = spell.description[0] ? `\n${spell.description[0]}` : '';
  const levelText = spell.level === 0 ? ' (фокус)' : ` (${castLevel} круг)`;
  ctx.systemMessage(room, `${caster.name}: ${spell.name}${levelText}${detail}`);
  return {};
}
