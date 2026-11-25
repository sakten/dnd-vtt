import { describe, expect, it } from 'vitest';
import type { AttackEntry, CharacterSheet } from 'shared';
import { makeCombatRoom, makeResources, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { availableSmites } from './smites';

function setup(spells: CharacterSheet['spells']) {
  const attacker = makeToken('t1', { libraryItemId: 'lib1', x: 50, y: 100 });
  const room = makeCombatRoom([attacker], { p1: 'lib1' });
  room.sheets.p1 = {
    name: 'Паладин',
    abilities: { str: 16, dex: 10, con: 14, int: 10, wis: 12, cha: 16 },
    classes: [{ className: 'paladin', level: 2 }],
    choices: [],
    attacks: [],
    spells,
    saves: {},
    skills: {},
    damageDefenses: [],
    senses: [],
    hpMax: '30',
    ac: '16',
    speed: 30,
  } as unknown as CharacterSheet;
  room.resources.p1 = makeResources({
    hp: { current: 30, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
    spellSlots: [{ level: 1, current: 2, max: 2 }],
  });
  const f = makeConnCtx(room, { playerId: 'p1' });
  const attack: AttackEntry = {
    id: 'a1',
    name: 'Меч',
    hit: 'd20+5',
    damage: '1d8+3',
    damageType: 'slashing',
    rangeType: 'melee',
    rangeNormal: 5,
    rangeLong: 0,
  };
  return { room, f, attacker, attack };
}

describe('Смайты паладина', () => {
  it('Divine Smite доступен как всегда подготовленное заклинание', () => {
    const { room, f, attacker, attack } = setup([]);

    const options = availableSmites(f.ctx, room, 'm1', attacker, attack, true);

    expect(options.map((o) => o.spellKey)).toContain('XPHB:Divine Smite');
  });

  it('выбранный смайт из списка тоже доступен', () => {
    const { room, f, attacker, attack } = setup([{ key: 'XPHB:Searing Smite', className: 'paladin' }]);

    const options = availableSmites(f.ctx, room, 'm1', attacker, attack, true);

    expect(options.map((o) => o.spellKey)).toContain('XPHB:Searing Smite');
  });
});