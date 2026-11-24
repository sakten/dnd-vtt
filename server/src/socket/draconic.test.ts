import { describe, expect, it } from 'vitest';
import { ELEMENTAL_AFFINITY_KEY, type CharacterSheet, type SpellStats } from 'shared';
import { findSpell } from '../spells';
import { makeCombatRoom, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { resolveSpellCast } from './spellResolve';

const STATS: SpellStats = { ability: 'cha', mod: 4, dc: 15, attack: 5 };

function withRandom<T>(value: number, fn: () => T): T {
  const original = Math.random;
  Math.random = () => value;
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

function setup(affinity?: string) {
  const caster = makeToken('t1', { libraryItemId: 'lib1', isPlayerToken: true, faction: 'ally', x: 50, y: 50 });
  const target = makeToken('t2', { faction: 'enemy', x: 100, y: 50, ac: '10', hpMax: '100', hpCurrent: 100 });
  const room = makeCombatRoom([caster, target], { p1: 'lib1' });
  room.sheets.p1 = {
    name: 'Дракон',
    abilities: { str: 10, dex: 14, con: 14, int: 10, wis: 10, cha: 18 },
    classes: [{ className: 'sorcerer', subclass: 'draconic', level: 6 }],
    choices: affinity ? [{ kind: 'featureOption', key: ELEMENTAL_AFFINITY_KEY, list: affinity }] : [],
    weapons: [],
    spells: [],
    saves: {},
    skills: {},
    damageDefenses: [],
    senses: [],
    hpMax: '30',
    ac: '12',
    speed: 30,
  } as unknown as CharacterSheet;
  const f = makeConnCtx(room, { playerId: 'p1', dm: true, all: true });
  return { room, f, caster, target };
}

function cast(f: ReturnType<typeof setup>['f'], caster: ReturnType<typeof setup>['caster'], target: ReturnType<typeof setup>['target'], spellKey: string, castLevel: number) {
  withRandom(0.5, () =>
    resolveSpellCast(f.ctx, {
      caster,
      mapId: 'm1',
      spell: findSpell(spellKey)!,
      castLevel,
      characterLevel: 6,
      stats: STATS,
      targets: [target],
      author: 'DM',
    })
  );
}

describe('Elemental Affinity (Драконье происхождение)', () => {
  it('Fire Bolt: +мод. Харизмы к урону огненного заклинания', () => {
    const { f, caster, target } = setup('fire');
    cast(f, caster, target, 'XPHB:Fire Bolt', 0);
    expect(target.hpCurrent).toBe(84); // 2к10 (12, кантрип 5+) + 4
  });

  it('без выбора или для другого типа — без прибавки', () => {
    const plain = setup();
    cast(plain.f, plain.caster, plain.target, 'XPHB:Fire Bolt', 0);
    expect(plain.target.hpCurrent).toBe(88);
    const cold = setup('cold');
    cast(cold.f, cold.caster, cold.target, 'XPHB:Fire Bolt', 0);
    expect(cold.target.hpCurrent).toBe(88);
  });

  it('многолучевое заклинание: прибавка один раз за каст', () => {
    const { f, caster, target } = setup('fire');
    cast(f, caster, target, 'XPHB:Scorching Ray', 2);
    expect(target.hpCurrent).toBe(72); // 3 луча по 2к6 (8) + 4 к первому
  });
});
