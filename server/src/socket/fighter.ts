import type { CharacterSheet, Token } from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { applyEffectTo } from './effectsApply';

const TACTICAL_SHIFT_KEY = 'class:fighter:tacticalShift';

/** Tactical Shift (воин 5): после Second Wind — половина скорости без провокации атак. */
export function applyTacticalShift(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  token: Token,
  sheet: CharacterSheet | undefined
): void {
  const level = sheet?.classes.find((c) => c.className === 'fighter')?.level ?? 0;
  if (level < 5) return;
  const speed = Math.round(ctx.manager.tokenSpeed(room, token) / 2);
  ctx.manager.grantExtraMovement(room, mapId, token, speed);
  applyEffectTo(ctx, room, {
    sourceKey: TACTICAL_SHIFT_KEY,
    sourceId: token.id,
    mapId,
    target: token,
    effectDef: {
      name: 'Тактический сдвиг',
      duration: { type: 'endOfTurn', of: 'target' },
      modifiers: [],
      restrictions: { ignoresOpportunityAttacks: true },
    },
  });
  ctx.emitToken(room, 'token:update', mapId, token);
  ctx.syncCombat(room, mapId);
  ctx.systemMessage(room, {
    code: 'automation.extraMovement',
    params: { name: token.name, feature: 'Тактический сдвиг', speed },
  });
}