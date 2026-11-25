import { describe, expect, it } from 'vitest';
import type { CharacterSheet } from 'shared';
import { makeCombatRoom, makeResources, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { applyAttackRiders } from './attackRiders';

function setup() {
  const attacker = makeToken('t1', { libraryItemId: 'lib1', x: 50, y: 100, faction: 'ally' });
  const target = makeToken('t2', { x: 100, y: 100, faction: 'enemy', hpMax: '10', hpCurrent: 10 });
  const room = makeCombatRoom([attacker, target], { p1: 'lib1' });
  room.sheets.p1 = {
    name: 'Воин',
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    classes: [{ className: 'fighter', level: 5, subclass: 'battleMaster' }],
    choices: [{ kind: 'maneuver', key: 'XPHB:Distracting Strike' }],
    attacks: [],
    spells: [],
    saves: {},
    skills: {},
    damageDefenses: [],
    senses: [],
    hpMax: '40',
    ac: '16',
    speed: 30,
  } as unknown as CharacterSheet;
  room.resources.p1 = makeResources({
    hp: { current: 40, max: 40, temp: 0, deathSuccesses: 0, deathFailures: 0 },
    resources: [
      {
        id: 'sup',
        key: 'fighter.battleMaster:superiorityDice',
        name: 'Кости превосходства',
        current: 4,
        max: 4,
        reset: 'short',
      },
    ],
  });
  const f = makeConnCtx(room, { playerId: 'p1' });
  return { room, f, attacker, target };
}

describe('Отвлекающий удар', () => {
  it('эффект накладывается на цель, а не на атакующего', () => {
    const { room, f, attacker, target } = setup();
    const applied = applyAttackRiders(
      f.ctx,
      room,
      attacker,
      'm1',
      target,
      ['fighter.battleMaster:distractingStrike'],
      undefined
    );

    expect(applied.expr).toContain('1d8');
    expect(target.effects.some((e) => e.sourceKey === 'rider:fighter.battleMaster:distractingStrike')).toBe(true);
    expect(attacker.effects.some((e) => e.sourceKey === 'rider:fighter.battleMaster:distractingStrike')).toBe(false);
  });

  it('снимает эффект с мёртвой цели', () => {
    const { room, f, attacker, target } = setup();
    applyAttackRiders(f.ctx, room, attacker, 'm1', target, ['fighter.battleMaster:distractingStrike'], undefined);

    f.ctx.manager.adjustTokenHp(room, 'm1', target, -20, { damageEvent: true });

    expect(target.conditions.some((c) => c.key === 'dead')).toBe(true);
    expect(target.effects.some((e) => e.sourceKey === 'rider:fighter.battleMaster:distractingStrike')).toBe(false);
  });
});