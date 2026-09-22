import { rollDice, type ReactionOption, type Token } from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { pushRollMessage } from './messages';
import type { ReactionChoice } from './reactions/internal';

/**
 * Бардовское вдохновение: кости `EffectInstance.bonusDie` на токене.
 * Тратятся без слота реакции на промах атаки или проваленный спасбросок.
 */

/** Варианты окна для костей на токене; `use` — трата на урон/AC (Боевое вдохновение). */
export function bonusDieOptions(token: Token, use?: 'damage' | 'ac'): ReactionOption[] {
  return token.effects
    .filter((e) => e.bonusDie && (!use || e.bonusDieUses?.includes(use)))
    .map((e) => ({
      id: use ? `bonusdie:${e.id}:${use}` : `bonusdie:${e.id}`,
      name:
        use === 'damage'
          ? `${e.name || 'Бардовское вдохновение'} (урон)`
          : use === 'ac'
            ? `${e.name || 'Бардовское вдохновение'} (AC)`
            : e.name || 'Бардовское вдохновение',
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
  pushRollMessage(ctx, room, {
    author: token.name,
    roll,
    kind: 'plain',
    params: { subject: effect.name || 'Бардовское вдохновение' },
  });
  return roll.total;
}

/** Тратит выбранные в окне кости атакующего; суммарный бонус к броску. */
export function applyBonusDieChoices(
  ctx: ConnCtx,
  room: Room,
  plan: { attacker: Token | null; attackerMapId: string | null },
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

export interface CombatInspirationMods {
  extraDamage: number;
  extraAc: number;
}

/**
 * Боевое вдохновение (Доблесть): выбранные кости на урон (без реакции) и на AC
 * (реакция носителя). Возвращает модификаторы для пересчёта урона.
 */
export function applyCombatInspirationChoices(
  ctx: ConnCtx,
  room: Room,
  plan: { attacker: Token | null; attackerMapId: string | null; targetMapId: string | null },
  target: Token | undefined,
  choices: ReactionChoice[]
): CombatInspirationMods {
  const mods: CombatInspirationMods = { extraDamage: 0, extraAc: 0 };
  for (const choice of choices) {
    const id = choice.optionId ?? '';
    if (!id.startsWith('bonusdie:')) continue;
    const [effectId, use] = id.slice('bonusdie:'.length).split(':');
    if (use !== 'damage' && use !== 'ac') continue;
    const holder = use === 'damage' ? plan.attacker : target;
    const fallbackMapId = use === 'damage' ? plan.attackerMapId : plan.targetMapId;
    const mapId = choice.mapId ?? fallbackMapId;
    if (!holder || !mapId || !effectId) continue;
    const value = spendBonusDie(ctx, room, mapId, holder, effectId);
    if (!value) continue;
    if (use === 'damage') {
      mods.extraDamage += value;
    } else {
      ctx.manager.spendSlot(room, mapId, holder, 'reaction');
      mods.extraAc += value;
    }
  }
  return mods;
}
