import {
  BAIT_AND_SWITCH_ACTION,
  KENSEI_SHOT_ACTION,
  KNOW_YOUR_ENEMY_ACTION,
  SHARPEN_THE_BLADE_ACTION,
  type ActionDef,
  type CharacterSheet,
  type Token,
} from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import type { ActionIssue } from './errors';
import { kenseiActionIssue, sharpenTheBladeAmount } from './kensei';
import { applyBaitAndSwitch, applyKnowYourEnemy, baitAndSwitchIssue, knowYourEnemyIssue } from './maneuvers';

/**
 * Спецдействия: механики, которым нужен серверный код сверх `AutomationDef`.
 * Общий протокол — проверка до траты, необязательная стоимость из payload,
 * применение после оплаты. Обычные черты сюда не попадают: их ведёт `featureAutomation`.
 */

export interface SpecialActionInput {
  ctx: ConnCtx;
  room: Room;
  mapId: string;
  token: Token;
  sheet: CharacterSheet | undefined;
  action: ActionDef;
  targetId: string | undefined;
  variant: string | undefined;
  featureAmount: unknown;
}

export interface SpecialAction {
  /** Проверка до траты слота/ресурса: цель, дистанция, оружие и т.п. */
  issue?(input: SpecialActionInput): ActionIssue | null;
  /** Стоимость ресурса из payload (Sharpen the Blade: 1–3 ки); undefined — обычная. */
  resourceAmount?(input: SpecialActionInput): number | undefined;
  /** Своя серверная логика после оплаты (обмен, раскрытие защит). */
  apply?(input: SpecialActionInput): void;
}

const SPECIAL_ACTIONS: Record<string, SpecialAction> = {
  [BAIT_AND_SWITCH_ACTION]: {
    issue: ({ ctx, room, mapId, token, targetId }) => baitAndSwitchIssue(ctx, room, mapId, token, targetId),
    apply: ({ ctx, room, mapId, token, sheet, targetId, variant }) =>
      applyBaitAndSwitch(ctx, room, mapId, token, sheet, targetId, variant),
  },
  [KNOW_YOUR_ENEMY_ACTION]: {
    issue: ({ ctx, room, mapId, token, targetId }) => knowYourEnemyIssue(ctx, room, mapId, token, targetId),
    apply: ({ ctx, room, mapId, token, sheet, targetId }) =>
      applyKnowYourEnemy(ctx, room, mapId, token, sheet, targetId),
  },
  [KENSEI_SHOT_ACTION]: {
    issue: ({ action, sheet }) => kenseiActionIssue(action, sheet),
  },
  [SHARPEN_THE_BLADE_ACTION]: {
    issue: ({ action, sheet }) => kenseiActionIssue(action, sheet),
    resourceAmount: ({ action, featureAmount }) => sharpenTheBladeAmount(action, featureAmount),
  },
};

/** Серверная ветка действия по id; остальные обрабатываются общим движком. */
export function specialAction(actionId: string): SpecialAction | undefined {
  return SPECIAL_ACTIONS[actionId];
}
