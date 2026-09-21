import { describe, expect, it } from 'vitest';
import { bestiaryTokenFields, type CharacterSheet } from 'shared';
import bestiaryData from 'shared/bestiaryData';
import { makeCombatRoom, makeResources, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { findSpell } from '../spells';
import { beginShape, formOf, shapeAttacks, shapeName, shapeSpeed, shapeStatblock } from '../room/shape';
import { applyEffectTo } from './effectsApply';
import { applyPolymorphForm, spellsInShapeAllowed } from './forms';
import { spellStatsFor } from './spellStats';
import { validateSpellCast } from './spellResolve';

const KNOWN = ['XMM:Wolf', 'XMM:Crocodile', 'XMM:Polar Bear', 'XMM:Owl'];
const WOLF_ENTRY = bestiaryData.entries.find((e) => e.key === 'XMM:Wolf')!;

function sheetWith(level: number, known: string[] = KNOWN, moon = false): CharacterSheet {
  return {
    name: 'Druid',
    abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 16, cha: 10 },
    proficiencyBonus: '3',
    saves: {},
    skills: {},
    attacks: [],
    classes: [{ className: 'druid', level, ...(moon ? { subclass: 'moon' } : {}) }],
    spells: [{ key: 'XPHB:Cure Wounds', className: 'druid' }],
    hpMax: '20',
    ac: '12',
    speed: 30,
    senses: [],
    damageDefenses: [],
    wildShape: { known },
  } as CharacterSheet;
}

function setup(level = 6, opts: { moon?: boolean; uses?: number } = {}) {
  const token = makeToken('t1', {
    libraryItemId: 'lib1',
    name: 'Druid',
    x: 100,
    y: 100,
    ac: '12',
    hpMax: '20',
    faction: 'ally',
  });
  const room = makeCombatRoom([token], { p1: 'lib1' });
  const map = room.scene.maps[0]!;
  map.width = 1000;
  map.height = 1000;
  room.sheets['p1'] = sheetWith(level, KNOWN, opts.moon === true);
  room.resources['p1'] = makeResources({
    hp: { current: 20, max: 20, temp: 0, deathSuccesses: 0, deathFailures: 0 },
    resources: [
      {
        id: 'r1',
        key: 'druid:wildShape',
        name: 'Дикий облик',
        current: opts.uses ?? 3,
        max: 3,
        reset: 'short',
        auto: true,
      },
    ],
  });
  const f = makeConnCtx(room, { playerId: 'p1', all: true });
  const errors = () => f.selfEvents('chat:error').map((e) => (e.payload as { code: string }).code);
  return { room, map, token, f, errors };
}

