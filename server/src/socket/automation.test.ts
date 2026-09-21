import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  automationForSpell,
  monsterAbilityAutomation,
  monsterStats,
  type ActionDef,
  type ChatMessage,
} from 'shared';
import { makeCombatRoom, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { findSpell } from '../spells';
import { executeAutomation } from './automation';

const isAttackRoll = (m: ChatMessage): m is Extract<ChatMessage, { kind: 'roll' }> =>
  m.kind === 'roll' && m.rollKind === 'attack';

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

describe('AoE-урон в чат', () => {
  afterEach(() => vi.restoreAllMocks());

  it('один бросок урона на весь каст, без дублей по целям', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[0]!;
    const t2 = map.tokens[1]!;
    const t3 = makeToken('t3', { x: 200, y: 100, hpMax: '30', hpCurrent: 30 });
    map.tokens.push(t3);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    executeAutomation(f.ctx, {
      caster,
      mapId: 'm1',
      def: automationForSpell(findSpell('XPHB:Fireball')!, { castLevel: 3, characterLevel: 5 }),
      targets: [t2, t3],
      stats,
      author: 'DM',
      origin: { x: 175, y: 100 },
    });

    const damageMsgs = room.chat.filter((m) => m.kind === 'roll' && m.rollKind === 'damage');
    expect(damageMsgs).toHaveLength(1);
  });
});

describe('Polymorph: якорь концентрации', () => {
  afterEach(() => vi.restoreAllMocks());

  const castPolymorph = (f: ReturnType<typeof setup>['f'], room: ReturnType<typeof setup>['room']) => {
    const map = room.scene.maps[0]!;
    // В фикстурах карта без размеров: зона подошвы формы требует границ.
    map.width = 1000;
    map.height = 800;
    executeAutomation(f.ctx, {
      caster: map.tokens[0]!,
      mapId: 'm1',
      def: automationForSpell(findSpell('XPHB:Polymorph')!, { castLevel: 4, characterLevel: 8 }),
      targets: [map.tokens[1]!],
      stats,
      author: 'DM',
      summonKey: 'XMM:Wolf',
    });
    return map;
  };

  it('провал сейва: форма + якорь концентрации на кастере', () => {
    const { room, f } = setup();
    const caster = room.scene.maps[0]!.tokens[0]!;
    const target = room.scene.maps[0]!.tokens[1]!;
    vi.spyOn(Math, 'random').mockReturnValue(0); // сейв цели провален
    const map = castPolymorph(f, room);

    expect(target.shape?.kind).toBe('polymorph');
    expect(target.shape?.sourceTokenId).toBe(caster.id);
    const anchor = caster.effects.find((e) => e.concentration && e.sourceKey === 'XPHB:Polymorph');
    expect(anchor).toBeTruthy();
    expect(map.combat.turns['e1']?.concentrationId).toBe(anchor!.id);
  });

  it('провал спасброска концентрации от урона возвращает цель из формы', () => {
    const { room, f } = setup();
    const caster = room.scene.maps[0]!.tokens[0]!;
    const target = room.scene.maps[0]!.tokens[1]!;
    vi.spyOn(Math, 'random').mockReturnValue(0);
    castPolymorph(f, room);
    expect(target.shape).toBeTruthy();

    f.ctx.applyHp(room, 'm1', caster, -30); // CON-спасбросок с DC 15 провален тем же сидом

    expect(target.shape).toBeUndefined();
    expect(caster.effects.some((e) => e.concentration)).toBe(false);
  });

  it('успешный сейв: формы и якоря нет', () => {
    const { room, f } = setup();
    const caster = room.scene.maps[0]!.tokens[0]!;
    const target = room.scene.maps[0]!.tokens[1]!;
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // сейв цели успешен
    castPolymorph(f, room);

    expect(target.shape).toBeUndefined();
    expect(caster.effects.some((e) => e.concentration && e.sourceKey === 'XPHB:Polymorph')).toBe(false);
  });
});

