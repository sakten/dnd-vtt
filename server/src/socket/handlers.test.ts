import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SPEED,
  type AutomationDef,
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
import { resolveWeaponAttack } from './attackResolve';
import { applyAttackRiders } from './attackRiders';
import { registerResourceHandlers } from './resources';
import { registerSpellHandlers } from './spells';
import { registerDiceHandlers } from './dice';
import { openReactionWindow, pendingOffers, registerReactionHandlers } from './reactions';
import { createZoneFromDef } from './zones';

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

  it('Второе дыхание лечит 1d10 + уровень воина и тратит ресурс', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.sheets.p1 = {
      ...casterSheet(),
      classes: [{ className: 'fighter', level: 3 }],
      spells: [],
    };
    room.resources.p1 = {
      ...casterResources(),
      hp: { current: 10, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      spellSlots: [],
      resources: [
        { id: 'r1', key: 'fighter:secondWind', name: 'Второе дыхание', current: 2, max: 2, reset: 'short' },
      ],
    };
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.8); // d10 = 9
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'class:fighter:secondWind' });
    rand.mockRestore();

    expect(room.resources.p1!.hp.current).toBe(22); // 10 + 9 + 3
    expect(room.resources.p1!.resources[0]!.current).toBe(1);
    expect(combatOf(room).turns.e1!.bonusActionUsed).toBe(true);
  });

  it('Боевой дух самурая: 5 временных HP и преимущество на атаки оружием', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.sheets.p1 = {
      ...casterSheet(),
      classes: [{ className: 'fighter', level: 3, subclass: 'samurai' }],
      spells: [],
    };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [
        { id: 'r1', key: 'fighter.samurai:fightingSpirit', name: 'Боевой дух', current: 3, max: 3, reset: 'long' },
      ],
    };
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'class:fighter.samurai:fightingSpirit' });

    const tk = room.scene.maps[0]!.tokens[0]!;
    expect(room.resources.p1!.hp.temp).toBe(5);
    const effect = tk.effects.find((e) => e.name === 'Боевой дух');
    expect(effect?.modifiers[0]?.filter).toEqual({ direction: 'self', weapon: true });
    expect(room.resources.p1!.resources[0]!.current).toBe(2);
  });

  it('временные HP поглощаются до основных', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.resources.p1 = {
      ...casterResources(),
      hp: { current: 10, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      spellSlots: [],
      resources: [],
    };
    const tk = room.scene.maps[0]!.tokens[0]!;
    const f = makeCtx(room, { playerId: 'p1' });

    f.manager.grantTempHp(room, tk, 5);
    expect(room.resources.p1!.hp.temp).toBe(5);

    f.manager.adjustTokenHp(room, 'm1', tk, -7);
    expect(room.resources.p1!.hp.temp).toBe(0);
    expect(room.resources.p1!.hp.current).toBe(8); // 10 − 2
  });

  it('Чемпион критует на 19, прочие — нет', () => {
    const sword: AttackEntry = {
      name: 'Меч',
      hit: 'd20',
      damage: '1d8',
      damageType: 'slashing',
      rangeType: 'melee',
      rangeNormal: 5,
      rangeLong: 0,
    };
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', attacks: [sword] }),
        makeToken('t2', { hpMax: '30', hpCurrent: 30, ac: '5' }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = {
      ...casterSheet(),
      classes: [{ className: 'fighter', level: 3, subclass: 'champion' }],
      spells: [],
    };
    room.resources.p1 = casterResources();
    const [attacker, target] = room.scene.maps[0]!.tokens;
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.9); // d20 = 19
    const f = makeCtx(room, { playerId: 'p1' });
    const casterInput = {
      attacker: attacker!,
      attackerMapId: 'm1',
      target: target!,
      targetMapId: 'm1',
      attack: sword,
      prefix: 't1',
      author: 't1',
    };
    const crit = resolveWeaponAttack(f.ctx, casterInput);
    room.sheets.p1 = { ...casterSheet(), classes: [{ className: 'fighter', level: 3 }], spells: [] };
    const plain = resolveWeaponAttack(f.ctx, casterInput);
    rand.mockRestore();

    expect(crit.crit).toBe(true);
    expect(plain.crit).toBe(false);
  });

  it('Фанатичное присутствие: преимущество союзникам в 30 фт без выбора целей', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', faction: 'ally', x: 100, y: 100 }),
        makeToken('t2', { faction: 'ally', x: 150, y: 100 }),
        makeToken('t3', { faction: 'enemy', x: 150, y: 150 }),
        makeToken('t4', { faction: 'ally', x: 100, y: 600 }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = {
      ...casterSheet(),
      classes: [{ className: 'barbarian', level: 10, subclass: 'zealot' }],
      spells: [],
    };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [
        {
          id: 'r1',
          key: 'barbarian.zealot:zealousPresence',
          name: 'Фанатичное присутствие',
          current: 1,
          max: 1,
          reset: 'long',
        },
      ],
    };
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'class:barbarian.zealot:zealousPresence' });

    const [, ally, enemy, far] = room.scene.maps[0]!.tokens;
    const hasBuff = (t: (typeof room.scene.maps)[0]['tokens'][number]) =>
      t.effects.some((e) => e.name === 'Фанатичное присутствие');
    expect(hasBuff(ally!)).toBe(true);
    expect(hasBuff(enemy!)).toBe(false);
    expect(hasBuff(far!)).toBe(false);
    expect(room.resources.p1!.resources[0]!.current).toBe(0);
  });

  it('досягаемость: +10 фт в свой ход позволяет бить с 10 фт', () => {
    const sword: AttackEntry = {
      name: 'Меч',
      hit: 'd20',
      damage: '1d8',
      damageType: 'slashing',
      rangeType: 'melee',
      rangeNormal: 5,
      rangeLong: 0,
    };
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', attacks: [sword], x: 100, y: 100 }),
        makeToken('t2', { x: 200, y: 100, hpMax: '30', hpCurrent: 30, ac: '5' }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = { ...casterSheet(), spells: [] };
    room.resources.p1 = casterResources();
    combatOf(room).active = false;
    const [attacker, target] = room.scene.maps[0]!.tokens;
    attacker!.effects = [
      {
        id: 'reach1',
        name: 'Досягаемость',
        duration: { type: 'endOfTurn', of: 'target' },
        modifiers: [{ id: 'm1', target: 'reach', mode: 'add', value: 10 }],
      },
    ];
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.9); // d20 = 19
    const f = makeCtx(room, { playerId: 'p1' });
    const input = {
      attacker: attacker!,
      attackerMapId: 'm1',
      target: target!,
      targetMapId: 'm1',
      attack: sword,
      prefix: 't1',
      author: 't1',
    };
    const withReach = resolveWeaponAttack(f.ctx, input);
    attacker!.effects = [];
    const without = resolveWeaponAttack(f.ctx, input);
    rand.mockRestore();

    expect(withReach.error).toBeUndefined();
    expect(withReach.hitSuccess).toBe(true);
    expect(without.error).toContain('досягаемости');
  });

  it('Шквал ударов: бонусное действие, фокус и +2 доп. атаки', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.sheets.p1 = { ...casterSheet(), classes: [{ className: 'monk', level: 2 }], spells: [] };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [{ id: 'r1', key: 'monk:focus', name: 'Фокус', current: 2, max: 2, reset: 'short' }],
    };
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'class:monk:focus/flurryOfBlows' });

    const tk = room.scene.maps[0]!.tokens[0]!;
    const turn = combatOf(room).turns.e1!;
    expect(turn.flurryAttacks).toBe(2);
    expect(turn.bonusActionUsed).toBe(true);
    expect(room.resources.p1!.resources[0]!.current).toBe(1);
    turn.actionUsed = true;
    expect(f.manager.canAttack(room, 'm1', tk)).toBe(true);
    f.manager.consumeAttack(room, 'm1', tk);
    f.manager.consumeAttack(room, 'm1', tk);
    expect(turn.flurryAttacks).toBe(0);
    expect(f.manager.canAttack(room, 'm1', tk)).toBe(false);
  });

  it('Ошеломляющий удар: метка, CON-спас и stunned', () => {
    const room = makeRoom(
      [makeToken('t1', { libraryItemId: 'lib1' }), makeToken('t2', { hpMax: '30', hpCurrent: 30 })],
      { p1: 'lib1' }
    );
    room.sheets.p1 = { ...casterSheet(), classes: [{ className: 'monk', level: 5 }], spells: [] };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [{ id: 'r1', key: 'monk:focus', name: 'Фокус', current: 2, max: 2, reset: 'short' }],
    };
    const [monk, target] = room.scene.maps[0]!.tokens;
    monk!.effects = [
      {
        id: 'armed',
        name: 'Ошеломляющий удар: наготове',
        sourceKey: 'class:monk:stunningStrike',
        sourceId: monk!.id,
        duration: { type: 'endOfTurn', of: 'source' },
        modifiers: [],
        hidden: true,
      },
    ];
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.1); // d20 = 3 — провал спасброска
    const f = makeCtx(room, { playerId: 'p1' });

    applyAttackRiders(f.ctx, room, monk!, 'm1', target!);
    rand.mockRestore();

    expect(target!.conditions.some((c) => c.key === 'stunned')).toBe(true);
    expect(room.resources.p1!.resources[0]!.current).toBe(1);
    expect(monk!.effects.some((e) => e.sourceKey === 'class:monk:stunningStrike')).toBe(false);
  });

  it('Отражение атак: снижает урон и открывает окно перенаправления', () => {
    const sword: AttackEntry = {
      name: 'Меч',
      hit: 'd20',
      damage: '1d8',
      damageType: 'slashing',
      rangeType: 'melee',
      rangeNormal: 5,
      rangeLong: 0,
    };
    const room = makeRoom(
      [
        makeToken('t1', { attacks: [sword], x: 100, y: 100 }),
        makeToken('t2', { libraryItemId: 'lib2', x: 150, y: 100, hpMax: '30', hpCurrent: 30, ac: '5' }),
      ],
      { p1: 'lib2' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    room.sheets.p1 = { ...casterSheet(), classes: [{ className: 'monk', level: 3 }], spells: [] };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [{ id: 'r1', key: 'monk:focus', name: 'Фокус', current: 2, max: 2, reset: 'short' }],
    };
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'T2', imageUrl: '', initiative: 5, bonus: '' });
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.8); // d20 17, 1d8 7, 1d10 9
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });
    const deflect = pendingOffers('TEST').find((o) =>
      o.options.some((op) => op.id === 'feature:monk:deflectAttacks')
    );
    expect(deflect).toBeDefined();

    const f2 = makeCtx(room, { playerId: 'p1' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', { id: deflect!.id, optionId: 'feature:monk:deflectAttacks' });
    rand.mockRestore();

    const redirect = pendingOffers('TEST').find((o) =>
      o.options.some((op) => op.id === 'feature:monk:deflectAttacks:redirect')
    );
    expect(redirect).toBeDefined();
    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(30); // урон погашен
    f2.invoke('reaction:respond', { id: redirect!.id, optionId: null });
  });

  it('Ярость вешает эффект: сопротивление B/P/S и бонус урона по уровню', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.sheets.p1 = {
      ...casterSheet(),
      classes: [{ className: 'barbarian', level: 9 }],
      spells: [],
    };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [{ id: 'r1', key: 'barbarian:rage', name: 'Ярость', current: 2, max: 2, reset: 'short' }],
    };
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'class:barbarian:rage' });

    const tk = room.scene.maps[0]!.tokens[0]!;
    const rage = tk.effects.find((e) => e.name === 'Ярость');
    expect(rage).toBeDefined();
    expect(rage!.duration).toEqual({ type: 'rounds', rounds: 10 });
    expect(rage!.modifiers.find((m) => m.target === 'damage' && m.mode === 'add')?.value).toBe(3);
    expect(rage!.modifiers.filter((m) => m.mode === 'resistance')).toHaveLength(3);
    expect(room.resources.p1!.resources[0]!.current).toBe(1);
    expect(combatOf(room).turns.e1!.bonusActionUsed).toBe(true);
  });

  it('Безрассудная атака: преимущество своим Str-атакам и атакам по себе', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.sheets.p1 = {
      ...casterSheet(),
      classes: [{ className: 'barbarian', level: 2 }],
      spells: [],
    };
    room.resources.p1 = { ...casterResources(), spellSlots: [], resources: [] };
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'class:barbarian:recklessAttack' });

    const tk = room.scene.maps[0]!.tokens[0]!;
    const reckless = tk.effects.find((e) => e.name === 'Безрассудная атака');
    expect(reckless?.modifiers.map((m) => m.filter?.direction)).toEqual(['self', 'against']);
  });

  it('«Выпутаться» снимает эффект проверкой характеристики', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    const tk = room.scene.maps[0]!.tokens[0]!;
    tk.effects = [
      {
        id: 'web1',
        name: 'Web',
        duration: { type: 'permanent' },
        modifiers: [],
        conditions: ['restrained'],
        escape: { ability: 'str', skill: 'athletics', dc: 15 },
      },
    ];
    tk.conditions = [{ key: 'restrained', name: 'Обездвижен', effectId: 'web1' }];
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.7); // d20 = 15
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'escape:web1' });
    rand.mockRestore();

    expect(tk.effects).toHaveLength(0);
    expect(tk.conditions).toHaveLength(0);
    expect(combatOf(room).turns.e1!.actionUsed).toBe(true);
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

  it('Mirror Image: попадание принимает образ, урона нет', () => {
    const room = makeRoom(
      [
        makeToken('t1', {
          attacks: [{ name: 'Bite', hit: 'd20+5', damage: 'd6+3', rangeType: 'none', rangeNormal: 0, rangeLong: 0 }],
        }),
        makeToken('t2', { hpMax: '30', hpCurrent: 30 }),
      ],
      {}
    );
    const target = room.scene.maps[0]!.tokens[1]!;
    target.effects = [
      {
        id: 'mi1',
        name: 'Mirror Image',
        duration: { type: 'rounds', rounds: 10 },
        modifiers: [],
        misdirect: { charges: 1, die: 'd6', threshold: 3 },
      },
    ];
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.8); // d20 = 17 (попал), d6 = 5 (образ)
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });
    rand.mockRestore();

    expect(target.hpCurrent).toBe(30);
    expect(target.effects).toHaveLength(0);
    expect(room.chat.some((m) => m.kind === 'text' && m.text.includes('образ принял удар'))).toBe(true);
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