describe('формы: Wild Shape', () => {
  it('принятие формы: ресурс, статы резолвера, пул = уровень, свои поля не тронуты', () => {
    const { room, token, f, errors } = setup(6);
    f.invoke('token:shape', { mapId: 'm1', id: 't1', formKey: 'XMM:Wolf' });
    expect(errors()).toEqual([]);
    const use = room.resources['p1']!.resources[0]!;
    expect(use.current).toBe(2);
    expect(token.shape).toMatchObject({ key: 'XMM:Wolf', kind: 'wildShape', hp: 6, maxHp: 6 });
    // Свои поля токена не подменяются: статы отдаёт резолвер.
    expect(token.name).toBe('Druid');
    expect(token.ac).toBe('12');
    expect(shapeName(token)).toBe('Wolf');
    expect(shapeSpeed(token)).toBe(40);
    expect(formOf(token)?.ac).toBe(12);
    expect(shapeAttacks(token).length + (shapeStatblock(token)?.actions?.length ?? 0)).toBeGreaterThan(0);
    // Портрет в бою — зверя (как и имя).
    expect(room.scene.maps[0]!.combat.entries[0]!.imageUrl).toBe(formOf(token)?.fields.imageUrl);
  });

  it('неизвестная форма и полёт до 8 уровня отклоняются', () => {
    const { token, f, errors } = setup(6);
    f.invoke('token:shape', { mapId: 'm1', id: 't1', formKey: 'XMM:Polar Bear' });
    f.invoke('token:shape', { mapId: 'm1', id: 't1', formKey: 'XMM:Owl' });
    expect(errors()).toEqual(['shapeNoForm', 'shapeNoForm']);
    expect(token.shape).toBeUndefined();
  });

  it('без использований формы не будет', () => {
    const { token, f, errors } = setup(6, { uses: 0 });
    f.invoke('token:shape', { mapId: 'm1', id: 't1', formKey: 'XMM:Wolf' });
    expect(errors()).toEqual(['shapeNoUse']);
    expect(token.shape).toBeUndefined();
  });

  it('стена в подошве: превращение отклоняется (shapeNoSpace)', () => {
    const { map, token, f, errors } = setup(6);
    map.walls = [{ id: 'w1', x1: 100, y1: 120, x2: 160, y2: 120, kind: 'wall' }] as typeof map.walls;
    f.invoke('token:shape', { mapId: 'm1', id: 't1', formKey: 'XMM:Wolf' });
    expect(errors()).toEqual(['shapeNoSpace']);
    expect(token.shape).toBeUndefined();
  });

  it('не друид: дикий облик недоступен', () => {
    const { room, f, errors } = setup(6);
    room.sheets['p1'] = { ...sheetWith(6), classes: [{ className: 'wizard', level: 6 }] } as CharacterSheet;
    f.invoke('token:shape', { mapId: 'm1', id: 't1', formKey: 'XMM:Wolf' });
    expect(errors()).toEqual(['shapeNoAbility']);
  });

  it('возврат восстанавливает свои поля, пул сгорает', () => {
    const { map, token, f } = setup(6);
    f.invoke('token:shape', { mapId: 'm1', id: 't1', formKey: 'XMM:Wolf' });
    map.combat.turns['e1']!.bonusActionUsed = false;
    f.invoke('token:revert', { mapId: 'm1', id: 't1' });
    expect(token.shape).toBeUndefined();
    expect(token.name).toBe('Druid');
    expect(token.ac).toBe('12');
    expect(token.hpMax).toBe('20');
    expect(map.combat.entries[0]!.imageUrl).toBe(token.imageUrl);
  });

  it('досрочный выход из Wild Shape — бонусное действие', () => {
    const { map, token, f, errors } = setup(6);
    f.invoke('token:shape', { mapId: 'm1', id: 't1', formKey: 'XMM:Wolf' });
    map.combat.turns['e1']!.bonusActionUsed = false;
    f.invoke('token:revert', { mapId: 'm1', id: 't1' });
    expect(errors()).toEqual([]);
    expect(token.shape).toBeUndefined();
    expect(map.combat.turns['e1']!.bonusActionUsed).toBe(true);
  });

  it('повторный Wild Shape меняет форму за новый заряд', () => {
    const { map, room, token, f, errors } = setup(6);
    f.invoke('token:shape', { mapId: 'm1', id: 't1', formKey: 'XMM:Wolf' });
    map.combat.turns['e1']!.bonusActionUsed = false; // новый ход
    f.invoke('token:shape', { mapId: 'm1', id: 't1', formKey: 'XMM:Crocodile' });
    expect(errors()).toEqual([]);
    expect(token.shape?.key).toBe('XMM:Crocodile');
    expect(room.resources['p1']!.resources[0]!.current).toBe(1);
  });

  it('в чужой ход форма не меняется и не сбрасывается', () => {
    const { map, token, f, errors } = setup(6);
    map.combat.entries[0]!.tokenId = 't9'; // ход другого бойца
    const entry = bestiaryData.entries.find((e) => e.key === 'XMM:Wolf')!;
    beginShape(token, { entry, kind: 'wildShape', tempHp: 6 });
    f.invoke('token:shape', { mapId: 'm1', id: 't1', formKey: 'XMM:Crocodile' });
    f.invoke('token:revert', { mapId: 'm1', id: 't1' });
    expect(errors()).toEqual(['notYourTurn', 'notYourTurn']);
    expect(token.shape?.key).toBe('XMM:Wolf');
  });

  it('из Polymorph в Wild Shape нельзя (shapePolymorph)', () => {
    const { token, f, errors } = setup(6);
    const entry = bestiaryData.entries.find((e) => e.key === 'XMM:Wolf')!;
    beginShape(token, { entry, kind: 'polymorph', tempHp: 11, sourceTokenId: 'caster' });
    f.invoke('token:shape', { mapId: 'm1', id: 't1', formKey: 'XMM:Crocodile' });
    expect(errors()).toEqual(['shapePolymorph']);
    expect(token.shape?.kind).toBe('polymorph');
  });

  it('в форме патч описания и клеток не трогает свои поля', () => {
    const { room, token, f } = setup(6);
    token.description = 'своё описание';
    f.invoke('token:shape', { mapId: 'm1', id: 't1', formKey: 'XMM:Wolf' });

    f.invoke('token:update', { mapId: 'm1', id: 't1', patch: { description: 'волчье', cells: 2 } });

    expect(token.description).toBe('своё описание');
    expect(token.cells).toBe(1);
    expect(room.library).toHaveLength(0); // шаблоны библиотеки не участвуют
  });

  it('недееспособность с панели условий (token:update) снимает форму', () => {
    const { token, f } = setup(6);
    const entry = bestiaryData.entries.find((e) => e.key === 'XMM:Wolf')!;
    beginShape(token, { entry, kind: 'polymorph', tempHp: 11, sourceTokenId: 'caster' });
    f.invoke('token:update', {
      mapId: 'm1',
      id: 't1',
      patch: { conditions: [{ key: 'stunned', name: 'Ошеломлён' }] },
    });
    expect(token.shape).toBeUndefined();
  });

  it('Polymorph вручную не снять (только DM)', () => {
    const { room, token, f, errors } = setup(6);
    const entry = bestiaryData.entries.find((e) => e.key === 'XMM:Wolf')!;
    beginShape(token, { entry, kind: 'polymorph', tempHp: 11, sourceTokenId: 'caster', spellKey: 'XPHB:Polymorph' });
    f.invoke('token:revert', { mapId: 'm1', id: 't1' });
    expect(errors()).toEqual(['shapeNoRevert']);
    expect(token.shape).toBeDefined();
    const dm = makeConnCtx(room, { dm: true, all: true });
    dm.invoke('token:revert', { mapId: 'm1', id: 't1' });
    expect(token.shape).toBeUndefined();
  });
});

