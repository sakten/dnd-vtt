import { describe, expect, it, vi } from 'vitest';
import type { CharacterSheet } from 'shared';
import { makeCombatRoom, makeResources, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';

function sheet(level: number, spells: string[] = []): CharacterSheet {
  return {
    name: 'Друид',
    abilities: { str: 10, dex: 14, con: 14, int: 10, wis: 16, cha: 10 },
    classes: [{ className: 'druid', level, subclass: 'symbiote' }],
    spells: spells.map((key) => ({ key, className: 'druid' })),
    attacks: [],
    saves: {},
    skills: {},
    damageDefenses: [],
    senses: [],
    hpMax: '30',
    ac: '14',
    speed: 30,
  } as unknown as CharacterSheet;
}

function resources() {
  return makeResources({
    hp: { current: 30, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
    spellSlots: [{ level: 3, current: 1, max: 1 }],
    resources: [
      { id: 'r1', key: 'druid:wildShape', name: 'Дикий облик', current: 2, max: 2, reset: 'short' },
      {
        id: 'r2',
        key: 'druid.symbiote:symbioticReflexes',
        name: 'Симбиотические рефлексы',
        current: 3,
        max: 3,
        reset: 'long',
      },
    ],
  });
}

function noCombat(room: ReturnType<typeof makeCombatRoom>) {
  room.scene.maps[0]!.combat.active = false;
  return room;
}

describe("Cat's Spring: прыжок, OA и атака", () => {
  function setup(opts: { enemy?: boolean; resistance?: boolean } = {}) {
    const caster = makeToken('t1', { libraryItemId: 'lib1', x: 25, y: 25, faction: 'ally' });
    const target = makeToken('t2', {
      x: 125,
      y: 75,
      ac: '10',
      hpMax: '30',
      hpCurrent: 30,
      faction: 'enemy',
      ...(opts.resistance
        ? { damageDefenses: [{ id: 'd1', type: 'resistance', damageType: 'slashing' }] }
        : {}),
    });
    const tokens = [caster, target];
    if (opts.enemy) {
      tokens.push(
        makeToken('t3', {
          x: 25,
          y: 75,
          attacks: [
            {
              id: 'a1',
              name: 'Клыки',
              hit: 'd20+5',
              damage: '1d4',
              damageType: 'piercing',
              rangeType: 'melee',
              rangeNormal: 5,
              rangeLong: 0,
            },
          ],
          faction: 'enemy',
        })
      );
    }
    const room = noCombat(makeCombatRoom(tokens as never, { p1: 'lib1' }));
    room.sheets.p1 = sheet(5, ["CBT:Cat's Spring"]);
    room.resources.p1 = resources();
    const f = makeConnCtx(room, { playerId: 'p1', all: true });
    return { caster, target, room, f };
  }

  it('телепортирует к точке, бьёт цель и вешает преимущество', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const { caster, target, room, f } = setup();
    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: "CBT:Cat's Spring",
      targetIds: ['t2'],
      placements: [{ targetId: 't2', x: 125, y: 25 }],
      variant: 'force',
    });
    vi.restoreAllMocks();
    expect(f.emitted.some((e) => e.event === 'chat:error')).toBe(false);
    expect(caster.x).toBe(125);
    expect(caster.y).toBe(25);
    expect(target.hpCurrent).toBeLessThan(30);
    const effect = target.effects.find((e) => e.sourceKey === "CBT:Cat's Spring");
    expect(effect?.consumeOnSourceAttack).toBe(true);
    expect(effect?.modifiers[0]?.filter).toMatchObject({ direction: 'against', sourceOnly: true });
    expect(room.resources.p1!.hp.current).toBe(30);
  });

  it('точка прыжка слишком далеко — отказ без перемещения и урона', () => {
    const { caster, target, f } = setup();
    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: "CBT:Cat's Spring",
      targetIds: ['t2'],
      placements: [{ targetId: 't2', x: 325, y: 25 }],
    });
    const error = f.emitted.find((e) => e.event === 'chat:error')?.payload as { code?: string } | undefined;
    expect(error?.code).toBe('outOfRange');
    expect([caster.x, caster.y]).toEqual([25, 25]);
    expect(target.hpCurrent).toBe(30);
    expect(target.effects).toEqual([]);
  });

  it('выход из досягаемости провоцирует атаку по возможности', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const { room, f } = setup({ enemy: true });
    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: "CBT:Cat's Spring",
      targetIds: ['t2'],
      placements: [{ targetId: 't2', x: 125, y: 25 }],
    });
    vi.restoreAllMocks();
    expect(f.emitted.some((e) => e.event === 'chat:error')).toBe(false);
    // Клыки попали: атака по возможности сняла HP до прыжка/атаки.
    expect(room.resources.p1!.hp.current).toBeLessThan(30);
  });
});

