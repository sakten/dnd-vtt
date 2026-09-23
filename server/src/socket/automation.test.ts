import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  automationForAction,
  automationForSpell,
  findBaseAction,
  monsterAbilityAutomation,
  monsterStats,
  savedAgainst,
  type ActionDef,
  type ChatMessage,
} from 'shared';
import { makeCombatRoom, makeResources, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { findSpell } from '../spells';
import { executeAutomation } from './automation';
import { tickEffectTriggers } from './effects';
import { applyEffectTo } from './effectsApply';
import { validateSpellCast } from './spellResolve';
import { checkPartsForToken } from '../room/effects';

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

  it('Pass without Trace: аура +10 к Скрытности на всех в радиусе', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[0]!;
    const target = map.tokens[1]!;

    const passTrace = findSpell('XPHB:Pass without Trace')!;
    executeAutomation(f.ctx, {
      caster,
      mapId: 'm1',
      def: automationForSpell(passTrace, { castLevel: 2 }),
      targets: [],
      stats,
      author: 'DM',
    });

    expect(map.zones?.map((z) => z.sourceKey)).toEqual(['XPHB:Pass without Trace']);
    expect(target.effects.some((e) => e.sourceKey === 'XPHB:Pass without Trace' && !!e.zoneId)).toBe(true);
    expect(caster.effects.some((e) => e.sourceKey === 'XPHB:Pass without Trace' && !!e.zoneId)).toBe(true);
    expect(checkPartsForToken(room, target, { ability: 'dex', skill: 'stealth' })).toMatchObject({ flat: 10 });
  });

  it('Enhance Ability: выбранная характеристика — преимущество проверок цели', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[0]!;
    const target = map.tokens[1]!;

    const enhance = findSpell('XPHB:Enhance Ability')!;
    executeAutomation(f.ctx, {
      caster,
      mapId: 'm1',
      def: automationForSpell(enhance, { castLevel: 2, variant: 'dex' }),
      targets: [target],
      stats,
      author: 'DM',
    });

    expect(target.effects.some((e) => e.sourceKey === 'XPHB:Enhance Ability')).toBe(true);
    expect(checkPartsForToken(room, target, { ability: 'dex' }).mode).toBe('a');
    expect(checkPartsForToken(room, target, { ability: 'str' }).mode).toBeUndefined();
  });

  it('Protection from Poison: снимает «Отравлен» и вешает эффект', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[0]!;
    const target = map.tokens[1]!;
    target.conditions.push({ key: 'poisoned', name: 'Отравлен', rounds: null });

    const pp = findSpell('XPHB:Protection from Poison')!;
    executeAutomation(f.ctx, {
      caster,
      mapId: 'm1',
      def: automationForSpell(pp, { castLevel: 2 }),
      targets: [target],
      stats,
      author: 'DM',
    });

    expect(target.conditions.some((c) => c.key === 'poisoned')).toBe(false);
    expect(target.effects.some((e) => e.sourceKey === 'XPHB:Protection from Poison')).toBe(true);
  });

  it('Scatter: союзник без сейва, враг с WIS-спасом, точки — в 120 фт от кастера', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[0]!;
    const enemy = map.tokens[1]!;
    const ally = makeToken('t3', { x: 150, y: 150 });
    map.tokens.push(ally);
    caster.faction = 'ally';
    ally.faction = 'ally';
    enemy.faction = 'enemy';
    enemy.x = 150;
    enemy.y = 100;

    const def = automationForSpell(findSpell('XGE:Scatter')!);
    const enemyFrom = { x: enemy.x, y: enemy.y };
    const allyFrom = { x: ally.x, y: ally.y };

    const spy = vi.spyOn(Math, 'random').mockReturnValue(0); // враг проваливает сейв
    executeAutomation(f.ctx, {
      caster,
      mapId: 'm1',
      def,
      targets: [],
      stats,
      author: 'DM',
      placements: [
        { targetId: enemy.id, x: 300, y: 300 },
        { targetId: ally.id, x: 350, y: 300 },
      ],
    });
    spy.mockRestore();

    expect(enemy.x).not.toBe(enemyFrom.x);
    expect(ally.x).not.toBe(allyFrom.x);
    const saves = room.chat.filter(
      (m): m is Extract<ChatMessage, { kind: 'roll' }> => m.kind === 'roll' && m.rollKind === 'save'
    );
    expect(saves.some((m) => m.labelParams?.subject?.includes(enemy.name))).toBe(true);
    expect(saves.some((m) => m.labelParams?.subject?.includes(ally.name))).toBe(false);
  });

  it('Scatter: успешный сейв врага — остаётся на месте', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[0]!;
    const enemy = map.tokens[1]!;
    caster.faction = 'ally';
    enemy.faction = 'enemy';
    enemy.x = 150;
    enemy.y = 100;

    const def = automationForSpell(findSpell('XGE:Scatter')!);
    const from = { x: enemy.x, y: enemy.y };
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.999);
    executeAutomation(f.ctx, {
      caster,
      mapId: 'm1',
      def,
      targets: [],
      stats,
      author: 'DM',
      placements: [{ targetId: enemy.id, x: 300, y: 300 }],
    });
    spy.mockRestore();

    expect(enemy.x).toBe(from.x);
    expect(enemy.y).toBe(from.y);
    const saves = room.chat.filter(
      (m): m is Extract<ChatMessage, { kind: 'roll' }> => m.kind === 'roll' && m.rollKind === 'save'
    );
    expect(saves.some((m) => m.labelParams?.saveOutcome === 'success')).toBe(true);
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