describe('формы: круг луны', () => {
  it('CR = ⌊уровень/3⌋, пул ×3, AC 13+WIS', () => {
    const { token, f, errors } = setup(6, { moon: true });
    f.invoke('token:shape', { mapId: 'm1', id: 't1', formKey: 'XMM:Polar Bear' });
    expect(errors()).toEqual([]);
    expect(token.shape).toMatchObject({ hp: 18, maxHp: 18 });
    // Мудрость 16: 13 + 3 = 16 против AC зверя 12.
    expect(formOf(token)?.ac).toBe(16);
    expect(shapeName(token)).toBe('Polar Bear');
  });
});

describe('формы: урон и возврат', () => {
  it('Wild Shape: урон в пул; при нуле форма не спадает, урон идёт в свои HP', () => {
    const { room, token, f } = setup(6);
    f.invoke('token:shape', { mapId: 'm1', id: 't1', formKey: 'XMM:Wolf' });
    f.ctx.applyHp(room, 'm1', token, -4);
    expect(token.shape?.hp).toBe(2);
    expect(room.resources['p1']!.hp.current).toBe(20);
    f.ctx.applyHp(room, 'm1', token, -5);
    expect(token.shape?.hp).toBe(0);
    expect(shapeName(token)).toBe('Wolf');
    expect(room.resources['p1']!.hp.current).toBe(17);
    f.ctx.applyHp(room, 'm1', token, -7);
    expect(token.shape).toBeDefined();
    expect(room.resources['p1']!.hp.current).toBe(10);
  });

  it('temp HP не складываются: пул формы берёт максимум, старые обнуляются', () => {
    const { room, token, f } = setup(6);
    room.resources['p1']!.hp.temp = 10;
    f.invoke('token:shape', { mapId: 'm1', id: 't1', formKey: 'XMM:Wolf' });
    expect(token.shape?.maxHp).toBe(10); // max(уровень 6, temp 10)
    expect(room.resources['p1']!.hp.temp).toBe(0);
  });

  it('Polymorph: старые temp HP цели заменяются пулом зверя', () => {
    const { room, token, f } = setup(6);
    const target = makeToken('t2', { name: 'Огр', x: 150, y: 100, hpTemp: 3, hpMax: '30', hpCurrent: 30, ac: '11' });
    room.scene.maps[0]!.tokens.push(target);

    expect(applyPolymorphForm(f.ctx, room, 'm1', token, target, 'XMM:Wolf', 'XPHB:Polymorph')).toBe(true);
    expect(target.shape?.maxHp).toBe(11); // max(HP волка 11, temp 3)
    expect(target.hpTemp).toBe(0);
  });

  it('Polymorph: обнуление пула возвращает форму, избыток идёт в свои HP', () => {
    const { room, token, f } = setup(6);
    const entry = bestiaryData.entries.find((e) => e.key === 'XMM:Wolf')!;
    beginShape(token, { entry, kind: 'polymorph', tempHp: 4 });
    expect(token.shape).toMatchObject({ kind: 'polymorph', hp: 4, maxHp: 4 });
    f.ctx.applyHp(room, 'm1', token, -10);
    expect(token.shape).toBeUndefined();
    expect(token.name).toBe('Druid');
    expect(room.resources['p1']!.hp.current).toBe(14);
  });

  it('недееспособность снимает форму', () => {
    const { room, map, token, f } = setup(6);
    f.invoke('token:shape', { mapId: 'm1', id: 't1', formKey: 'XMM:Wolf' });
    applyEffectTo(f.ctx, room, {
      sourceKey: 'test:stun',
      sourceId: 'src',
      mapId: map.id,
      target: token,
      effectDef: { name: 'Stun', duration: { type: 'permanent' }, modifiers: [], conditions: ['stunned'] },
    });
    expect(token.shape).toBeUndefined();
    expect(token.name).toBe('Druid');
  });
});

