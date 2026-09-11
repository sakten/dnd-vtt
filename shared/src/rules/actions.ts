import type { ActionCost, ActionDef, ClassLevel, TurnState } from '../types';
import { clampLevel } from './classes';

/** Доступен ли слот действия (действие/бонусное/реакция) с учётом доп. слотов. */
export function actionSlotAvailable(turn: TurnState, slot: ActionCost): boolean {
  switch (slot) {
    case 'action':
      return !turn.actionUsed || turn.extraActions > 0;
    case 'bonus':
      return !turn.bonusActionUsed || turn.extraBonusActions > 0;
    case 'reaction':
      return !turn.reactionUsed;
    case 'legendary':
      return turn.legendaryRemaining > 0;
    default:
      return true;
  }
}

/** Доступно ли действие хотя бы по одному из своих слотов. */
export function actionAvailable(turn: TurnState, costs: ActionCost[]): boolean {
  return costs.some((slot) => actionSlotAvailable(turn, slot));
}

/** Классы, получающие вторую атаку за действие «Атака» на 5 уровне. */
const EXTRA_ATTACK_CLASSES = new Set(['barbarian', 'fighter', 'monk', 'paladin', 'ranger']);

/**
 * Число атак за одно действие «Атака» (Extra Attack/мультиатака).
 * Мультикласс: берём максимум по классам (способности не складываются).
 */
export function attacksPerAction(classes: ClassLevel[]): number {
  let attacks = 1;
  for (const entry of classes) {
    const level = clampLevel(entry.level);
    if (entry.className === 'fighter') {
      if (level >= 20) attacks = Math.max(attacks, 4);
      else if (level >= 11) attacks = Math.max(attacks, 3);
      else if (level >= 5) attacks = Math.max(attacks, 2);
    } else if (EXTRA_ATTACK_CLASSES.has(entry.className) && level >= 5) {
      attacks = Math.max(attacks, 2);
    }
  }
  return attacks;
}

/** Базовые действия, доступные любому существу. */
export const BASE_ACTIONS: ActionDef[] = [
  { id: 'attack', name: 'Атака', source: 'basic', costs: ['action'], targeting: { kind: 'creature' } },
  { id: 'dash', name: 'Рывок', source: 'basic', costs: ['action'], targeting: { kind: 'self' } },
  { id: 'disengage', name: 'Отход', source: 'basic', costs: ['action'], targeting: { kind: 'self' } },
  { id: 'dodge', name: 'Уклонение', source: 'basic', costs: ['action'], targeting: { kind: 'self' } },
  { id: 'help', name: 'Помощь', source: 'basic', costs: ['action'], targeting: { kind: 'creature' } },
  { id: 'hide', name: 'Скрыться', source: 'basic', costs: ['action'], targeting: { kind: 'self' } },
  { id: 'grapple', name: 'Захват', source: 'basic', costs: ['action'], targeting: { kind: 'creature' } },
  { id: 'shove', name: 'Толчок', source: 'basic', costs: ['action'], targeting: { kind: 'creature' } },
  { id: 'unarmedStrike', name: 'Безоружный удар', source: 'basic', costs: ['action'], targeting: { kind: 'creature' } },
];

export function findBaseAction(id: string): ActionDef | undefined {
  return BASE_ACTIONS.find((a) => a.id === id);
}
