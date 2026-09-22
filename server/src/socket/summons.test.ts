import { describe, expect, it } from 'vitest';
import { automationForSpell, tokenCells, type CharacterSheet, type SpellStats } from 'shared';
import { makeCombatRoom, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { findSpell } from '../spells';
import { executeAutomation } from './automation';
import { prepareWeaponAttack } from './attackResolve';
import { applyDamage } from './damage';
import { familiarCannotAttack } from './summons';
import { validateSpellCast, type SpellCastInput } from './spellResolve';

const stats: SpellStats = { ability: 'wis', mod: 3, dc: 14, attack: 5 };

function setup(opts: { pactChain?: boolean } = {}) {
  const caster = makeToken('t1', {
    libraryItemId: 'lib1',
    name: 'Druid',
    x: 100,
    y: 100,
    ac: '12',
    hpMax: '20',
    faction: 'ally',
  });
  const room = makeCombatRoom([caster], { p1: 'lib1' });
  const map = room.scene.maps[0]!;
  map.width = 1000;
  map.height = 1000;
  if (opts.pactChain) {
    room.sheets['p1'] = {
      name: 'Druid',
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
      proficiencyBonus: '2',
      saves: {},
      skills: {},
      attacks: [],
      classes: [{ className: 'warlock', level: 5 }],
      spells: [],
      hpMax: '20',
      ac: '12',
      speed: 30,
      senses: [],
      damageDefenses: [],
      invocations: ['XPHB:Pact of the Chain'],
    } as CharacterSheet;
  }
  const f = makeConnCtx(room, { dm: true, all: true });
  return { room, map, caster, f };
}

function cast(
  room: ReturnType<typeof setup>['room'],
  f: ReturnType<typeof setup>['f'],
  spellKey: string,
  castLevel: number,
  origin?: { x: number; y: number },
  summonKey?: string
) {
  const spell = findSpell(spellKey)!;
  executeAutomation(f.ctx, {
    caster: room.scene.maps[0]!.tokens[0]!,
    mapId: 'm1',
    def: automationForSpell(spell, { castLevel }),
    targets: [],
    stats,
    author: 'DM',
    origin: origin ?? null,
    ...(summonKey ? { summonKey } : {}),
  });
}

describe('призывы: серверный спавн', () => {
  it('Summon Fey: шаблон со скейлом круга, атакой кастера и владельцем-контролёром', () => {
    const { room, map, caster, f } = setup();
    cast(room, f, 'XPHB:Summon Fey', 3, { x: 200, y: 200 });
    expect(map.tokens).toHaveLength(2);
    const summon = map.tokens[1]!;
    expect(summon).toMatchObject({
      name: 'Fey Spirit',
      hpMax: '30',
      ac: '15',
      cells: 1,
      owner: 'Druid',
      ownerId: 'p1',
      isPlayerToken: false,
      faction: 'ally',
      summon: { casterTokenId: 't1', spellKey: 'XPHB:Summon Fey' },
    });
    expect(summon.attacks[0]).toMatchObject({ hit: '+5', damage: '2d6 + 3 + 3', damageType: 'force' });
    // Инициатива: запись сразу после кастера.
    expect(map.combat.entries).toHaveLength(2);
    expect(map.combat.entries[1]!.tokenId).toBe(summon.id);
    // Концентрация заякорена на кастере.
    expect(caster.effects.some((e) => e.concentration && e.sourceKey === 'XPHB:Summon Fey')).toBe(true);
    expect(map.combat.turns['e1']?.concentrationId).toBeTruthy();
  });

  it('скейл выше: HP/AC/урон растут с кругом, мультиатака = половина круга', () => {
    const { room, map, f } = setup();
    cast(room, f, 'XPHB:Summon Fey', 5, { x: 200, y: 200 });
    const summon = map.tokens[1]!;
    expect(summon.hpMax).toBe('50');
    expect(summon.ac).toBe('17');
    expect(summon.attacks[0]!.damage).toBe('2d6 + 3 + 5');
    expect(summon.statblock?.multiattack).toBe(2);
  });

  it('занятая точка: призыв встаёт на свободные клетки рядом', () => {
    const { room, map, f } = setup();
    const blocker = makeToken('b1', { x: 200, y: 200 });
    map.tokens.push(blocker);
    cast(room, f, 'XPHB:Summon Fey', 3, { x: 200, y: 200 });
    const summon = map.tokens[2]!;
    const free = new Set(tokenCells(summon, map.grid));
    for (const key of tokenCells(blocker, map.grid)) expect(free.has(key)).toBe(false);
  });

  it('Find Familiar: форма из каталога, своя инициатива, без концентрации', () => {
    const { room, map, caster, f } = setup();
    cast(room, f, 'XPHB:Find Familiar', 1, { x: 150, y: 150 }, 'XMM:Owl');
    const familiar = map.tokens[1]!;
    expect(familiar.name).toBe('Owl');
    expect(map.combat.entries.some((e) => e.tokenId === familiar.id)).toBe(true);
    expect(caster.effects.some((e) => e.concentration)).toBe(false);
    expect(map.combat.turns['e1']?.concentrationId).toBeFalsy();
  });

  it('Find Familiar без выбранной формы — спавна нет', () => {
    const { room, map, f } = setup();
    cast(room, f, 'XPHB:Find Familiar', 1, { x: 150, y: 150 });
    expect(map.tokens).toHaveLength(1);
  });

  it('Pact of the Chain: особая форма (Imp) проходит с инвокацией', () => {
    const { room, map, f } = setup({ pactChain: true });
    cast(room, f, 'XPHB:Find Familiar', 1, { x: 150, y: 150 }, 'XMM:Imp');
    expect(map.tokens[1]!.name).toBe('Imp');
    expect(map.tokens[1]!.summon?.pact).toBe(true);
  });

  it('без инвокации Pact of the Chain особая форма отклоняется', () => {
    const { room, map, f } = setup();
    cast(room, f, 'XPHB:Find Familiar', 1, { x: 150, y: 150 }, 'XMM:Imp');
    expect(map.tokens).toHaveLength(1);
  });

  it('Pact of the Chain: Find Familiar кастуется без ячейки через spell:cast', () => {
    const { room, map } = setup({ pactChain: true });
    const player = makeConnCtx(room, { playerId: 'p1', all: true });

    player.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Find Familiar',
      origin: { x: 150, y: 150 },
      summonKey: 'XMM:Owl',
    });

    expect(player.selfEvents('chat:error')).toHaveLength(0);
    expect(map.tokens).toHaveLength(2);
    expect(map.tokens[1]!.name).toBe('Owl');
  });

  it('вне боя: токен создаётся, инициатива не трогается', () => {
    const { room, map, f } = setup();
    map.combat.active = false;
    map.combat.entries = [];
    map.combat.turns = {};
    cast(room, f, 'XPHB:Summon Beast', 2, { x: 200, y: 200 });
    expect(map.tokens).toHaveLength(2);
    expect(map.tokens[1]!.name).toBe('Bestial Spirit');
    expect(map.combat.entries).toHaveLength(0);
  });

  it('сброс концентрации убирает призыв и запись в бою', () => {
    const { room, map, f } = setup();
    cast(room, f, 'XPHB:Summon Fey', 3, { x: 200, y: 200 });
    const summon = map.tokens[1]!;
    f.invoke('spell:endConcentration', { mapId: 'm1', tokenId: 't1' });
    expect(map.tokens).toHaveLength(1);
    expect(map.combat.entries).toHaveLength(1);
    expect(f.emitted.some((e) => e.event === 'token:remove' && (e.payload as { id?: string }).id === summon.id)).toBe(true);
  });

  it('призыв с 0 HP исчезает', () => {
    const { room, map, f } = setup();
    cast(room, f, 'XPHB:Summon Fey', 3, { x: 200, y: 200 });
    const summon = map.tokens[1]!;
    applyDamage(f.ctx, { target: summon, mapId: 'm1', amount: 999, kind: 'damage' });
    expect(map.tokens).toHaveLength(1);
  });

  it('удаление кастера убирает его призывы', () => {
    const { room, map, f } = setup();
    cast(room, f, 'XPHB:Summon Fey', 3, { x: 200, y: 200 });
    expect(map.tokens).toHaveLength(2);
    f.invoke('token:remove', { mapId: 'm1', id: 't1' });
    expect(map.tokens).toHaveLength(0);
  });

  it('повторный Find Familiar заменяет прежнего (не больше одного)', () => {
    const { room, map, f } = setup();
    cast(room, f, 'XPHB:Find Familiar', 1, { x: 150, y: 150 }, 'XMM:Owl');
    cast(room, f, 'XPHB:Find Familiar', 1, { x: 250, y: 250 }, 'XMM:Cat');
    expect(map.tokens).toHaveLength(2);
    expect(map.tokens[1]!.name).toBe('Cat');
  });

  it('каст Summon-* не снимает фамильяра, сброс концентрации — снимает только призыв', () => {
    const { room, map, f } = setup();
    cast(room, f, 'XPHB:Find Familiar', 1, { x: 150, y: 150 }, 'XMM:Owl');
    cast(room, f, 'XPHB:Summon Fey', 3, { x: 200, y: 200 });
    expect(map.tokens.map((t) => t.name)).toEqual(['Druid', 'Owl', 'Fey Spirit']);
    f.invoke('spell:endConcentration', { mapId: 'm1', tokenId: 't1' });
    expect(map.tokens.map((t) => t.name)).toEqual(['Druid', 'Owl']);
  });

  it('фамильяр без Pact of the Chain не атакует, особая форма — может', () => {
    const { room, map, caster, f } = setup({ pactChain: true });
    cast(room, f, 'XPHB:Find Familiar', 1, { x: 150, y: 150 }, 'XMM:Owl');
    const owl = map.tokens[1]!;
    expect(familiarCannotAttack(owl)).toBe(true);
    const blocked = prepareWeaponAttack(f.ctx, {
      attacker: owl,
      attackerMapId: 'm1',
      target: caster,
      targetMapId: 'm1',
      attack: { name: 'Bite', hit: '+4', damage: '1d6 + 2', rangeType: 'melee', rangeNormal: 5, rangeLong: 0 },
      author: 'DM',
    });
    expect(blocked.error?.code).toBe('familiarNoAttack');
    cast(room, f, 'XPHB:Find Familiar', 1, { x: 250, y: 250 }, 'XMM:Quasit');
    const quasit = map.tokens[1]!;
    expect(quasit.name).toBe('Quasit');
    expect(familiarCannotAttack(quasit)).toBe(false);
  });

  it('атака призыва: бонус шаблона превращается в бросок d20', () => {
    const { room, map, f } = setup();
    const target = makeToken('t2', { x: 225, y: 100, ac: '12', hpMax: '20' });
    map.tokens.push(target);
    cast(room, f, 'XPHB:Summon Fey', 3, { x: 175, y: 100 });
    const summon = map.tokens[2]!;
    const prep = prepareWeaponAttack(f.ctx, {
      attacker: summon,
      attackerMapId: 'm1',
      target,
      targetMapId: 'm1',
      attack: summon.attacks[0]!,
      author: 'DM',
    });
    expect(prep.prep?.attackExpr).toContain('d20+');
    expect(prep.prep?.attackExpr).not.toBe('+5');
  });

  it('валидация каста: точка обязательна, дистанция и путь проверяются', () => {
    const { room, map, caster } = setup();
    const base: SpellCastInput = {
      caster,
      mapId: 'm1',
      spell: findSpell('XPHB:Summon Fey')!,
      castLevel: 3,
      characterLevel: 3,
      stats,
      targets: [],
      author: 'DM',
    };
    expect(validateSpellCast(room, { ...base, origin: null })).toMatchObject({ code: 'noAreaPoint' });
    expect(validateSpellCast(room, { ...base, origin: { x: caster.x + 5000, y: caster.y } })).toMatchObject({
      code: 'outOfRange',
    });
    expect(validateSpellCast(room, { ...base, origin: { x: 200, y: 200 } })).toBeUndefined();
    // Формы фамильяра: без Pact of the Chain особая форма и пустая форма отклоняются до траты ячейки.
    const ff = findSpell('XPHB:Find Familiar')!;
    const familiar = { ...base, spell: ff, castLevel: 1, origin: { x: 200, y: 200 } };
    expect(validateSpellCast(room, { ...familiar, summonKey: 'XMM:Imp' })).toMatchObject({ code: 'summonNoPact' });
    expect(validateSpellCast(room, familiar)).toMatchObject({ code: 'summonNoForm' });
    // Обычная форма (осьминог — familiar, но не PotC) проходит и без инвокации.
    expect(
      validateSpellCast(room, { ...familiar, origin: { x: 150, y: 100 }, summonKey: 'XMM:Octopus' })
    ).toBeUndefined();
    // Нет свободного места (карта 1×1) — ошибка до траты ячейки.
    const tiny = { ...room, scene: { ...room.scene, maps: [{ ...map, width: 50, height: 50 }] } };
    expect(
      validateSpellCast(tiny, { ...familiar, origin: { x: 150, y: 100 }, summonKey: 'XMM:Octopus' })
    ).toMatchObject({ code: 'summonNoSpace' });
    map.walls = [{ id: 'w1', x1: caster.x + 50, y1: -500, x2: caster.x + 50, y2: 500, kind: 'wall' }];
    expect(validateSpellCast(room, { ...base, origin: { x: 400, y: 100 } })).toMatchObject({ code: 'noClearPath' });
  });
});
