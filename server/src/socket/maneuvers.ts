import {
  BAIT_AND_SWITCH_ACTION,
  crossesWalls,
  fighterLevelOf,
  gridDistanceFeet,
  gridOfMap,
  hostileTokens,
  isIncapacitated,
  MANEUVER_ACTION_PREFIX,
  rollDice,
  superiorityDie,
  wallsWithZones,
  type CharacterSheet,
  type DamageDefense,
  type Token,
} from 'shared';
import type { Room } from '../roomTypes';
import { damageDefensesForToken } from '../room/effects';
import type { ConnCtx } from './context';
import { applyEffectTo } from './effectsApply';
import { fail, type ActionIssue } from './errors';
import { mixedSwapPlan, sameFootprint } from './maneuverSwap';
import { pushRollMessage } from './messages';

/**
 * Манёвры боевого мастера с серверной логикой сверх `AutomationDef`:
 * Приманка и подмена (обмен местами + AC) и Знай врага (раскрытие защит).
 * Остальные автоматизированные манёвры описаны декларативно в shared:
 * Parry/Riposte — `reactionFeatures`, Precision Attack — `rollBonus` с `selfOnly`,
 * Distracting Strike — наездник атаки. Регистрация спецдействий — `specialActions.ts`.
 */

export function isManeuverAction(actionId: string): boolean {
  return actionId.startsWith(MANEUVER_ACTION_PREFIX);
}

/** Ручной манёвр без автоматизации: кость превосходства в чат, эффект — по описанию. */
export function rollManualManeuver(
  ctx: ConnCtx,
  room: Room,
  token: Token,
  sheet: CharacterSheet,
  actionName: string
): void {
  const roll = rollDice(`1d${superiorityDie(fighterLevelOf(sheet.classes))}`);
  pushRollMessage(ctx, room, { author: token.name, roll, kind: 'plain', params: { subject: actionName } });
}

/** Проверка Приманки и подмены до траты кости и движения: цель, дистанция, размеры, стены, движение. */
export function baitAndSwitchIssue(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  token: Token,
  targetId: string | undefined
): ActionIssue | null {
  const map = ctx.manager.findMap(room, mapId);
  const target = targetId ? ctx.manager.findToken(room, mapId, targetId) : null;
  if (!map || !target || target.id === token.id || isIncapacitated(target.conditions)) {
    return { code: 'spellNoTarget' };
  }
  // Обмен — только с согласной целью: враждебное существо не соглашается (XPHB).
  if (hostileTokens(token, target)) return { code: 'targetUnwilling' };
  const grid = gridOfMap(map, room.scene.grid);
  const feet = gridDistanceFeet(token, target, grid.size);
  if (feet > 5) return { code: 'outOfRange', params: { feet: Math.round(feet) } };
  const walls = wallsWithZones(map.walls, map.zones, grid);
  // Меняться сквозь стену/закрытую дверь нельзя.
  if (crossesWalls(token, target, walls, 'move')) return { code: 'swapNoSpace' };
  // Одинаковые подошвы просто меняются клетками; смешанные — по минимальному сдвигу.
  if (!sameFootprint(token, target) && !mixedSwapPlan(map, grid, token, target)) {
    return { code: 'swapNoSpace' };
  }
  const turn = ctx.manager.turnForToken(room, mapId, token);
  if (ctx.manager.combatOf(room, mapId)?.active && turn && turn.movementMax - turn.movementUsed < 5) {
    return { code: 'noMovement' };
  }
  return null;
}

/** Проверка Знай врага до траты бонуса: цель и дистанция 30 фт. */
export function knowYourEnemyIssue(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  token: Token,
  targetId: string | undefined
): ActionIssue | null {
  const map = ctx.manager.findMap(room, mapId);
  const target = targetId ? ctx.manager.findToken(room, mapId, targetId) : null;
  if (!map || !target) return { code: 'spellNoTarget' };
  const grid = gridOfMap(map, room.scene.grid);
  const feet = gridDistanceFeet(token, target, grid.size);
  if (feet > 30) return { code: 'outOfRange', params: { feet: Math.round(feet) } };
  return null;
}

