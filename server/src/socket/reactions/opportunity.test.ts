import { describe, expect, it, vi } from 'vitest';
import { bestiaryTokenFields, type CharacterSheet } from 'shared';
import bestiaryData from 'shared/bestiaryData';
import { makeCombatRoom, makeResources, makeToken } from '../../test/fixtures';
import { makeConnCtx } from '../../test/ctx';
import { beginShape } from '../../room/shape';
import { pendingOffers, registerReactionHandlers } from './queue';
import { executeOpportunityAttack, opportunityAttack, opportunitySources, triggerOpportunityAttacks } from './opportunity';

const WOLF = bestiaryData.entries.find((e) => e.key === 'XMM:Wolf')!;
const BITE = WOLF.actions.find((a) => a.ability?.attack?.rangeType === 'melee')!;
const SPIRIT = bestiaryData.entries.find((e) => e.key === 'XPHB:Undead Spirit')!;
const SPIRIT_MELEE = SPIRIT.actions.filter((a) => a.ability?.attack?.rangeType === 'melee');

function setup() {
  const token = makeToken('t1', {
    libraryItemId: 'lib1',
    name: 'Друид',
    x: 100,
    y: 100,
    faction: 'ally',
    isPlayerToken: true,
  });
  const room = makeCombatRoom([token], { p1: 'lib1' });
  room.sheets['p1'] = {
    name: 'Друид',
    abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 16, cha: 10 },
    proficiencyBonus: '3',
    saves: {},
    skills: {},
    attacks: [{ name: 'Скимитар', hit: 'd20+5', damage: '1d6+3', rangeType: 'melee', rangeNormal: 5, rangeLong: 0 }],
    classes: [{ className: 'druid', level: 6 }],
    spells: [],
    wildShape: { known: ['XMM:Wolf'] },
    hpMax: '20',
    ac: '12',
    speed: 30,
    senses: [],
    damageDefenses: [],
  } as CharacterSheet;
  const f = makeConnCtx(room, { dm: true, all: true });
  return { room, token, f };
}

