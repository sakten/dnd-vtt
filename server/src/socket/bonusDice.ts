import { rollDice, type ReactionOption, type Token } from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import type { WeaponAttackPlan } from './attackResolve';
import type { ReactionChoice } from './reactions/internal';

/**
 * Бардовское вдохновение: кости `EffectInstance.bonusDie` на токене.
 * Тратятся без слота реакции на промах атаки или проваленный спасбросок.
 */

/** Варианты окна для костей на токене. */
export function bonusDieOptions(token: Token): ReactionOption[] {
  return token.effects
    .filter((e) => e.bonusDie)
    .map((e) => ({
      id: `bonusdie:${e.id}`,
      name: e.name || 'Бардовское вдохновение',
      kind: 'feature' as const,
    }));
}

/** Тратит одну кость по id эффекта; возвращает выпавшее значение (0 — не нашлось). */
export function spendBonusDie(ctx: ConnCtx, room: Room, mapId: string, token: Token, effectId: string): number {
  const effect = token.effects.find((e) => e.id === effectId && e.bonusDie);
  if (!effect?.bonusDie) return 0;
  const roll = rollDice(effect.bonusDie);
  ctx.manager.removeEffect(room, token, effect.id);
  ctx.emitToken(room, 'token:update', mapId, token);
  ctx.systemMessage(room, `${token.name}: Бардовское вдохновение (+${roll.total})`);
  return roll.total;
}

/** Тратит выбранные в окне кости атакующего; суммарный бонус к броску. */
export function applyBonusDieChoices(
  ctx: ConnCtx,
  room: Room,
  plan: WeaponAttackPlan,
  choices: ReactionChoice[]
): number {
  const attacker = plan.attacker;
  if (!attacker || !plan.attackerMapId) return 0;
  let bonus = 0;
  for (const choice of choices) {
    const id = choice.optionId ?? '';
    if (!id.startsWith('bonusdie:')) continue;
    bonus += spendBonusDie(ctx, room, plan.attackerMapId, attacker, id.slice('bonusdie:'.length));
  }
  return bonus;
}
