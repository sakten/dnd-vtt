import { describe, expect, it } from 'vitest';
import { normalizeActions, normalizeStatblock } from './actions';

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

describe('normalizeStatblock: иммунитеты к состояниям', () => {
  it('канонические ключи сохраняются, чужие — отбрасываются', () => {
    const sb = normalizeStatblock({
      abilities: { str: 10 },
      conditionImmunities: ['charmed', 'bogus', 'charmed', 'poisoned'],
    });
    expect(sb?.conditionImmunities).toEqual(['charmed', 'poisoned']);
    expect(normalizeStatblock({ abilities: { str: 10 }, conditionImmunities: [] })?.conditionImmunities).toBeUndefined();
  });
});