describe('формы: каст', () => {
  it('в форме каст запрещён, Beast Spells (18 ур.) разрешает', () => {
    const { room, token, f, errors } = setup(6);
    f.invoke('token:shape', { mapId: 'm1', id: 't1', formKey: 'XMM:Wolf' });
    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Cure Wounds' });
    expect(errors()).toEqual(['shapeInForm']);
    expect(spellsInShapeAllowed(room, token)).toBe(false);
    room.sheets['p1'] = sheetWith(18);
    expect(spellsInShapeAllowed(room, token)).toBe(true);
  });
});

describe('формы: Polymorph — валидация до списания', () => {
  it('без цели отклоняется (spellNoTarget)', () => {    const { room, token } = setup(6);
    const invalid = validateSpellCast(room, {
      caster: token,
      mapId: 'm1',
      spell: findSpell('XPHB:Polymorph')!,
      castLevel: 4,
      characterLevel: 6,
      stats: spellStatsFor(room, token),
      targets: [],
      summonKey: 'XMM:Wolf',
      author: 'A',
    });
    expect(invalid).toEqual({ code: 'spellNoTarget' });
  });

  it('CR цели-монстра ограничивает форму', () => {
    const { room, map, token } = setup(6);
    const monster = makeToken('t2', {
      name: 'Волк',
      x: 150,
      y: 100,
      hpMax: '11',
      hpCurrent: 11,
      ac: '12',
      statblock: bestiaryTokenFields(WOLF_ENTRY).statblock,
    });
    map.tokens.push(monster);
    const base = {
      caster: token,
      mapId: 'm1',
      spell: findSpell('XPHB:Polymorph')!,
      castLevel: 4,
      characterLevel: 6,
      stats: spellStatsFor(room, token),
      targets: [monster],
      author: 'A',
    };
    expect(validateSpellCast(room, { ...base, summonKey: 'XMM:Polar Bear' })).toEqual({
      code: 'shapeCrTooHigh',
      params: { max: 0.25 },
    });
    expect(validateSpellCast(room, { ...base, summonKey: 'XMM:Wolf' })).toBeUndefined();
  });

  it('нет места под форму: каст отклонён, ячейка и концентрация целы', () => {
    const { room, map, token, f } = setup(6);
    room.sheets['p1']!.spells = [{ key: 'XPHB:Polymorph', className: 'druid' }] as CharacterSheet['spells'];
    room.resources['p1']!.spellSlots = [{ level: 4, current: 1, max: 1 }];
    f.ctx.manager.applyEffect(room, token, {
      id: 'conc1',
      name: 'Старая концентрация',
      sourceKey: 'test:old',
      sourceId: token.id,
      concentration: true,
      duration: { type: 'concentration' },
      modifiers: [],
    });
    const target = makeToken('t2', { name: 'Dummy', x: 150, y: 100, hpMax: '30', hpCurrent: 30, ac: '10' });
    map.tokens.push(target);
    map.walls = [{ id: 'w1', x1: 100, y1: 120, x2: 160, y2: 120, kind: 'wall' }] as typeof map.walls;

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Polymorph',
      slotLevel: 4,
      targetIds: [target.id],
      summonKey: 'XMM:Wolf',
    });

    expect(f.selfEvents('chat:error')[0]?.payload).toEqual({ code: 'shapeNoSpace' });
    expect(room.resources['p1']!.spellSlots[0]!.current).toBe(1);
    expect(token.effects.some((e) => e.concentration)).toBe(true);
    expect(map.combat.turns['e1']!.actionUsed).toBe(false);
  });
});

