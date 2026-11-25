import { describe, expect, it } from 'vitest';
import type { CharacterSheet } from 'shared';
import { makeCombatRoom, makeResources, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { registerActionHandlers } from './actions';

function setup(level: number) {
  const token = makeToken('t1', { libraryItemId: 'lib1', speed: 30, x: 100, y: 100 });
  const room = makeCombatRoom([token], { p1: 'lib1' });
  room.sheets.p1 = {
    name: 'Воин',
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    classes: [{ className: 'fighter', level }],
    choices: [],
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
    hp: { current: 20, max: 40, temp: 0, deathSuccesses: 0, deathFailures: 0 },
    resources: [
      {
        id: 'sw',
        key: 'fighter:secondWind',
        name: 'Второе дыхание',
        current: 2,
        max: 2,
        reset: 'short',
      },
    ],
  });
  const f = makeConnCtx(room, { playerId: 'p1' });
  registerActionHandlers(f.ctx);
  return { room, f, token };
}

describe('Tactical Shift', () => {
  it('после Second Wind даёт половину скорости и игнорирование OA', () => {
    const { room, f, token } = setup(5);
    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: 'class:fighter:secondWind',
      slot: 'bonus',
    });

    const turn = room.scene.maps[0]!.combat.turns.e1!;
    expect(turn.bonusActionUsed).toBe(true);
    expect(turn.movementMax).toBe(45);
    expect(token.effects.some((e) => e.restrictions?.ignoresOpportunityAttacks)).toBe(true);
  });

  it('до 5 уровня эффекта нет', () => {
    const { room, f, token } = setup(4);
    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: 'class:fighter:secondWind',
      slot: 'bonus',
    });

    expect(room.scene.maps[0]!.combat.turns.e1!.movementMax).toBe(30);
    expect(token.effects.some((e) => e.restrictions?.ignoresOpportunityAttacks)).toBe(false);
  });
});