describe('иммунитеты к состояниям и триггеры эффектов', () => {
  const alive = () =>
    makeResources({ hp: { current: 10, max: 20, temp: 0, deathSuccesses: 0, deathFailures: 0 } });

  it('Heroism: иммунитет к испугу и temp HP в начале хода', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[1]!;
    const target = map.tokens[0]!;
    room.resources.p1 = alive();

    const heroism = findSpell('XPHB:Heroism')!;
    executeAutomation(f.ctx, {
      caster,
      mapId: 'm1',
      def: automationForSpell(heroism, { castLevel: 1, characterLevel: 5, spellMod: 3 }),
      targets: [target],
      stats,
      author: 'A',
    });

    const effect = target.effects.find((e) => e.sourceKey === 'XPHB:Heroism');
    expect(effect?.triggers?.startOfTurn?.tempHp).toBe(3);

    applyEffectTo(f.ctx, room, {
      sourceKey: 'test:fear',
      sourceId: 'x',
      mapId: 'm1',
      target,
      effectDef: { name: 'Fear', duration: { type: 'rounds', rounds: 10 }, modifiers: [], conditions: ['frightened'] },
    });
    expect(target.conditions.some((c) => c.key === 'frightened')).toBe(false);

    tickEffectTriggers(f.ctx, room, 'm1', target);
    expect(room.resources.p1!.hp.temp).toBe(3);
  });

  it('Freedom of Movement: паралич и опутывание не накладываются', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[1]!;
    const target = map.tokens[0]!;
    room.resources.p1 = alive();

    const fom = findSpell('XPHB:Freedom of Movement')!;
    executeAutomation(f.ctx, {
      caster,
      mapId: 'm1',
      def: automationForSpell(fom, { castLevel: 4, characterLevel: 9 }),
      targets: [target],
      stats,
      author: 'A',
    });

    applyEffectTo(f.ctx, room, {
      sourceKey: 'test:hold',
      sourceId: 'x',
      mapId: 'm1',
      target,
      effectDef: { name: 'Hold Person', duration: { type: 'rounds', rounds: 10 }, modifiers: [], conditions: ['paralyzed', 'restrained'] },
    });
    expect(target.conditions.map((c) => c.key)).toEqual([]);

    for (const effect of target.effects.filter((e) => e.sourceKey === 'XPHB:Freedom of Movement')) {
      f.ctx.manager.removeEffect(room, target, effect.id);
    }
    applyEffectTo(f.ctx, room, {
      sourceKey: 'test:hold2',
      sourceId: 'x',
      mapId: 'm1',
      target,
      effectDef: { name: 'Hold Person', duration: { type: 'rounds', rounds: 10 }, modifiers: [], conditions: ['paralyzed'] },
    });
    expect(target.conditions.some((c) => c.key === 'paralyzed')).toBe(true);
  });

  it('статблок монстра: иммунитет к состоянию блокирует его, эффект остаётся', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const target = map.tokens[1]!;
    target.statblock = {
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      conditionImmunities: ['charmed', 'frightened'],
    };

    applyEffectTo(f.ctx, room, {
      sourceKey: 'test:charm',
      sourceId: 'x',
      mapId: 'm1',
      target,
      effectDef: { name: 'Charm', duration: { type: 'rounds', rounds: 10 }, modifiers: [], conditions: ['charmed'] },
    });
    expect(target.conditions.some((c) => c.key === 'charmed')).toBe(false);
    expect(target.effects.some((e) => e.sourceKey === 'test:charm')).toBe(true);

    applyEffectTo(f.ctx, room, {
      sourceKey: 'test:hold',
      sourceId: 'x',
      mapId: 'm1',
      target,
      effectDef: { name: 'Hold Person', duration: { type: 'rounds', rounds: 10 }, modifiers: [], conditions: ['paralyzed'] },
    });
    expect(target.conditions.some((c) => c.key === 'paralyzed')).toBe(true);
  });

  it('checkPartsForToken: преимущество и флэт проверок из эффектов носителя', () => {
    const { room } = setup();
    const token = room.scene.maps[0]!.tokens[0]!;
    token.effects = [
      {
        id: 'e1',
        name: 'Enhance Ability',
        duration: { type: 'concentration' },
        modifiers: [{ id: 'm1', target: 'check', mode: 'advantage', filter: { ability: 'str' } }],
      },
      {
        id: 'e2',
        name: 'Pass without Trace',
        duration: { type: 'concentration' },
        modifiers: [{ id: 'm2', target: 'check', mode: 'add', value: 10, filter: { skill: 'stealth' } }],
      },
    ];
    expect(checkPartsForToken(room, token, { ability: 'str' }).mode).toBe('a');
    expect(checkPartsForToken(room, token, { ability: 'dex' }).mode).toBeUndefined();
    expect(checkPartsForToken(room, token, { ability: 'dex', skill: 'stealth' })).toMatchObject({ flat: 10 });
  });

  it('Searing Smite: доп. урон при касте и повторный урон в начале хода', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[1]!;
    const target = map.tokens[0]!;
    room.resources.p1 = alive();
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.5); // d6 = 4

    const searing = findSpell('XPHB:Searing Smite')!;
    executeAutomation(f.ctx, {
      caster,
      mapId: 'm1',
      def: automationForSpell(searing, { castLevel: 1, characterLevel: 5 }),
      targets: [target],
      stats,
      author: 'A',
    });
    expect(room.resources.p1!.hp.current).toBe(6);
    const effect = target.effects.find((e) => e.sourceKey === 'XPHB:Searing Smite');
    expect(effect?.duration).toEqual({ type: 'untilSave', ability: 'con', dc: 14, timing: 'start' });

    tickEffectTriggers(f.ctx, room, 'm1', target);
    expect(room.resources.p1!.hp.current).toBe(2);
    rand.mockRestore();
  });
});

