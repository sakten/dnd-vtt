import { actionSlotAvailable, characterLevel, crValue, gridOfMap, polymorphFormIssue, rectCrossesWalls, shapeAllowsSpellcast, snapToGrid, tokenCells, wildShapeFormIssue, wildShapeLimit, wildShapeTempHp, druidLevelOf, hasMoonCircle, type BestiaryEntry, type ErrorPayload, type MapInfo, type Token } from 'shared';
import bestiaryData from 'shared/bestiaryData';
import type { Room } from '../roomTypes';
import { sheetOfToken, controllerIdOfItem } from '../room/helpers';
import { beginShape, revertShape, shapeGrid, shapeImageUrl, shapeName, shapesOfSource, wisdomModOf } from '../room/shape';
import type { ConnCtx } from './context';
import { fail } from './errors';
import { rejectIfIncapacitated, rejectIfReaction, scopedToken } from './guards';

/** Форма из каталога бестиария по ключу. */
export function shapeEntry(key: string): BestiaryEntry | undefined {
  return bestiaryData.entries.find((e) => e.key === key);
}

/** Снимает формы, привязанные к источникам (конец концентрации Polymorph). */
export function endShapesOf(ctx: ConnCtx, room: Room, sourceIds: Set<string>): number {
  let count = 0;
  for (const { mapId, token } of shapesOfSource(room, sourceIds)) {
    if (revertShape(token, shapeGrid(room, mapId))) {
      ctx.emitToken(room, 'token:update', mapId, token);
      syncShapeCombat(ctx, room, mapId, token);
      count += 1;
    }
  }
  return count;
}

/** Принудительный возврат токена (недееспособность/смерть/конец Polymorph). */
export function endShapeToken(ctx: ConnCtx, room: Room, mapId: string, token: Token): void {
  const sourceTokenId = token.shape?.kind === 'polymorph' ? token.shape.sourceTokenId : undefined;
  if (!revertShape(token, shapeGrid(room, mapId))) return;
  ctx.emitToken(room, 'token:update', mapId, token);
  syncShapeCombat(ctx, room, mapId, token);
  // Polymorph окончился досрочно (недееспособность/DM) — концентрация кастера тоже кончается.
  if (sourceTokenId) {
    for (const c of ctx.manager.clearConcentration(room, sourceTokenId)) {
      ctx.emitToken(room, 'token:update', c.mapId, c.token);
    }
  }
}

/** Имя/образ записи боя после смены формы (вне боя — no-op). */
function syncShapeCombat(ctx: ConnCtx, room: Room, mapId: string, token: Token): void {
  if (!ctx.manager.combatOf(room, mapId)?.active) return;
  ctx.manager.renameCombatantByToken(room, mapId, token.id, shapeName(token), shapeImageUrl(token));
  ctx.syncCombat(room, mapId);
}

/** Свободна ли площадь под новый размер токена (свои клетки не в счёт). */
function shapeSpotFree(map: MapInfo, token: Token, cells: number): boolean {
  const grid = map.grid;
  const size = gridOfMap(map).size;
  const cols = Math.max(1, Math.floor(map.width / size));
  const rows = Math.max(1, Math.floor(map.height / size));
  const occupied = new Set(
    map.tokens
      .filter((other) => other.id !== token.id)
      .flatMap((other) => tokenCells(other, grid))
  );
  const cx = snapToGrid(token.x, grid.offsetX, size, cells);
  const cy = snapToGrid(token.y, grid.offsetY, size, cells);
  const col0 = Math.round((cx - grid.offsetX) / size - cells / 2);
  const row0 = Math.round((cy - grid.offsetY) / size - cells / 2);
  for (let col = col0; col < col0 + cells; col++) {
    for (let row = row0; row < row0 + cells; row++) {
      if (col < 0 || row < 0 || col >= cols || row >= rows) return false;
      if (occupied.has(`${col},${row}`)) return false;
    }
  }
  // Стена/закрытая дверь внутри подошвы: превращаться нельзя (не «залезать» на стену).
  const inset = Math.min(4, size * 0.1);
  const rect = {
    x: grid.offsetX + col0 * size + inset,
    y: grid.offsetY + row0 * size + inset,
    w: cells * size - inset * 2,
    h: cells * size - inset * 2,
  };
  if (rectCrossesWalls(rect, map.walls ?? [], 'move')) return false;
  return true;
}