/** Приманка и подмена: обмен местами, 5 фт движения, кость в AC. */
export function applyBaitAndSwitch(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  token: Token,
  sheet: CharacterSheet | undefined,
  targetId: string | undefined,
  variant: string | undefined
): void {
  const map = ctx.manager.findMap(room, mapId);
  const target = targetId ? ctx.manager.findToken(room, mapId, targetId) : null;
  if (!map || !target || !sheet) {
    fail(ctx, 'spellNoTarget');
    return;
  }
  const issue = baitAndSwitchIssue(ctx, room, mapId, token, targetId);
  if (issue) {
    fail(ctx, issue.code, issue.params);
    return;
  }
  const grid = gridOfMap(map, room.scene.grid);
  const mixed = sameFootprint(token, target) ? null : mixedSwapPlan(map, grid, token, target);
  if (!sameFootprint(token, target) && !mixed) {
    fail(ctx, 'swapNoSpace');
    return;
  }
  const turn = ctx.manager.turnForToken(room, mapId, token);
  if (ctx.manager.combatOf(room, mapId)?.active && turn) {
    ctx.manager.setMovement(room, mapId, token.id, turn.movementUsed + 5, turn.diagonalsUsed);
  }
  if (mixed) {
    token.x = mixed.token.x;
    token.y = mixed.token.y;
    target.x = mixed.target.x;
    target.y = mixed.target.y;
  } else {
    const fromX = token.x;
    const fromY = token.y;
    token.x = target.x;
    token.y = target.y;
    target.x = fromX;
    target.y = fromY;
  }

  const roll = rollDice(`1d${superiorityDie(fighterLevelOf(sheet.classes))}`);
  pushRollMessage(ctx, room, {
    author: token.name,
    roll,
    kind: 'plain',
    params: { subject: `Приманка и подмена (+${roll.total} к AC)` },
  });
  const recipient = variant === 'self' ? token : target;
  applyEffectTo(ctx, room, {
    sourceKey: BAIT_AND_SWITCH_ACTION,
    sourceId: token.id,
    mapId,
    effectDef: {
      name: 'Приманка и подмена',
      duration: { type: 'endOfTurn', of: 'source' },
      modifiers: [{ target: 'ac', mode: 'add', value: roll.total }],
    },
    target: recipient,
  });
  ctx.emitToken(room, 'token:update', mapId, token);
  ctx.emitToken(room, 'token:update', mapId, target);
  ctx.systemMessage(room, {
    code: 'features.baitAndSwitch',
    params: { name: token.name, target: target.name, amount: roll.total, acTarget: recipient.name },
  });
  ctx.syncCombat(room, mapId);
}

/** Знай врага: бонусное действие, цель в 30 фт — защиты раскрываются всем в чат. */
export function applyKnowYourEnemy(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  token: Token,
  _sheet: CharacterSheet | undefined,
  targetId: string | undefined
): void {
  const map = ctx.manager.findMap(room, mapId);
  const target = targetId ? ctx.manager.findToken(room, mapId, targetId) : null;
  if (!map || !target || isIncapacitated(token.conditions)) {
    fail(ctx, 'spellNoTarget');
    return;
  }
  const grid = gridOfMap(map, room.scene.grid);
  const feet = gridDistanceFeet(token, target, grid.size);
  if (feet > 30) {
    fail(ctx, 'outOfRange', { feet: Math.round(feet) });
    return;
  }
  const defenses = damageDefensesForToken(room, target);
  const listOf = (type: DamageDefense['type']): string => {
    const types = [...new Set(defenses.filter((d) => d.type === type).map((d) => d.damageType))];
    return types.join(',');
  };
  ctx.systemMessage(room, {
    code: 'features.knowYourEnemy',
    params: {
      name: token.name,
      target: target.name,
      immunities: listOf('immunity'),
      resistances: listOf('resistance'),
      vulnerabilities: listOf('vulnerability'),
    },
  });
}
