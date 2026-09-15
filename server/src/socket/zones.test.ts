import { describe, expect, it, vi } from 'vitest';
import type { AutomationDef } from 'shared';
import { makeCombatRoom, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { createZoneFromDef, handleMovementZones, removeZonesOfSource, tickZones } from './zones';

/** Синтетическая зона: аура-слепота внутри + урон в начале хода (аналог HoH). */
const zoneDef: AutomationDef = {
  key: 'TEST:Zone',
  name: 'Зона',
  resolution: 'auto',
  zone: {
    area: { shape: 'sphere', size: 20 },
    origin: 'point',
    duration: { type: 'concentration' },
    aura: {
      effects: [{ name: 'Аура', duration: { type: 'permanent' }, to: 'targets', modifiers: [], conditions: ['blinded'] }],
    },
    triggers: { startOfTurn: { damage: { dice: '2d6', types: ['cold'] } } },
  },
};

function setup() {
  const room = makeCombatRoom(
    [
      makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100 }),
      makeToken('t2', { x: 250, y: 100, hpMax: '30', hpCurrent: 30 }),
    ],
    { p1: 'lib1' }
  );
  const f = makeConnCtx(room, { dm: true });
  return { room, f };
}

describe('движок зон', () => {
  it('создание зоны накрывает ауру на токены внутри', () => {
    const { room, f } = setup();
    const caster = room.scene.maps[0]!.tokens[0]!;
    const zone = createZoneFromDef(f.ctx, {
      caster,
      mapId: 'm1',
      def: zoneDef,
      stats: { ability: 'wis', mod: 3, dc: 14, attack: 5 },
      origin: { x: 250, y: 100 },
    });

    expect(zone).toBeTruthy();
    expect(room.scene.maps[0]!.zones).toHaveLength(1);
    const target = room.scene.maps[0]!.tokens[1]!;
    const aura = target.effects.find((e) => e.zoneId === zone!.id);
    expect(aura?.conditions).toEqual(['blinded']);
  });

  it('выход из зоны снимает ауру', () => {
    const { room, f } = setup();
    const caster = room.scene.maps[0]!.tokens[0]!;
    const zone = createZoneFromDef(f.ctx, {
      caster,
      mapId: 'm1',
      def: zoneDef,
      stats: null,
      origin: { x: 250, y: 100 },
    });
    const target = room.scene.maps[0]!.tokens[1]!;
    expect(target.effects).toHaveLength(1);

    target.x = 2000;
    handleMovementZones(f.ctx, room, 'm1');

    expect(target.effects.filter((e) => e.zoneId === zone!.id)).toHaveLength(0);
    expect(target.conditions).toHaveLength(0);
  });

  it('startOfTurn внутри зоны наносит урон', () => {
    const { room, f } = setup();
    const caster = room.scene.maps[0]!.tokens[0]!;
    createZoneFromDef(f.ctx, {
      caster,
      mapId: 'm1',
      def: zoneDef,
      stats: null,
      origin: { x: 250, y: 100 },
    });
    const target = room.scene.maps[0]!.tokens[1]!;
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.5); // 2d6 = 8
    tickZones(f.ctx, room, 'm1', target, 'start');
    rand.mockRestore();

    expect(target.hpCurrent).toBe(22);
  });

  it('снятие по источнику убирает зону и её ауру', () => {
    const { room, f } = setup();
    const caster = room.scene.maps[0]!.tokens[0]!;
    createZoneFromDef(f.ctx, {
      caster,
      mapId: 'm1',
      def: zoneDef,
      stats: null,
      origin: { x: 250, y: 100 },
    });

    expect(removeZonesOfSource(f.ctx, room, caster.id)).toBe(true);
    expect(room.scene.maps[0]!.zones).toHaveLength(0);
    expect(room.scene.maps[0]!.tokens[1]!.effects).toHaveLength(0);
  });
});
