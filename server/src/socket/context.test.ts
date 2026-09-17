import { describe, expect, it } from 'vitest';
import type { CharacterSheet } from 'shared';
import { makeConnCtx } from '../test/ctx';
import { makeResources, makeRoom, makeToken } from '../test/fixtures';

function sheet(): CharacterSheet {
  return {
    name: 'Конан',
    abilities: { str: 16, dex: 14, con: 12, int: 10, wis: 10, cha: 8 },
    proficiencyBonus: '2',
    saves: {},
    skills: {},
    attacks: [],
    classes: [],
    spells: [],
    hpMax: '',
    ac: '16',
    speed: 25,
    senses: [],
    damageDefenses: [],
  };
}

function setup() {
  const room = makeRoom({
    controllers: { p1: 'lib1' },
    sheets: { p1: sheet() },
    resources: { p1: makeResources({ hp: { current: 12, max: 20, temp: 2, deathSuccesses: 0, deathFailures: 0 } }) },
  });
  const token = makeToken('t1', { libraryItemId: 'lib1', name: 'Токен', ac: '10', hpMax: '5', hpCurrent: 5 });
  room.scene.maps[0]!.tokens.push(token);
  return { room, token };
}

describe('visibleToken: статы персонажа', () => {
  it('DM видит resolved-статы из листа и ресурсов', () => {
    const { room, token } = setup();
    const { ctx } = makeConnCtx(room, { dm: true });

    const view = ctx.visibleToken(room, token, 'dm', 'm1');

    expect(view).toMatchObject({
      character: true,
      name: 'Конан',
      ac: '16',
      hpMax: '20',
      hpCurrent: 12,
      hpTemp: 2,
      speed: 25,
      initiativeBonus: '+2',
    });
    expect(view.statblock?.abilities.dex).toBe(14);
  });

  it('у монстра флага character нет', () => {
    const { room } = setup();
    const { ctx } = makeConnCtx(room, { dm: true });
    const monster = makeToken('t2', { name: 'Гоблин', ac: '15' });
    room.scene.maps[0]!.tokens.push(monster);

    expect(ctx.visibleToken(room, monster, 'dm', 'm1').character).toBeUndefined();
  });

  it('владелец видит статы, чужой игрок — заглушки', () => {
    const { room, token } = setup();
    const own = makeConnCtx(room, { playerId: 'p1' }).ctx.visibleToken(room, token, 'p1', 'm1');
    expect(own).toMatchObject({ ac: '16', hpCurrent: 12, hpMax: '20' });

    makeConnCtx(room, { playerId: 'p2' });
    const stranger = makeConnCtx(room, { playerId: 'p2' }).ctx.visibleToken(room, token, 'p2', 'm1');
    expect(stranger).toMatchObject({ ac: '', hpMax: '', hpCurrent: 0, senses: [], attacks: [] });
    expect(stranger.statblock).toBeUndefined();
    expect(stranger.character).toBe(true);
  });

  it('resolved-объект стабилен по identity, но всегда отражает текущие поля', () => {
    const { room, token } = setup();
    const { ctx } = makeConnCtx(room, { dm: true });

    const first = ctx.visibleToken(room, token, 'dm', 'm1');
    const second = ctx.visibleToken(room, token, 'dm', 'm1');
    expect(second).toBe(first);
    expect(second.hpCurrent).toBe(12);

    room.resources.p1!.hp.current = 5;
    token.visible = false;
    const third = ctx.visibleToken(room, token, 'dm', 'm1');
    expect(third).toBe(first);
    expect(third.hpCurrent).toBe(5);
    expect(third.visible).toBe(false);
  });
});
