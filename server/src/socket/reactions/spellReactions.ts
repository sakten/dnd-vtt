import { randomUUID } from 'node:crypto';
import {
  absorbTypesOf,
  characterLevel,
  COUNTERSPELL,
  d20Expr,
  hostileTokens as hostile,
  isIncapacitated,
  reactionSpellTrigger,
  rollDice,
  spellEffectDefs,
  type EffectInstance,
  type ErrorPayload,
  type ReactionOption,
  type ReactionTriggerKind,
  type Token,
} from 'shared';
import type { Room } from '../../roomTypes';
import type { ConnCtx } from '../context';
import { findSpell } from '../../spells';
import { controllerIdOfToken, sheetOfToken, withinFeet } from '../../rooms';
import { pushRollMessage } from '../messages';
import { spellClassFor, spellStatsFor } from '../spellStats';
import { resolveSpellCast, validateSpellCast, type SpellCastInput } from '../spellResolve';
import { openReactionWindow, type ReactionOfferInput } from './queue';
import { audienceOf, featFreeCastKey, knownSpellKeys, reactionSlotFree, spellPayable, type ReactionChoice } from './internal';

/** Применимые к триггеру оплачиваемые варианты-заклинания. */
export function reactionSpellOptions(room: Room, token: Token, trigger: ReactionTriggerKind): ReactionOption[] {
  const out: ReactionOption[] = [];
  for (const key of knownSpellKeys(room, token)) {
    if (reactionSpellTrigger(key) !== trigger) continue;
    const spell = findSpell(key);
    if (!spell || !spellPayable(room, token, spell.level, key)) continue;
    out.push({ id: `spell:${key}`, name: spell.name, kind: 'spell', spellKey: key });
  }
  return out;
}

/** Боевые характеристики кастера для эффектов реакции. */
function statsForCaster(room: Room, token: Token, spellKey: string) {
  const { sheet } = sheetOfToken(room, token);
  return spellStatsFor(room, token, sheet ? spellClassFor(sheet, spellKey) : undefined);
}

/** Бонус к AC от эффектов варианта (Shield +5); 0 — если неизвестно. */
export function acBonusOf(option: ReactionOption): number {
  if (!option.spellKey) return 0;
  let bonus = 0;
  for (const def of spellEffectDefs(option.spellKey) ?? []) {
    for (const mod of def.modifiers) {
      if (mod.target === 'ac' && mod.mode === 'add' && typeof mod.value === 'number') bonus += mod.value;
    }
  }
  return bonus;
}

/** Применяет выбранную в окне реакцию (Shield, Absorb Elements, Hellish Rebuke и т.п.). */
export function applyReactionChoice(
  ctx: ConnCtx,
  room: Room,
  choice: ReactionChoice,
  targets: Token[],
  damageType?: string
): void {
  const optionId = choice.optionId;
  if (!optionId?.startsWith('spell:')) return;
  const key = optionId.slice('spell:'.length);
  const spell = findSpell(key);
  const token = ctx.manager.findToken(room, choice.mapId, choice.tokenId);
  if (!spell || !token) return;

  const { controllerId: cid, sheet } = sheetOfToken(room, token);
  const stats = spellStatsFor(room, token, sheet ? spellClassFor(sheet, key) : undefined);
  const input: SpellCastInput = {
    caster: token,
    mapId: choice.mapId,
    spell,
    castLevel: spell.level,
    characterLevel: sheet ? characterLevel(sheet.classes) : 1,
    stats,
    targets,
    author: token.name,
  };
  if (validateSpellCast(room, input)) return;

  if (spell.level > 0) {
    const chargeKey = cid ? featFreeCastKey(room, token, key) : undefined;
    if (cid && chargeKey) {
      // Magic Initiate: приоритет бесплатного каста, как в `spell:cast`.
      ctx.manager.spendResource(room, cid, chargeKey, 1);
      ctx.emitResources(room, cid);
      ctx.systemMessage(room, { code: 'spells.featCast', params: { name: token.name, spell: spell.name } });
    } else if (cid) {
      if (!ctx.manager.spendSpellSlot(room, cid, spell.level)) return;
      ctx.emitResources(room, cid);
    } else if (!ctx.manager.spendTokenSpellSlot(room, token, spell.level)) {
      return;
    }
  }
  if (!ctx.manager.spendSlot(room, choice.mapId, token, 'reaction')) return;

  // Absorb Elements: сопротивление типу сработавшего урона до следующего хода.
  const absorb = absorbTypesOf(key);
  if (absorb.length && damageType && absorb.includes(damageType)) {
    const effect: EffectInstance = {
      id: randomUUID(),
      name: spell.name,
      sourceKey: key,
      sourceId: token.id,
      duration: { type: 'rounds', rounds: 1 },
      modifiers: [
        {
          id: `${randomUUID()}:r`,
          target: 'damage',
          mode: 'resistance',
          filter: { damageType },
        },
      ],
    };
    ctx.manager.applyEffect(room, token, effect);
    ctx.emitToken(room, 'token:update', choice.mapId, token);
    ctx.systemMessage(room, {
      code: 'spells.resistance',
      params: { name: token.name, spell: spell.name, type: damageType },
    });
    ctx.syncCombat(room, choice.mapId);
    return;
  }

  resolveSpellCast(ctx, input);
  ctx.syncCombat(room, choice.mapId);
}

