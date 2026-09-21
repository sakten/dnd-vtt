import { describe, expect, it } from 'vitest';
import { normalizeActions } from './actions';

describe('normalizeActions: таргетинг', () => {
  it('action.targeting сохраняется', () => {
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
