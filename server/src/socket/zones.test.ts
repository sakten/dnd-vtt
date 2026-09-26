import { describe, expect, it, vi } from 'vitest';
import { automationForSpell, tokensCrossingSegments, zoneWallSegments, type AttackEntry, type AutomationDef } from 'shared';
import { makeCombatRoom, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { findSpell } from '../spells';
import { applyWallPush, createZoneFromDef, handleMovementZones, hitZoneSection, removeZonesOfSource, tickZones } from './zones';
import { collectSpellCast } from './spellTargeting';
import { validateSpellCast } from './spellResolve';
import { resolveZoneSectionAttack } from './zoneAttacks';
import { executeAutomation } from './automation';

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

  it('Wall of Thorns: вход и конец хода — один сейв за ход, на новом ходу снова', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[0]!;
    const target = map.tokens[1]!;
    target.hpMax = '200';
    target.hpCurrent = 200;
    // Якорь концентрации кастера — как его ставит anchorConcentration.
    caster.effects.push({
      id: 'anchor1',
      name: 'Wall of Thorns',
      sourceKey: 'XPHB:Wall of Thorns',
      sourceId: caster.id,
      concentration: true,
      duration: { type: 'concentration' },
      modifiers: [],
    });
    const def = automationForSpell(findSpell('XPHB:Wall of Thorns')!, { castLevel: 6 });
    const zone = createZoneFromDef(f.ctx, {
      caster,
      mapId: 'm1',
      def,
      stats: { ability: 'dex', mod: 3, dc: 20, attack: 5 },
      origin: { x: 100, y: 100 },
      direction: { x: 100, y: 200 },
    });
    expect(zone).toBeTruthy();

    const rand = vi.spyOn(Math, 'random').mockReturnValue(0); // сейв провален, 7d8 = 7
    // Вход в стену: урон рубящим.
    target.x = 100;
    target.y = 150;
    handleMovementZones(f.ctx, room, 'm1');
    expect(target.hpCurrent).toBe(193);
    // Конец того же хода — «раз за ход», второго урона нет.
    tickZones(f.ctx, room, 'm1', target, 'end');
    expect(target.hpCurrent).toBe(193);
    // Новый ход (другой ключ) — триггер снова срабатывает.
    map.combat!.round = 2;
    tickZones(f.ctx, room, 'm1', target, 'end');
    rand.mockRestore();
    expect(target.hpCurrent).toBe(186);
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

describe('зоны с зарядами и появлением (C-хвосты)', () => {
  const stats = { ability: 'wis', mod: 3, dc: 14, attack: 5 } as const;

  it('Healing Spirit: лечит только союзников (кроме конструктов/нежити) и гаснет по зарядам', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[0]!;
    caster.faction = 'ally';
    const ally = map.tokens[1]!;
    ally.faction = 'ally';
    const construct = makeToken('t3', {
      x: 250,
      y: 100,
      hpMax: '30',
      hpCurrent: 10,
      faction: 'ally',
      statblock: { creatureType: 'construct', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
    });
    const enemy = makeToken('t5', { x: 250, y: 100, hpMax: '30', hpCurrent: 10, faction: 'enemy' });
    const full = makeToken('t6', { x: 250, y: 100, hpMax: '30', hpCurrent: 30, faction: 'ally' });
    map.tokens.push(construct, enemy, full);
    const def = automationForSpell(findSpell('XGE:Healing Spirit')!, { castLevel: 2, spellMod: 3 });
    // Якорь концентрации кастера — как его ставит executeAutomation (иначе зона сиротеет).
    caster.effects.push({
      id: 'anchor1',
      name: 'Healing Spirit',
      sourceKey: 'XGE:Healing Spirit',
      sourceId: caster.id,
      concentration: true,
      duration: { type: 'concentration' },
      modifiers: [],
    });
    const zone = createZoneFromDef(f.ctx, { caster, mapId: 'm1', def, stats, origin: { x: 150, y: 100 } });
    expect(zone?.charges).toBe(4);

    ally.x = 150;
    ally.y = 100;
    ally.hpCurrent = 10;
    construct.x = 150;
    construct.y = 100;
    enemy.x = 150;
    enemy.y = 100;
    full.x = 150;
    full.y = 100;
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.05); // d20 = 2, 1к6 = 1
    handleMovementZones(f.ctx, room, 'm1');
    rand.mockRestore();
    expect(ally.hpCurrent).toBe(11);
    expect(construct.hpCurrent).toBe(10);
    expect(enemy.hpCurrent).toBe(10);
    expect(full.hpCurrent).toBe(30);
    expect(zone?.charges).toBe(3);

    // Последний заряд: вошедший союзник лечится, зона исчезает.
    zone!.charges = 1;
    const other = makeToken('t4', { x: 250, y: 100, hpMax: '30', hpCurrent: 5, faction: 'ally' });
    map.tokens.push(other);
    other.x = 150;
    other.y = 100;
    const rand2 = vi.spyOn(Math, 'random').mockReturnValue(0.05);
    handleMovementZones(f.ctx, room, 'm1');
    rand2.mockRestore();
    expect(other.hpCurrent).toBe(6);
    expect(map.zones).toHaveLength(0);
  });

  it('Cordon of Arrows: бьёт только враждебных, тратит стрелы и гаснет', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[0]!;
    caster.faction = 'ally';
    const enemy = map.tokens[1]!;
    enemy.faction = 'enemy';
    enemy.hpMax = '30';
    enemy.hpCurrent = 30;
    const friend = makeToken('t3', { x: 250, y: 100, hpMax: '30', hpCurrent: 30, faction: 'ally' });
    map.tokens.push(friend);
    const def = automationForSpell(findSpell('XPHB:Cordon of Arrows')!, { castLevel: 2 });
    const zone = createZoneFromDef(f.ctx, {
      caster,
      mapId: 'm1',
      def,
      stats,
      origin: { x: caster.x, y: caster.y },
    });
    expect(zone?.charges).toBe(4);

    // На момент создания враг и союзник были внутри 30 фт; выводим и вводим заново.
    enemy.x = 400;
    enemy.y = 400;
    friend.x = 400;
    friend.y = 350;
    handleMovementZones(f.ctx, room, 'm1');
    enemy.x = 150;
    enemy.y = 100;
    friend.x = 200;
    friend.y = 100;
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.05); // d20 = 2 — провал; 2к4 = 2
    handleMovementZones(f.ctx, room, 'm1');
    rand.mockRestore();
    expect(enemy.hpCurrent).toBe(28);
    expect(friend.hpCurrent).toBe(30);
    expect(zone?.charges).toBe(3);
  });

  it('Storm Sphere: при появлении бьёт спас STR по существам в сфере', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[0]!;
    const enemy = map.tokens[1]!;
    enemy.hpMax = '30';
    enemy.hpCurrent = 30;
    const def = automationForSpell(findSpell('XGE:Storm Sphere')!, { castLevel: 4 });
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.05); // d20 = 2 — провал; 2к6 = 2
    const zone = createZoneFromDef(f.ctx, {
      caster,
      mapId: 'm1',
      def,
      stats,
      origin: { x: 150, y: 100 },
    });
    rand.mockRestore();
    expect(zone).toBeTruthy();
    expect(enemy.hpCurrent).toBe(28);
  });

  it('Storm Sphere: молния бьёт с преимуществом по цели внутри сферы', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[0]!;
    const enemy = map.tokens[1]!;
    enemy.hpMax = '30';
    enemy.hpCurrent = 30;
    const def = automationForSpell(findSpell('XGE:Storm Sphere')!, { castLevel: 4 });
    const zone = createZoneFromDef(f.ctx, { caster, mapId: 'm1', def, stats, origin: { x: 150, y: 100 } });
    const bolt = def.zone?.actions?.[0]?.def;
    expect(bolt).toBeTruthy();

    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.99); // d20 = 20 — попадание
    executeAutomation(f.ctx, {
      caster,
      mapId: 'm1',
      def: bolt!,
      targets: [enemy],
      stats,
      author: 'DM',
      origin: zone!.origin,
      zoneId: zone!.id,
    });
    rand.mockRestore();

    const attackMsg = f.emitted
      .filter((e) => e.event === 'chat:message')
      .map((e) => e.payload as { kind?: string; rollKind?: string; labelParams?: { sources?: unknown[] } })
      .find((m) => m.kind === 'roll' && m.rollKind === 'attack');
    expect(attackMsg?.labelParams?.sources).toContainEqual({ side: 'advantage', kind: 'rule', key: 'insideZone' });
  });

  it('Cordon of Arrows: последняя стрела в конце хода — зона гаснет и рассылается', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[0]!;
    caster.faction = 'ally';
    const enemy = map.tokens[1]!;
    enemy.faction = 'enemy';
    enemy.hpMax = '30';
    enemy.hpCurrent = 30;
    enemy.x = 150;
    enemy.y = 100;
    const def = automationForSpell(findSpell('XPHB:Cordon of Arrows')!, { castLevel: 2 });
    const zone = createZoneFromDef(f.ctx, {
      caster,
      mapId: 'm1',
      def,
      stats,
      origin: { x: caster.x, y: caster.y },
    });
    zone!.charges = 1;
    f.emitted.length = 0;
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.05);
    tickZones(f.ctx, room, 'm1', enemy, 'end');
    rand.mockRestore();
    expect(map.zones).toHaveLength(0);
    // Снятие зоны должно уехать клиентам сразу, а не после F5.
    expect(f.emitted.filter((e) => e.event === 'zones:update').length).toBeGreaterThan(0);
  });

  it('Большой юнит (3×3) входит в Cordon один раз', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[0]!;
    caster.faction = 'ally';
    const big = makeToken('big', { x: 600, y: 300, w: 150, h: 150, faction: 'enemy', hpMax: '60', hpCurrent: 60 });
    map.tokens.push(big);
    const def = automationForSpell(findSpell('XPHB:Cordon of Arrows')!, { castLevel: 2 });
    const zone = createZoneFromDef(f.ctx, {
      caster,
      mapId: 'm1',
      def,
      stats,
      origin: { x: caster.x, y: caster.y },
    });
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.05);
    for (const x of [550, 500, 450, 400, 350, 300, 250]) {
      big.x = x;
      big.y = 300;
      handleMovementZones(f.ctx, room, 'm1');
    }
    rand.mockRestore();
    expect(zone?.charges).toBe(3);
  });
});