describe('лечение, стабильность и оживление', () => {
  const deadResources = () =>
    makeResources({ hp: { current: -5, max: 20, temp: 0, deathSuccesses: 0, deathFailures: 3 } });

  it('Revivify: мёртвый персонаж оживает с 1 HP, «Мёртв» снят', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[1]!;
    const target = map.tokens[0]!;
    room.resources.p1 = deadResources();
    target.conditions = [{ key: 'dead', name: 'Мёртв', rounds: null }];

    const revivify = findSpell('XPHB:Revivify')!;
    executeAutomation(f.ctx, {
      caster,
      mapId: 'm1',
      def: automationForSpell(revivify, { castLevel: 3, characterLevel: 5 }),
      targets: [target],
      stats,
      author: 'A',
    });

    expect(room.resources.p1!.hp.current).toBe(1);
    expect(room.resources.p1!.hp.deathFailures).toBe(0);
    expect(target.conditions.some((c) => c.key === 'dead')).toBe(false);
    expect(f.emitted.some((e) => e.event === 'chat:message')).toBe(true);
  });

  it('Spare the Dying: цель на 0 HP становится стабильной', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[1]!;
    const target = map.tokens[0]!;
    room.resources.p1 = makeResources({ hp: { current: 0, max: 20, temp: 0, deathSuccesses: 0, deathFailures: 2 } });
    target.conditions = [{ key: 'unconscious', name: 'Без сознания', rounds: null }];

    const spare = findSpell('XPHB:Spare the Dying')!;
    executeAutomation(f.ctx, {
      caster,
      mapId: 'm1',
      def: automationForSpell(spare),
      targets: [target],
      stats,
      author: 'A',
    });

    expect(room.resources.p1!.hp.stable).toBe(true);
    expect(room.resources.p1!.hp.deathFailures).toBe(0);
  });

  it('Death Ward: урон, роняющий до 0, оставляет 1 HP и снимает эффект', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[1]!;
    const target = map.tokens[0]!;
    room.resources.p1 = makeResources({ hp: { current: 10, max: 20, temp: 0, deathSuccesses: 0, deathFailures: 0 } });

    const ward = findSpell('XPHB:Death Ward')!;
    executeAutomation(f.ctx, {
      caster,
      mapId: 'm1',
      def: automationForSpell(ward, { castLevel: 4, characterLevel: 5 }),
      targets: [target],
      stats,
      author: 'A',
    });
    expect(target.effects.some((e) => e.deathWard)).toBe(true);

    f.ctx.applyHp(room, 'm1', target, -99);

    expect(room.resources.p1!.hp.current).toBe(1);
    expect(target.effects.some((e) => e.deathWard)).toBe(false);
    expect(
      f.emitted.some((e) => e.event === 'chat:message' && JSON.stringify(e.payload).includes('automation.deathWard'))
    ).toBe(true);
  });

  it('Heal: лечит 70 и снимает Blinded/Deafened/Poisoned', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[1]!;
    const target = map.tokens[0]!;
    room.resources.p1 = makeResources({ hp: { current: 5, max: 20, temp: 0, deathSuccesses: 0, deathFailures: 0 } });
    target.conditions = [
      { key: 'blinded', name: 'Ослеплён', rounds: null },
      { key: 'poisoned', name: 'Отравлен', rounds: null },
      { key: 'prone', name: 'Сбит с ног', rounds: null },
    ];

    const heal = findSpell('XPHB:Heal')!;
    executeAutomation(f.ctx, {
      caster,
      mapId: 'm1',
      def: automationForSpell(heal, { castLevel: 6, characterLevel: 11 }),
      targets: [target],
      stats,
      author: 'A',
    });

    expect(room.resources.p1!.hp.current).toBe(20);
    expect(target.conditions.map((c) => c.key)).toEqual(['prone']);
  });

  it('Lesser Restoration: выбор снимает состояние и его эффект-источник', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[1]!;
    const target = map.tokens[0]!;
    room.resources.p1 = makeResources({ hp: { current: 10, max: 20, temp: 0, deathSuccesses: 0, deathFailures: 0 } });
    target.effects = [
      { id: 'ef1', name: 'Яд', duration: { type: 'rounds', rounds: 10 }, modifiers: [], conditions: ['poisoned'] },
    ];
    target.conditions = [
      { key: 'poisoned', name: 'Отравлен', rounds: null, effectId: 'ef1' },
      { key: 'blinded', name: 'Ослеплён', rounds: null },
    ];

    const lesser = findSpell('XPHB:Lesser Restoration')!;
    executeAutomation(f.ctx, {
      caster,
      mapId: 'm1',
      def: automationForSpell(lesser, { castLevel: 2, characterLevel: 5 }),
      targets: [target],
      stats,
      author: 'A',
      choice: 'poisoned',
    });

    expect(target.effects.some((e) => e.id === 'ef1')).toBe(false);
    expect(target.conditions.map((c) => c.key)).toEqual(['blinded']);
    expect(
      f.emitted.some((e) => e.event === 'chat:message' && JSON.stringify(e.payload).includes('automation.restore'))
    ).toBe(true);
  });

  it('валидация: Lesser Restoration без выбора и без состояний отклоняется', () => {
    const { room } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[1]!;
    const target = map.tokens[0]!;
    room.resources.p1 = makeResources({ hp: { current: 10, max: 20, temp: 0, deathSuccesses: 0, deathFailures: 0 } });
    const lesser = findSpell('XPHB:Lesser Restoration')!;
    const base = {
      caster,
      mapId: 'm1',
      spell: lesser,
      castLevel: 2,
      characterLevel: 5,
      stats,
      targets: [target],
      author: 'A',
    };

    expect(validateSpellCast(room, base)).toEqual({ code: 'restoreNoCondition' });

    target.conditions = [
      { key: 'poisoned', name: 'Отравлен', rounds: null },
      { key: 'blinded', name: 'Ослеплён', rounds: null },
    ];
    expect(validateSpellCast(room, base)).toEqual({ code: 'restoreNoChoice' });
    expect(validateSpellCast(room, { ...base, condition: 'blinded' })).toBeUndefined();
    expect(validateSpellCast(room, { ...base, condition: 'paralyzed' })).toEqual({ code: 'restoreNoCondition' });
  });

  it('валидация: цель Revivify/Spare the Dying проверяется до каста', () => {
    const { room } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[1]!;
    const target = map.tokens[0]!;
    const base = {
      caster,
      mapId: 'm1',
      castLevel: 3,
      characterLevel: 5,
      stats,
      targets: [target],
      author: 'A',
    };
    room.resources.p1 = makeResources({ hp: { current: 10, max: 20, temp: 0, deathSuccesses: 0, deathFailures: 0 } });
    target.hpCurrent = 10;

    const revivify = findSpell('XPHB:Revivify')!;
    const spare = findSpell('XPHB:Spare the Dying')!;
    expect(validateSpellCast(room, { ...base, spell: revivify })).toEqual({ code: 'reviveNotDead' });
    expect(validateSpellCast(room, { ...base, castLevel: 0, spell: spare })).toEqual({
      code: 'stabilizeNotDying',
    });

    room.resources.p1!.hp.current = 0;
    target.hpCurrent = 0;
    expect(validateSpellCast(room, { ...base, castLevel: 0, spell: spare })).toBeUndefined();

    room.resources.p1!.hp.deathFailures = 3;
    target.hpCurrent = -5;
    target.conditions = [{ key: 'dead', name: 'Мёртв', rounds: null }];
    expect(validateSpellCast(room, { ...base, spell: revivify })).toBeUndefined();
    expect(validateSpellCast(room, { ...base, castLevel: 0, spell: spare })).toEqual({
      code: 'stabilizeNotDying',
    });
  });
});