const { key: COUNTERSPELL_KEY, level: COUNTERSPELL_LEVEL, rangeFeet: COUNTERSPELL_RANGE_FEET } = COUNTERSPELL;

/** Офферы Counterspell: враги кастера в 60 фт с оплачиваемым заклинанием. */
function counterspellOffers(ctx: ConnCtx, room: Room, input: SpellCastInput): ReactionOfferInput[] {
  const map = ctx.manager.findMap(room, input.mapId);
  if (!map) return [];
  const offers: ReactionOfferInput[] = [];
  for (const reactor of map.tokens) {
    if (reactor.id === input.caster.id) continue;
    if (!hostile(reactor, input.caster)) continue;
    if (isIncapacitated(reactor.conditions)) continue;
    if (!withinFeet(room, reactor, input.caster, COUNTERSPELL_RANGE_FEET)) continue;
    if (!reactionSlotFree(ctx.manager, room, map.id, reactor)) continue;
    if (!knownSpellKeys(room, reactor).includes(COUNTERSPELL_KEY)) continue;
    if (!spellPayable(room, reactor, COUNTERSPELL_LEVEL, COUNTERSPELL_KEY)) continue;
    offers.push({
      token: reactor,
      audience: audienceOf(ctx, room, map.id, reactor),
      options: [{ id: `spell:${COUNTERSPELL_KEY}`, name: 'Counterspell', kind: 'spell', spellKey: COUNTERSPELL_KEY }],
    });
  }
  return offers;
}

/** Применяет Counterspell реактора; true — каст отменён. */
function applyCounterspell(ctx: ConnCtx, room: Room, choice: ReactionChoice, input: SpellCastInput): boolean {
  const reactor = ctx.manager.findToken(room, choice.mapId, choice.tokenId);
  if (!reactor) return false;
  const cid = controllerIdOfToken(room, reactor);
  if (cid) {
    if (!ctx.manager.spendSpellSlot(room, cid, COUNTERSPELL_LEVEL)) return false;
    ctx.emitResources(room, cid);
  } else if (!ctx.manager.spendTokenSpellSlot(room, reactor, COUNTERSPELL_LEVEL)) {
    return false;
  }
  if (!ctx.manager.spendSlot(room, choice.mapId, reactor, 'reaction')) return false;

  const targetLevel = Math.max(1, input.spell.level);
  let success = COUNTERSPELL_LEVEL >= targetLevel;
  if (!success) {
    const mod = statsForCaster(room, reactor, COUNTERSPELL_KEY)?.mod ?? 0;
    const roll = rollDice(d20Expr(mod));
    const dc = 10 + targetLevel;
    success = roll.total >= dc;
    pushRollMessage(ctx, room, {
      author: reactor.name,
      roll,
      kind: 'check',
      params: { subject: `Counterspell: ${input.spell.name} (СЛ ${dc})` },
    });
  }
  ctx.syncCombat(room, choice.mapId);
  return success;
}

/** Каст с окном Counterspell (до резолва); экономика и проверки — на вызывающем. */
export function resolveSpellCastWithReactions(ctx: ConnCtx, input: SpellCastInput): { error?: ErrorPayload } {
  const room = ctx.getRoom();
  if (!room) return resolveSpellCast(ctx, input);
  const offers = counterspellOffers(ctx, room, input);
  if (!offers.length) return resolveSpellCast(ctx, input);
  const opened = openReactionWindow(ctx, room, {
    mapId: input.mapId,
    trigger: 'spellCast',
    sourceName: `${input.caster.name}: накладывает ${input.spell.name}`,
    offers,
    resume: (choices) => {
      const currentRoom = ctx.getRoom();
      if (!currentRoom) return;
      let countered = false;
      for (const choice of choices) {
        if (!choice.optionId || countered) continue;
        countered = applyCounterspell(ctx, currentRoom, choice, input);
      }
      if (countered) {
        ctx.systemMessage(currentRoom, {
          code: 'spells.countered',
          params: { name: input.caster.name, spell: input.spell.name },
        });
        return;
      }
      resolveSpellCast(ctx, input);
    },
  });
  return opened ? {} : resolveSpellCast(ctx, input);
}
