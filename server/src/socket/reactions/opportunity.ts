import {
  hostileTokens as hostile,
  isIncapacitated,
  monsterAbilityAutomation,
  monsterStats,
  pathLeavesReach,
  restrictionsFor,
  unarmedStrikeEntry,
  type ActionDef,
  type AttackEntry,
  type ReactionOption,
  type Token,
} from 'shared';
import type { Room } from '../../roomTypes';
import type { ConnCtx } from '../context';
import { executeAutomation } from '../automation';
import { actorStats } from '../../room/actor';
import { shapeStatblock } from '../../room/shape';
import { gridSizeOfMap, sheetOfToken } from '../../rooms';
import { resolveWeaponAttack } from '../attackResolve';
import { isReactionPending, openReactionWindow, type ReactionOfferInput } from './queue';
import { audienceOf, hasPayableSpecial, reactionSlotFree } from './internal';
import { applyReactionChoice, reactionSpellOptions } from './spellReactions';

/** Источник атаки по возможности: оружие/атаки текущего облика или melee-способность статблока. */
export interface OpportunitySource {
  name: string;
  /** Атака из `attacks[]` (оружие, атаки формы): бросок через `resolveWeaponAttack`. */
  weapon?: AttackEntry;
  /** Melee-способность статблока (зверь/монстр): через `executeAutomation`. */
  action?: ActionDef;
}

/** Melee-атаки текущего облика: в форме — статблок зверя (actorStats), иначе своё оружие. */
function meleeWeapons(room: Room, token: Token): AttackEntry[] {
  return actorStats(room, token).attacks.filter(
    (a) => a.hit && (a.rangeType === 'melee' || a.rangeType === 'none')
  );
}

/** Melee-способности статблока (у зверей атаки лежат в actions, не в attacks). */
function meleeAbilities(token: Token): ActionDef[] {
  return (shapeStatblock(token)?.actions ?? []).filter((a) => a.ability?.attack?.rangeType === 'melee');
}

/**
 * Все подходящие атаки для OA: оружие/атаки формы → melee-способности статблока →
 * безоружный удар персонажа (только без формы: у зверя своих безоружных нет).
 */
export function opportunitySources(ctx: ConnCtx, room: Room, token: Token): OpportunitySource[] {
  const out: OpportunitySource[] = meleeWeapons(room, token).map((w) => ({ name: w.name, weapon: w }));
  for (const action of meleeAbilities(token)) out.push({ name: action.name, action });
  if (out.length || token.shape) return out;
  const { sheet } = sheetOfToken(room, token);
  if (!sheet) return out;
  const abilities = ctx.manager.abilitiesForToken(room, token) ?? {};
  const unarmed = unarmedStrikeEntry(undefined, { abilities, classes: sheet.classes, choices: sheet.choices });
  return [{ name: unarmed.name, weapon: unarmed }];
}

/** Первая подходящая атака (без выбора) — авто-OA и ответные атаки черт. */
export function opportunityAttack(ctx: ConnCtx, room: Room, token: Token): OpportunitySource | null {
  return opportunitySources(ctx, room, token)[0] ?? null;
}

/** Немедленная атака по возможности (без окна). `sourceIndex` — выбранный вариант. */
export function executeOpportunityAttack(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  reactor: Token,
  mover: Token,
  sourceIndex = 0
): void {
  const source = opportunitySources(ctx, room, reactor)[sourceIndex];
  if (!source) return;
  if (!ctx.manager.spendSlot(room, mapId, reactor, 'reaction')) return;
  ctx.systemMessage(room, {
    code: 'reactions.opportunity',
    params: { name: reactor.name, target: mover.name },
  });
  if (source.weapon) {
    const result = resolveWeaponAttack(ctx, {
      attacker: reactor,
      attackerMapId: mapId,
      target: mover,
      targetMapId: mapId,
      attack: source.weapon,
      prefix: reactor.name,
      author: reactor.name,
      ignoreRange: true,
    });
    if (result.error) {
      ctx.systemMessage(room, {
        code: 'reactions.opportunityError',
        params: { name: reactor.name, error: result.error.code, ...(result.error.params ?? {}) },
      });
    }
  } else if (source.action) {
    const def = monsterAbilityAutomation(source.action);
    if (def) {
      executeAutomation(ctx, {
        caster: reactor,
        mapId,
        def,
        targets: [mover],
        stats: monsterStats(shapeStatblock(reactor), source.action.ability),
        author: reactor.name,
      });
    }
  }
  ctx.syncCombat(room, mapId);
}

