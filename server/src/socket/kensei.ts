import {
  AGILE_PARRY_SOURCE,
  KENSEI_SHOT_ACTION,
  kenseiWeaponDefOf,
  type ActionDef,
  type CharacterSheet,
  type Token,
} from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { applyEffectTo } from './effectsApply';
import type { ActionIssue } from './errors';

/**
 * Кэнсэй-монах: серверные проверки и эффекты поверх декларативных кнопок.
 * `kenseisShot`/`sharpenTheBlade` — валидация до траты ки; `agileParry` — реакция
 * на безоружный удар в действии «Атака» (эффект +2 AC до начала следующего хода).
 */

export function kenseiActionIssue(action: ActionDef, sheet: CharacterSheet | undefined): ActionIssue | null {
  const weapon = kenseiWeaponDefOf({ attacks: sheet?.attacks, hands: sheet?.hands, classes: sheet?.classes });
  if (!weapon) return { code: 'kenseiNoWeapon' };
  if (action.id === KENSEI_SHOT_ACTION && weapon.rangeType !== 'ranged') {
    return { code: 'kenseiNoRangedWeapon' };
  }
  return null;
}

/** Sharpen the Blade: игрок выбирает 1–3 ки (payload), остальное — фиксированная стоимость. */
export function sharpenTheBladeAmount(action: ActionDef, featureAmount: unknown): number {
  return Math.max(1, Math.min(3, Math.round(Number(featureAmount) || action.resourceAmount || 1)));
}

/** Agile Parry: безоружный удар частью действия «Атака» с melee-кэнсэй-оружием. */
export function agileParryEligible(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  token: Token,
  sheet: CharacterSheet | undefined,
  actionId: string,
  offhand: boolean | undefined
): boolean {
  if (actionId !== 'unarmedStrike' || offhand || !sheet) return false;
  const weapon = kenseiWeaponDefOf({ attacks: sheet.attacks, hands: sheet.hands, classes: sheet.classes });
  if (!weapon || weapon.rangeType !== 'melee') return false;
  const turnState = ctx.manager.turnStateFor(room, mapId, token);
  // Удар из запаса действия «Атака»; бонусный (Шквал) и доп. действие Haste не считаются.
  return !turnState || turnState.attacksRemaining > 0 || (turnState.flurryAttacks <= 0 && turnState.extraActions <= 0);
}

export function applyAgileParry(ctx: ConnCtx, room: Room, mapId: string, token: Token): void {
  applyEffectTo(ctx, room, {
    sourceKey: AGILE_PARRY_SOURCE,
    sourceId: token.id,
    mapId,
    effectDef: {
      name: 'Ловкая защита',
      duration: { type: 'endOfTurn', of: 'target' },
      modifiers: [{ target: 'ac', mode: 'add', value: 2 }],
    },
    target: token,
  });
  ctx.emitToken(room, 'token:update', mapId, token);
  ctx.syncCombat(room, mapId);
  ctx.systemMessage(room, { code: 'automation.agileParry', params: { name: token.name } });
}