describe('формы: Polymorph', () => {  it('форма по CR цели, пул = HP зверя, источник — кастер', () => {
    const { room, map, token, f, errors } = setup(6);
    const caster = token;
    const target = makeToken('t2', { name: 'Goblin', x: 300, y: 300, libraryItemId: 'lib2' });
    map.tokens.push(target);
    room.sheets['p2'] = { ...sheetWith(6), classes: [{ className: 'fighter', level: 4 }] } as CharacterSheet;
    room.controllers['p2'] = 'lib2';
    expect(applyPolymorphForm(f.ctx, room, 'm1', caster, target, 'XMM:Wolf', 'XPHB:Polymorph')).toBe(true);
    expect(errors()).toEqual([]);
    expect(target.shape).toMatchObject({
      key: 'XMM:Wolf',
      kind: 'polymorph',
      hp: 11,
      maxHp: 11,
      sourceTokenId: 't1',
      spellKey: 'XPHB:Polymorph',
    });
    // CR 2 выше уровня цели (4 → CR 1 не выше 4; Polar Bear CR 2 тоже можно: CR ≤ уровня).
    expect(applyPolymorphForm(f.ctx, room, 'm1', caster, target, 'XMM:Polar Bear', 'XPHB:Polymorph')).toBe(true);
    expect(target.shape?.key).toBe('XMM:Polar Bear');
  });

  it('валидация каста: без формы — shapeNoForm, CR выше уровня — shapeCrTooHigh', () => {
    const { room, token } = setup(6);
    const target = makeToken('t2', { name: 'Goblin', x: 300, y: 300, libraryItemId: 'lib2' });
    room.scene.maps[0]!.tokens.push(target);
    room.sheets['p2'] = { ...sheetWith(6), classes: [{ className: 'fighter', level: 1 }] } as CharacterSheet;
    room.controllers['p2'] = 'lib2';
    const base = {
      caster: token,
      mapId: 'm1',
      spell: findSpell('XPHB:Polymorph')!,
      castLevel: 4,
      characterLevel: 6,
      stats: { ability: 'wis' as const, mod: 3, dc: 14, attack: 5 },
      targets: [target],
      author: 'Druid',
    };
    expect(validateSpellCast(room, { ...base })?.code).toBe('shapeNoForm');
    expect(validateSpellCast(room, { ...base, summonKey: 'XMM:Polar Bear' })).toEqual({
      code: 'shapeCrTooHigh',
      params: { max: 1 },
    });
    expect(validateSpellCast(room, { ...base, summonKey: 'XMM:Wolf' })).toBeUndefined();
  });
});

