import { describe, expect, it } from 'vitest';
import type { CharacterSheet } from 'shared';
import { makeCombatRoom, makeResources, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';

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

function setup() {
  const bard = makeToken('t1', { libraryItemId: 'lib1', isPlayerToken: true, faction: 'ally', x: 50, y: 75 });
  const target = makeToken('t2', { faction: 'enemy', x: 100, y: 75, ac: '10', hpMax: '30', hpCurrent: 30 });
  const room = makeCombatRoom([bard, target], { p1: 'lib1' });
  room.sheets.p1 = {
    name: 'Бард',
    abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 16 },
    proficiencyBonus: '3',
    classes: [{ className: 'bard', level: 5, subclass: 'glamour' }],
    attacks: [],
    spells: [],
    saves: {},
    skills: {},
    damageDefenses: [],
    senses: [],
    hpMax: '30',
    ac: '14',
    speed: 30,
  } as unknown as CharacterSheet;
  room.resources.p1 = {
    ...makeResources(),
    resources: [
      { id: 'r1', key: 'bard.glamour:beguilingMagic', name: 'Обольщающая магия', current: 1, max: 1, reset: 'long' },
    ],
  };
  const f = makeConnCtx(room, { playerId: 'p1', all: true });
  return { bard, target, room, f };
}

describe('Обольщающая магия (Обаяние, 3)', () => {
  it('выбор «Испуган»: спас Мдр, эффект с frightened и расход в день', () => {
    const { target, room, f } = setup();
    withRandom(0.5, () =>
      f.invoke('action:use', {
        mapId: 'm1',
        tokenId: 't1',
        actionId: 'class:bard.glamour:beguilingMagic',
        targetIds: ['t2'],
        variant: 'frightened',
      })
    );

    const effect = target.effects.find((e) => e.name === 'Обольщающая магия');
    expect(effect?.conditions).toEqual(['frightened']);
    expect(effect?.duration).toMatchObject({ type: 'untilSave', ability: 'wis', dc: 14 });
    expect(room.resources.p1!.resources[0]!.current).toBe(0);
    expect(room.scene.maps[0]!.combat.turns['e1']!.actionUsed).toBe(false);
  });

  it('без варианта — Очарован', () => {
    const { target, f } = setup();
    withRandom(0.5, () =>
      f.invoke('action:use', {
        mapId: 'm1',
        tokenId: 't1',
        actionId: 'class:bard.glamour:beguilingMagic',
        targetIds: ['t2'],
      })
    );
    expect(target.effects.find((e) => e.name === 'Обольщающая магия')?.conditions).toEqual(['charmed']);
  });
});