describe('стена льда (Wall of Ice)', () => {
  const stats = { ability: 'wis' as const, mod: 3, dc: 14, attack: 5 };
  const wallSpell = () => findSpell('XPHB:Wall of Ice')!;

  function iceSetup() {
    const room = makeCombatRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100 }),
        makeToken('t2', { x: 175, y: 125, hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib1' }
    );
    const f = makeConnCtx(room, { dm: true, all: true });
    const map = room.scene.maps[0]!;
    const caster = map.tokens[0]!;
    // Якорь концентрации кастера — как его ставит executeAutomation (иначе зона гаснет при движении).
    caster.effects.push({
      id: 'anchor-ice',
      name: 'Wall of Ice',
      sourceKey: 'XPHB:Wall of Ice',
      sourceId: caster.id,
      concentration: true,
      duration: { type: 'concentration' },
      modifiers: [],
    });
    const def = automationForSpell(wallSpell(), { variant: 'vertical' });
    const zone = createZoneFromDef(f.ctx, {
      caster,
      mapId: 'm1',
      def,
      stats,
      origin: { x: 125, y: 125 },
      direction: { x: 125, y: 225 },
    })!;
    return { room, f, map, caster, zone };
  }

  /** Дубина без модификаторов: d20 vs КЗ 12; урон 1d4. */
  const club = (damageType: string): AttackEntry => ({
    name: 'Дубина',
    hit: 'd20',
    damage: '1d4',
    rangeType: 'melee',
    rangeNormal: 5,
    rangeLong: 0,
    damageType,
  });

  it('создание: 10 секций по 30 HP, КЗ 12, иммунитеты и уязвимость', () => {
    const { zone } = iceSetup();
    expect(zone.wall?.ac).toBe(12);
    expect(zone.wall?.immunities).toEqual(['cold', 'poison', 'psychic']);
    expect(zone.wall?.vulnerabilities).toEqual(['fire']);
    expect(zone.sections).toHaveLength(10);
    expect(zone.sections!.every((s) => s.hp === 30 && s.maxHp === 30 && !s.broken)).toBe(true);
  });

  it('атака по секции: d20 vs КЗ, уязвимость к огню удваивает урон', () => {
    const { room, f, zone } = iceSetup();
    const attacker = room.scene.maps[0]!.tokens[1]!;
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.6); // d20=13 (попадание), 1d4=3
    resolveZoneSectionAttack(f.ctx, room, {
      attacker,
      mapId: 'm1',
      attack: club('fire'),
      ref: { zoneId: zone.id, section: 0 },
      author: 'DM',
    });
    rand.mockRestore();
    // Огонь: 3 × 2 = 6.
    expect(zone.sections![0]!.hp).toBe(24);
    expect(!!zone.sections![0]!.broken).toBe(false);
    expect(f.emitted.some((e) => e.event === 'zones:update')).toBe(true);
  });

  it('иммунитет холоду: атака не пробивает; ручной урон добивает секцию', () => {
    const { room, f, zone } = iceSetup();
    const attacker = room.scene.maps[0]!.tokens[1]!;
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.6);
    resolveZoneSectionAttack(f.ctx, room, {
      attacker,
      mapId: 'm1',
      attack: club('cold'),
      ref: { zoneId: zone.id, section: 0 },
      author: 'DM',
    });
    rand.mockRestore();
    expect(zone.sections![0]!.hp).toBe(30);
    const hit = hitZoneSection(f.ctx, room, 'm1', zone, 0, [{ damageType: 'slashing', amount: 30 }]);
    expect(hit).toMatchObject({ applied: 30, broken: true });
  });

  it('проход сквозь пробитую секцию: спас CON и урон раз за ход', () => {
    const { room, f, map, zone } = iceSetup();
    hitZoneSection(f.ctx, room, 'm1', zone, 0, [{ damageType: 'slashing', amount: 30 }]);
    const mover = map.tokens[1]!;
    f.emitted.length = 0;
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.6); // d20=13 < СЛ 14 → 5d6=20
    f.invoke('token:step', { mapId: 'm1', id: 't2', x: 125, y: 125 });
    rand.mockRestore();
    expect(mover.hpCurrent).toBe(10);
    // Второй проход в этом же ходу — без урона (раз за ход на секцию).
    const rand2 = vi.spyOn(Math, 'random').mockReturnValue(0.6);
    f.invoke('token:step', { mapId: 'm1', id: 't2', x: 175, y: 125 });
    rand2.mockRestore();
    expect(mover.hpCurrent).toBe(10);
  });

  it('появление: разрезанное стеной существо попадает в цели, соседнее — нет', () => {
    const { f, map } = iceSetup();
    const straddle = makeToken('t3', { x: 150, y: 125, hpMax: '20', hpCurrent: 20 });
    map.tokens.push(straddle);
    const caster = map.tokens[0]!;
    const input = collectSpellCast(f.ctx, {
      mapId: 'm1',
      caster,
      spell: wallSpell(),
      castLevel: 6,
      characterLevel: 11,
      stats,
      variant: 'vertical',
      origin: { x: 125, y: 125 },
      author: 'DM',
    });
    expect(input?.targets.some((t) => t.id === 't3')).toBe(true);
    // t2 стоит вплотную (касание грани) — не цель.
    expect(input?.targets.some((t) => t.id === 't2')).toBe(false);
  });

  it('цепочка панелей: зона по узлам пути, секции по панелям, разрезанные — в цели каста', () => {
    const { room, f, map, caster } = iceSetup();
    const def = automationForSpell(wallSpell(), { variant: 'wall' });
    const path = [
      { x: 325, y: 125 },
      { x: 425, y: 125 },
      { x: 425, y: 225 },
    ];
    const zone = createZoneFromDef(f.ctx, { caster, mapId: 'm1', def, stats, origin: path[0]!, path })!;
    expect(zone.wallPath).toEqual(path);
    expect(zone.sections).toHaveLength(2);

    const straddle = makeToken('t3', { x: 425, y: 125, hpMax: '20', hpCurrent: 20 });
    map.tokens.push(straddle);
    const input = collectSpellCast(f.ctx, {
      mapId: 'm1',
      caster,
      spell: wallSpell(),
      castLevel: 6,
      characterLevel: 11,
      stats,
      variant: 'wall',
      path,
      author: 'DM',
    });
    expect(input?.path).toEqual(path);
    expect(input?.targets.some((t) => t.id === 't3')).toBe(true);
    // Неконтинуальный путь отклоняется явной ошибкой; 45° 2×2 — запрещённый шаг.
    const bad = validateSpellCast(room, { ...input!, path: [{ x: 325, y: 125 }, { x: 400, y: 125 }] });
    expect(bad?.code).toBe('wallPathBad');
    const diagonal = validateSpellCast(room, { ...input!, path: [{ x: 325, y: 125 }, { x: 425, y: 225 }] });
    expect(diagonal?.code).toBe('wallPathBad');
  });

  it('большой токен (3×3) бьёт стену вплотную: дистанция от подошвы, а не от центра', () => {
    const { room, f, zone } = iceSetup();
    const map = room.scene.maps[0]!;
    const big = makeToken('big', { x: 225, y: 125, w: 150, h: 150, hpMax: '60', hpCurrent: 60 });
    map.tokens.push(big);
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.6); // d20=13, 1d4=3
    resolveZoneSectionAttack(f.ctx, room, {
      attacker: big,
      mapId: 'm1',
      attack: club('fire'),
      ref: { zoneId: zone.id, section: 0 },
      author: 'DM',
    });
    rand.mockRestore();
    expect(zone.sections![0]!.hp).toBe(24);
  });

  it('выталкивание при появлении: разрезанное существо смещается и больше не разрезано', () => {
    const { room, f, map, caster } = iceSetup();
    const dummy = makeToken('dummy', { x: 350, y: 100, hpMax: '30', hpCurrent: 30 });
    map.tokens.push(dummy);
    const def = automationForSpell(wallSpell(), { variant: 'wall' });
    const path = [
      { x: 300, y: 100 },
      { x: 400, y: 100 },
    ];
    applyWallPush(f.ctx, room, caster, 'm1', def.zone!, { path, side: 'a' });
    expect({ x: dummy.x, y: dummy.y }).toEqual({ x: 375, y: 175 });
    const segments = zoneWallSegments(
      { area: def.zone!.area, origin: path[0]!, direction: null, wallPath: path },
      { size: 50, offsetX: 0, offsetY: 0 }
    );
    expect(tokensCrossingSegments([dummy], segments)).toHaveLength(0);
  });
});
