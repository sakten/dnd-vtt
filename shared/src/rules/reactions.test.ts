import { describe, expect, it } from 'vitest';
import { ABSORB_ELEMENTS_TYPES, absorbTypesOf, reactionSpellTrigger, superiorityDie } from './reactions';

describe('reactionSpellTrigger', () => {
  it('возвращает триггер известных реакционных заклинаний', () => {
    expect(reactionSpellTrigger('XPHB:Shield')).toBe('attackHit');
    expect(reactionSpellTrigger('XGE:Absorb Elements')).toBe('attackHit');
    expect(reactionSpellTrigger('XPHB:Hellish Rebuke')).toBe('damage');
    expect(reactionSpellTrigger('XPHB:Counterspell')).toBe('spellCast');
  });

  it('неизвестное заклинание — undefined', () => {
    expect(reactionSpellTrigger('XPHB:Fireball')).toBeUndefined();
    expect(reactionSpellTrigger('')).toBeUndefined();
  });
});

describe('absorbTypesOf', () => {
  it('возвращает типы урона Absorb Elements', () => {
    expect(absorbTypesOf('XGE:Absorb Elements')).toEqual(ABSORB_ELEMENTS_TYPES);
  });

  it('для остальных заклинаний — пустой список', () => {
    expect(absorbTypesOf('XPHB:Shield')).toEqual([]);
    expect(absorbTypesOf('UNKNOWN:Spell')).toEqual([]);
  });
});

describe('superiorityDie', () => {
  it('растёт по уровням боевого мастера', () => {
    expect([1, 9, 10, 17, 18, 20].map(superiorityDie)).toEqual([8, 8, 10, 10, 12, 12]);
  });
});
