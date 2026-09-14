import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SPEED,
  type CharacterSheet,
  type PlayerResources,
  type AttackEntry,
  type TokenStatblock,
} from 'shared';
import type { Room } from '../roomTypes';
import { makeCombatRoom as makeRoom, makeResources, makeToken } from '../test/fixtures';
import { makeConnCtx as makeCtx } from '../test/ctx';
import { registerCombatHandlers } from './combat';
import { registerRoomHandlers } from './room';
import { registerTokenHandlers } from './token';
import { registerActionHandlers } from './actions';
import { registerResourceHandlers } from './resources';
import { registerSpellHandlers } from './spells';
import { registerDiceHandlers } from './dice';
import { openReactionWindow, pendingOffers, registerReactionHandlers } from './reactions';

const combatOf = (room: Room) => room.scene.maps[0]!.combat;

describe('combat:endTurn', () => {
  it('игрок, управляющий активным токеном, может завершить ход', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    const f = makeCtx(room, { playerId: 'p1' });
    registerCombatHandlers(f.ctx);

    f.invoke('combat:endTurn', { mapId: 'm1' });
    expect(combatOf(room).round).toBe(2);
  });

  it('чужой игрок не может завершить ход', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p2: 'lib2' });
    const f = makeCtx(room, { playerId: 'p2' });
    registerCombatHandlers(f.ctx);

    // активируем второй токен, чтобы был куда перейти
    room.scene.maps[0]!.tokens.push(makeToken('t2'));
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    f.invoke('combat:endTurn', { mapId: 'm1' });
    expect(combatOf(room).currentIndex).toBe(0);
    expect(combatOf(room).round).toBe(1);
  });

  it('DM завершает ход', () => {
    const room = makeRoom([makeToken('t1'), makeToken('t2')], {});
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    const f = makeCtx(room, { dm: true });
    registerCombatHandlers(f.ctx);

    f.invoke('combat:endTurn', { mapId: 'm1' });
    expect(combatOf(room).currentIndex).toBe(1);
  });
});

describe('combat:setTurn / setMovement', () => {
  it('setTurn доступен только DM', () => {
    const room = makeRoom([makeToken('t1'), makeToken('t2')], {});
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });

    const player = makeCtx(room, { playerId: 'p1' });
    registerCombatHandlers(player.ctx);
    player.invoke('combat:setTurn', { mapId: 'm1', id: 'e2' });
    expect(combatOf(room).currentIndex).toBe(0);

    const dm = makeCtx(room, { dm: true });
    registerCombatHandlers(dm.ctx);
    dm.invoke('combat:setTurn', { mapId: 'm1', id: 'e2' });
    expect(combatOf(room).currentIndex).toBe(1);
  });

  it('setMovement принимает от контролёра активного токена и от DM', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    const player = makeCtx(room, { playerId: 'p1' });
    registerCombatHandlers(player.ctx);
    player.invoke('combat:setMovement', { mapId: 'm1', tokenId: 't1', used: 20, diagonals: 2 });
    expect(combatOf(room).turns.e1!.movementUsed).toBe(20);
    expect(combatOf(room).turns.e1!.diagonalsUsed).toBe(2);
  });

  it('setMovement чужого игрока игнорируется', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p2: 'lib2' });
    const f = makeCtx(room, { playerId: 'p2' });
    registerCombatHandlers(f.ctx);
    f.invoke('combat:setMovement', { mapId: 'm1', tokenId: 't1', used: 20 });
    expect(combatOf(room).turns.e1!.movementUsed).toBe(0);
  });
});

describe('action:use', () => {
  it('Рывок тратит действие и добавляет передвижение', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1', speed: 30 })], { p1: 'lib1' });
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'dash', slot: 'action' });

    expect(combatOf(room).turns.e1!.actionUsed).toBe(true);
    expect(combatOf(room).turns.e1!.movementMax).toBe(60);
    expect(room.chat.some((m) => m.kind === 'text' && m.text.includes('Рывок'))).toBe(true);
  });

  it('игрок не может действовать не в свой ход', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.scene.maps[0]!.tokens.push(makeToken('t2'));
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    combatOf(room).currentIndex = 1;
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'dash' });
    expect(combatOf(room).turns.e1!.actionUsed).toBe(false);
    expect(f.emitted.some((e) => e.event === 'chat:error')).toBe(true);
  });

  it('реакционное действие доступно не в свой ход и тратит реакцию', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.scene.maps[0]!.tokens[0]!.statblock = {
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      actions: [{ id: 'parry', name: 'Парирование', source: 'monster', costs: ['reaction'] }],
    };
    room.scene.maps[0]!.tokens.push(makeToken('t2'));
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    combatOf(room).currentIndex = 1;
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'parry', slot: 'reaction' });
    expect(combatOf(room).turns.e1!.reactionUsed).toBe(true);
    expect(f.emitted.some((e) => e.event === 'chat:error')).toBe(false);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'parry', slot: 'reaction' });
    expect(
      f.emitted.some((e) => e.event === 'chat:error' && String(e.payload).includes('Реакция уже потрачена'))
    ).toBe(true);
  });

  it('Атака списывает действие и оружие бьёт', () => {
    const room = makeRoom([makeToken('t1')], {});
    const token = room.scene.maps[0]!.tokens[0]!;
    token.attacks = [
      { name: 'Bite', hit: 'd20+5', damage: 'd6+3', rangeType: 'none', rangeNormal: 0, rangeLong: 0 },
    ];
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0 });

    expect(combatOf(room).turns.e1!.actionUsed).toBe(true);
    expect(combatOf(room).turns.e1!.attacksRemaining).toBe(0);
    expect(room.chat.length).toBeGreaterThan(0);
  });
});