describe('атака по возможности в форме', () => {
  it('без формы — своё оружие', () => {
    const { room, token, f } = setup();
    expect(opportunityAttack(f.ctx, room, token)?.name).toBe('Скимитар');
  });

  it('в Wild Shape — melee-способность зверя вместо своего оружия', () => {
    const { room, token, f } = setup();
    beginShape(token, { entry: WOLF, kind: 'wildShape', tempHp: 6 });
    expect(opportunityAttack(f.ctx, room, token)?.name).toBe(BITE.name);
    expect(BITE.name).not.toBe('Скимитар');
  });

  it('в Polymorph — тоже способность зверя', () => {
    const { room, token, f } = setup();
    beginShape(token, { entry: WOLF, kind: 'polymorph', tempHp: 11, sourceTokenId: 'caster' });
    expect(opportunityAttack(f.ctx, room, token)?.name).toBe(BITE.name);
  });

  it('монстр без листа: melee-способность статблока доступна для OA', () => {
    const monster = makeToken('t9', { name: 'Wolf', x: 100, y: 100 });
    monster.statblock = bestiaryTokenFields(WOLF).statblock;
    const room = makeCombatRoom([monster]);
    const f = makeConnCtx(room, { dm: true, all: true });
    expect(opportunityAttack(f.ctx, room, monster)?.name).toBe(BITE.name);
  });

  it('способности призванного существа скейлятся кругом (плейсхолдеров нет)', () => {
    const fields = bestiaryTokenFields(SPIRIT, { slotLevel: 4, spellAttackBonus: 7 });
    const dice = (fields.statblock?.actions ?? [])
      .flatMap((a) => [a.ability?.damage?.dice, a.ability?.attack?.damage])
      .filter((d): d is string => !!d);
    expect(dice.length).toBeGreaterThan(0);
    expect(dice.every((d) => !d.includes('summonSpellLevel'))).toBe(true);
  });

  it('executeOpportunityAttack в форме бьёт способностью зверя (имя в чате)', () => {
    const { room, token, f } = setup();
    const mover = makeToken('t2', {
      name: 'Гоблин',
      x: 150,
      y: 100,
      ac: '12',
      hpMax: '10',
      hpCurrent: 10,
      faction: 'enemy',
    });
    room.scene.maps[0]!.tokens.push(mover);
    beginShape(token, { entry: WOLF, kind: 'wildShape', tempHp: 6 });

    executeOpportunityAttack(f.ctx, room, 'm1', token, mover);

    expect(room.chat.some((m) => JSON.stringify(m).includes(BITE.name))).toBe(true);
    expect(room.scene.maps[0]!.combat.turns['e1']!.reactionUsed).toBe(true);
  });

  it('несколько melee-вариантов: окно даёт выбор, бьёт выбранной способностью', () => {
    expect(SPIRIT_MELEE).toHaveLength(2);
    const reactor = makeToken('t1', {
      libraryItemId: 'lib1',
      name: 'Дух',
      x: 150,
      y: 100,
      faction: 'ally',
      statblock: bestiaryTokenFields(SPIRIT).statblock,
    });
    const mover = makeToken('t2', { name: 'Гоблин', x: 100, y: 100, faction: 'enemy' });
    const room = makeCombatRoom([reactor, mover], { p1: 'lib1' });
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    const f = makeConnCtx(room, { dm: true, all: true });

    expect(opportunitySources(f.ctx, room, reactor).map((s) => s.name)).toEqual(SPIRIT_MELEE.map((a) => a.name));

    triggerOpportunityAttacks(f.ctx, room, 'm1', mover, [
      { x: 100, y: 100 },
      { x: 400, y: 100 },
    ]);

    const offers = pendingOffers(room.code);
    expect(offers).toHaveLength(1);
    expect(offers[0]!.options.map((o) => o.id)).toEqual(['opportunity:0', 'opportunity:1']);
    expect(offers[0]!.options[1]!.name).toContain(SPIRIT_MELEE[1]!.name);

    const f2 = makeConnCtx(room, { playerId: 'p1' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', { id: offers[0]!.id, optionId: 'opportunity:1' });

    expect(room.chat.some((m) => JSON.stringify(m).includes(SPIRIT_MELEE[1]!.name))).toBe(true);
    expect(room.chat.some((m) => JSON.stringify(m).includes(SPIRIT_MELEE[0]!.name))).toBe(false);
    // Окно закрылось: ошибка применения не должна его подвешивать.
    expect(pendingOffers(room.code)).toHaveLength(0);
  });

  it('сторона OA — фракция: союзный питомец и нейтрал не провоцируют', () => {
    const { room, f } = setup();
    const allyPet = makeToken('t2', { name: 'Волк-питомец', x: 150, y: 100, faction: 'ally', isPlayerToken: false });
    const neutral = makeToken('t3', { name: 'Горожанин', x: 100, y: 150, faction: 'neutral' });
    room.scene.maps[0]!.tokens.push(allyPet, neutral);

    triggerOpportunityAttacks(f.ctx, room, 'm1', allyPet, [
      { x: 150, y: 100 },
      { x: 400, y: 100 },
    ]);
    triggerOpportunityAttacks(f.ctx, room, 'm1', neutral, [
      { x: 100, y: 150 },
      { x: 400, y: 150 },
    ]);

    expect(pendingOffers(room.code)).toHaveLength(0);
    expect(room.chat.some((m) => m.kind === 'text' && m.system?.code === 'reactions.opportunity')).toBe(false);
  });
});

describe('видимость для атаки по возможности', () => {
  const invisible = { key: 'invisible' as const, name: 'Невидим', rounds: null };
  const pathAway = (mover: { x: number; y: number }) => [
    { x: mover.x, y: mover.y },
    { x: mover.x + 300, y: mover.y },
  ];

  it('невидимый не провоцирует OA, пока реактор его не видит', () => {
    const { room, f } = setup();
    const mover = makeToken('t2', {
      name: 'Гоблин',
      x: 150,
      y: 100,
      ac: '12',
      hpMax: '10',
      hpCurrent: 10,
      faction: 'enemy',
      conditions: [invisible],
    });
    room.scene.maps[0]!.tokens.push(mover);

    triggerOpportunityAttacks(f.ctx, room, 'm1', mover, pathAway(mover));

    expect(pendingOffers(room.code)).toHaveLength(0);
    expect(room.scene.maps[0]!.combat.turns['e1']!.reactionUsed).toBe(false);
    expect(room.chat.some((m) => m.kind === 'text' && m.system?.code === 'reactions.opportunity')).toBe(false);
  });

  it('с See Invisibility реактор бьёт невидимого', () => {
    const { room, token, f } = setup();
    token.effects = [
      { id: 'see', name: 'See Invisibility', duration: { type: 'permanent' }, modifiers: [], seesInvisible: true },
    ];
    const mover = makeToken('t2', {
      name: 'Гоблин',
      x: 150,
      y: 100,
      ac: '12',
      hpMax: '10',
      hpCurrent: 10,
      faction: 'enemy',
      conditions: [invisible],
    });
    room.scene.maps[0]!.tokens.push(mover);

    triggerOpportunityAttacks(f.ctx, room, 'm1', mover, pathAway(mover));

    expect(room.scene.maps[0]!.combat.turns['e1']!.reactionUsed).toBe(true);
    expect(room.chat.some((m) => m.kind === 'text' && m.system?.code === 'reactions.opportunity')).toBe(true);
  });

  it('слепой реактор не провоцируется, зрячий — да', () => {
    const { room, token, f } = setup();
    const mover = makeToken('t2', { name: 'Гоблин', x: 150, y: 100, ac: '12', hpMax: '10', hpCurrent: 10, faction: 'enemy' });
    room.scene.maps[0]!.tokens.push(mover);
    token.conditions = [{ key: 'blinded', name: 'Ослеплён', rounds: null }];

    triggerOpportunityAttacks(f.ctx, room, 'm1', mover, pathAway(mover));

    expect(room.scene.maps[0]!.combat.turns['e1']!.reactionUsed).toBe(false);

    token.conditions = [];
    triggerOpportunityAttacks(f.ctx, room, 'm1', mover, pathAway(mover));
    expect(room.scene.maps[0]!.combat.turns['e1']!.reactionUsed).toBe(true);
  });

  it('стена между реактором и уходящим блокирует OA', () => {
    const { room, f } = setup();
    const mover = makeToken('t2', { name: 'Гоблин', x: 150, y: 100, ac: '12', hpMax: '10', hpCurrent: 10, faction: 'enemy' });
    room.scene.maps[0]!.tokens.push(mover);
    room.scene.maps[0]!.walls = [{ id: 'w1', x1: 125, y1: 0, x2: 125, y2: 200, kind: 'wall', open: false }];

    triggerOpportunityAttacks(f.ctx, room, 'm1', mover, pathAway(mover));

    expect(room.scene.maps[0]!.combat.turns['e1']!.reactionUsed).toBe(false);
  });
});

describe('вложенные окна: реакции на бросок OA', () => {
  const sword = (name: string) => ({
    name,
    hit: 'd20+5',
    damage: '1d6+3',
    rangeType: 'melee' as const,
    rangeNormal: 5,
    rangeLong: 0,
    damageType: 'slashing',
  });

  /** Бойцы (2 атаки — окно с выбором) + военный клирик рядом; двигатель уходит. */
  function world(moverHp: number) {
    const t1 = makeToken('t1', {
      name: 'Боец1',
      x: 100,
      y: 100,
      faction: 'ally',
      isPlayerToken: true,
      libraryItemId: 'lib1',
      attacks: [sword('Скимитар'), sword('Кинжал')],
    });
    const t2 = makeToken('t2', {
      name: 'Боец2',
      x: 150,
      y: 150,
      faction: 'ally',
      isPlayerToken: true,
      libraryItemId: 'lib2',
      attacks: [sword('Скимитар'), sword('Кинжал')],
    });
    const cleric = makeToken('t3', {
      name: 'Клирик',
      x: 200,
      y: 100,
      faction: 'ally',
      isPlayerToken: true,
      libraryItemId: 'lib3',
    });
    const mover = makeToken('t4', {
      name: 'Гоблин',
      x: 150,
      y: 100,
      faction: 'enemy',
      ac: '16',
      hpMax: String(moverHp),
      hpCurrent: moverHp,
    });
    const room = makeCombatRoom([t1, t2, cleric, mover], { p1: 'lib1', p2: 'lib2', p3: 'lib3' });
    room.scene.maps[0]!.combat.entries.push(
      { id: 'e1', tokenId: 't1', name: 'Боец1', imageUrl: '', initiative: 30, bonus: '' },
      { id: 'e2', tokenId: 't2', name: 'Боец2', imageUrl: '', initiative: 20, bonus: '' },
      { id: 'e3', tokenId: 't3', name: 'Клирик', imageUrl: '', initiative: 10, bonus: '' }
    );
    room.sheets.p3 = {
      name: 'Клирик',
      senses: [],
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 },
      proficiencyBonus: '3',
      saves: {},
      skills: {},
      attacks: [],
      classes: [{ className: 'cleric', level: 6, subclass: 'war' }],
      spells: [],
      hpMax: '30',
      ac: '18',
      speed: 30,
      damageDefenses: [],
    } as CharacterSheet;
    room.resources.p3 = makeResources({
      resources: [
        { id: 'cd1', key: 'cleric:channelDivinity', name: 'Проведение', current: 1, max: 1, reset: 'short' },
      ],
    });
    const f = makeConnCtx(room, { dm: true, all: true });
    return { room, f, mover };
  }

  const pathAway = (mover: { x: number; y: number }) => [
    { x: mover.x, y: mover.y },
    { x: mover.x + 300, y: mover.y },
  ];

  it('промах OA открывает дочернее окно, Guided Strike решает до вопроса второму реактору', () => {
    const { room, f, mover } = world(20);
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0); // d20 = 1 — промах
    try {
      triggerOpportunityAttacks(f.ctx, room, 'm1', mover, pathAway(mover));

      const first = pendingOffers(room.code)[0]!;
      expect(first.tokenName).toBe('Боец1');
      f.invoke('reaction:respond', { id: first.id, optionId: 'opportunity:0' });

      // Дочернее окно промаха: спрашивают клирика, а не второго бойца.
      const miss = pendingOffers(room.code)[0]!;
      expect(miss.trigger).toBe('attackMiss');
      expect(miss.tokenName).toBe('Клирик');
      expect(miss.options.map((o) => o.id)).toContain('feature:cleric.war:guidedStrike');

      f.invoke('reaction:respond', { id: miss.id, optionId: 'feature:cleric.war:guidedStrike' });

      // +10 превратил промах в попадание: урон прошёл, и только после этого — второй реактор.
      expect(mover.hpCurrent).toBeLessThan(20);
      expect(room.resources.p3!.resources[0]!.current).toBe(0);
      const second = pendingOffers(room.code)[0]!;
      expect(second.tokenName).toBe('Боец2');
      while (pendingOffers(room.code).length) {
        f.invoke('reaction:respond', { id: pendingOffers(room.code)[0]!.id, optionId: null });
      }
      expect(pendingOffers(room.code)).toHaveLength(0);
    } finally {
      rand.mockRestore();
    }
  });

  it('поверженный двигатель в дочернем уроне — оставшихся не спрашиваем', () => {
    const { room, f, mover } = world(1);
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.99); // попадание и смертельный урон
    try {
      triggerOpportunityAttacks(f.ctx, room, 'm1', mover, pathAway(mover));

      const first = pendingOffers(room.code)[0]!;
      expect(first.tokenName).toBe('Боец1');
      f.invoke('reaction:respond', { id: first.id, optionId: 'opportunity:0' });

      expect(mover.hpCurrent).toBeLessThanOrEqual(0);
      expect(pendingOffers(room.code)).toHaveLength(0);
      expect(room.scene.maps[0]!.combat.turns['e2']!.reactionUsed).toBe(false);
    } finally {
      rand.mockRestore();
    }
  });
});
