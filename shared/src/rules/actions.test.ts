import { describe, expect, it } from 'vitest';
import { emptyTurnState } from '../types';
import { BASE_ACTIONS, actionAvailable, actionSlotAvailable, attacksPerAction, findBaseAction } from './actions';

describe('attacksPerAction', () => {
  it('без классов — одна атака', () => {
    expect(attacksPerAction([])).toBe(1);
    expect(attacksPerAction([{ className: 'wizard', level: 20 }])).toBe(1);
  });

  it('воин: 2/3/4 атаки на 5/11/20', () => {
    expect(attacksPerAction([{ className: 'fighter', level: 4 }])).toBe(1);
    expect(attacksPerAction([{ className: 'fighter', level: 5 }])).toBe(2);
    expect(attacksPerAction([{ className: 'fighter', level: 11 }])).toBe(3);
    expect(attacksPerAction([{ className: 'fighter', level: 20 }])).toBe(4);
  });

  it('прочие воинские классы — вторая атака на 5', () => {
    expect(attacksPerAction([{ className: 'barbarian', level: 5 }])).toBe(2);
    expect(attacksPerAction([{ className: 'monk', level: 5 }])).toBe(2);
    expect(attacksPerAction([{ className: 'paladin', level: 4 }])).toBe(1);
    expect(attacksPerAction([{ className: 'ranger', level: 6 }])).toBe(2);
  });

  it('мультикласс берёт максимум, не суммирует', () => {
    expect(attacksPerAction([{ className: 'fighter', level: 11 }, { className: 'wizard', level: 5 }])).toBe(3);
    expect(attacksPerAction([{ className: 'monk', level: 5 }, { className: 'fighter', level: 4 }])).toBe(2);
  });
});

describe('BASE_ACTIONS', () => {
  it('уникальные id и есть атака за действие', () => {
    const ids = BASE_ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(findBaseAction('attack')?.costs).toEqual(['action']);
    expect(findBaseAction('attack')?.targeting?.kind).toBe('creature');
    expect(findBaseAction('nope')).toBeUndefined();
  });
});

describe('actionSlotAvailable', () => {
  it('действие/бонус/реакция и доп. слоты', () => {
    const turn = emptyTurnState();
    expect(actionSlotAvailable(turn, 'action')).toBe(true);
    turn.actionUsed = true;
    expect(actionSlotAvailable(turn, 'action')).toBe(false);
    turn.extraActions = 1;
    expect(actionSlotAvailable(turn, 'action')).toBe(true);

    expect(actionSlotAvailable(turn, 'bonus')).toBe(true);
    turn.bonusActionUsed = true;
    expect(actionSlotAvailable(turn, 'bonus')).toBe(false);
    turn.extraBonusActions = 2;
    expect(actionSlotAvailable(turn, 'bonus')).toBe(true);

    expect(actionSlotAvailable(turn, 'reaction')).toBe(true);
    turn.reactionUsed = true;
    expect(actionSlotAvailable(turn, 'reaction')).toBe(false);
  });

  it('actionAvailable учитывает любой доступный слот', () => {
    const turn = emptyTurnState();
    turn.actionUsed = true;
    expect(actionAvailable(turn, ['action'])).toBe(false);
    expect(actionAvailable(turn, ['action', 'bonus'])).toBe(true);
  });
});