describe('способности монстров', () => {
  afterEach(() => vi.restoreAllMocks());

  const venom: ActionDef = {
    id: 'venom',
    name: 'Ядовитый укус',
    source: 'monster',
    costs: ['action'],
    ability: {
      attack: { rangeType: 'melee', bonus: '+5', damage: '1d6+3', types: ['piercing'] },
      save: { ability: 'con' },
      effects: [{ condition: 'poisoned', duration: { type: 'rounds', rounds: 2 } }],
    },
  };

  it('атака способности: урон при попадании, состояние — по провалу сейва', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[0]!;
    const target = map.tokens[1]!;
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0);
    executeAutomation(f.ctx, {
      caster,
      mapId: 'm1',
      def: monsterAbilityAutomation(venom)!,
      targets: [target],
      stats: monsterStats(undefined, venom.ability),
      author: 'DM',
    });
    expect(target.hpCurrent).toBe(23);
    expect(target.conditions.some((c) => c.key === 'poisoned')).toBe(true);
  });

  it('атака способности по оглушённой цели идёт с преимуществом', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[0]!;
    const target = map.tokens[1]!;
    target.conditions = [{ key: 'stunned', name: 'Ошеломлён' }];
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    executeAutomation(f.ctx, {
      caster,
      mapId: 'm1',
      def: monsterAbilityAutomation(venom)!,
      targets: [target],
      stats: monsterStats(undefined, venom.ability),
      author: 'DM',
    });
    const attackMsg = room.chat.find(isAttackRoll);
    expect(attackMsg?.roll.dice[0]?.advantage).toBe('a');
    expect(attackMsg?.roll.dice[0]?.dropped).toHaveLength(1);
  });

  it('полный цикл: рёв оглушает цель, следующая атака идёт с преимуществом', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[0]!;
    const target = map.tokens[1]!;
    target.isPlayerToken = true;
    target.libraryItemId = 'lib2';
    const roar: ActionDef = {
      id: 'roar',
      name: 'Оглушающий рёв',
      source: 'monster',
      costs: [],
      legendaryCost: 1,
      ability: {
        save: { ability: 'wis' },
        dc: 15,
        effects: [{ condition: 'stunned', duration: { type: 'endOfTurn', of: 'target' } }],
      },
    };
    const fail = vi.spyOn(Math, 'random').mockReturnValue(0);
    executeAutomation(f.ctx, {
      caster,
      mapId: 'm1',
      def: monsterAbilityAutomation(roar)!,
      targets: [target],
      stats: monsterStats(undefined, roar.ability),
      author: 'DM',
    });
    fail.mockRestore();
    expect(target.conditions.some((c) => c.key === 'stunned')).toBe(true);

    const hit = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    executeAutomation(f.ctx, {
      caster,
      mapId: 'm1',
      def: monsterAbilityAutomation(venom)!,
      targets: [target],
      stats: monsterStats(undefined, venom.ability),
      author: 'DM',
    });
    hit.mockRestore();

    const attacks = room.chat.filter(isAttackRoll);
    expect(attacks[attacks.length - 1]?.roll.dice[0]?.advantage).toBe('a');
  });

  it('атака способности: успешный сейв — урон без состояния', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[0]!;
    const target = map.tokens[1]!;
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.99);
    executeAutomation(f.ctx, {
      caster,
      mapId: 'm1',
      def: monsterAbilityAutomation(venom)!,
      targets: [target],
      stats: monsterStats(undefined, venom.ability),
      author: 'DM',
    });
    expect(target.hpCurrent).toBe(23);
    expect(target.conditions.some((c) => c.key === 'poisoned')).toBe(false);
  });

  it('сейв-способность без урона: состояние только при провале', () => {
    const { room, f } = setup();
    const caster = room.scene.maps[0]!.tokens[0]!;
    const target = room.scene.maps[0]!.tokens[1]!;
    const roar: ActionDef = {
      id: 'roar',
      name: 'Оглушающий рёв',
      source: 'monster',
      costs: [],
      legendaryCost: 1,
      ability: {
        save: { ability: 'wis' },
        dc: 15,
        effects: [{ condition: 'stunned', duration: { type: 'endOfTurn', of: 'target' } }],
      },
    };
    vi.spyOn(Math, 'random').mockReturnValue(0);
    executeAutomation(f.ctx, {
      caster,
      mapId: 'm1',
      def: monsterAbilityAutomation(roar)!,
      targets: [target],
      stats: monsterStats(undefined, roar.ability),
      author: 'DM',
    });
    expect(target.conditions.some((c) => c.key === 'stunned')).toBe(true);
  });

  it('сейв-способность с уроном: при успехе половина без состояния', () => {
    const { room, f } = setup();
    const caster = room.scene.maps[0]!.tokens[0]!;
    const target = room.scene.maps[0]!.tokens[1]!;
    const burst: ActionDef = {
      id: 'burst',
      name: 'Вспышка',
      source: 'monster',
      costs: ['action'],
      ability: {
        save: { ability: 'dex' },
        dc: 12,
        damage: { dice: '2d6', types: ['fire'] },
        effects: [{ condition: 'prone', duration: { type: 'endOfTurn', of: 'target' } }],
      },
    };
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.99);
    executeAutomation(f.ctx, {
      caster,
      mapId: 'm1',
      def: monsterAbilityAutomation(burst)!,
      targets: [target],
      stats: monsterStats(undefined, burst.ability),
      author: 'DM',
    });
    expect(target.hpCurrent).toBe(29);
    expect(target.conditions.some((c) => c.key === 'prone')).toBe(false);
  });

  it('способность без атаки и сейва: урон и состояние сразу', () => {
    const { room, f } = setup();
    const caster = room.scene.maps[0]!.tokens[0]!;
    const target = room.scene.maps[0]!.tokens[1]!;
    const slam: ActionDef = {
      id: 'slam',
      name: 'Удар',
      source: 'monster',
      costs: ['action'],
      ability: {
        damage: { dice: '1d4', types: ['force'] },
        effects: [{ condition: 'prone', duration: { type: 'endOfTurn', of: 'target' } }],
      },
    };
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    executeAutomation(f.ctx, {
      caster,
      mapId: 'm1',
      def: monsterAbilityAutomation(slam)!,
      targets: [target],
      stats: monsterStats(undefined, slam.ability),
      author: 'DM',
    });
    expect(target.hpCurrent).toBe(27);
    expect(target.conditions.some((c) => c.key === 'prone')).toBe(true);
  });
});
