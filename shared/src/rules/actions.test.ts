import { describe, expect, it } from 'vitest';
import { emptyTurnState } from '../domain/combat';
import {
  BASE_ACTIONS,
  actionAvailable,
  actionSlotAvailable,
  attackAvailable,
  attacksPerAction,
  consumeAttackTurn,
  consumeSlotTurn,
  findBaseAction,
  slotSpendable,
} from './actions';

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

  it('бард-доблесть: вторая атака с 6 уровня', () => {
    expect(attacksPerAction([{ className: 'bard', level: 5, subclass: 'valor' }])).toBe(1);
    expect(attacksPerAction([{ className: 'bard', level: 6, subclass: 'valor' }])).toBe(2);
    expect(attacksPerAction([{ className: 'bard', level: 6, subclass: 'lore' }])).toBe(1);
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

describe('attackAvailable / consumeAttackTurn', () => {
  it('действие, мультиатака и доп. действия', () => {
    const turn = emptyTurnState();
    expect(attackAvailable(turn, {})).toBe(true);
    expect(consumeAttackTurn(turn, 3, {})).toBe(true);
    expect(turn.actionUsed).toBe(true);
    expect(turn.attacksRemaining).toBe(2);
    expect(consumeAttackTurn(turn, 3, {})).toBe(true);
    expect(consumeAttackTurn(turn, 3, {})).toBe(true);
    expect(turn.attacksRemaining).toBe(0);
    expect(consumeAttackTurn(turn, 3, {})).toBe(false);
    turn.extraActions = 1;
    expect(attackAvailable(turn, {})).toBe(true);
    expect(consumeAttackTurn(turn, 3, {})).toBe(true);
    expect(turn.extraActions).toBe(0);
  });

  it('Slow: одна атака за ход', () => {
    const turn = { ...emptyTurnState(), actionUsed: true, attacksRemaining: 1 };
    expect(attackAvailable(turn, { oneAttackOnly: true })).toBe(false);
    expect(consumeAttackTurn(turn, 3, { oneAttackOnly: true })).toBe(false);
  });

  it('Шквал ударов: безоружный запас, оружием его не потратить', () => {
    const turn = { ...emptyTurnState(), actionUsed: true, flurryAttacks: 1 };
    expect(attackAvailable(turn, {})).toBe(false);
    expect(attackAvailable(turn, {}, { unarmed: true })).toBe(true);
    expect(consumeAttackTurn(turn, 1, {}, { unarmed: true })).toBe(true);
    expect(turn.flurryAttacks).toBe(0);
  });

  it('Loading: один боеприпас за действие — остаток серии атак сгорает', () => {
    const turn = { ...emptyTurnState(), attacksRemaining: 2 };
    expect(consumeAttackTurn(turn, 3, {}, { loading: true })).toBe(true);
    expect(turn.attacksRemaining).toBe(0);
    expect(turn.actionUsed).toBe(false);
    const fresh = emptyTurnState();
    expect(consumeAttackTurn(fresh, 3, {}, { loading: true })).toBe(true);
    expect(fresh.actionUsed).toBe(true);
    expect(fresh.attacksRemaining).toBe(0);
  });
});

describe('slotSpendable / consumeSlotTurn', () => {
  it('ограничения эффектов (Slow, Stinking Cloud)', () => {
    const turn = emptyTurnState();
    expect(slotSpendable(turn, { noActions: true }, 'action')).toBe(false);
    expect(slotSpendable(turn, { noBonus: true }, 'bonus')).toBe(false);
    expect(slotSpendable(turn, { noReactions: true }, 'reaction')).toBe(false);
    expect(slotSpendable(turn, { actionOrBonusOnly: true }, 'action')).toBe(true);
    expect(slotSpendable({ ...turn, bonusActionUsed: true }, { actionOrBonusOnly: true }, 'action')).toBe(false);
    expect(slotSpendable({ ...turn, actionUsed: true }, { actionOrBonusOnly: true }, 'bonus')).toBe(false);
  });

  it('доп. слоты списываются первыми', () => {
    const turn = { ...emptyTurnState(), actionUsed: true, extraActions: 2 };
    expect(consumeSlotTurn(turn, {}, 'action')).toBe(true);
    expect(turn.extraActions).toBe(1);
    expect(turn.actionUsed).toBe(true);
    expect(consumeSlotTurn(turn, {}, 'bonus')).toBe(true);
    expect(turn.bonusActionUsed).toBe(true);
    expect(consumeSlotTurn(turn, {}, 'reaction')).toBe(true);
    expect(slotSpendable(turn, {}, 'reaction')).toBe(false);
  });
});