describe('token:update права', () => {
  it('игрок-контролёр меняет hpTemp/conditions, но не faction/speed/statblock', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    const f = makeCtx(room, { playerId: 'p1' });
    registerTokenHandlers(f.ctx);
    const token = room.scene.maps[0]!.tokens[0]!;

    f.invoke('token:update', {
      mapId: 'm1',
      id: 't1',
      patch: {
        hpTemp: 5,
        faction: 'enemy',
        speed: 50,
        statblock: { abilities: { str: 20, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
      },
    });

    expect(token.hpTemp).toBe(5);
    expect(token.faction).toBe('neutral');
    expect(token.speed).toBe(DEFAULT_SPEED);
    expect(token.statblock).toBeUndefined();
  });

  it('DM меняет faction/speed/statblock', () => {
    const room = makeRoom([makeToken('t1')], {});
    const f = makeCtx(room, { dm: true });
    registerTokenHandlers(f.ctx);
    const token = room.scene.maps[0]!.tokens[0]!;

    f.invoke('token:update', {
      mapId: 'm1',
      id: 't1',
      patch: {
        faction: 'enemy',
        speed: 50,
        statblock: { abilities: { str: 20, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
      },
    });

    expect(token.faction).toBe('enemy');
    expect(token.speed).toBe(50);
    expect(token.statblock?.abilities.str).toBe(20);
  });
});

function casterSheet(): CharacterSheet {
  return {
    name: 'Волшебник',
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    proficiencyBonus: '3',
    saves: {},
    skills: {},
    attacks: [],
    classes: [{ className: 'wizard', level: 5 }],
    spells: [{ key: 'XPHB:Fireball', className: 'wizard' }],
    hpMax: '30',
    ac: '12',
    speed: 30,
    damageDefenses: [],
  };
}

function casterResources(): PlayerResources {
  return makeResources({
    hp: { current: 30, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
    spellSlots: [{ level: 3, current: 1, max: 1 }],
  });
}

describe('spell:cast', () => {
  it('тратит ячейку/действие, кидает спасбросок и урон', () => {
    const room = makeRoom(
      [makeToken('t1', { libraryItemId: 'lib1' }), makeToken('t2', { hpMax: '30', hpCurrent: 30 })],
      { p1: 'lib1' }
    );
    room.sheets.p1 = casterSheet();
    room.resources.p1 = casterResources();
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Fireball',
      slotLevel: 3,
      origin: { x: 0, y: 0 },
    });

    expect(room.resources.p1!.spellSlots[0]!.current).toBe(0);
    expect(combatOf(room).turns.e1!.actionUsed).toBe(true);
    expect(room.chat.some((m) => m.kind === 'roll' && m.rollKind === 'save')).toBe(true);
  });

  it('без выбранного заклинания не кастует', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.sheets.p1 = casterSheet();
    room.resources.p1 = casterResources();
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Cure Wounds', slotLevel: 1 });

    expect(room.resources.p1!.spellSlots[0]!.current).toBe(1);
    expect(f.emitted.some((e) => e.event === 'chat:error')).toBe(true);
  });

  it('область: Fireball с origin поражает существ в радиусе', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100 }),
        makeToken('t2', { x: 300, y: 100, hpMax: '30', hpCurrent: 30 }),
        makeToken('t3', { x: 350, y: 100, hpMax: '30', hpCurrent: 30 }),
        makeToken('t5', { x: 300, y: 600, hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = casterSheet();
    room.resources.p1 = casterResources();
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Fireball',
      slotLevel: 3,
      origin: { x: 300, y: 100 },
    });

    const t2 = room.scene.maps[0]!.tokens.find((t) => t.id === 't2')!;
    const t3 = room.scene.maps[0]!.tokens.find((t) => t.id === 't3')!;
    const t5 = room.scene.maps[0]!.tokens.find((t) => t.id === 't5')!;
    const saves = room.chat.filter((m) => m.kind === 'roll' && m.rollKind === 'save');
    expect(saves).toHaveLength(2);
    expect(t2.hpCurrent).toBeLessThan(30);
    expect(t3.hpCurrent).toBeLessThan(30);
    expect(t5.hpCurrent).toBe(30);
  });

  it('Scorching Ray: каждый луч бьёт свою цель (3 броска)', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1' }),
        makeToken('t2', { hpMax: '40', hpCurrent: 40 }),
        makeToken('t3', { hpMax: '40', hpCurrent: 40 }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = {
      ...casterSheet(),
      spells: [{ key: 'XPHB:Scorching Ray', className: 'wizard' }],
    };
    room.resources.p1 = {
      hp: { current: 20, max: 20, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      hitDice: [],
      spellSlots: [{ level: 2, current: 1, max: 1 }],
      pact: { current: 0, max: 0, level: 0 },
      resources: [],
      notes: '',
    };
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Scorching Ray',
      slotLevel: 2,
      targetIds: ['t2', 't3', 't2'],
    });

    const attacks = room.chat.filter((m) => m.kind === 'roll' && m.rollKind === 'attack');
    expect(attacks).toHaveLength(3);
    const subject = (m: (typeof attacks)[number]) =>
      (m as { labelParams?: { subject?: string } }).labelParams?.subject ?? '';
    expect(subject(attacks[0]!)).toContain('(1/3)');
    expect(subject(attacks[2]!)).toContain('(3/3)');
  });

  it('иммунитет к типу урона обнуляет урон атаки', () => {
    const room = makeRoom(
      [
        makeToken('t1'),
        makeToken('t2', {
          hpMax: '30',
          hpCurrent: 30,
          damageDefenses: [{ id: 'd1', type: 'immunity', damageType: 'fire' }],
        }),
      ],
      {}
    );
    room.scene.maps[0]!.tokens[0]!.attacks = [
      { name: 'Огонь', hit: 'd20+20', damage: '2d6', damageType: 'fire', rangeType: 'none', rangeNormal: 0, rangeLong: 0 },
    ];
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });

    expect(room.scene.maps[0]!.tokens.find((t) => t.id === 't2')?.hpCurrent).toBe(30);
  });

  it('Shield накладывает +5 AC и тратит реакцию', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1', ac: '12' })], { p1: 'lib1' });
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Shield', className: 'wizard' }] };
    room.resources.p1 = { ...casterResources(), spellSlots: [{ level: 1, current: 1, max: 1 }] };
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Shield' });

    const tk = room.scene.maps[0]!.tokens[0]!;
    expect(tk.effects).toHaveLength(1);
    expect(tk.effects[0]!.modifiers[0]).toMatchObject({ target: 'ac', mode: 'add', value: 5 });
    expect(combatOf(room).turns.e1!.reactionUsed).toBe(true);
    expect(room.resources.p1!.spellSlots[0]!.current).toBe(0);
    expect(f.manager.acForToken(room, tk)).toBe(17);
  });

  it('реакционное заклинание кастуется не в свой ход и тратит реакцию', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1', ac: '12' })], { p1: 'lib1' });
    room.scene.maps[0]!.tokens.push(makeToken('t2'));
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    combatOf(room).currentIndex = 1;
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Shield', className: 'wizard' }] };
    room.resources.p1 = { ...casterResources(), spellSlots: [{ level: 1, current: 1, max: 1 }] };
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Shield' });

    expect(combatOf(room).turns.e1!.reactionUsed).toBe(true);
    expect(room.scene.maps[0]!.tokens[0]!.effects).toHaveLength(1);
    expect(room.resources.p1!.spellSlots[0]!.current).toBe(0);
    expect(f.emitted.some((e) => e.event === 'chat:error')).toBe(false);

    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Shield' });
    expect(f.emitted.some((e) => e.event === 'chat:error')).toBe(true);
  });

  it('Bless — концентрация на цели; endConcentration снимает эффекты', () => {    const room = makeRoom(
      [makeToken('t1', { libraryItemId: 'lib1' }), makeToken('t2')],
      { p1: 'lib1' }
    );
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Bless', className: 'cleric' }] };
    room.resources.p1 = { ...casterResources(), spellSlots: [{ level: 1, current: 1, max: 1 }] };
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Bless',
      slotLevel: 1,
      targetIds: ['t2'],
    });

    const target = room.scene.maps[0]!.tokens.find((t) => t.id === 't2')!;
    expect(target.effects).toHaveLength(1);
    expect(target.effects[0]!.concentration).toBe(true);
    expect(target.effects[0]!.sourceId).toBe('t1');
    expect(combatOf(room).turns.e1!.concentrationId).toBe(target.effects[0]!.id);

    const caster = room.scene.maps[0]!.tokens[0]!;
    expect(caster.effects.some((e) => e.sourceKey === 'XPHB:Bless' && e.concentration)).toBe(true);

    f.invoke('spell:endConcentration', { mapId: 'm1', tokenId: 't1' });
    expect(target.effects).toHaveLength(0);
    expect(caster.effects.some((e) => e.sourceKey === 'XPHB:Bless')).toBe(false);
    expect(combatOf(room).turns.e1!.concentrationId).toBeNull();
  });

  it('Aid поднимает максимум и текущие HP цели', () => {
    const room = makeRoom(
      [makeToken('t1', { libraryItemId: 'lib1' }), makeToken('t2', { hpMax: '20', hpCurrent: 20 })],
      { p1: 'lib1' }
    );
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Aid', className: 'cleric' }] };
    room.resources.p1 = { ...casterResources(), spellSlots: [{ level: 2, current: 1, max: 1 }] };
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Aid', slotLevel: 2, targetIds: ['t2'] });

    const target = room.scene.maps[0]!.tokens.find((t) => t.id === 't2')!;
    expect(target.hpMax).toBe('25');
    expect(target.hpCurrent).toBe(25);
    expect(target.effects).toHaveLength(1);
  });

  it('Hex помечает цель, даёт +1d6 урона и метку на цели', () => {
    const room = makeRoom(
      [makeToken('t1', { libraryItemId: 'lib1' }), makeToken('t2', { hpMax: '40', hpCurrent: 40 })],
      { p1: 'lib1' }
    );
    room.scene.maps[0]!.tokens[0]!.attacks = [
      { name: 'Меч', hit: 'd20+20', damage: '1d8', damageType: 'slashing', rangeType: 'melee', rangeNormal: 5, rangeLong: 0 },
    ];
    room.sheets.p1 = {
      ...casterSheet(),
      attacks: [
        { name: 'Меч', hit: 'd20+20', damage: '1d8', damageType: 'slashing', rangeType: 'melee', rangeNormal: 5, rangeLong: 0 },
      ],
      spells: [{ key: 'XPHB:Hex', className: 'warlock' }],
    };
    room.resources.p1 = { ...casterResources(), spellSlots: [{ level: 1, current: 1, max: 1 }] };
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.5); // d20 = 11 → попадание
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);
    registerDiceHandlers(f.ctx);

    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Hex', slotLevel: 1, targetIds: ['t2'] });

    const caster = room.scene.maps[0]!.tokens[0]!;
    const target = room.scene.maps[0]!.tokens.find((t) => t.id === 't2')!;
    const hex = caster.effects.find((e) => e.sourceKey === 'XPHB:Hex');
    expect(hex!.modifiers[0]!.filter?.targetId).toBe('t2');
    expect(target.effects.some((e) => e.sourceKey === 'XPHB:Hex')).toBe(true);

    f.invoke('dice:attack', { tokenId: 't1', targetId: 't2', attackIndex: 0 });
    rand.mockRestore();

    const damage = room.chat.find((m) => m.kind === 'roll' && m.rollKind === 'damage') as
      | { roll?: { expression?: string } }
      | undefined;
    expect(damage?.roll?.expression).toContain('1d6');
  });
});

