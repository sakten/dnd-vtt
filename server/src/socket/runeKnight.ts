import { randomUUID } from 'node:crypto';
import {
  GIANTS_MIGHT_ACTION,
  giantsMightCells,
  gridOfMap,
  snapToGrid,
  type ActionDef,
  type CharacterSheet,
  type EffectInstance,
  type Token,
} from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';

const EFFECT_KEY = GIANTS_MIGHT_ACTION;

export function applyGiantsMight(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  token: Token,
  sheet: CharacterSheet | undefined,
  action: ActionDef
): void {
  const map = ctx.manager.findMap(room, mapId);
  if (!map) return;
  for (const effect of token.effects.filter((e) => e.sourceKey === EFFECT_KEY)) {
    ctx.manager.removeEffect(room, token, effect.id);
  }
  const fighterLevel = sheet?.classes.find((c) => c.className === 'fighter')?.level ?? 0;
  const targetCells = giantsMightCells(fighterLevel);
  const previous = token.cells;
  const resized = previous < targetCells;
  if (resized) {
    const grid = gridOfMap(map, room.scene.grid);
    token.cells = targetCells;
    token.w = targetCells * grid.size;
    token.h = targetCells * grid.size;
    if (grid.snap) {
      token.x = snapToGrid(token.x, grid.offsetX, grid.size, targetCells);
      token.y = snapToGrid(token.y, grid.offsetY, grid.size, targetCells);
    }
  }
  const effect: EffectInstance = {
    id: randomUUID(),
    name: action.name,
    sourceKey: EFFECT_KEY,
    sourceId: token.id,
    duration: { type: 'rounds', rounds: 10 },
    modifiers: [],
    ...(resized ? { size: { cells: targetCells, previous } } : {}),
  };
  ctx.manager.applyEffect(room, token, effect);
  ctx.emitChanged(room, [{ mapId, token }]);
  ctx.systemMessage(room, { code: 'actions.used', params: { name: token.name, action: action.name } });
}