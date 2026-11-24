import { describe, expect, it, vi } from 'vitest';
import { INNATE_SORCERY_ID, type CharacterSheet, type EffectInstance, type SpellStats } from 'shared';
import { findSpell } from '../spells';
import { makeCombatRoom, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { resolveSpellCast } from './spellResolve';
import { spellStatsFor } from './spellStats';

const STATS: SpellStats = { ability: 'cha', mod: 4, dc: 15, attack: 7 };

function setup(spellClass = 'sorcerer') {
  const caster = makeToken('t1', { libraryItemId: 'lib1', isPlayerToken: true, faction: 'ally', x: 50, y: 50 });
  const target = makeToken('t2', { faction: 'enemy', x: 100, y: 50, ac: '10', hpMax: '100', hpCurrent: 100 });
  const room = makeCombatRoom([caster, target], { p1: 'lib1' });
  room.sheets.p1 = {
    name: 'Чародей',
    abilities: { str: 10, dex: 14, con: 14, int: 10, wis: 10, cha: 18 },
    proficiencyBonus: '3',
    classes: [{ className: 'sorcerer', level: 2 }],
    choices: [],
    spells: [{ key: 'XPHB:Fire Bolt', className: spellClass }],
    saves: {},
    skills: {},
    damageDefenses: [],
    senses: [],
    hpMax: '20',
    ac: '12',
    speed: 30,
  } as unknown as CharacterSheet;
  const f = makeConnCtx(room, { playerId: 'p1', dm: true, all: true });
  return { room, f, caster, target };
}

function activate(caster: ReturnType<typeof setup>['caster'], withAdvantage = true): void {
  caster.effects.push({
    id: 'innate',
    name: 'Врождённое чародейство',
    sourceKey: INNATE_SORCERY_ID,
    sourceId: caster.id,
    duration: { type: 'permanent' },
    modifiers: [
      { id: 'dc', target: 'spellDc', mode: 'add', value: 1 },
      ...(withAdvantage
        ? [
            {
              id: 'adv',
              target: 'attack' as const,
              mode: 'advantage' as const,
              filter: { direction: 'self' as const, weapon: false },
            },
          ]
        : []),
    ],
  } as EffectInstance);
}

function attackSources(f: ReturnType<typeof setup>['f']): { kind?: string; name?: string }[] {
  return f.emitted
    .filter((e) => e.event === 'chat:message')
    .map((e) => e.payload as { rollKind?: string; labelParams?: { sources?: { kind?: string; name?: string }[] } })
    .filter((m) => m.rollKind === 'attack')
    .at(-1)?.labelParams?.sources ?? [];
}

describe('Врождённое чародейство', () => {
  it('СЛ +1 только для заклинаний чародея', () => {
    const { room, caster } = setup();
    const before = spellStatsFor(room, caster, 'sorcerer')!;
    activate(caster);
    const after = spellStatsFor(room, caster, 'sorcerer')!;
    expect(after.dc).toBe(before.dc + 1);
    expect(after.attack).toBe(before.attack);
    expect(spellStatsFor(room, caster, 'wizard')!.dc).toBe(8 + 3 + 0);
  });

  it('преимущество на заклинательную атаку чародея', () => {
    const { f, caster, target } = setup();
    activate(caster);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    resolveSpellCast(f.ctx, {
      caster,
      mapId: 'm1',
      spell: findSpell('XPHB:Fire Bolt')!,
      castLevel: 0,
      characterLevel: 2,
      stats: STATS,
      targets: [target],
      author: 'DM',
    });
    vi.restoreAllMocks();
    expect(attackSources(f)).toContainEqual(
      expect.objectContaining({ kind: 'effect', name: 'Врождённое чародейство' })
    );
  });

  it('на заклинание не-чародея преимущество не переносится', () => {
    const { f, caster, target } = setup('wizard');
    activate(caster);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    resolveSpellCast(f.ctx, {
      caster,
      mapId: 'm1',
      spell: findSpell('XPHB:Fire Bolt')!,
      castLevel: 0,
      characterLevel: 2,
      stats: STATS,
      targets: [target],
      author: 'DM',
    });
    vi.restoreAllMocks();
    expect(attackSources(f).some((s) => s.name === 'Врождённое чародейство')).toBe(false);
  });
});
