import { describe, expect, it } from 'vitest';
import { makeCombatRoom, makeToken } from '../test/fixtures';
import { attackDamageRoll, attackHitRoll, attackUnseen } from './attackResolve';

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

describe('attackUnseen', () => {
  it('стена между участниками — оба не видят друг друга', () => {
    const attacker = makeToken('a', { x: 50, y: 100 });
    const target = makeToken('t', { x: 150, y: 100 });
    const room = makeCombatRoom([attacker, target]);
    const map = room.scene.maps[0]!;
    map.walls = [{ id: 'w1', x1: 100, y1: 0, x2: 100, y2: 200, kind: 'wall', open: false }];

    expect(attackUnseen(room, attacker, target, map)).toEqual({ unseenTarget: true, unseenAttacker: true });

    map.walls = [];
    expect(attackUnseen(room, attacker, target, map)).toEqual({ unseenTarget: false, unseenAttacker: false });
  });
});

describe('attackHitRoll', () => {
  it('штраф-истощение и нат. 20: попадание и крит', () => {
    withRandom(0.999, () => {
      const hit = attackHitRoll({
        attackExpr: 'd20+0',
        advCount: 0,
        disCount: 0,
        penalty: -5,
        critMin: 20,
        targetAc: 25,
      });
      expect(hit.hitRoll.total).toBe(20);
      expect(hit.crit).toBe(true);
      expect(hit.hitSuccess).toBe(true); // 20 - 5 = 15 < 25, но крит = попадание
    });
  });

  it('AC неизвестен — попадание не проверяется', () => {
    withRandom(0.5, () => {
      const hit = attackHitRoll({
        attackExpr: 'd20+2',
        advCount: 0,
        disCount: 0,
        penalty: 0,
        critMin: 20,
        targetAc: 0,
      });
      expect(hit.hitSuccess).toBeUndefined();
      expect(hit.crit).toBe(false);
    });
  });
});

describe('attackDamageRoll', () => {
  it('крит удваивает кости урона', () => {
    withRandom(0.5, () => {
      expect(attackDamageRoll('1d6', undefined, false).total).toBe(4);
      expect(attackDamageRoll('1d6', undefined, true).total).toBe(8);
    });
  });
});
