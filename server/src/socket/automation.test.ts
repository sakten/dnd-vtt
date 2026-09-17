import { describe, expect, it } from 'vitest';
import { automationForSpell } from 'shared';
import { makeCombatRoom, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { findSpell } from '../spells';
import { executeAutomation } from './automation';

function setup() {
  const room = makeCombatRoom(
    [
      makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100 }),
      makeToken('t2', { x: 150, y: 100, hpMax: '30', hpCurrent: 30 }),
    ],
    { p1: 'lib1' }
  );
  const f = makeConnCtx(room, { dm: true, all: true });
  return { room, f };
}

const stats = { ability: 'wis', mod: 3, dc: 14, attack: 5 } as const;

describe('концентрация заклинаний с зонами', () => {
  it('новый каст концентрации снимает прежнюю зону и её эффекты', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[0]!;
    const target = map.tokens[1]!;

    const sg = findSpell('XPHB:Spirit Guardians')!;
    executeAutomation(f.ctx, {
      caster,
      mapId: 'm1',
      def: automationForSpell(sg, { castLevel: 3, characterLevel: 5 }),
      targets: [],
      stats,
      author: 'DM',
    });
    expect(map.zones?.map((z) => z.sourceKey)).toEqual(['XPHB:Spirit Guardians']);
    expect(caster.effects.some((e) => e.concentration && e.sourceKey === 'XPHB:Spirit Guardians')).toBe(true);
    expect(target.effects.some((e) => e.sourceKey === 'XPHB:Spirit Guardians' && !!e.zoneId)).toBe(true);
    expect(caster.effects.some((e) => e.sourceKey === 'XPHB:Spirit Guardians' && !!e.zoneId)).toBe(false);

    const hoh = findSpell('XPHB:Hunger of Hadar')!;
    executeAutomation(f.ctx, {
      caster,
      mapId: 'm1',
      def: automationForSpell(hoh, { castLevel: 3, characterLevel: 5 }),
      targets: [target],
      stats,
      author: 'DM',
      origin: { x: target.x, y: target.y },
    });

    expect(map.zones?.map((z) => z.sourceKey)).toEqual(['XPHB:Hunger of Hadar']);
    expect(caster.effects.some((e) => e.sourceKey === 'XPHB:Spirit Guardians')).toBe(false);
    expect(target.effects.some((e) => e.sourceKey === 'XPHB:Spirit Guardians')).toBe(false);
  });

  it('новая концентрация снимает прежнюю и с другого токена того же персонажа', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[0]!;
    const twin = makeToken('t3', { libraryItemId: 'lib1', x: 400, y: 400 });
    map.tokens.push(twin);

    const sg = findSpell('XPHB:Spirit Guardians')!;
    executeAutomation(f.ctx, {
      caster,
      mapId: 'm1',
      def: automationForSpell(sg, { castLevel: 3, characterLevel: 5 }),
      targets: [],
      stats,
      author: 'DM',
    });
    expect(map.zones?.map((z) => z.sourceKey)).toEqual(['XPHB:Spirit Guardians']);

    const hoh = findSpell('XPHB:Hunger of Hadar')!;
    executeAutomation(f.ctx, {
      caster: twin,
      mapId: 'm1',
      def: automationForSpell(hoh, { castLevel: 3, characterLevel: 5 }),
      targets: [],
      stats,
      author: 'DM',
      origin: { x: twin.x, y: twin.y },
    });

    expect(map.zones?.map((z) => z.sourceKey)).toEqual(['XPHB:Hunger of Hadar']);
    expect(caster.effects.some((e) => e.sourceKey === 'XPHB:Spirit Guardians')).toBe(false);
  });
});
