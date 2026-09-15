import { randomUUID } from 'node:crypto';
import { type AutomationEffect, type EffectInstance, type Token } from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';

export interface ApplyEffectArgs {
  sourceKey: string;
  sourceId: string;
  mapId: string;
  effectDef: AutomationEffect;
  target: Token;
  markedId?: string;
  /** СЛ повторного спасброска для `untilSave`-эффектов (Sleep и т.п.). */
  untilSaveDc?: number;
  /** СЛ выпутывания действием (`effectDef.escape`). */
  escapeDc?: number;
  /** Зона-источник (аура): эффект снимается при выходе и окончании зоны. */
  zoneId?: string;
}

/** Накладывает один эффект на токен (заменяя прошлый каст того же источника). */
export function applyEffectTo(ctx: ConnCtx, room: Room, args: ApplyEffectArgs): string {
  const { sourceKey, sourceId, mapId, effectDef, target, markedId, untilSaveDc, escapeDc, zoneId } = args;
  for (const stale of target.effects.filter((e) => e.sourceKey === sourceKey && e.sourceId === sourceId)) {
    ctx.manager.removeEffect(room, target, stale.id);
  }
  const effectId = randomUUID();
  let duration = effectDef.duration;
  if (duration.type === 'untilSave' && untilSaveDc !== undefined) duration = { ...duration, dc: untilSaveDc };
  const effect: EffectInstance = {
    id: effectId,
    name: effectDef.name,
    sourceKey,
    sourceId,
    concentration: effectDef.concentration,
    duration,
    modifiers: effectDef.modifiers.map((m, i) => ({
      ...m,
      id: `${effectId}:m${i}`,
      ...(markedId ? { filter: { ...m.filter, targetId: markedId } } : {}),
    })),
    conditions: effectDef.conditions,
    escalate: effectDef.escalate,
    wakeOnDamage: effectDef.wakeOnDamage,
    restrictions: effectDef.restrictions,
    zoneId,
    escape: effectDef.escape && escapeDc !== undefined ? { ...effectDef.escape, dc: escapeDc } : undefined,
    misdirect: effectDef.misdirect ? { ...effectDef.misdirect } : undefined,
    hidden: effectDef.hidden,
    bonusDie: effectDef.bonusDie,
  };
  ctx.manager.applyEffect(room, target, effect);
  if (effectDef.tempHp) {
    ctx.manager.grantTempHp(room, target, effectDef.tempHp);
    const controllerId = ctx.manager.controllerOfToken(room, target);
    if (controllerId) ctx.emitResources(room, controllerId);
  }
  ctx.emitToken(room, 'token:update', mapId, target);
  return effectId;
}

/** Снимает с токена все эффекты, наложенные зоной; true — что-то снято. */
export function removeZoneEffects(ctx: ConnCtx, room: Room, mapId: string, token: Token, zoneId: string): boolean {
  const ids = token.effects.filter((e) => e.zoneId === zoneId).map((e) => e.id);
  if (!ids.length) return false;
  for (const id of ids) ctx.manager.removeEffect(room, token, id);
  ctx.emitToken(room, 'token:update', mapId, token);
  return true;
}
