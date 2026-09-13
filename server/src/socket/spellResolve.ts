import { randomUUID } from 'node:crypto';
import {
  advantageAgainst,
  applyDamageDefenses,
  attackerAdvantage,
  attackerDisadvantage,
  autoCrit,
  autoFailSave,
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
  spellIsSelf,
  spellRangeFeet,
  statNumber,
  withAdvantage,
  type ChatMessage,
  type DiceRollResult,
  type RollKind,
  type RollLabelParams,
  type Spell,
  type SpellStats,
  type Token,
} from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';

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

  if (spell.spellAttack && expression && stats) {
    const count = spellAttackCount(spell, castLevel, characterLevel);
    const rangeType = spell.spellAttack;
    const castMap = ctx.manager.findMap(room, input.mapId);
    const gridSize = room.scene.grid.size || 50;
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
      const advMode: 'a' | 'd' | undefined = advCount > disCount ? 'a' : disCount > advCount ? 'd' : undefined;
      const distance = castMap ? gridDistanceFeet(caster, target, gridSize) : 0;
      const penalty = exhaustionRollPenalty(caster.conditions);
      const hitRoll = rollDice(withAdvantage(`d20+${stats.attack + penalty}`, advMode));
      const crit = isCriticalHit(hitRoll) || autoCrit(target.conditions, distance, rangeType);
      const targetAc = statNumber(target.ac);
      const hitSuccess = targetAc > 0 ? resolveAttack(hitRoll.total, crit, isCriticalFail(hitRoll), targetAc) : true;
      pushRoll(ctx, room, author, hitRoll, 'attack', { subject: label, hit: hitSuccess ? 'hit' : 'miss' });
      if (!hitSuccess) continue;
      const damageRoll = rollDice(expression, Math.random, { doubleDice: crit });
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
    const damageRoll = rollDice(expression);
    pushRoll(ctx, room, author, damageRoll, healing ? 'heal' : 'damage', { subject, damageType });
    for (const target of targets) {
      const saveAbility = spell.save[0];
      const saveBonus =
        ctx.manager.saveBonusForToken(room, target, saveAbility) + exhaustionRollPenalty(target.conditions);
      const saveRoll = rollDice(`d20+${saveBonus}`);
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
