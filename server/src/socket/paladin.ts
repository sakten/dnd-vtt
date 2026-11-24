import {
  gridDistanceFeet,
  gridOfMap,
  LAY_ON_HANDS_POISON_COST,
  type ActionDef,
  type CharacterSheet,
  type Token,
} from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { applyDamage } from './damage';
import { removeConditionInstances } from './effectsApply';
import { fail, type ActionIssue } from './errors';

/** Наложение рук: касание (5 фт или себя), пул HP, опционально снятие отравления за 5. */
export function layOnHandsIssue(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  caster: Token,
  targetId: string | undefined,
  featureAmount: unknown,
  variant: string | undefined
): ActionIssue | null {
  const target = targetId ? ctx.manager.findToken(room, mapId, targetId) : null;
  const map = ctx.manager.findMap(room, mapId);
  if (!target || !map) return { code: 'spellNoTarget' };
  const grid = gridOfMap(map, room.scene.grid);
  const feet = gridDistanceFeet(caster, target, grid.size);
  if (feet > 5) return { code: 'outOfRange', params: { feet: Math.round(feet) } };
  const amount = Math.max(0, Math.round(Number(featureAmount) || 0));
  if (amount <= 0) return { code: 'badRequest' };
  if (variant === 'poison') {
    if (amount < LAY_ON_HANDS_POISON_COST) return { code: 'badRequest' };
    if (!target.conditions.some((condition) => condition.key === 'poisoned')) {
      return { code: 'restoreNoCondition' };
    }
  }
  return null;
}

/** Сколько очков пула тратит одно применение. */
export function layOnHandsAmount(_action: ActionDef, featureAmount: unknown): number {
  return Math.max(1, Math.round(Number(featureAmount) || 1));
}

/** Лечение и снятие отравления; пул уже оплачен вызывающим. */
export function applyLayOnHands(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  caster: Token,
  _sheet: CharacterSheet | undefined,
  targetId: string | undefined,
  variant: string | undefined,
  featureAmount: unknown
): void {
  const target = targetId ? ctx.manager.findToken(room, mapId, targetId) : null;
  if (!target) {
    fail(ctx, 'spellNoTarget');
    return;
  }
  const total = Math.max(1, Math.round(Number(featureAmount) || 1));
  const poison = variant === 'poison';
  const heal = Math.max(0, total - (poison ? LAY_ON_HANDS_POISON_COST : 0));
  if (heal > 0) {
    applyDamage(ctx, {
      target,
      mapId,
      amount: heal,
      kind: 'heal',
      author: caster.name,
      params: { subject: `Наложение рук · ${target.name}` },
    });
  }
  if (poison) removeConditionInstances(ctx, room, mapId, target, ['poisoned']);
  ctx.emitToken(room, 'token:update', mapId, target);
  ctx.syncCombat(room, mapId);
  const code = poison
    ? heal > 0
      ? 'paladin.layOnHandsPoison'
      : 'paladin.layOnHandsPoisonOnly'
    : 'paladin.layOnHands';
  ctx.systemMessage(room, {
    code,
    params: { name: caster.name, target: target.name, heal },
  });
}
