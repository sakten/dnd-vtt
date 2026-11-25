import { describe, expect, it } from 'vitest';
import type { CharacterSheet } from 'shared';
import { makeCombatRoom, makeResources, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { registerActionHandlers } from './actions';
import { registerCombatHandlers } from './combat';

function setup() {
  const caster = makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, faction: 'ally' });
  const enemy = makeToken('t2', { x: 150, y: 100, faction: 'enemy' });
  const room = makeCombatRoom([caster, enemy], { p1: 'lib1' });
  room.scene.maps[0]!.combat.entries.push({
    id: 'e2',
    tokenId: 't2',
    name: 'Враг',
    imageUrl: '',
    initiative: 5,
    bonus: '',
  });
  room.scene.maps[0]!.combat.turns.e2 = { ...room.scene.maps[0]!.combat.turns.e1! };
  room.sheets.p1 = {
    name: 'Кобольд',
    abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 16 },
    classes: [{ className: 'fighter', level: 5 }],
    race: { key: 'MPMM:Kobold' },
    choices: [],
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
  room.resources.p1 = makeResources({
    hp: { current: 30, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
    resources: [
      {
        id: 'cry',
        key: 'race:MPMM:Kobold:draconicCry',
        name: 'Драконий клич',
        current: 1,
        max: 3,
        reset: 'long',
      },
    ],
  });
  const f = makeConnCtx(room, { playerId: 'p1', dm: true });
  registerActionHandlers(f.ctx);
  registerCombatHandlers(f.ctx);
  return { room, f, caster, enemy };
}

describe('Draconic Cry', () => {
  it('висит до начала следующего хода кобольда', () => {
    const { f, enemy } = setup();
    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: 'race:MPMM:Kobold:draconicCry',
      slot: 'bonus',
    });
    expect(enemy.effects.some((e) => e.sourceKey === 'race:MPMM:Kobold:draconicCry')).toBe(true);
    expect(enemy.effects.find((e) => e.sourceKey === 'race:MPMM:Kobold:draconicCry')).toMatchObject({
      sourceId: 't1',
      duration: { type: 'endOfTurn', of: 'source' },
    });

    f.invoke('combat:endTurn', { mapId: 'm1' });
    expect(enemy.effects.some((e) => e.sourceKey === 'race:MPMM:Kobold:draconicCry')).toBe(true);

    f.invoke('combat:endTurn', { mapId: 'm1' });
    expect(enemy.effects.some((e) => e.sourceKey === 'race:MPMM:Kobold:draconicCry')).toBe(false);
    const update = f
      .selfEvents('token:update')
      .filter((e) => (e.payload as { token?: { id?: string } }).token?.id === enemy.id)
      .at(-1)?.payload as { token?: { effects?: { sourceKey?: string }[] } } | undefined;
    expect(update?.token?.effects?.some((e) => e.sourceKey === 'race:MPMM:Kobold:draconicCry')).toBe(false);
  });
});