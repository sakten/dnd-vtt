import {
  cellCenter,
  gridOfMap,
  isIncapacitated,
  pointCell,
  type ErrorPayload,
} from 'shared';
import type { ConnCtx } from './context';
import { triggerOpportunityAttacks } from './reactions/opportunity';
import { resolveSpellCast, type SpellCastInput } from './spellResolve';
import { executeTeleport } from './teleport';

/**
 * Cat's Spring (CBT): прыжок до 10 фт в видимую свободную клетку, затем
 * рукопашная атака заклинанием. Точка приземления и цель приходят в `placements`.
 */

/** Телепорт к точке прыжка (с атаками по возможности при выходе из досягаемости) и атака. */
export function resolveCatSpring(ctx: ConnCtx, input: SpellCastInput): { error?: ErrorPayload } {
  const room = ctx.getRoom();
  if (!room) return {};
  const map = room.scene.maps.find((m) => m.id === input.mapId);
  const placement = input.placements?.[0];
  if (!map || !placement) return {};
  const grid = gridOfMap(map, room.scene.grid);
  const cell = pointCell({ x: placement.x, y: placement.y }, grid);
  const landing = cellCenter(cell.cx, cell.cy, grid);
  const path = [{ x: input.caster.x, y: input.caster.y }, landing];
  triggerOpportunityAttacks(ctx, room, input.mapId, input.caster, path, () => {
    const currentRoom = ctx.getRoom();
    if (!currentRoom) return;
    const caster = ctx.manager.findToken(currentRoom, input.mapId, input.caster.id);
    if (!caster || isIncapacitated(caster.conditions)) return;
    executeTeleport(ctx, currentRoom, input.mapId, caster, landing);
    resolveSpellCast(ctx, input);
  });
  return {};
}
