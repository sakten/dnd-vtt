import { describe, expect, it } from 'vitest';
import { GIANTS_MIGHT_ACTION, type CharacterSheet } from 'shared';
import { makeCombatRoom, makeResources, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { registerActionHandlers } from './actions';

function setup(level: number) {
  const token = makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, cells: 1 });
  const room = makeCombatRoom([token], { p1: 'lib1' });
  room.sheets.p1 = {
    name: 'Рыцарь',
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    classes: [{ className: 'fighter', level, subclass: 'runeKnight' }],
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
    hp: { current: 40, max: 40, temp: 0, deathSuccesses: 0, deathFailures: 0 },
    resources: [
      {
        id: 'gm',
        key: 'fighter.runeKnight:giantsMight',
        name: "Giant's Might",
        current: 1,
        max: 1,
        reset: 'long',
      },
    ],
  });
  const f = makeConnCtx(room, { playerId: 'p1' });
  registerActionHandlers(f.ctx);
  return { room, f, token };
}

describe("Giant's Might", () => {
  it('увеличивает токен до Large и возвращает размер после снятия эффекта', () => {
    const { room, f, token } = setup(5);
    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: GIANTS_MIGHT_ACTION,
      slot: 'bonus',
    });

    expect(token.cells).toBe(2);
    expect(token.w).toBe(100);
    expect(token.h).toBe(100);
    const effect = token.effects.find((e) => e.sourceKey === GIANTS_MIGHT_ACTION)!;
    expect(effect.size).toEqual({ cells: 2, previous: 1 });

    f.ctx.manager.removeEffect(room, token, effect.id);
    expect(token.cells).toBe(1);
    expect(token.w).toBe(50);
    expect(token.h).toBe(50);
  });

  it('на 18 уровне увеличивает до Huge', () => {
    const { f, token } = setup(18);
    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: GIANTS_MIGHT_ACTION,
      slot: 'bonus',
    });

    expect(token.cells).toBe(3);
    expect(token.w).toBe(150);
  });
});