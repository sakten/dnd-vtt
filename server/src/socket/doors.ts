import { abilityMod, rollDice, segmentRectDistance, SKILLS, type Token, type Wall } from 'shared';
import { sheetOfToken } from '../rooms';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { fail } from './errors';

/** Дистанция взаимодействия с дверью: 5 фт = сторона клетки. */
const DOOR_REACH_CELLS = 1;

/** Подошва токена в мировых координатах (anchor — центр фигуры). */
function tokenRect(token: Pick<Token, 'x' | 'y' | 'w' | 'h'>) {
  return { x: token.x - token.w / 2, y: token.y - token.h / 2, w: token.w, h: token.h };
}

/** Токен дотягивается до двери от края подошвы (в пределах одной клетки). */
export function inDoorReach(
  token: Pick<Token, 'x' | 'y' | 'w' | 'h'>,
  door: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>,
  cellPx: number
): boolean {
  const distance = segmentRectDistance(
    { x: door.x1, y: door.y1 },
    { x: door.x2, y: door.y2 },
    tokenRect(token)
  );
  return distance <= cellPx * DOOR_REACH_CELLS + 1e-6;
}

/** Модификатор взлома: персонаж — Ловкость рук с листа; canInteract-токен — ЛОВ статблока. */
export function pickBonus(room: Room, token: Token): number {
  const { sheet } = sheetOfToken(room, token);
  if (sheet) {
    const skill = SKILLS.find((s) => s.key === 'sleightOfHand');
    const mod = abilityMod(sheet.abilities[skill?.ability ?? 'dex'] ?? 10);
    const level = sheet.skills['sleightOfHand'] ?? 0;
    const prof = Number(sheet.proficiencyBonus) || 2;
    return mod + prof * level;
  }
  return abilityMod(Number(token.statblock?.abilities?.dex) || 10);
}

/** Может ли игрок взаимодействовать этой дверью с какого-то из своих токенов. */
function interactionActor(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  tokens: Token[],
  door: Wall,
  cellPx: number
): Token | undefined {
  return tokens.find(
    (t) =>
      (t.isPlayerToken || t.canInteract) && ctx.canControlToken(room, mapId, t) && inDoorReach(t, door, cellPx)
  );
}

function nameOf(room: Room, playerId: string | null): string {
  const player = playerId ? room.players.find((p) => p.id === playerId) : undefined;
  return player?.name ?? 'Ведущий';
}

export function registerDoorHandlers(ctx: ConnCtx) {
  ctx.on('door:toggle', ({ mapId, wallId }) => {
    const room = ctx.getRoom();
    if (!room || typeof mapId !== 'string' || typeof wallId !== 'string') return;
    const map = ctx.manager.findMap(room, mapId);
    if (!map) return;
    const door = map.walls.find((w) => w.id === wallId && w.kind === 'door');
    if (!door) return;

    const finish = (text: string) => {
      ctx.systemMessage(room, text);
      ctx.broadcast('walls:update', { mapId, walls: map.walls });
    };

    // DM/тест-режим: всегда, замок не ломается.
    if (ctx.isDm()) {
      door.open = !door.open;
      finish(`${nameOf(room, ctx.playerId)} ${door.open ? 'открыл(а)' : 'закрыл(а)'} дверь`);
      return;
    }

    const playerId = ctx.playerId;
    if (!playerId) return;
    const cellPx = map.grid.size || 50;
    const actor = interactionActor(ctx, room, mapId, map.tokens, door, cellPx);
    if (!actor) return; // нет подходящего токена рядом — тихо (курсор и так неактивен)
    if (door.dmOnly) return; // открывает только ведущий

    // Открытая дверь закрывается свободно (в том числе в бою).
    if (door.open) {
      door.open = false;
      finish(`${actor.name} закрыл(а) дверь`);
      return;
    }

    const dc = door.pickDc ?? 0;
    if (dc > 0) {
      if (map.combat.active) {
        fail(ctx, 'doorLockedInCombat');
        return;
      }
      const bonus = pickBonus(room, actor);
      const roll = rollDice(bonus >= 0 ? `1d20+${bonus}` : `1d20${bonus}`);
      if (roll.total < dc) {
        ctx.systemMessage(room, `${actor.name}: Ловкость рук ${roll.total} против Сл ${dc} — не удалось`);
        return;
      }
      door.open = true;
      door.pickDc = 0; // взломана: следующим игрокам взламывать не нужно
      finish(`${actor.name}: Ловкость рук ${roll.total} против Сл ${dc} — дверь взломана`);
      return;
    }

    door.open = true;
    finish(`${actor.name} открыл(а) дверь`);
  });
}