/** Синтетическая зона с эффектом на входе (Web-подобная). */
const enterZoneDef: AutomationDef = {
  key: 'TEST:Enter',
  name: 'Вход',
  resolution: 'auto',
  zone: {
    area: { shape: 'sphere', size: 20 },
    origin: 'point',
    duration: { type: 'rounds', rounds: 10 },
    triggers: {
      enter: {
        effects: [
          { name: 'Вход', duration: { type: 'permanent' }, to: 'targets', modifiers: [], conditions: ['restrained'] },
        ],
      },
    },
  },
};

describe('зоны и концентрация', () => {
  it('зонный каст держит якорь концентрации; ручное снятие эффекта гасит зону', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100 }),
        makeToken('t2', { x: 200, y: 100, hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Hunger of Hadar', className: 'wizard' }] };
    room.resources.p1 = casterResources();
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);
    registerTokenHandlers(f.ctx);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Hunger of Hadar',
      slotLevel: 3,
      origin: { x: 200, y: 100 },
    });

    const caster = room.scene.maps[0]!.tokens[0]!;
    expect(room.scene.maps[0]!.zones).toHaveLength(1);
    expect(
      caster.effects.some((e) => e.concentration && e.sourceId === 't1' && e.sourceKey === 'XPHB:Hunger of Hadar')
    ).toBe(true);

    // Сняли якорь вручную (меню токена) — зона и её аура гаснут.
    f.invoke('token:update', { mapId: 'm1', id: 't1', patch: { effects: [] } });
    expect(room.scene.maps[0]!.zones).toHaveLength(0);
  });

  it('нет концентрации, если все цели прошли спас (Hypnotic Pattern)', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100 }),
        makeToken('t2', { x: 300, y: 100, hpMax: '30', hpCurrent: 30 }),
        makeToken('t3', { x: 350, y: 100, hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Hypnotic Pattern', className: 'wizard' }] };
    room.resources.p1 = casterResources();
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.99); // d20 = 20 → все спаслись

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Hypnotic Pattern',
      slotLevel: 3,
      origin: { x: 300, y: 100 },
    });
    rand.mockRestore();

    const caster = room.scene.maps[0]!.tokens[0]!;
    expect(caster.effects.some((e) => e.concentration)).toBe(false);
    expect(combatOf(room).turns.e1!.concentrationId).toBeNull();
  });

  it('Mass Healing Word лечит всех выбранных существ (можно меньше шести)', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100 }),
        makeToken('t2', { x: 150, y: 100, hpMax: '30', hpCurrent: 10 }),
        makeToken('t3', { x: 200, y: 100, hpMax: '30', hpCurrent: 5 }),
        makeToken('t4', { x: 250, y: 100, hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Mass Healing Word', className: 'wizard' }] };
    room.resources.p1 = casterResources();
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Mass Healing Word',
      slotLevel: 3,
      targetIds: ['t2', 't3'],
    });

    const tokens = room.scene.maps[0]!.tokens;
    expect(tokens[1]!.hpCurrent).toBeGreaterThan(10);
    expect(tokens[2]!.hpCurrent).toBeGreaterThan(5);
    expect(tokens[3]!.hpCurrent).toBe(30);
  });

  it('Hold Person с апкастом накрывает две цели', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100 }),
        makeToken('t2', { x: 150, y: 100, hpMax: '30', hpCurrent: 30 }),
        makeToken('t3', { x: 200, y: 100, hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Hold Person', className: 'wizard' }] };
    room.resources.p1 = { ...casterResources(), spellSlots: [{ level: 3, current: 1, max: 1 }] };
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0); // d20 = 1 → спас провален

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Hold Person',
      slotLevel: 3,
      targetIds: ['t2', 't3'],
    });
    rand.mockRestore();

    const tokens = room.scene.maps[0]!.tokens;
    expect(tokens[1]!.effects.some((e) => e.sourceKey === 'XPHB:Hold Person')).toBe(true);
    expect(tokens[2]!.effects.some((e) => e.sourceKey === 'XPHB:Hold Person')).toBe(true);
  });

  it('перетаскивание токена в зону срабатывает вне его хода (enter)', () => {
    const room = makeRoom([makeToken('t1'), makeToken('t2', { x: 500, y: 500, hpMax: '30', hpCurrent: 30 })], {});
    const f = makeCtx(room, { dm: true });
    registerTokenHandlers(f.ctx);
    const caster = room.scene.maps[0]!.tokens[0]!;
    createZoneFromDef(f.ctx, { caster, mapId: 'm1', def: enterZoneDef, stats: null, origin: { x: 125, y: 125 } });

    f.invoke('token:move', { mapId: 'm1', id: 't2', x: 125, y: 125 });

    expect(room.scene.maps[0]!.tokens[1]!.effects.some((e) => e.sourceKey === 'TEST:Enter')).toBe(true);
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

  it('Ярость запрещает каст заклинаний', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    const tk = room.scene.maps[0]!.tokens[0]!;
    tk.effects = [
      {
        id: 'rage1',
        name: 'Ярость',
        duration: { type: 'rounds', rounds: 10 },
        modifiers: [],
        restrictions: { noSpells: true },
      },
    ];
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

    expect(room.resources.p1!.spellSlots[0]!.current).toBe(casterResources().spellSlots[0]!.current);
    expect(combatOf(room).turns.e1!.actionUsed).toBe(false);
  });

  it('Shocking Grasp на попадании запрещает OA цели', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100 }),
        makeToken('t2', { x: 150, y: 100, hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Shocking Grasp', className: 'wizard' }] };
    room.resources.p1 = casterResources();
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.8);
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Shocking Grasp', targetIds: ['t2'] });
    rand.mockRestore();

    const target = room.scene.maps[0]!.tokens[1]!;
    expect(target.effects.some((e) => e.restrictions?.noOpportunityAttacks)).toBe(true);
    expect(target.hpCurrent).toBeLessThan(30);
  });

  it('замедление: шанс провала заклинания с соматическим компонентом', () => {
    const room = makeRoom(
      [makeToken('t1', { libraryItemId: 'lib1' }), makeToken('t2', { hpMax: '30', hpCurrent: 30 })],
      { p1: 'lib1' }
    );
    room.sheets.p1 = casterSheet();
    room.resources.p1 = casterResources();
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);
    f.ctx.manager.applyEffect(room, room.scene.maps[0]!.tokens[0]!, {
      id: 'slow1',
      name: 'Slow',
      sourceId: 't2',
      duration: { type: 'untilSave', ability: 'wis', dc: 20, timing: 'end' },
      modifiers: [],
      restrictions: { spellFailureChance: 25 },
    });
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.1); // d100 = 11 → провал
    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Fireball',
      slotLevel: 3,
      origin: { x: 0, y: 0 },
    });
    rand.mockRestore();

    expect(room.resources.p1!.spellSlots[0]!.current).toBe(0);
    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(30);
    expect(room.chat.some((m) => m.kind === 'text' && m.text.includes('провал'))).toBe(true);
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

  it('игрок со Щитом видит окно при выходе врага из досягаемости (не авто-OA)', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 150, y: 100, hpMax: '30', hpCurrent: 30, faction: 'ally' }),
        makeToken('t2', { attacks: [melee('Клыки')], x: 100, y: 100, faction: 'enemy' }),
      ],
      { p1: 'lib1' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Shield', className: 'wizard' }] };
    room.resources.p1 = { ...casterResources(), spellSlots: [{ level: 1, current: 1, max: 1 }] };
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    combatOf(room).currentIndex = 1;
    const f = makeCtx(room, { dm: true });
    registerCombatHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('combat:setMovement', {
      mapId: 'm1',
      tokenId: 't2',
      used: 30,
      path: [
        { x: 100, y: 100 },
        { x: 400, y: 100 },
      ],
    });

    const offers = pendingOffers('TEST');
    expect(offers).toHaveLength(1);
    expect(offers[0]!.tokenId).toBe('t1');
    expect(offers[0]!.options.map((o) => o.id)).toEqual(['opportunity']);
    expect(combatOf(room).turns.e1!.reactionUsed).toBe(false);
    expect(room.scene.maps[0]!.tokens[0]!.hpCurrent).toBe(30);
    f.invoke('reaction:forceSkip', { id: offers[0]!.id });
  });

  it('реакционная черта (Рипост) даёт окно вместо авто-OA', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 150, y: 100, hpMax: '30', hpCurrent: 30, faction: 'ally' }),
        makeToken('t2', { attacks: [melee('Клыки')], x: 100, y: 100, faction: 'enemy' }),
      ],
      { p1: 'lib1' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    room.sheets.p1 = {
      ...casterSheet(),
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
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    combatOf(room).currentIndex = 1;
    const f = makeCtx(room, { dm: true });
    registerCombatHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('combat:setMovement', {
      mapId: 'm1',
      tokenId: 't2',
      used: 30,
      path: [
        { x: 100, y: 100 },
        { x: 400, y: 100 },
      ],
    });

    const offers = pendingOffers('TEST');
    expect(offers).toHaveLength(1);
    expect(offers[0]!.options.map((o) => o.id)).toEqual(['opportunity']);
    expect(combatOf(room).turns.e1!.reactionUsed).toBe(false);
    f.invoke('reaction:forceSkip', { id: offers[0]!.id });
  });

  it('черта без ресурса (кости кончились) не открывает окно — авто-OA', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 150, y: 100, hpMax: '30', hpCurrent: 30, faction: 'ally' }),
        makeToken('t2', { attacks: [melee('Клыки')], x: 100, y: 100, faction: 'enemy' }),
      ],
      { p1: 'lib1' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    room.sheets.p1 = {
      ...casterSheet(),
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
          current: 0,
          max: 4,
          reset: 'short',
        },
      ],
    };
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    combatOf(room).currentIndex = 1;
    const f = makeCtx(room, { dm: true });
    registerCombatHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('combat:setMovement', {
      mapId: 'm1',
      tokenId: 't2',
      used: 30,
      path: [
        { x: 100, y: 100 },
        { x: 400, y: 100 },
      ],
    });

    expect(pendingOffers('TEST')).toHaveLength(0);
    expect(combatOf(room).turns.e1!.reactionUsed).toBe(true);
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
    expect(room.scene.maps[0]!.tokens[0]!.effects.some((e) => e.name === 'Уклонение')).toBe(true);

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

  it('наездники: Божественная ярость (+1d6+полуровень) — один раз за ход', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.sheets.p1 = {
      ...casterSheet(),
      classes: [{ className: 'barbarian', subclass: 'zealot', level: 4 }],
      spells: [],
    };
    room.resources.p1 = { ...casterResources(), spellSlots: [], resources: [] };
    const tk = room.scene.maps[0]!.tokens[0]!;
    tk.effects = [
      {
        id: 'rage',
        name: 'Rage',
        sourceKey: 'class:barbarian:rage',
        sourceId: tk.id,
        duration: { type: 'rounds', rounds: 10 },
        modifiers: [],
      },
    ];
    const f = makeCtx(room, { playerId: 'p1' });

    const first = applyAttackRiders(f.ctx, room, tk, 'm1');
    expect(first.expr).toBe('1d6+2');
    expect(first.notes).toHaveLength(1);
    expect(applyAttackRiders(f.ctx, room, tk, 'm1').expr).toBe('');
  });

  it('Псионический удар: без метки нет, с меткой тратит кость пси-энергии', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.sheets.p1 = {
      ...casterSheet(),
      classes: [{ className: 'fighter', subclass: 'psiWarrior', level: 3 }],
      spells: [],
    };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [
        {
          id: 'r1',
          key: 'fighter.psiWarrior:psionicEnergyDice',
          name: 'Кости пси-энергии',
          current: 1,
          max: 4,
          reset: 'short',
        },
      ],
    };
    const tk = room.scene.maps[0]!.tokens[0]!;
    const f = makeCtx(room, { playerId: 'p1' });
    expect(applyAttackRiders(f.ctx, room, tk, 'm1').expr).toBe('');

    tk.effects = [
      {
        id: 'armed',
        name: 'Псионический удар: наготове',
        sourceKey: 'class:fighter.psiWarrior:psionicStrike',
        sourceId: tk.id,
        duration: { type: 'endOfTurn', of: 'source' },
        modifiers: [],
        hidden: true,
      },
    ];
    const ride = applyAttackRiders(f.ctx, room, tk, 'm1');
    expect(ride.expr).toMatch(/^1d6(\+\d+)?$/);
    expect(room.resources.p1!.resources[0]!.current).toBe(0);
    expect(tk.effects.some((e) => e.sourceKey === 'class:fighter.psiWarrior:psionicStrike')).toBe(false);
  });

  it('Щит духов союзника снижает урон атаки', () => {
    const room = makeRoom(
      [
        makeToken('t1', { attacks: [melee('Меч', 'd20')], x: 100, y: 100 }),
        makeToken('t2', { x: 150, y: 100, hpMax: '30', hpCurrent: 30, ac: '5' }),
        makeToken('t3', { libraryItemId: 'lib2', x: 200, y: 100, hpMax: '30', hpCurrent: 30 }),
      ],
      { p2: 'lib2' }
    );
    room.players.push({ id: 'p2', name: 'P2', role: 'player', isConnected: true, socketId: null });
    room.sheets.p2 = {
      ...casterSheet(),
      classes: [{ className: 'barbarian', level: 6, subclass: 'ancestralGuardian' }],
      spells: [],
    };
    room.resources.p2 = casterResources();
    combatOf(room).entries.push({ id: 'e3', tokenId: 't3', name: 'T3', imageUrl: '', initiative: 5, bonus: '' });
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.8); // d20 17 (попадение), 1d8 7, 2d6 10
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });
    const shield = pendingOffers('TEST').find((o) =>
      o.options.some((op) => op.id === 'feature:barbarian.ancestralGuardian:spiritShield')
    );
    expect(shield).toBeDefined();

    const f2 = makeCtx(room, { playerId: 'p2' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', { id: shield!.id, optionId: 'feature:barbarian.ancestralGuardian:spiritShield' });
    rand.mockRestore();

    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(30); // 7 − 10 → 0
    expect(combatOf(room).turns.e3!.reactionUsed).toBe(true);
  });

  it('Возмездие: реакция-атака по ударившему в 5 фт', () => {
    const room = makeRoom(
      [
        makeToken('t1', { attacks: [melee('Меч', 'd20')], x: 100, y: 100, hpMax: '30', hpCurrent: 30 }),
        makeToken('t2', { libraryItemId: 'lib2', x: 150, y: 100, hpMax: '30', hpCurrent: 30, ac: '5' }),
      ],
      { p1: 'lib2' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    room.sheets.p1 = {
      ...casterSheet(),
      classes: [{ className: 'barbarian', level: 10, subclass: 'berserker' }],
      spells: [],
      attacks: [melee('Топор')],
    };
    room.resources.p1 = { ...casterResources(), spellSlots: [], resources: [] };
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'T2', imageUrl: '', initiative: 5, bonus: '' });
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.8);
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });
    const offers = pendingOffers('TEST');
    expect(offers.some((o) => o.options.some((op) => op.id === 'feature:barbarian.berserker:retaliation'))).toBe(true);

    const f2 = makeCtx(room, { playerId: 'p1' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', { id: offers[0]!.id, optionId: 'feature:barbarian.berserker:retaliation' });
    rand.mockRestore();

    expect(room.chat.some((m) => m.kind === 'roll' && m.rollKind === 'attack' && m.author === 't2')).toBe(true);
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
