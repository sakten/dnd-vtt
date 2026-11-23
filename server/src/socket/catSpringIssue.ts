import {
  CAT_SPRING_KEY,
  cellCenter,
  gridDistanceFeet,
  gridOfMap,
  isBanished,
  pointCell,
  tokenVisibleFrom,
  wallsWithZones,
  type ErrorPayload,
} from 'shared';
import type { Room } from '../roomTypes';
import type { SpellCastInput } from './spellResolve';
import { teleportIssue } from './teleport';

/** Проверка прыжка и цели Cat's Spring до списания ячейки/слота. */
export function catSpringIssue(room: Room, input: SpellCastInput): ErrorPayload | undefined {
  if (input.spell.key !== CAT_SPRING_KEY) return undefined;
  const placement = input.placements?.[0];
  const target = input.targets[0];
  if (!placement || !target) return { code: 'spellNoTarget' };
  const map = room.scene.maps.find((m) => m.id === input.mapId);
  if (!map) return { code: 'teleportNoSpace' };
  if (isBanished(target)) return { code: 'spellNoTarget' };
  const issue = teleportIssue(room, input.mapId, input.caster, { x: placement.x, y: placement.y }, 10);
  if (issue) return issue;
  const grid = gridOfMap(map, room.scene.grid);
  const cell = pointCell({ x: placement.x, y: placement.y }, grid);
  const landing = cellCenter(cell.cx, cell.cy, grid);
  const probe = { x: landing.x, y: landing.y, w: input.caster.w, h: input.caster.h };
  const feet = gridDistanceFeet(probe, target, grid.size);
  if (feet > 5) return { code: 'outOfRange', params: { feet: Math.round(feet) } };
  if (!tokenVisibleFrom(probe, target, wallsWithZones(map.walls, map.zones, grid), grid)) {
    return { code: 'noClearPath' };
  }
  return undefined;
}