describe('Помощь: разбудить союзника', () => {
  const helpDef = () => {
    const action = findBaseAction('help')!;
    return automationForAction(action)!;
  };

  const sleeper = () => {
    const token = makeToken('t2', { x: 150, y: 100 });
    token.effects = [
      {
        id: 'sleep1',
        name: 'Sleep',
        duration: { type: 'rounds', rounds: 10 },
        modifiers: [],
        conditions: ['unconscious'],
        wakeOnDamage: true,
      },
    ];
    token.conditions = [{ key: 'unconscious', name: 'Без сознания', rounds: null, effectId: 'sleep1' }];
    return token;
  };

  it('снимает сонный эффект вместе с состоянием', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[0]!;
    const target = sleeper();
    map.tokens.push(target);

    executeAutomation(f.ctx, { caster, mapId: 'm1', def: helpDef(), targets: [target], stats: null, author: 'A' });

    expect(target.effects).toEqual([]);
    expect(target.conditions).toEqual([]);
  });

  it('нечего будить и враждебная цель — ошибки', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[0]!;
    const target = map.tokens[1]!;

    executeAutomation(f.ctx, { caster, mapId: 'm1', def: helpDef(), targets: [target], stats: null, author: 'A' });
    expect(f.selfEvents('chat:error')[0]?.payload).toMatchObject({ code: 'nothingToWake' });

    caster.faction = 'ally';
    target.faction = 'enemy';
    target.effects = [
      { id: 'sleep2', name: 'Sleep', duration: { type: 'rounds', rounds: 10 }, modifiers: [], wakeOnDamage: true },
    ];
    executeAutomation(f.ctx, { caster, mapId: 'm1', def: helpDef(), targets: [target], stats: null, author: 'A' });
    expect(f.selfEvents('chat:error').at(-1)?.payload).toMatchObject({ code: 'helpHostile' });
  });
});