describe('spell:cast монстра (статблок)', () => {
  const monsterStatblock = (spellcasting: NonNullable<TokenStatblock['spellcasting']>): TokenStatblock => ({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 },
    spellcasting,
  });

  it('кастует из списка и тратит ячейку статблока', () => {
    const room = makeRoom(
      [
        makeToken('t1', {
          statblock: monsterStatblock({
            ability: 'wis',
            dc: 14,
            spells: ['XPHB:Shield'],
            slots: [{ level: 1, max: 2, current: 2 }],
          }),
        }),
      ],
      {}
    );
    const f = makeCtx(room, { dm: true });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Shield' });

    const token = room.scene.maps[0]!.tokens[0]!;
    expect(token.statblock?.spellcasting?.slots?.[0]?.current).toBe(1);
    expect(token.effects).toHaveLength(1);
    expect(f.emitted.some((e) => e.event === 'chat:error')).toBe(false);
  });

  it('заклинание вне списка статблока не кастуется', () => {
    const room = makeRoom(
      [
        makeToken('t1', {
          statblock: monsterStatblock({ ability: 'wis', spells: [], slots: [{ level: 1, max: 1, current: 1 }] }),
        }),
      ],
      {}
    );
    const f = makeCtx(room, { dm: true });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Shield' });

    const token = room.scene.maps[0]!.tokens[0]!;
    expect(token.statblock?.spellcasting?.slots?.[0]?.current).toBe(1);
    expect(token.effects).toHaveLength(0);
    expect(
      f.emitted.some((e) => e.event === 'chat:error' && String(e.payload).includes('статблоке'))
    ).toBe(true);
  });

  it('без свободной ячейки нужного круга не кастует', () => {
    const room = makeRoom(
      [
        makeToken('t1', {
          statblock: monsterStatblock({
            ability: 'wis',
            spells: ['XPHB:Shield'],
            slots: [{ level: 1, max: 1, current: 0 }],
          }),
        }),
      ],
      {}
    );
    const f = makeCtx(room, { dm: true });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Shield' });

    expect(room.scene.maps[0]!.tokens[0]!.effects).toHaveLength(0);
    expect(
      f.emitted.some((e) => e.event === 'chat:error' && String(e.payload).includes('Нет ячейки'))
    ).toBe(true);
  });
});

