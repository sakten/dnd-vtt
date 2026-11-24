import { describe, expect, it, vi } from 'vitest';
import {
  CAREFUL_SPELL_KEY,
  DISTANT_SPELL_KEY,
  EMPOWERED_SPELL_KEY,
  HEIGHTENED_SPELL_KEY,
  QUICKENED_SPELL_KEY,
  SEEKING_SPELL_KEY,
  SUBTLE_SPELL_KEY,
  TRANSMUTED_SPELL_KEY,
  TWINNED_SPELL_KEY,
  type AutomationDef,
  type CharacterSheet,
} from 'shared';
import { makeCombatRoom, makeResources, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { executeAutomation } from './automation';
import { registerSpellHandlers } from './spells';
import { createZoneFromDef } from './zones';

const known = [
  SUBTLE_SPELL_KEY,
  DISTANT_SPELL_KEY,
  TRANSMUTED_SPELL_KEY,
  QUICKENED_SPELL_KEY,
  EMPOWERED_SPELL_KEY,
  SEEKING_SPELL_KEY,
  HEIGHTENED_SPELL_KEY,
  CAREFUL_SPELL_KEY,
  TWINNED_SPELL_KEY,
];

function setup(spells = ['XPHB:Fire Bolt'], targetX = 150) {
  const caster = makeToken('t1', { libraryItemId: 'lib1', isPlayerToken: true, faction: 'ally', x: 100, y: 100 });
  const target = makeToken('t2', { faction: 'enemy', x: targetX, y: 100, ac: '10', hpMax: '100', hpCurrent: 100 });
  const room = makeCombatRoom([caster, target], { p1: 'lib1' });
  room.sheets.p1 = {
    name: 'Сорк',
    abilities: { str: 10, dex: 14, con: 14, int: 10, wis: 10, cha: 18 },
    proficiencyBonus: '3',
    classes: [{ className: 'sorcerer', level: 2 }],
    choices: known.map((key) => ({ kind: 'metamagic', key })),
    spells: spells.map((key) => ({ key, className: 'sorcerer' })),
    saves: {},
    skills: {},
    damageDefenses: [],
    senses: [],
    hpMax: '20',
    ac: '12',
    speed: 30,
  } as unknown as CharacterSheet;
  room.resources.p1 = makeResources({
    hp: { current: 20, max: 20, temp: 0, deathSuccesses: 0, deathFailures: 0 },
    spellSlots: [
      { level: 1, current: 3, max: 3 },
      { level: 2, current: 3, max: 3 },
      { level: 3, current: 3, max: 3 },
    ],
    resources: [{ id: 'sp', key: 'sorcerer:sorceryPoints', name: 'Очки чародейства', current: 10, max: 10, reset: 'long' }],
  });
  const f = makeConnCtx(room, { playerId: 'p1' });
  registerSpellHandlers(f.ctx);
  return { room, f, caster, target };
}

function withRandom<T>(value: number, fn: () => T): T {
  const original = Math.random;
  Math.random = () => value;
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

const spLeft = (room: ReturnType<typeof setup>['room']): number =>
  room.resources.p1!.resources.find((r) => r.key === 'sorcerer:sorceryPoints')!.current;

describe('метамагия при касте', () => {
  it('Subtle Spell: обходит зону молчания', () => {
    const { room, f, caster, target } = setup();
    const silence: AutomationDef = {
      key: 'TEST:Silence',
      name: 'Тишина',
      resolution: 'effect',
      zone: {
        area: { shape: 'sphere', size: 20 },
        origin: 'point',
        duration: { type: 'permanent' },
        flags: { silence: true },
      },
    };
    createZoneFromDef(f.ctx, { caster, mapId: 'm1', def: silence, stats: null, origin: { x: caster.x, y: caster.y } });
    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Fire Bolt', targetIds: ['t2'] });
    expect((f.selfEvents('chat:error')[0]?.payload as { code?: string })?.code).toBe('silenced');

    withRandom(0.5, () =>
      f.invoke('spell:cast', {
        mapId: 'm1',
        tokenId: 't1',
        spellKey: 'XPHB:Fire Bolt',
        targetIds: ['t2'],
        metamagic: { key: SUBTLE_SPELL_KEY },
      })
    );
    expect(target.hpCurrent).toBeLessThan(100);
    expect(spLeft(room)).toBe(9);
  });

  it('Distant Spell: удваивает дистанцию и тратит 1 ОЧ', () => {
    const { room, f, target } = setup(['XPHB:Fire Bolt'], 2100);
    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Fire Bolt', targetIds: ['t2'] });
    expect((f.selfEvents('chat:error')[0]?.payload as { code?: string })?.code).toBe('outOfRange');

    withRandom(0.5, () =>
      f.invoke('spell:cast', {
        mapId: 'm1',
        tokenId: 't1',
        spellKey: 'XPHB:Fire Bolt',
        targetIds: ['t2'],
        metamagic: { key: DISTANT_SPELL_KEY },
      })
    );
    expect(target.hpCurrent).toBeLessThan(100);
    expect(spLeft(room)).toBe(9);
  });

  it('Transmuted Spell: меняет тип урона (огонь → холод)', () => {
    const { room, f, target } = setup();
    target.damageDefenses = [{ id: 'd1', type: 'resistance', damageType: 'fire' }];
    withRandom(0.5, () =>
      f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Fire Bolt', targetIds: ['t2'] })
    );
    expect(target.hpCurrent).toBe(97); // 1к10 = 6, сопротивление огню → 3

    room.scene.maps[0]!.combat.turns.e1!.actionUsed = false;
    withRandom(0.5, () =>
      f.invoke('spell:cast', {
        mapId: 'm1',
        tokenId: 't1',
        spellKey: 'XPHB:Fire Bolt',
        targetIds: ['t2'],
        metamagic: { key: TRANSMUTED_SPELL_KEY, damageType: 'cold' },
      })
    );
    expect(target.hpCurrent).toBe(91); // 6 холодом без сопротивления
    expect(spLeft(room)).toBe(9);
  });

  it('Quickened Spell: действие → бонусное действие, 2 ОЧ', () => {
    const { room, f } = setup();
    withRandom(0.5, () =>
      f.invoke('spell:cast', {
        mapId: 'm1',
        tokenId: 't1',
        spellKey: 'XPHB:Fire Bolt',
        targetIds: ['t2'],
        metamagic: { key: QUICKENED_SPELL_KEY },
      })
    );
    const turn = room.scene.maps[0]!.combat.turns.e1!;
    expect(turn.bonusActionUsed).toBe(true);
    expect(turn.actionUsed).toBe(false);
    expect(spLeft(room)).toBe(8);
  });

  it('чужая/неизвестная опция отклоняется', () => {
    const { room, f } = setup();
    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Fire Bolt',
      targetIds: ['t2'],
      metamagic: { key: 'XPHB:Nope' },
    });
    expect((f.selfEvents('chat:error')[0]?.payload as { code?: string })?.code).toBe('metamagicUnknown');
    expect(spLeft(room)).toBe(10);
  });

  it('ручная опция тратит ОЧ и пишет в чат', () => {
    const { room, f } = setup();
    withRandom(0.5, () =>
      f.invoke('spell:cast', {
        mapId: 'm1',
        tokenId: 't1',
        spellKey: 'XPHB:Fire Bolt',
        targetIds: ['t2'],
        metamagic: { key: EMPOWERED_SPELL_KEY },
      })
    );
    expect(spLeft(room)).toBe(9);
    expect(
      f.emitted.some(
        (e) =>
          e.event === 'chat:message' &&
          (e.payload as { system?: { code?: string } }).system?.code === 'metamagic.manual'
      )
    ).toBe(true);
  });

  it('без ОЧ — отказ без траты слота', () => {
    const { room, f } = setup();
    room.resources.p1!.resources.find((r) => r.key === 'sorcerer:sorceryPoints')!.current = 0;
    withRandom(0.5, () =>
      f.invoke('spell:cast', {
        mapId: 'm1',
        tokenId: 't1',
        spellKey: 'XPHB:Fire Bolt',
        targetIds: ['t2'],
        metamagic: { key: SUBTLE_SPELL_KEY },
      })
    );
    expect((f.selfEvents('chat:error')[0]?.payload as { code?: string })?.code).toBe('noResource');
  });

  it('Seeking Spell: промах перебрасывается за 1 ОЧ', () => {
    const { room, f, target } = setup();
    const seq = [0, 0.99, 0.5, 0.5];
    const rand = vi.spyOn(Math, 'random').mockImplementation(() => seq.shift() ?? 0.5);
    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Fire Bolt',
      targetIds: ['t2'],
      metamagic: { key: SEEKING_SPELL_KEY },
    });
    rand.mockRestore();
    expect(target.hpCurrent).toBeLessThan(100);
    expect(spLeft(room)).toBe(9);
    expect(room.chat.filter((m) => m.kind === 'roll' && m.rollKind === 'attack')).toHaveLength(2);
  });

  it('Seeking Spell: попадание с первого раза — без траты ОЧ', () => {
    const { room, f } = setup();
    withRandom(0.5, () =>
      f.invoke('spell:cast', {
        mapId: 'm1',
        tokenId: 't1',
        spellKey: 'XPHB:Fire Bolt',
        targetIds: ['t2'],
        metamagic: { key: SEEKING_SPELL_KEY },
      })
    );
    expect(spLeft(room)).toBe(10);
  });

  it('Heightened Spell: спасбросок с помехой (d20d)', () => {
    const { room, f } = setup(['XPHB:Sacred Flame']);
    withRandom(0.5, () =>
      f.invoke('spell:cast', {
        mapId: 'm1',
        tokenId: 't1',
        spellKey: 'XPHB:Sacred Flame',
        targetIds: ['t2'],
        metamagic: { key: HEIGHTENED_SPELL_KEY },
      })
    );
    const save = room.chat.find((m) => m.kind === 'roll' && m.rollKind === 'save') as
      | { roll: { expression: string } }
      | undefined;
    expect(save?.roll.expression).toContain('d20d');
    expect(spLeft(room)).toBe(8);
  });

  it('Careful Spell: защищённый союзник не получает урон', () => {
    const { room, f, caster, target } = setup();
    const ally = makeToken('t3', { faction: 'ally', x: 150, y: 150, hpMax: '100', hpCurrent: 100 });
    room.scene.maps[0]!.tokens.push(ally);
    const def = {
      key: 'TEST:Careful',
      name: 'Careful',
      resolution: 'save',
      save: { ability: 'dex', half: true },
      damage: { dice: '2d6', types: ['fire'] },
    } as AutomationDef;
    withRandom(0.5, () =>
      executeAutomation(f.ctx, {
        caster,
        mapId: 'm1',
        def,
        targets: [ally, target],
        stats: { ability: 'cha', mod: 4, dc: 15, attack: 5 },
        author: 'DM',
        carefulIds: [ally.id],
      })
    );
    expect(ally.hpCurrent).toBe(100);
    expect(target.hpCurrent).toBe(92);
  });

  it('Twinned Spell: не подходит для заклинания без апкаста целей', () => {
    const { room, f } = setup();
    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Fire Bolt',
      targetIds: ['t2'],
      metamagic: { key: TWINNED_SPELL_KEY },
    });
    expect((f.selfEvents('chat:error')[0]?.payload as { code?: string })?.code).toBe('metamagicNotApplicable');
    expect(spLeft(room)).toBe(10);
  });

  it('Twinned Spell: эффективный уровень +1, ячейка прежняя', () => {
    const { room, f } = setup(['XPHB:Charm Person']);
    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Charm Person',
      slotLevel: 1,
      targetIds: ['t2'],
      metamagic: { key: TWINNED_SPELL_KEY },
    });
    expect(f.selfEvents('chat:error')).toHaveLength(0);
    expect(spLeft(room)).toBe(9);
    expect(room.resources.p1!.spellSlots.find((s) => s.level === 1)!.current).toBe(2);
    expect(room.resources.p1!.spellSlots.find((s) => s.level === 2)!.current).toBe(3);
  });
});
