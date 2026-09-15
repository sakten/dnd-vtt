import {
  hostileTokens as hostile,
  isIncapacitated,
  pathLeavesReach,
  restrictionsFor,
  unarmedStrikeEntry,
  type AttackEntry,
  type ReactionOption,
  type Token,
} from 'shared';
import type { Room } from '../../roomTypes';
import type { ConnCtx } from '../context';
import { gridSizeOf, sheetOfToken } from '../../rooms';
import { resolveWeaponAttack } from '../attackResolve';
import { isReactionPending, openReactionWindow, type ReactionOfferInput } from './queue';
import { audienceOf, hasPayableSpecial, reactionSlotFree } from './internal';
import { applyReactionChoice, reactionSpellOptions } from './spellReactions';

function meleeAttacks(room: Room, token: Token): AttackEntry[] {
  const { sheet } = sheetOfToken(room, token);
  const list = sheet ? sheet.attacks : token.attacks;
  return list.filter((a) => a.hit && (a.rangeType === 'melee' || a.rangeType === 'none'));
}

/** Оружие для атаки по возможности: первая melee-атака, у персонажа — безоружный удар. */
export function opportunityAttack(ctx: ConnCtx, room: Room, token: Token): AttackEntry | null {
  const melee = meleeAttacks(room, token);
  if (melee[0]) return melee[0];
  const { sheet } = sheetOfToken(room, token);
  if (!sheet) return null;
  const abilities = ctx.manager.abilitiesForToken(room, token) ?? {};
  return unarmedStrikeEntry(undefined, { abilities, classes: sheet.classes });
}

/** Немедленная атака по возможности (без окна). */
export function executeOpportunityAttack(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  reactor: Token,
  mover: Token
): void {
  const attack = opportunityAttack(ctx, room, reactor);
  if (!attack) return;
  if (!ctx.manager.spendSlot(room, mapId, reactor, 'reaction')) return;
  ctx.systemMessage(room, `${reactor.name}: атака по возможности по ${mover.name}`);
  const result = resolveWeaponAttack(ctx, {
    attacker: reactor,
    attackerMapId: mapId,
    target: mover,
    targetMapId: mapId,
    attack,
    prefix: reactor.name,
    author: reactor.name,
    ignoreRange: true,
  });
  if (result.error) ctx.systemMessage(room, `${reactor.name}: ${result.error}`);
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
  const size = gridSizeOf(room);

  const offers: ReactionOfferInput[] = [];
  for (const reactor of map.tokens) {
    if (reactor.id === mover.id) continue;
    if (!hostile(reactor, mover)) continue;
    if (isIncapacitated(reactor.conditions)) continue;
    if (restrictionsFor(reactor.conditions, reactor.effects).noOpportunityAttacks) continue;
    if (!reactionSlotFree(ctx.manager, room, mapId, reactor)) continue;
    if (!pathLeavesReach(path, reactor, mover, size)) continue;
    const attack = opportunityAttack(ctx, room, reactor);
    if (!attack) continue;
    if (!hasPayableSpecial(ctx.manager, room, mapId, reactor)) {
      executeOpportunityAttack(ctx, room, mapId, reactor, mover);
      continue;
    }
    const options: ReactionOption[] = [
      { id: 'opportunity', name: `Атака по возможности: ${attack.name}`, kind: 'opportunity' },
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
        if (choice.optionId === 'opportunity') {
          const reactor = ctx.manager.findToken(currentRoom, mapId, choice.tokenId);
          const target = ctx.manager.findToken(currentRoom, mapId, mover.id);
          if (reactor && target) executeOpportunityAttack(ctx, currentRoom, mapId, reactor, target);
        } else {
          applyReactionChoice(ctx, currentRoom, choice, []);
        }
      }
      ctx.syncCombat(currentRoom, mapId);
    },
  });
}