describe('at-will инвокации', () => {  it('Armor of Shadows: Mage Armor только на себя', () => {
    const { room, map, token, f, errors } = setup(6);
    room.sheets['p1'] = {
      ...sheetWith(6),
      classes: [{ className: 'warlock', level: 5 }],
      invocations: ['XPHB:Armor of Shadows'],
    } as CharacterSheet;
    const other = makeToken('t2', { name: 'Ally', x: 300, y: 300 });
    map.tokens.push(other);
    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Mage Armor', targetIds: ['t2'] });
    expect(errors()).toEqual(['spellSelfOnly']);
    expect(token.effects.some((e) => e.sourceKey === 'XPHB:Mage Armor')).toBe(false);
    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Mage Armor' });
    expect(errors()).toEqual(['spellSelfOnly']);
    expect(token.effects.some((e) => e.sourceKey === 'XPHB:Mage Armor')).toBe(true);
  });
});

describe('формы: атаки способностями', () => {
  it('Wild Shape тратит бонусное действие', () => {
    const { room, map, f } = setup(6);
    f.invoke('token:shape', { mapId: 'm1', id: 't1', formKey: 'XMM:Wolf' });
    const turn = map.combat.turns['e1']!;
    expect(turn.bonusActionUsed).toBe(true);
    expect(room.resources['p1']!.resources[0]!.current).toBe(2);
  });

  it('размер токена синхронизируется: Large-форма и возврат сбрасывают w/h', () => {
    const { map, room, token, f } = setup(6);
    room.sheets['p1'] = sheetWith(6, [...KNOWN, 'XMM:Crocodile']) as CharacterSheet;
    f.invoke('token:shape', { mapId: 'm1', id: 't1', formKey: 'XMM:Crocodile' });
    expect(token.cells).toBe(2);
    expect(token.w).toBe(100);
    expect(token.h).toBe(100);
    // Большая форма: центр сохранён, левый край сдвинут влево.
    expect(token.x).toBe(100);
    f.ctx.applyHp(room, 'm1', token, -6);
    expect(token.shape?.hp).toBe(0); // при пуле 0 форма держится (XPHB)
    map.combat.turns['e1']!.bonusActionUsed = false;
    f.invoke('token:revert', { mapId: 'm1', id: 't1' });
    expect(token.shape).toBeUndefined();
    expect(token.cells).toBe(1);
    expect(token.w).toBe(50);
    expect(token.h).toBe(50);
    // Возврат: центр на месте, левый край снова на исходной позиции.
    expect(token.x).toBe(125);
  });

  it('RAM Giant Goat: бросок атаки в чат, без ошибок', () => {
    const { room, map, token, f, errors } = setup(6);
    room.sheets['p1'] = sheetWith(6, [...KNOWN, 'XMM:Giant Goat']) as CharacterSheet;
    f.invoke('token:shape', { mapId: 'm1', id: 't1', formKey: 'XMM:Giant Goat' });
    expect(errors()).toEqual([]);
    expect(shapeName(token)).toBe('Giant Goat');
    const target = makeToken('t2', { name: 'Dummy', x: 150, y: 100, hpMax: '30', ac: '10' });
    map.tokens.push(target);
    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: 'xmm:giant-goat:ram',
      targetIds: ['t2'],
      slot: 'action',
    });
    const rolls = f.emitted.filter(
      (e) => e.event === 'chat:message' && !!(e.payload as { roll?: unknown })?.roll
    );
    expect(errors()).toEqual([]);
    expect(rolls.length).toBeGreaterThan(0);
  });

  it('атака оружием формы (Ram козы): берём атаки формы, а не листа', () => {
    const { room, map, token, f, errors } = setup(6);
    room.sheets['p1'] = sheetWith(6, [...KNOWN, 'XMM:Goat']) as CharacterSheet;
    f.invoke('token:shape', { mapId: 'm1', id: 't1', formKey: 'XMM:Goat' });
    expect(errors()).toEqual([]);
    expect(shapeAttacks(token)[0]?.name).toBe('Ram');
    const target = makeToken('t2', { name: 'Dummy', x: 150, y: 100, hpMax: '30', ac: '10' });
    map.tokens.push(target);
    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: 'attack',
      targetIds: ['t2'],
      attackIndex: 0,
      slot: 'action',
    });
    const rolls = f.emitted.filter(
      (e) => e.event === 'chat:message' && !!(e.payload as { roll?: unknown })?.roll
    );
    expect(errors()).toEqual([]);
    expect(rolls.length).toBeGreaterThan(0);
  });
});