/** Триггер leaveReach: авто-OA или окно, если у реактора есть оплачиваемые спец-реакции. */
export function triggerOpportunityAttacks(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  mover: Token,
  path: { x: number; y: number }[]
): void {
  if (isReactionPending(room.code)) return;
  const map = ctx.manager.findMap(room, mapId);
  if (!map || path.length < 2) return;
  // «Отход»: движение в этом ходу не провоцирует атаки по возможности.
  if (ctx.manager.turnForToken(room, mapId, mover)?.disengaged) return;
  // Эффекты движения без провокации (Мантия вдохновения).
  if (restrictionsFor(mover.conditions, mover.effects).ignoresOpportunityAttacks) return;
  const size = gridSizeOfMap(map);

  const offers: ReactionOfferInput[] = [];
  for (const reactor of map.tokens) {
    if (reactor.id === mover.id) continue;
    if (!hostile(reactor, mover)) continue;
    if (isIncapacitated(reactor.conditions)) continue;
    if (restrictionsFor(reactor.conditions, reactor.effects).noOpportunityAttacks) continue;
    if (!reactionSlotFree(ctx.manager, room, mapId, reactor)) continue;
    if (!pathLeavesReach(path, reactor, mover, size)) continue;
    const sources = opportunitySources(ctx, room, reactor);
    if (!sources.length) continue;
    // Авто-OA без окна: единственный вариант и нет оплачиваемых спец-реакций.
    if (sources.length === 1 && !hasPayableSpecial(ctx.manager, room, mapId, reactor)) {
      executeOpportunityAttack(ctx, room, mapId, reactor, mover, 0);
      continue;
    }
    const options: ReactionOption[] = [
      ...sources.map((s, i) => ({
        id: sources.length === 1 ? 'opportunity' : `opportunity:${i}`,
        name: `Атака по возможности: ${s.name}`,
        kind: 'opportunity' as const,
      })),
      ...reactionSpellOptions(room, reactor, 'leaveReach'),
    ];
    offers.push({ token: reactor, audience: audienceOf(ctx, room, mapId, reactor), options });
  }
  if (!offers.length) return;

  openReactionWindow(ctx, room, {
    mapId,
    trigger: 'leaveReach',
    sourceName: mover.name,
    offers,
    resume: (choices) => {
      const currentRoom = ctx.getRoom();
      if (!currentRoom) return;
      for (const choice of choices) {
        if (!choice.optionId) continue;
        const opportunityIndex =
          choice.optionId === 'opportunity'
            ? 0
            : choice.optionId.startsWith('opportunity:')
              ? Number(choice.optionId.slice('opportunity:'.length))
              : null;
        if (opportunityIndex !== null && Number.isInteger(opportunityIndex)) {
          const reactor = ctx.manager.findToken(currentRoom, mapId, choice.tokenId);
          const target = ctx.manager.findToken(currentRoom, mapId, mover.id);
          if (reactor && target) {
            executeOpportunityAttack(ctx, currentRoom, mapId, reactor, target, opportunityIndex);
          }
        } else {
          applyReactionChoice(ctx, currentRoom, choice, []);
        }
      }
      ctx.syncCombat(currentRoom, mapId);
    },
  });
}
