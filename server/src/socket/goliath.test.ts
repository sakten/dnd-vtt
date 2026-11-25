import { describe, expect, it } from 'vitest';
import {
  LARGE_FORM_ACTION,
  LARGE_FORM_END_ACTION,
  type CharacterSheet,
} from 'shared';
import { makeCombatRoom, makeResources, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { registerActionHandlers } from './actions';

function setup() {
  const token = makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, cells: 1 });
  const room = makeCombatRoom([token], { p1: 'lib1' });
  room.sheets.p1 = {
    name: 'Голиаф',
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    classes: [{ className: 'fighter', level: 5 }],
    race: { key: 'XPHB:Goliath', choices: { giant: 'fire' } },
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
      { id: 'lf', key: LARGE_FORM_ACTION, name: 'Большая форма', current: 1, max: 1, reset: 'long' },
    ],
  });
  const f = makeConnCtx(room, { playerId: 'p1' });
  registerActionHandlers(f.ctx);
  return { room, f, token };
}

describe('Goliath Large Form', () => {
  it('увеличивает токен и возвращает размер свободным действием', () => {
    const { f, token } = setup();
    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: LARGE_FORM_ACTION,
      slot: 'bonus',
    });

    expect(token.cells).toBe(2);
    expect(token.effects.find((e) => e.sourceKey === LARGE_FORM_ACTION)?.size).toEqual({
      cells: 2,
      previous: 1,
    });

    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: LARGE_FORM_END_ACTION,
      slot: 'free',
    });

    expect(token.cells).toBe(1);
    expect(token.effects.some((e) => e.sourceKey === LARGE_FORM_ACTION)).toBe(false);
  });
});