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

  it('сплошная стена не пропускает ауру зоны', () => {
    const { room, f } = setup();
    room.scene.maps[0]!.tokens.push(makeToken('t3', { x: 350, y: 100, hpMax: '30', hpCurrent: 30 }));
    room.scene.maps[0]!.walls = [{ id: 'w1', x1: 300, y1: -100, x2: 300, y2: 300, kind: 'wall' }];
    const caster = room.scene.maps[0]!.tokens[0]!;
    const zone = createZoneFromDef(f.ctx, {
      caster,
      mapId: 'm1',
      def: zoneDef,
      stats: { ability: 'wis', mod: 3, dc: 14, attack: 5 },
      origin: { x: 250, y: 100 },
    });

    const behind = room.scene.maps[0]!.tokens.find((t) => t.id === 't3')!;
    const inside = room.scene.maps[0]!.tokens.find((t) => t.id === 't2')!;
    expect(behind.effects.some((e) => e.zoneId === zone!.id)).toBe(false);
    expect(inside.effects.some((e) => e.zoneId === zone!.id)).toBe(true);
  });

  it('открытая дверь ауру пропускает', () => {
    const { room, f } = setup();
    room.scene.maps[0]!.tokens.push(makeToken('t3', { x: 350, y: 100, hpMax: '30', hpCurrent: 30 }));
    room.scene.maps[0]!.walls = [{ id: 'w1', x1: 300, y1: -100, x2: 300, y2: 300, kind: 'door', open: true }];
    const caster = room.scene.maps[0]!.tokens[0]!;
    const zone = createZoneFromDef(f.ctx, {
      caster,
      mapId: 'm1',
      def: zoneDef,
      stats: { ability: 'wis', mod: 3, dc: 14, attack: 5 },
      origin: { x: 250, y: 100 },
    });

    const behind = room.scene.maps[0]!.tokens.find((t) => t.id === 't3')!;
    expect(behind.effects.some((e) => e.zoneId === zone!.id)).toBe(true);
  });

  it('аура зоны не снимает собственную концентрацию кастера (HoH)', () => {
    const { room, f } = setup();
    const caster = room.scene.maps[0]!.tokens[0]!;
    // Якорь концентрации кастера — как его ставит anchorConcentration.
    caster.effects.push({
      id: 'anchor1',
      name: 'Зона',
      sourceKey: 'TEST:Zone',
      sourceId: caster.id,
      concentration: true,
      duration: { type: 'concentration' },
      modifiers: [],
    });
    const zone = createZoneFromDef(f.ctx, {
      caster,
      mapId: 'm1',
      def: zoneDef,
      stats: null,
      origin: { x: 100, y: 100 },
    });

    expect(zone).toBeTruthy();
    // Аура накрыла самого кастера (слепота), но концентрация цела.
    expect(caster.effects.some((e) => e.zoneId === zone!.id)).toBe(true);
    expect(caster.effects.some((e) => e.concentration)).toBe(true);

    handleMovementZones(f.ctx, room, 'm1');
    expect(room.scene.maps[0]!.zones).toHaveLength(1);
    expect(caster.effects.some((e) => e.concentration)).toBe(true);
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

  it('side: hostile — союзный питомец и нейтрал вне зоны, враг получает урон', () => {
    const room = makeCombatRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, faction: 'ally', isPlayerToken: true }),
        makeToken('t2', { x: 250, y: 100, hpMax: '30', hpCurrent: 30, faction: 'enemy' }),
        makeToken('t3', { x: 250, y: 150, hpMax: '30', hpCurrent: 30, faction: 'ally', isPlayerToken: false }),
        makeToken('t4', { x: 250, y: 200, hpMax: '30', hpCurrent: 30, faction: 'neutral' }),
      ],
      { p1: 'lib1' }
    );
    const f = makeConnCtx(room, { dm: true, all: true });
    const [caster, enemy, ally, neutral] = room.scene.maps[0]!.tokens;
    const def: AutomationDef = { ...zoneDef, key: 'TEST:Hostile', zone: { ...zoneDef.zone!, side: 'hostile' } };
    createZoneFromDef(f.ctx, { caster: caster!, mapId: 'm1', def, stats: null, origin: { x: 250, y: 150 } });

    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.5); // 2d6 = 8
    tickZones(f.ctx, room, 'm1', enemy!, 'start');
    tickZones(f.ctx, room, 'm1', ally!, 'start');
    tickZones(f.ctx, room, 'm1', neutral!, 'start');
    rand.mockRestore();

    expect(enemy!.hpCurrent).toBe(22);
    expect(ally!.hpCurrent).toBe(30);
    expect(neutral!.hpCurrent).toBe(30);
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

  it('снятие концентрации не трогает зоны без концентрации', () => {
    const { room, f } = setup();
    const caster = room.scene.maps[0]!.tokens[0]!;
    const daylight: AutomationDef = {
      ...zoneDef,
      key: 'XPHB:Daylight',
      name: 'Daylight',
      zone: { ...zoneDef.zone!, duration: { type: 'permanent' } },
    };
    const concentration: AutomationDef = { ...zoneDef, key: 'TEST:Conc', name: 'Концентрация', concentration: true };
    createZoneFromDef(f.ctx, { caster, mapId: 'm1', def: daylight, stats: null, origin: { x: 250, y: 100 } });
    createZoneFromDef(f.ctx, { caster, mapId: 'm1', def: concentration, stats: null, origin: { x: 100, y: 100 } });

    removeZonesOfSource(f.ctx, room, caster.id, { onlyConcentration: true });

    expect(room.scene.maps[0]!.zones.map((z) => z.sourceKey)).toEqual(['XPHB:Daylight']);
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

describe('диспел света и тьмы', () => {
  /** Darkness L2: магическая тьма. */
  const darknessDef: AutomationDef = {
    key: 'XPHB:Darkness',
    name: 'Darkness',
    resolution: 'effect',
    concentration: true,
    zone: {
      area: { shape: 'sphere', size: 15 },
      origin: 'point',
      duration: { type: 'concentration' },
      flags: { blocksLight: true },
    },
  };
  /** Moonbeam L2: источник света. */
  const moonbeamDef: AutomationDef = {
    key: 'XPHB:Moonbeam',
    name: 'Moonbeam',
    resolution: 'effect',
    concentration: true,
    zone: {
      area: { shape: 'sphere', size: 5 },
      origin: 'point',
      duration: { type: 'concentration' },
      light: { bright: 0, dim: 5 },
    },
  };
  /** Hunger of Hadar L3: магическая тьма выше уровнем. */
  const hadarDef: AutomationDef = {
    ...darknessDef,
    key: 'XPHB:Hunger of Hadar',
    name: 'Hunger of Hadar',
    zone: { ...darknessDef.zone!, area: { shape: 'sphere', size: 20 } },
  };

  it('равный уровень: свет гасит тьму', () => {
    const { room, f } = setup();
    const caster = room.scene.maps[0]!.tokens[0]!;
    createZoneFromDef(f.ctx, { caster, mapId: 'm1', def: darknessDef, stats: null, origin: { x: 250, y: 100 } });
    const moon = createZoneFromDef(f.ctx, { caster, mapId: 'm1', def: moonbeamDef, stats: null, origin: { x: 250, y: 100 } });

    expect(moon).toBeTruthy();
    expect(room.scene.maps[0]!.zones.map((z) => z.sourceKey)).toEqual(['XPHB:Moonbeam']);
    expect(room.chat.some((m) => m.kind === 'text' && m.system?.code === 'automation.dispelled')).toBe(true);
  });

  it('тьма выше уровнем гасит свет (и свет её не убивает)', () => {
    const { room, f } = setup();
    const caster = room.scene.maps[0]!.tokens[0]!;
    const hadar = createZoneFromDef(f.ctx, {
      caster,
      mapId: 'm1',
      def: hadarDef,
      stats: null,
      origin: { x: 250, y: 100 },
    });
    const moon = createZoneFromDef(f.ctx, {
      caster,
      mapId: 'm1',
      def: moonbeamDef,
      stats: null,
      origin: { x: 250, y: 100 },
    });

    expect(moon).toBeNull();
    expect(room.scene.maps[0]!.zones.map((z) => z.sourceKey)).toEqual(['XPHB:Hunger of Hadar']);
    expect(hadar).toBeTruthy();
  });

  it('тьма гасит эффект-свет ниже уровнем (Light на токене)', () => {
    const { room, f } = setup();
    const caster = room.scene.maps[0]!.tokens[0]!;
    const target = room.scene.maps[0]!.tokens[1]!;
    target.effects.push({
      id: 'ef-light',
      name: 'Light',
      sourceKey: 'XPHB:Light',
      sourceId: caster.id,
      concentration: false,
      duration: { type: 'permanent' },
      modifiers: [],
      light: { bright: 20, dim: 20 },
    });

    createZoneFromDef(f.ctx, { caster, mapId: 'm1', def: darknessDef, stats: null, origin: { x: 250, y: 100 } });

    expect(target.effects.some((e) => e.id === 'ef-light')).toBe(false);
    expect(room.scene.maps[0]!.zones.map((z) => z.sourceKey)).toEqual(['XPHB:Darkness']);
    expect(room.chat.some((m) => m.kind === 'text' && m.system?.code === 'automation.dispelled')).toBe(true);
  });

  it('эффект-свет равного уровня гасит тьму (Flame Blade L2)', () => {
    const { room, f } = setup();
    const bladeCaster = room.scene.maps[0]!.tokens[0]!;
    const darkCaster = room.scene.maps[0]!.tokens[1]!;
    bladeCaster.effects.push({
      id: 'ef-blade',
      name: 'Flame Blade',
      sourceKey: 'XPHB:Flame Blade',
      sourceId: bladeCaster.id,
      concentration: true,
      duration: { type: 'concentration' },
      modifiers: [],
      light: { bright: 10, dim: 10 },
    });

    const zone = createZoneFromDef(f.ctx, {
      caster: darkCaster,
      mapId: 'm1',
      def: darknessDef,
      stats: null,
      origin: { x: 100, y: 100 },
    });

    expect(zone).toBeNull();
    expect(room.scene.maps[0]!.zones).toHaveLength(0);
    expect(bladeCaster.effects.some((e) => e.id === 'ef-blade')).toBe(true);
  });

  it('токен со свет-эффектом, вошедший в тьму, теряет свет', () => {
    const { room, f } = setup();
    const caster = room.scene.maps[0]!.tokens[0]!;
    const target = room.scene.maps[0]!.tokens[1]!;
    // Якорь концентрации кастера тьмы — иначе зона сиротеет и снимается на движении.
    caster.effects.push({
      id: 'anchor1',
      name: 'Darkness',
      sourceKey: 'XPHB:Darkness',
      sourceId: caster.id,
      concentration: true,
      duration: { type: 'concentration' },
      modifiers: [],
    });
    target.effects.push({
      id: 'ef-light',
      name: 'Light',
      sourceKey: 'XPHB:Light',
      sourceId: caster.id,
      concentration: false,
      duration: { type: 'permanent' },
      modifiers: [],
      light: { bright: 20, dim: 20 },
    });
    createZoneFromDef(f.ctx, { caster, mapId: 'm1', def: darknessDef, stats: null, origin: { x: 450, y: 100 } });
    expect(target.effects.some((e) => e.id === 'ef-light')).toBe(true);

    target.x = 400;
    handleMovementZones(f.ctx, room, 'm1');

    expect(target.effects.some((e) => e.id === 'ef-light')).toBe(false);
  });
});