describe('Симбиотическая трансформация и рефлексы', () => {
  function setup() {
    const token = makeToken('t1', { libraryItemId: 'lib1', x: 25, y: 25 });
    const room = noCombat(makeCombatRoom([token], { p1: 'lib1' }));
    room.sheets.p1 = sheet(6);
    room.resources.p1 = resources();
    const f = makeConnCtx(room, { playerId: 'p1', all: true });
    return { token, room, f };
  }

  it('трансформация тратит Дикий облик и даёт AC/скрытность/временные хиты', () => {
    const { token, room, f } = setup();
    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: 'class:druid.symbiote:symbioticTransformation',
      slot: 'bonus',
    });
    expect(room.resources.p1!.resources[0]!.current).toBe(1);
    const effect = token.effects.find((e) => e.sourceKey === 'class:druid.symbiote:symbioticTransformation');
    expect(effect?.modifiers.map((m) => m.target)).toEqual(['ac', 'check']);
    expect(effect?.triggers?.[0]).toMatchObject({ on: 'startOfTurn', turn: { tempHp: 5 } });
  });

  it('рефлексы требуют трансформацию и кастуют Haste без ячейки', () => {
    const { token, room, f } = setup();
    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: 'class:druid.symbiote:symbioticTransformation',
      slot: 'bonus',
    });
    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: 'class:druid.symbiote:symbioticReflexes',
      slot: 'action',
    });
    expect(f.emitted.some((e) => e.event === 'chat:error')).toBe(false);
    expect(room.resources.p1!.resources[1]!.current).toBe(2);
    expect(room.resources.p1!.spellSlots[0]!.current).toBe(1);
    const haste = token.effects.find((e) => e.sourceKey === 'XPHB:Haste');
    expect(haste?.concentration).toBe(true);
    expect(haste?.modifiers.map((m) => m.target)).toEqual(['ac', 'speed', 'extraActions', 'save']);
  });

  it('без ресурса рефлексы отклоняются без каста и траты ячейки', () => {
    const { token, room, f } = setup();
    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: 'class:druid.symbiote:symbioticTransformation',
      slot: 'bonus',
    });
    room.resources.p1!.resources[1]!.current = 0;
    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: 'class:druid.symbiote:symbioticReflexes',
      slot: 'action',
    });
    const error = f.emitted.find((e) => e.event === 'chat:error')?.payload as { code?: string } | undefined;
    expect(error?.code).toBe('noResource');
    expect(token.effects.some((e) => e.sourceKey === 'XPHB:Haste')).toBe(false);
    expect(room.resources.p1!.spellSlots[0]!.current).toBe(1);
  });

  it('без трансформации рефлексы отклоняются без траты', () => {
    const { room, f } = setup();
    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: 'class:druid.symbiote:symbioticReflexes',
      slot: 'action',
    });
    const error = f.emitted.find((e) => e.event === 'chat:error')?.payload as { code?: string } | undefined;
    expect(error?.code).toBe('featureInactive');
    expect(room.resources.p1!.resources[1]!.current).toBe(3);
  });
});