describe('реакции (R1)', () => {
  const melee = (name = 'Меч', hit = 'd20+20'): AttackEntry => ({
    name,
    hit,
    damage: '1d8',
    damageType: 'slashing',
    rangeType: 'melee',
    rangeNormal: 5,
    rangeLong: 0,
  });
  const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 };

  it('окно на попадание: Shield тратит реакцию/ячейку и отменяет урон', () => {
    const room = makeRoom(
      [
        makeToken('t1', { attacks: [melee('Меч', 'd20')] }),
        makeToken('t2', { libraryItemId: 'lib2', ac: '16', hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib2' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    room.sheets.p1 = { ...casterSheet(), ac: '16', spells: [{ key: 'XPHB:Shield', className: 'wizard' }] };
    room.resources.p1 = { ...casterResources(), spellSlots: [{ level: 1, current: 1, max: 1 }] };
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.8); // d20 = 17 (не крит)
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });

    const defender = room.scene.maps[0]!.tokens[1]!;
    expect(defender.hpCurrent).toBe(30);
    const offers = pendingOffers('TEST');
    expect(offers).toHaveLength(1);
    expect(offers[0]!.options.map((o) => o.id)).toContain('spell:XPHB:Shield');

    // Пока окно открыто, даже DM не может действовать (заморозка).
    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'dash' });
    expect(
      f.emitted.some((e) => e.event === 'chat:error' && String(e.payload).includes('Ожидание реакции'))
    ).toBe(true);

    const f2 = makeCtx(room, { playerId: 'p1' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', { id: offers[0]!.id, optionId: 'spell:XPHB:Shield' });
    rand.mockRestore();

    expect(defender.effects.some((e) => e.sourceKey === 'XPHB:Shield')).toBe(true);
    expect(combatOf(room).turns.e2!.reactionUsed).toBe(true);
    expect(room.resources.p1!.spellSlots[0]!.current).toBe(0);
    expect(defender.hpCurrent).toBe(30);
  });

  it('щит не предлагается при промахе', () => {
    const room = makeRoom(
      [
        makeToken('t1', { attacks: [melee('Меч', 'd20')] }),
        makeToken('t2', { libraryItemId: 'lib2', ac: '25', hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib2' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    room.sheets.p1 = { ...casterSheet(), ac: '25', spells: [{ key: 'XPHB:Shield', className: 'wizard' }] };
    room.resources.p1 = { ...casterResources(), spellSlots: [{ level: 1, current: 1, max: 1 }] };
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.5); // d20 = 11
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });
    rand.mockRestore();

    expect(pendingOffers('TEST')).toHaveLength(0);
    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(30);
  });

  it('щит не предлагается, если попадание с запасом больше бонуса', () => {
    const room = makeRoom(
      [
        makeToken('t1', { attacks: [melee('Меч', 'd20')] }),
        makeToken('t2', { libraryItemId: 'lib2', ac: '10', hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib2' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    room.sheets.p1 = { ...casterSheet(), ac: '10', spells: [{ key: 'XPHB:Shield', className: 'wizard' }] };
    room.resources.p1 = { ...casterResources(), spellSlots: [{ level: 1, current: 1, max: 1 }] };
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.8); // d20 = 17 ≥ 10+5
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });
    rand.mockRestore();

    expect(pendingOffers('TEST')).toHaveLength(0);
    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBeLessThan(30);
  });

  it('без спец-реакций атака по возможности срабатывает автоматически', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, faction: 'ally' }),
        makeToken('t2', { attacks: [melee('Клыки')], x: 150, y: 100, faction: 'enemy' }),
      ],
      { p1: 'lib1' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    room.resources.p1 = casterResources();
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    const f = makeCtx(room, { playerId: 'p1' });
    registerCombatHandlers(f.ctx);

    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.5); // d20 = 11, 1d8 = 5
    f.invoke('combat:setMovement', {
      mapId: 'm1',
      tokenId: 't1',
      used: 30,
      path: [
        { x: 100, y: 100 },
        { x: 300, y: 100 },
      ],
    });
    rand.mockRestore();

    expect(combatOf(room).turns.e2!.reactionUsed).toBe(true);
    expect(room.chat.some((m) => m.kind === 'roll' && m.rollKind === 'attack' && m.author === 't2')).toBe(true);
    expect(room.resources.p1!.hp.current).toBe(25);
  });

  it('действие «Отход» отменяет атаку по возможности при движении', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, faction: 'ally' }),
        makeToken('t2', { attacks: [melee('Клыки')], x: 150, y: 100, faction: 'enemy' }),
      ],
      { p1: 'lib1' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    room.resources.p1 = casterResources();
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);
    registerCombatHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'disengage' });
    f.invoke('combat:setMovement', {
      mapId: 'm1',
      tokenId: 't1',
      used: 30,
      path: [
        { x: 100, y: 100 },
        { x: 300, y: 100 },
      ],
    });

    expect(combatOf(room).turns.e1!.disengaged).toBe(true);
    expect(combatOf(room).turns.e2?.reactionUsed ?? false).toBe(false);
    expect(room.resources.p1!.hp.current).toBe(30);
    expect(room.chat.some((m) => m.kind === 'roll' && m.rollKind === 'attack' && m.author === 't2')).toBe(false);
  });

  it('действие «Уклонение» помечает ход и даёт помеху на атаки по токену', () => {
    const room = makeRoom(
      [
        makeToken('t1', { x: 100, y: 100, ac: '20', hpMax: '30', hpCurrent: 30, faction: 'ally' }),
        makeToken('t2', { attacks: [melee('Клыки', 'd20')], x: 150, y: 100, faction: 'enemy' }),
      ],
      {}
    );
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'dodge' });
    expect(combatOf(room).turns.e1!.dodge).toBe(true);

    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    combatOf(room).currentIndex = 1;
    const rand = vi.spyOn(Math, 'random').mockReturnValueOnce(0.9).mockReturnValueOnce(0.1); // 19 и 3
    f.invoke('action:use', { mapId: 'm1', tokenId: 't2', actionId: 'attack', attackIndex: 0, targetIds: ['t1'] });
    rand.mockRestore();

    const attack = room.chat.find((m) => m.kind === 'roll' && m.rollKind === 'attack') as
      | { roll?: { total?: number } }
      | undefined;
    expect(attack?.roll?.total).toBe(3); // помеха: взят меньший бросок
    expect(room.scene.maps[0]!.tokens[0]!.hpCurrent).toBe(30);
  });

  it('после урона открывается окно Hellish Rebuke и бьёт по атакующему', () => {
    const room = makeRoom(
      [
        makeToken('t1', { attacks: [melee()], hpMax: '30', hpCurrent: 30, faction: 'enemy' }),
        makeToken('t2', { libraryItemId: 'lib2', ac: '10', hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib2' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    room.sheets.p1 = { ...casterSheet(), ac: '10', spells: [{ key: 'XPHB:Hellish Rebuke', className: 'wizard' }] };
    room.resources.p1 = { ...casterResources(), spellSlots: [{ level: 1, current: 1, max: 1 }] };
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.5); // без фляков на d20
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });

    expect(room.resources.p1!.hp.current).toBeLessThan(30);
    const offers = pendingOffers('TEST');
    expect(offers).toHaveLength(1);
    expect(offers[0]!.trigger).toBe('damage');
    expect(offers[0]!.options.map((o) => o.id)).toContain('spell:XPHB:Hellish Rebuke');

    const f2 = makeCtx(room, { playerId: 'p1' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', { id: offers[0]!.id, optionId: 'spell:XPHB:Hellish Rebuke' });
    rand.mockRestore();

    expect(room.scene.maps[0]!.tokens[0]!.hpCurrent).toBeLessThan(30);
    expect(combatOf(room).turns.e2!.reactionUsed).toBe(true);
    expect(room.resources.p1!.spellSlots[0]!.current).toBe(0);
  });

  it('Невероятное уклонение уменьшает урон вдвое', () => {
    const room = makeRoom(
      [
        makeToken('t1', { attacks: [melee('Меч', 'd20')] }),
        makeToken('t2', { libraryItemId: 'lib2', ac: '16', hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib2' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    room.sheets.p1 = {
      ...casterSheet(),
      ac: '16',
      classes: [{ className: 'rogue', level: 5 }],
      spells: [],
    };
    room.resources.p1 = { ...casterResources(), spellSlots: [] };
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.8); // d20 = 17 (попадание), d8 = 7
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });

    const offers = pendingOffers('TEST');
    expect(offers).toHaveLength(1);
    expect(offers[0]!.options.map((o) => o.id)).toContain('feature:rogue:uncannyDodge');

    const f2 = makeCtx(room, { playerId: 'p1' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', { id: offers[0]!.id, optionId: 'feature:rogue:uncannyDodge' });
    rand.mockRestore();

    expect(room.resources.p1!.hp.current).toBe(27); // floor(7 / 2)
    expect(combatOf(room).turns.e2!.reactionUsed).toBe(true);
  });

  it('Парирование тратит кость превосходства и повышает AC', () => {
    const room = makeRoom(
      [
        makeToken('t1', { attacks: [melee('Меч', 'd20')] }),
        makeToken('t2', { libraryItemId: 'lib2', ac: '16', hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib2' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    room.sheets.p1 = {
      ...casterSheet(),
      ac: '16',
      classes: [{ className: 'fighter', level: 5, subclass: 'battleMaster' }],
      spells: [],
    };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [
        {
          id: 'r1',
          key: 'fighter.battleMaster:superiorityDice',
          name: 'Кости превосходства',
          current: 4,
          max: 4,
          reset: 'short',
        },
      ],
    };
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.8); // d20 = 17, кость d8 = 7
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });

    const offers = pendingOffers('TEST');
    expect(offers).toHaveLength(1);
    expect(offers[0]!.options.map((o) => o.id)).toContain('feature:fighter.battleMaster:parry');

    const f2 = makeCtx(room, { playerId: 'p1' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', { id: offers[0]!.id, optionId: 'feature:fighter.battleMaster:parry' });
    rand.mockRestore();

    expect(room.resources.p1!.hp.current).toBe(30); // AC 16 + 7 = 23 > 17 → промах
    expect(room.resources.p1!.resources[0]!.current).toBe(3);
    expect(combatOf(room).turns.e2!.reactionUsed).toBe(true);
  });

  it('Absorb Elements уменьшает урон и даёт сопротивление типу', () => {
    const room = makeRoom(
      [
        makeToken('t1', {
          attacks: [
            {
              name: 'Огонь',
              hit: 'd20',
              damage: '1d8',
              damageType: 'fire',
              rangeType: 'melee',
              rangeNormal: 5,
              rangeLong: 0,
            },
          ],
        }),
        makeToken('t2', { libraryItemId: 'lib2', ac: '10', hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib2' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    room.sheets.p1 = { ...casterSheet(), ac: '10', spells: [{ key: 'XGE:Absorb Elements', className: 'wizard' }] };
    room.resources.p1 = { ...casterResources(), spellSlots: [{ level: 1, current: 1, max: 1 }] };
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.8); // d20 = 17, 1d8 = 7
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });

    const offers = pendingOffers('TEST');
    expect(offers).toHaveLength(1);
    expect(offers[0]!.options.map((o) => o.id)).toContain('spell:XGE:Absorb Elements');

    const f2 = makeCtx(room, { playerId: 'p1' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', { id: offers[0]!.id, optionId: 'spell:XGE:Absorb Elements' });
    rand.mockRestore();

    const defender = room.scene.maps[0]!.tokens[1]!;
    expect(room.resources.p1!.hp.current).toBe(27); // floor(7 / 2)
    expect(room.resources.p1!.spellSlots[0]!.current).toBe(0);
    expect(
      defender.effects.some(
        (e) => e.sourceKey === 'XGE:Absorb Elements' && e.modifiers.some((m) => m.filter?.damageType === 'fire')
      )
    ).toBe(true);
    expect(combatOf(room).turns.e2!.reactionUsed).toBe(true);
  });

  it('Counterspell отменяет каст', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 0, y: 0, faction: 'ally' }),
        makeToken('t2', { x: 100, y: 0, hpMax: '30', hpCurrent: 30, faction: 'enemy' }),
        makeToken('t3', { libraryItemId: 'lib3', x: 0, y: 100, faction: 'enemy' }),
      ],
      { p1: 'lib1', p2: 'lib3' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    room.players.push({ id: 'p2', name: 'P2', role: 'player', isConnected: true, socketId: null });
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    combatOf(room).entries.push({ id: 'e3', tokenId: 't3', name: 'C', imageUrl: '', initiative: 4, bonus: '' });
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Fireball', className: 'wizard' }] };
    room.resources.p1 = { ...casterResources(), spellSlots: [{ level: 3, current: 1, max: 1 }] };
    room.sheets.p2 = { ...casterSheet(), spells: [{ key: 'XPHB:Counterspell', className: 'wizard' }] };
    room.resources.p2 = { ...casterResources(), spellSlots: [{ level: 3, current: 1, max: 1 }] };
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Fireball',
      slotLevel: 3,
      origin: { x: 100, y: 0 },
    });

    // Каст ещё не разрешён: цель невредима, открыто окно Counterspell.
    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(30);
    const offers = pendingOffers('TEST');
    expect(offers).toHaveLength(1);
    expect(offers[0]!.options.map((o) => o.id)).toContain('spell:XPHB:Counterspell');

    const f2 = makeCtx(room, { playerId: 'p2' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', { id: offers[0]!.id, optionId: 'spell:XPHB:Counterspell' });

    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(30);
    expect(room.chat.some((m) => m.kind === 'text' && m.text.includes('Counterspell'))).toBe(true);
    expect(combatOf(room).turns.e3!.reactionUsed).toBe(true);
    expect(room.resources.p2!.spellSlots[0]!.current).toBe(0);
  });

  it('Палящая вспышка даёт помеху до броска и отменяет попадание', () => {
    const room = makeRoom(
      [
        makeToken('t1', { attacks: [melee('Меч', 'd20')] }),
        makeToken('t2', { libraryItemId: 'lib2', ac: '16', hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib2' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    room.sheets.p1 = {
      ...casterSheet(),
      ac: '16',
      classes: [{ className: 'cleric', level: 1, subclass: 'light' }],
      spells: [],
    };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [
        {
          id: 'r1',
          key: 'cleric.light:wardingFlare',
          name: 'Палящая вспышка',
          current: 2,
          max: 2,
          reset: 'long',
        },
      ],
    };
    const rand = vi.spyOn(Math, 'random').mockReturnValueOnce(0.9).mockReturnValueOnce(0.1); // 19 и 3
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });

    // Броска ещё не было — открыто окно до атаки.
    expect(room.chat.some((m) => m.kind === 'roll' && m.rollKind === 'attack')).toBe(false);
    const offers = pendingOffers('TEST');
    expect(offers).toHaveLength(1);
    expect(offers[0]!.trigger).toBe('attackRoll');
    expect(offers[0]!.options.map((o) => o.id)).toContain('feature:cleric.light:wardingFlare');

    const f2 = makeCtx(room, { playerId: 'p1' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', { id: offers[0]!.id, optionId: 'feature:cleric.light:wardingFlare' });
    rand.mockRestore();

    const attack = room.chat.find((m) => m.kind === 'roll' && m.rollKind === 'attack') as
      | { roll?: { total?: number } }
      | undefined;
    expect(attack?.roll?.total).toBe(3); // с помехой взят меньший бросок
    expect(room.resources.p1!.hp.current).toBe(30);
    expect(room.resources.p1!.resources[0]!.current).toBe(1);
    expect(combatOf(room).turns.e2!.reactionUsed).toBe(true);
  });

  it('Ответный удар после промаха бьёт по атакующему с костью превосходства', () => {
    const room = makeRoom(
      [
        makeToken('t1', { attacks: [melee('Меч', 'd20+1')], hpMax: '30', hpCurrent: 30 }),
        makeToken('t2', { libraryItemId: 'lib2', ac: '16', hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib2' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    room.sheets.p1 = {
      ...casterSheet(),
      ac: '16',
      classes: [{ className: 'fighter', level: 5, subclass: 'battleMaster' }],
      spells: [],
      attacks: [melee('Рапира')],
    };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [
        {
          id: 'r1',
          key: 'fighter.battleMaster:superiorityDice',
          name: 'Кости превосходства',
          current: 4,
          max: 4,
          reset: 'short',
        },
      ],
    };
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.1); // d20 = 3, d8 = 1
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });

    const offers = pendingOffers('TEST');
    expect(offers).toHaveLength(1);
    expect(offers[0]!.trigger).toBe('attackMiss');
    expect(offers[0]!.options.map((o) => o.id)).toContain('feature:fighter.battleMaster:riposte');

    const f2 = makeCtx(room, { playerId: 'p1' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', { id: offers[0]!.id, optionId: 'feature:fighter.battleMaster:riposte' });
    rand.mockRestore();

    // Ответный удар (d20+20) попал: 1d8 + кость 1d8 = 2 при моке.
    expect(room.scene.maps[0]!.tokens[0]!.hpCurrent).toBe(28);
    expect(room.resources.p1!.resources[0]!.current).toBe(3);
    expect(combatOf(room).turns.e2!.reactionUsed).toBe(true);
    expect(room.chat.some((m) => m.kind === 'roll' && m.rollKind === 'attack' && m.author === 't2')).toBe(true);
  });

  it('в режиме тестов окно NPC видят все игроки и может ответить любой', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, faction: 'ally' }),
        makeToken('t2', {
          x: 150,
          y: 100,
          faction: 'enemy',
          attacks: [melee('Клыки')],
          statblock: {
            abilities,
            spellcasting: { ability: 'wis', spells: ['XPHB:Shield'], slots: [{ level: 1, max: 1, current: 1 }] },
          },
        }),
      ],
      { p1: 'lib1' }
    );
    room.testMode = true;
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    room.players.push({ id: 'p2', name: 'P2', role: 'player', isConnected: true, socketId: null });
    room.resources.p1 = casterResources();
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    const f = makeCtx(room, { playerId: 'p1' });
    registerCombatHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('combat:setMovement', {
      mapId: 'm1',
      tokenId: 't1',
      used: 30,
      path: [
        { x: 100, y: 100 },
        { x: 300, y: 100 },
      ],
    });

    const offers = pendingOffers('TEST');
    expect(offers).toHaveLength(1);
    expect(offers[0]!.options.map((o) => o.id)).toContain('opportunity');

    const f2 = makeCtx(room, { playerId: 'p2' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', { id: offers[0]!.id, optionId: 'opportunity' });

    expect(combatOf(room).turns.e2!.reactionUsed).toBe(true);
    expect(room.chat.some((m) => m.kind === 'roll' && m.rollKind === 'attack' && m.author === 't2')).toBe(true);
  });
});

describe('состояния (ограничения и авто-эффекты)', () => {
  it('состояние не даёт двигать токен игроку', () => {
    const room = makeRoom(
      [makeToken('t1', { libraryItemId: 'lib1', conditions: [{ key: 'grappled', name: 'Схвачен', rounds: null }] })],
      { p1: 'lib1' }
    );
    const f = makeCtx(room, { playerId: 'p1' });
    registerTokenHandlers(f.ctx);

    f.invoke('token:move', { mapId: 'm1', id: 't1', x: 500, y: 500 });

    expect(room.scene.maps[0]!.tokens[0]!.x).toBe(0);
    expect(f.emitted.some((e) => e.event === 'chat:error')).toBe(true);
  });

  it('недееспособный не действует', () => {
    const room = makeRoom(
      [makeToken('t1', { libraryItemId: 'lib1', conditions: [{ key: 'stunned', name: 'Ошеломлён', rounds: null }] })],
      { p1: 'lib1' }
    );
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'dash' });

    expect(combatOf(room).turns.e1!.actionUsed).toBe(false);
    expect(f.emitted.some((e) => e.event === 'chat:error')).toBe(true);
  });

  it('авто-крит по парализованной цели в упор', () => {
    const room = makeRoom(
      [
        makeToken('t1', { x: 100, y: 100 }),
        makeToken('t2', {
          x: 100,
          y: 100,
          hpMax: '50',
          hpCurrent: 50,
          conditions: [{ key: 'paralyzed', name: 'Парализован', rounds: null }],
        }),
      ],
      {}
    );
    room.scene.maps[0]!.tokens[0]!.attacks = [
      { name: 'Меч', hit: 'd20+20', damage: '1d6', damageType: 'slashing', rangeType: 'melee', rangeNormal: 5, rangeLong: 0 },
    ];
    const f = makeCtx(room, { dm: true });
    registerDiceHandlers(f.ctx);

    f.invoke('dice:attack', { tokenId: 't1', targetId: 't2', attackIndex: 0 });

    const damage = room.chat.find((m) => m.kind === 'roll' && m.rollKind === 'damage');
    expect(damage && (damage as { crit?: boolean }).crit).toBe(true);
  });
});

describe('room:settings (режим тестов)', () => {
  it('игрок не может включить режим, ведущий может', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.players = [
      { id: 'p1', name: 'A', role: 'player', isConnected: true, socketId: null },
      { id: 'dm', name: 'D', role: 'dm', isConnected: true, socketId: null },
    ];

    const player = makeCtx(room, { playerId: 'p1' });
    registerRoomHandlers(player.ctx);
    player.invoke('room:settings', { testMode: true });
    expect(room.testMode).toBe(false);

    const dm = makeCtx(room, { playerId: 'dm', dm: true });
    registerRoomHandlers(dm.ctx);
    dm.invoke('room:settings', { testMode: true });
    expect(room.testMode).toBe(true);
    expect(room.chat.some((m) => m.kind === 'text')).toBe(true);
  });
});

describe('отдых и удаление токена', () => {
  it('долгий отдых снимает эффекты и восстанавливает HP', () => {
    const room = makeRoom(
      [
        makeToken('t1', {
          libraryItemId: 'lib1',
          effects: [
            {
              id: 'ef1',
              name: 'Aid',
              duration: { type: 'permanent' },
              modifiers: [{ id: 'm1', target: 'maxHp', mode: 'add', value: 5 }],
            },
          ],
        }),
      ],
      { p1: 'lib1' }
    );
    room.resources.p1 = {
      ...casterResources(),
      hp: { current: 15, max: 25, temp: 0, deathSuccesses: 0, deathFailures: 0 },
    };
    const f = makeCtx(room, { playerId: 'p1' });
    registerResourceHandlers(f.ctx);

    f.invoke('resources:rest', { type: 'long' });

    expect(room.resources.p1!.hp.max).toBe(20);
    expect(room.resources.p1!.hp.current).toBe(20);
    expect(room.scene.maps[0]!.tokens[0]!.effects).toHaveLength(0);
  });

  it('удаление кастера снимает его концентрацию с других токенов', () => {
    const room = makeRoom(
      [
        makeToken('t1'),
        makeToken('t2', {
          effects: [
            {
              id: 'ef1',
              name: 'Hex',
              concentration: true,
              sourceId: 't1',
              duration: { type: 'concentration' },
              modifiers: [],
            },
          ],
        }),
      ],
      {}
    );
    const f = makeCtx(room, { dm: true });
    registerTokenHandlers(f.ctx);

    f.invoke('token:remove', { mapId: 'm1', id: 't1' });

    expect(room.scene.maps[0]!.tokens.find((t) => t.id === 't2')?.effects).toHaveLength(0);
  });
});

describe('очередь окон реакций (R6.5)', () => {
  it('второй триггер ждёт в очереди и открывается после первого', () => {
    const room = makeRoom([makeToken('t1'), makeToken('t2')], { p1: 'lib1' });
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    const f = makeCtx(room, { playerId: 'p1', dm: true });
    registerReactionHandlers(f.ctx);

    const t1 = room.scene.maps[0]!.tokens[0]!;
    const t2 = room.scene.maps[0]!.tokens[1]!;
    const resumed: string[] = [];
    const offer = (token: typeof t1, name: string) => ({
      token,
      audience: ['p1'],
      options: [{ id: 'op', name, kind: 'opportunity' as const }],
    });

    const first = openReactionWindow(f.ctx, room, {
      mapId: 'm1',
      trigger: 'leaveReach',
      sourceName: 'A',
      offers: [offer(t1, 'OA1')],
      resume: () => resumed.push('first'),
    });
    const second = openReactionWindow(f.ctx, room, {
      mapId: 'm1',
      trigger: 'damage',
      sourceName: 'B',
      offers: [offer(t2, 'OA2')],
      resume: () => resumed.push('second'),
    });

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(pendingOffers('TEST')).toHaveLength(1);
    expect(pendingOffers('TEST')[0]!.options[0]!.name).toBe('OA1');

    f.invoke('reaction:respond', { id: pendingOffers('TEST')[0]!.id, optionId: null });
    expect(resumed).toEqual(['first']);
    expect(pendingOffers('TEST')).toHaveLength(1);
    expect(pendingOffers('TEST')[0]!.options[0]!.name).toBe('OA2');

    f.invoke('reaction:respond', { id: pendingOffers('TEST')[0]!.id, optionId: null });
    expect(resumed).toEqual(['first', 'second']);
    expect(pendingOffers('TEST')).toHaveLength(0);
  });
});
