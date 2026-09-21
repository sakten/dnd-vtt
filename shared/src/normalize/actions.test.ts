import { describe, expect, it } from 'vitest';
import { actionTargeting } from '../domain/actions';
import { normalizeActions } from './actions';

describe('normalizeActions: единое место таргетинга', () => {
  it('легаси ability.targeting поднимается на уровень действия', () => {
    const [action] = normalizeActions([
      {
        name: 'Ram',
        costs: ['action'],
        ability: { attack: { rangeType: 'melee', bonus: '+5' }, targeting: { kind: 'creature', range: 5 } },
      },
    ]);
    expect(action?.targeting).toEqual({ kind: 'creature', range: 5 });
    expect(action?.ability?.targeting).toBeUndefined();
    expect(actionTargeting(action!)).toEqual({ kind: 'creature', range: 5 });
  });

  it('канонический action.targeting сохраняется без изменений', () => {
    const [action] = normalizeActions([
      {
        name: 'Bite',
        costs: ['action'],
        targeting: { kind: 'creature', range: 5 },
        ability: { attack: { rangeType: 'melee', bonus: '+4' } },
      },
    ]);
    expect(action?.targeting).toEqual({ kind: 'creature', range: 5 });
  });
});
