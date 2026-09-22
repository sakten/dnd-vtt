import { describe, expect, it } from 'vitest';
import type { ActionDef, TokenStatblock } from 'shared';
import { makeCombatRoom, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { applyDamage } from './damage';

/** Сид Math.random на время колбэка (броски детерминированы). */
function withRandom(value: number, fn: () => void): void {
  const original = Math.random;
  Math.random = () => value;
  try {
    fn();
  } finally {
    Math.random = original;
  }
}

const DEATH_BURST: ActionDef = {
  id: 'burst',
  name: 'Смертельный взрыв',
  source: 'monster',
  costs: [],
  ability: {
    save: { ability: 'wis' },
    damage: { dice: '2d6', types: ['psychic'] },
    effects: [{ condition: 'paralyzed', duration: { type: 'endOfTurn', of: 'target' } }],
    trigger: 'death',
    radius: 5,
    side: 'any',
  },
};

const RETALIATION: ActionDef = {
  id: 'retaliate',
  name: 'Возмездие',
  source: 'monster',
  costs: [],
  ability: {
    damage: { dice: '1d6', types: ['psychic'] },
    trigger: 'takeDamage',
    radius: 5,
    side: 'any',
  },
};

function setup(action: ActionDef) {
  const statblock: TokenStatblock = {
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    saveDc: 13,
    actions: [action],
  };
  const monster = makeToken('m', { x: 100, y: 100, hpMax: '20', hpCurrent: 20, statblock });
  const near = makeToken('near', { x: 150, y: 100, hpMax: '30', hpCurrent: 30 });
  const far = makeToken('far', { x: 400, y: 100, hpMax: '30', hpCurrent: 30 });
  const room = makeCombatRoom([monster, near, far]);
  const f = makeConnCtx(room, { dm: true, all: true });
  const hit = (target: typeof monster, amount: number, kind?: 'heal') =>
    applyDamage(f.ctx, { target, mapId: 'm1', amount, damageType: 'slashing', author: 'A', kind });
  return { monster, near, far, hit };
}

describe('триггер способности монстра «при смерти»', () => {
  it('в радиусе: сейв WIS, 2d6 психического и паралич; вне радиуса — нет', () => {
    const { monster, near, far, hit } = setup(DEATH_BURST);
    withRandom(0, () => hit(monster, 25));
    expect(monster.hpCurrent).toBeLessThanOrEqual(0);
    expect(near.hpCurrent).toBe(28); // 2d6 при сиде 0 → 1+1
    expect(near.conditions.some((c) => c.key === 'paralyzed')).toBe(true);
    expect(near.effects.some((e) => e.conditions?.includes('paralyzed'))).toBe(true);
    expect(far.hpCurrent).toBe(30);
    expect(far.conditions.some((c) => c.key === 'paralyzed')).toBe(false);
  });

  it('не срабатывает без триггера и при лечении', () => {
    const plain: ActionDef = { ...DEATH_BURST, id: 'plain', ability: { ...DEATH_BURST.ability!, trigger: undefined } };
    const a = setup(plain);
    withRandom(0, () => a.hit(a.monster, 25));
    expect(a.near.hpCurrent).toBe(30);

    const b = setup(DEATH_BURST);
    withRandom(0, () => b.hit(b.monster, 25, 'heal'));
    expect(b.near.hpCurrent).toBe(30);
    expect(b.near.conditions.some((c) => c.key === 'paralyzed')).toBe(false);
  });
});

describe('триггер способности монстра «при получении урона»', () => {
  it('срабатывает на каждый урон в радиусе', () => {
    const { monster, near, far, hit } = setup(RETALIATION);
    withRandom(0, () => hit(monster, 3));
    expect(monster.hpCurrent).toBe(17);
    expect(near.hpCurrent).toBe(29); // 1d6 при сиде 0 → 1
    expect(far.hpCurrent).toBe(30);
    withRandom(0, () => hit(monster, 2));
    expect(near.hpCurrent).toBe(28);
  });
});