/** Beast Spells (друид 18+): каст разрешён только в Wild Shape; из Polymorph — нельзя (XPHB). */
export function spellsInShapeAllowed(room: Room, token: Token): boolean {
  let playerId: string | undefined;
  for (const [pid, libId] of Object.entries(room.controllers)) {
    if (libId === token.libraryItemId) {
      playerId = pid;
      break;
    }
  }
  const sheet = playerId ? room.sheets[playerId] : undefined;
  return shapeAllowsSpellcast(token.shape, sheet?.classes);
}

/** Проблема размещения формы: нет карты или подошва занята/пересекает стену. */
export function shapePlacementIssue(
  room: Room,
  mapId: string,
  token: Token,
  cells: number
): ErrorPayload | undefined {
  const map = room.scene.maps.find((m) => m.id === mapId);
  if (!map || !shapeSpotFree(map, token, cells)) return { code: 'shapeNoSpace' };
  return undefined;
}

/** temp HP не складываются (XPHB): пул формы берёт максимум со старыми, старые обнуляются. */
function fuseTempHp(room: Room, token: Token, pool: number): number {
  const controllerId = controllerIdOfItem(room, token.libraryItemId);
  const res = controllerId ? room.resources[controllerId] : undefined;
  if (res) {
    const fused = Math.max(pool, res.hp.temp);
    res.hp.temp = 0;
    return fused;
  }
  const fused = Math.max(pool, token.hpTemp ?? 0);
  token.hpTemp = 0;
  return fused;
}

/** Максимальный CR формы Polymorph: уровень персонажа; у монстра — его CR (XPHB). */
export function polymorphMaxCr(room: Room, target: Token): number | undefined {
  const { sheet } = sheetOfToken(room, target);
  if (sheet) return characterLevel(sheet.classes);
  const cr = target.statblock?.cr;
  return cr ? crValue(cr) : undefined;
}

/** Polymorph: превращает цель в выбранного зверя (пул = HP зверя, без переноса урона). */
export function applyPolymorphForm(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  caster: Token,
  target: Token,
  formKey: string | undefined,
  spellKey: string
): boolean {
  const entry = formKey ? shapeEntry(formKey) : undefined;
  if (!entry || entry.type !== 'beast') {
    fail(ctx, 'shapeNoForm');
    return false;
  }
  const maxCr = polymorphMaxCr(room, target);
  if (maxCr !== undefined && polymorphFormIssue(entry, maxCr)) {
    fail(ctx, 'shapeCrTooHigh', { max: maxCr });
    return false;
  }
  const placement = shapePlacementIssue(room, mapId, target, entry.cells);
  if (placement) {
    fail(ctx, 'shapeNoSpace');
    return false;
  }
  beginShape(
    target,
    {
      entry,
      kind: 'polymorph',
      tempHp: fuseTempHp(room, target, entry.hpAverage),
      sourceTokenId: caster.id,
      spellKey,
    },
    shapeGrid(room, mapId)
  );
  ctx.emitToken(room, 'token:update', mapId, target);
  const controllerId = controllerIdOfItem(room, target.libraryItemId);
  if (controllerId) ctx.emitResources(room, controllerId);
  syncShapeCombat(ctx, room, mapId, target);
  return true;
}