describe('Eyebite: первичный эффект и метка спасшегося', () => {
  it('провал сейва — состояние; успех — скрытая метка', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[0]!;
    const target = map.tokens[1]!;
    const def = automationForSpell(findSpell('XPHB:Eyebite')!, { castLevel: 6, variant: 'sickened' });

    const fail = vi.spyOn(Math, 'random').mockReturnValue(0);
    executeAutomation(f.ctx, { caster, mapId: 'm1', def, targets: [target], stats, author: 'DM' });
    fail.mockRestore();
    expect(target.conditions.some((c) => c.key === 'poisoned')).toBe(true);
    expect(savedAgainst(target.effects, caster.id, def.key)).toBe(false);

    const pass = vi.spyOn(Math, 'random').mockReturnValue(0.999);
    executeAutomation(f.ctx, { caster, mapId: 'm1', def, targets: [target], stats, author: 'DM' });
    pass.mockRestore();
    expect(savedAgainst(target.effects, caster.id, def.key)).toBe(true);
    expect(target.conditions.some((c) => c.key === 'poisoned')).toBe(false);
  });
});

describe('Irresistible Dance: успех и провал спасброска', () => {
  it('провал — Charmed и танец; успех — короткий танец до конца хода', () => {
    const { room, f } = setup();
    const map = room.scene.maps[0]!;
    const caster = map.tokens[0]!;
    const target = map.tokens[1]!;
    const def = automationForSpell(findSpell("XPHB:Otto's Irresistible Dance")!, { castLevel: 6 });

    const fail = vi.spyOn(Math, 'random').mockReturnValue(0);
    executeAutomation(f.ctx, { caster, mapId: 'm1', def, targets: [target], stats, author: 'DM' });
    fail.mockRestore();
    const dance = target.effects.find((e) => e.sourceKey === def.key);
    expect(dance?.conditions).toBeUndefined();
    expect(dance?.escape).toMatchObject({ kind: 'save', ability: 'wis', label: 'Собраться' });
    expect(f.ctx.manager.tokenSpeed(room, target)).toBe(0);

    const pass = vi.spyOn(Math, 'random').mockReturnValue(0.999);
    executeAutomation(f.ctx, { caster, mapId: 'm1', def, targets: [target], stats, author: 'DM' });
    pass.mockRestore();
    const short = target.effects.find((e) => e.sourceKey === def.key);
    expect(short?.duration).toEqual({ type: 'endOfTurn', of: 'target' });
    expect(f.ctx.manager.tokenSpeed(room, target)).toBe(0);
  });
});
