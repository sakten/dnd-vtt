import {
  isShadowBladeThrown,
  shadowBladeEffectIdOf,
  shadowBladeReturnAction,
  type AttackEntry,
  type Token,
} from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';

/**
 * Синтетическая запись (`shadow:`) допустима только пока у токена жив
 * соответствующий эффект с клинком в руке: защита от индексов «на память».
 */
export function shadowBladeAttackAllowed(token: Token, attack: AttackEntry): boolean {
  const effectId = shadowBladeEffectIdOf(attack);
  if (!effectId) return true;
  return token.effects.some((e) => e.id === effectId && !!e.shadowBlade?.inHand);
}

/** Бросок клинка: он исчезает из руки (возврат — бонусным действием через эффект). */
export function markShadowBladeThrown(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  token: Token | null,
  attack: AttackEntry
): void {
  if (!token || !isShadowBladeThrown(attack)) return;
  const effectId = shadowBladeEffectIdOf(attack);
  const effect = token.effects.find((e) => e.id === effectId);
  if (!effect?.shadowBlade?.inHand) return;
  effect.shadowBlade = { ...effect.shadowBlade, inHand: false };
  // Эффекты старых кастов могли не иметь статичного действия возврата — достраиваем.
  if (!effect.actions?.some((a) => a.id === 'return')) {
    effect.actions = [shadowBladeReturnAction(), ...(effect.actions ?? [])];
  }
  ctx.emitToken(room, 'token:update', mapId, token);
}
