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
  const f = makeConnCtx(room, { dm: true, all: true });
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

  it('token:step обрабатывает вход в зону по ходу движения', () => {
    const { room, f } = setup();
    const caster = room.scene.maps[0]!.tokens[0]!;
    const zone = createZoneFromDef(f.ctx, {
      caster,
      mapId: 'm1',
      def: zoneDef,
      stats: { ability: 'wis', mod: 3, dc: 14, attack: 5 },
      origin: { x: 550, y: 100 },
    });
    expect(zone).toBeTruthy();
    expect(caster.effects.some((e) => e.zoneId === zone!.id)).toBe(false);

    f.invoke('token:step', { mapId: 'm1', id: 't1', x: 550, y: 100 });
    expect(caster.effects.some((e) => e.zoneId === zone!.id)).toBe(true);
  });

  it('выход из зоны снимает ауру', () => {    const { room, f } = setup();
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

  it('payload containment: краевой 4×4 бьётся уроном, аура — только полностью внутри', () => {
    const { room, f } = setup();
    const caster = room.scene.maps[0]!.tokens[0]!;
    const def: AutomationDef = {
      ...zoneDef,
      key: 'TEST:Edge',
      zone: {
        ...zoneDef.zone!,
        containment: 'fullyWithin',
        triggers: { startOfTurn: { containment: 'anyCell', damage: { dice: '2d6', types: ['cold'] } } },
      },
    };
    const big = makeToken('t3', { x: 375, y: 125, w: 200, h: 200, hpMax: '30', hpCurrent: 30 });
    room.scene.maps[0]!.tokens.push(big);
    createZoneFromDef(f.ctx, { caster, mapId: 'm1', def, stats: null, origin: { x: 125, y: 125 } });

    expect(big.effects).toHaveLength(0); // не полностью внутри — ауры нет
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.5); // 2d6 = 8
    tickZones(f.ctx, room, 'm1', big, 'start');
    rand.mockRestore();

    expect(big.hpCurrent).toBe(22); // касание края — урона триггер получает
  });

  it('зона концентрации без живого эффекта-источника снимается', () => {
    const { room, f } = setup();
    const caster = room.scene.maps[0]!.tokens[0]!;
    const def: AutomationDef = { ...zoneDef, key: 'TEST:Orphan', concentration: true };
    createZoneFromDef(f.ctx, { caster, mapId: 'm1', def, stats: null, origin: { x: 250, y: 100 } });
    expect(room.scene.maps[0]!.zones).toHaveLength(1);

    handleMovementZones(f.ctx, room, 'm1');

    expect(room.scene.maps[0]!.zones).toHaveLength(0);
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

  it('шаг без изменения зон не рассылает полный снапшот и zones:update', () => {
    const { room, f } = setup();
    const caster = room.scene.maps[0]!.tokens[0]!;
    createZoneFromDef(f.ctx, { caster, mapId: 'm1', def: zoneDef, stats: null, origin: { x: 250, y: 100 } });
    f.emitted.length = 0;

    handleMovementZones(f.ctx, room, 'm1');

    expect(f.emitted.filter((e) => e.event === 'zones:update')).toHaveLength(0);
    expect(f.emitted.filter((e) => e.event === 'maps:update')).toHaveLength(0);
  });

  it('сдвиг ауры за источником рассылает zones:update с новой позицией', () => {
    const { room, f } = setup();
    const caster = room.scene.maps[0]!.tokens[0]!;
    const def: AutomationDef = { ...zoneDef, key: 'TEST:Anchor', zone: { ...zoneDef.zone!, anchor: 'source' } };
    createZoneFromDef(f.ctx, { caster, mapId: 'm1', def, stats: null, origin: { x: 100, y: 100 } });
    f.emitted.length = 0;

    caster.x = 500;
    handleMovementZones(f.ctx, room, 'm1');

    const events = f.emitted.filter((e) => e.event === 'zones:update');
    expect(events).toHaveLength(1);
    const payload = events[0]!.payload as { mapId: string; zones: { origin: { x: number } }[] };
    expect(payload.mapId).toBe('m1');
    expect(payload.zones[0]!.origin.x).toBe(500);
  });
});
