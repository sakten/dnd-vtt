import { describe, expect, it } from 'vitest';
import { normalizeSheet, type AttackEntry, type Wall } from 'shared';
import { makeToken } from '../test/fixtures';
import type { TargetingState } from '../domain/interaction';
import { attackEntryOf, attackRangeTypeOf, attacksOf } from './tableAttacks';
import { distToSegment } from './wallGeometry';

const attack = (name: string, rangeType: AttackEntry['rangeType'] = 'melee'): AttackEntry => ({
  id: name,
  name,
  hit: 'd20+5',
  damage: '1d8+3',
  damageType: 'slashing',
  rangeType,
  rangeNormal: rangeType === 'melee' ? 5 : 30,
  rangeLong: rangeType === 'melee' ? 0 : 120,
});

const tokenAttack = attack('Token attack', 'ranged');
const sheetAttack = attack('Sheet attack', 'melee');

function setup() {
  const token = makeToken('t1', { libraryItemId: 'char1', attacks: [tokenAttack] });
  const sheet = normalizeSheet({ attacks: [sheetAttack] });
  return { token, sheet };
}

const targeting = (patch: Record<string, unknown> = {}): TargetingState =>
  ({
    kind: 'action',
    tokenId: 't1',
    actionId: 'attack',
    slot: 'action',
    label: 'Атака',
    ...patch,
  }) as TargetingState;

describe('attacksOf', () => {
  it('берёт лист только для текущего персонажа', () => {
    const { token, sheet } = setup();
    expect(attacksOf(token, sheet, 'char1').map((a) => a.name)).toContain('Sheet attack');
    expect(attacksOf(token, sheet, null).map((a) => a.name)).toContain('Token attack');
    expect(attacksOf(makeToken('t2', { libraryItemId: 'char2', attacks: [tokenAttack] }), sheet, 'char1')[0]?.name).toBe(
      'Token attack'
    );
  });
});

describe('attackRangeTypeOf', () => {
  it('берёт rangeType атаки по индексу', () => {
    const { token, sheet } = setup();
    expect(attackRangeTypeOf(targeting({ attackIndex: 0 }), token, sheet, 'char1')).toBe('melee');
    expect(attackRangeTypeOf(targeting({ attackIndex: 99 }), token, sheet, 'char1')).toBeNull();
  });

  it('понимает действие-атаку и безоружный удар', () => {
    const { token, sheet } = setup();
    expect(attackRangeTypeOf(targeting({ actionId: 'unarmedStrike' }), token, sheet, 'char1')).toBe('melee');
    expect(attackRangeTypeOf(targeting({ actionId: 'dodge' }), token, sheet, 'char1')).toBeNull();

    const withAction = makeToken('t2', {
      statblock: { actions: [{ id: 'bite', ability: { attack: { rangeType: 'melee' } } }] },
    } as never);
    expect(attackRangeTypeOf(targeting({ actionId: 'bite' }), withAction, null, null)).toBe('melee');
  });
});

describe('attackEntryOf', () => {
  it('возвращает запись по индексу или null', () => {
    const { token, sheet } = setup();
    expect(attackEntryOf(targeting({ attackIndex: 0 }), token, sheet, 'char1')?.name).toBe('Sheet attack');
    expect(attackEntryOf(targeting({ attackIndex: 1 }), token, sheet, 'char1')).toBeNull();
    expect(attackEntryOf({ kind: 'spell', spellKey: 'XPHB:Fireball', tokenId: 't1' } as TargetingState, token, sheet, 'char1')).toBeNull();
  });
});

describe('distToSegment', () => {
  const wall: Wall = { id: 'w1', kind: 'wall', x1: 0, y1: 0, x2: 100, y2: 0 };

  it('считает расстояние до проекции и концов отрезка', () => {
    expect(distToSegment({ x: 50, y: 20 }, wall)).toBe(20);
    expect(distToSegment({ x: -10, y: 0 }, wall)).toBe(10);
    expect(distToSegment({ x: 110, y: 0 }, wall)).toBe(10);
  });

  it('обрабатывает вырожденный отрезок', () => {
    expect(distToSegment({ x: 3, y: 4 }, { ...wall, x2: 0, y2: 0 })).toBe(5);
  });
});