export function registerFormHandlers(ctx: ConnCtx) {
  ctx.on('token:shape', (payload) => {
    const scope = scopedToken(ctx, payload?.mapId, payload?.id);
    if (!scope) return;
    if (rejectIfReaction(ctx)) return;
    const { room, token, character } = scope;
    if (!character || character.playerId !== ctx.playerId) {
      fail(ctx, 'badRequest');
      return;
    }
    if (rejectIfIncapacitated(ctx, token)) return;
    // Повторный Wild Shape меняет форму за новый заряд (XPHB: «until you use Wild Shape again»),
    // из Polymorph в Wild Shape нельзя — форма держится чужой концентрацией.
    if (token.shape?.kind === 'polymorph') {
      fail(ctx, 'shapePolymorph');
      return;
    }
    const sheet = character.sheet;
    if (!sheet) {
      fail(ctx, 'invalidCharacter');
      return;
    }
    const level = druidLevelOf(sheet.classes);
    const moon = hasMoonCircle(sheet.classes);
    const limit = wildShapeLimit(level, moon);
    if (!limit) {
      fail(ctx, 'shapeNoAbility');
      return;
    }
    const formKey = typeof payload?.formKey === 'string' ? payload.formKey : '';
    if (!(sheet.wildShape?.known ?? []).includes(formKey)) {
      fail(ctx, 'shapeNoForm');
      return;
    }
    const entry = shapeEntry(formKey);
    if (!entry || wildShapeFormIssue(entry, limit)) {
      fail(ctx, 'shapeNoForm');
      return;
    }
    const res = room.resources[character.playerId];
    const use = res?.resources.find((r) => r.auto && r.key === 'druid:wildShape');
    if (!use || use.current <= 0) {
      fail(ctx, 'shapeNoUse');
      return;
    }
    const map = ctx.manager.findMap(room, payload.mapId);
    if (!map || !shapeSpotFree(map, token, entry.cells)) {
      fail(ctx, 'shapeNoSpace');
      return;
    }
    // Wild Shape — бонусное действие (XPHB): только в свой ход и при свободном бонусе.
    if (!scope.isDm && !ctx.manager.isActiveToken(room, payload.mapId, token.id)) {
      fail(ctx, 'notYourTurn');
      return;
    }
    const turn = ctx.manager.turnForToken(room, payload.mapId, token);
    if (turn && !actionSlotAvailable(turn, 'bonus')) {
      fail(ctx, 'noActions');
      return;
    }
    use.current -= 1;
    const pool = fuseTempHp(room, token, wildShapeTempHp(level, moon));
    ctx.emitResources(room, character.playerId);
    beginShape(
      token,
      {
        entry,
        kind: 'wildShape',
        tempHp: pool,
        ...(moon ? { wisMod: wisdomModOf(sheet.abilities) } : {}),
      },
      shapeGrid(room, payload.mapId)
    );
    ctx.manager.spendSlot(room, payload.mapId, token, 'bonus');
    syncShapeCombat(ctx, room, payload.mapId, token);
    ctx.emitToken(room, 'token:update', payload.mapId, token);
    ctx.notifyPlayers(room);
  });

  ctx.on('token:revert', (payload) => {
    const scope = scopedToken(ctx, payload?.mapId, payload?.id);
    if (!scope) return;
    if (rejectIfReaction(ctx)) return;
    const { room, mapId, token, isDm } = scope;
    if (!token.shape) return;
    // Polymorph снимается только концентрацией кастера или обнулением пула (XPHB);
    // вручную может отменить ведущий.
    if (token.shape.kind === 'polymorph' && !isDm) {
      fail(ctx, 'shapeNoRevert');
      return;
    }
    // Досрочный выход из Wild Shape — бонусное действие (XPHB), только в свой ход.
    if (!isDm && !ctx.manager.isActiveToken(room, mapId, token.id)) {
      fail(ctx, 'notYourTurn');
      return;
    }
    const turn = ctx.manager.turnForToken(room, mapId, token);
    if (turn && !actionSlotAvailable(turn, 'bonus')) {
      fail(ctx, 'noActions');
      return;
    }
    ctx.manager.spendSlot(room, mapId, token, 'bonus');
    endShapeToken(ctx, room, mapId, token);
    ctx.notifyPlayers(room);
  });
}

