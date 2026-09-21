import type { ActionCost, ActionDef } from '../domain/actions';
import type { TurnState } from '../domain/combat';
import type { Restrictions } from '../domain/effects';
import type { ClassLevel } from '../domain/sheet';
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

/**
 * Доступна ли атака: запас мультиатаки/Шквала (безоружные) или свободное действие.
 * Единое правило для сервера и клиента (Slow — `oneAttackOnly`).
 */
export function attackAvailable(
  turn: TurnState,
  restrictions: Restrictions,
  opts: { unarmed?: boolean } = {}
): boolean {
  if (restrictions.oneAttackOnly && turn.actionUsed) return false;
  const flurry = opts.unarmed === true && turn.flurryAttacks > 0;
  return turn.attacksRemaining > 0 || flurry || !turn.actionUsed || turn.extraActions > 0;
}

/** Доступен ли слот (действие/бонус/реакция) с учётом ограничений эффектов. */
export function slotSpendable(turn: TurnState, restrictions: Restrictions, slot: ActionCost): boolean {
  switch (slot) {
    case 'action':
      if (restrictions.noActions) return false;
      if (restrictions.actionOrBonusOnly && turn.bonusActionUsed) return false;
      return actionSlotAvailable(turn, 'action');
    case 'bonus':
      if (restrictions.noBonus) return false;
      if (restrictions.actionOrBonusOnly && turn.actionUsed) return false;
      return actionSlotAvailable(turn, 'bonus');
    case 'reaction':
      if (restrictions.noReactions) return false;
      return actionSlotAvailable(turn, 'reaction');
    default:
      return true;
  }
}

/** Списывает атаку (запас/Шквал/доп. действие/действие). false — нечего списывать. */
export function consumeAttackTurn(
  turn: TurnState,
  attacksPer: number,
  restrictions: Restrictions,
  opts: { unarmed?: boolean } = {}
): boolean {
  if (!attackAvailable(turn, restrictions, opts)) return false;
  if (turn.attacksRemaining > 0) {
    turn.attacksRemaining -= 1;
  } else if (opts.unarmed === true && turn.flurryAttacks > 0) {
    turn.flurryAttacks -= 1;
  } else if (turn.extraActions > 0) {
    turn.extraActions -= 1;
    turn.attacksRemaining = Math.max(0, attacksPer - 1);
  } else {
    turn.actionUsed = true;
    turn.attacksRemaining = Math.max(0, attacksPer - 1);
  }
  return true;
}

/** Списывает слот действия с учётом ограничений. false — слот недоступен. */
export function consumeSlotTurn(turn: TurnState, restrictions: Restrictions, slot: ActionCost): boolean {
  if (!slotSpendable(turn, restrictions, slot)) return false;
  switch (slot) {
    case 'action':
      if (turn.extraActions > 0) turn.extraActions -= 1;
      else turn.actionUsed = true;
      return true;
    case 'bonus':
      if (turn.extraBonusActions > 0) turn.extraBonusActions -= 1;
      else turn.bonusActionUsed = true;
      return true;
    case 'reaction':
      turn.reactionUsed = true;
      return true;
    default:
      return true;
  }
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
    } else if (entry.className === 'bard') {
      if (entry.subclass === 'valor' && level >= 6) attacks = Math.max(attacks, 2);
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
