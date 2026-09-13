import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_ABILITIES,
  DEFAULT_GRID,
  DEFAULT_SPEED,
  defaultFog,
  emptyCombatState,
  type CharacterSheet,
  type InitiativeEntry,
  type PlayerResources,
  type Token,
} from 'shared';
import type { Room } from './roomTypes';
import { RoomManager } from './rooms';

function token(id: string, overrides: Partial<Token> = {}): Token {
  return {
    id,
    libraryItemId: '',
    name: id,
    description: '',
    imageUrl: '',
    cells: 1,
    round: false,
    initiativeBonus: '',
    isPlayerToken: false,
    owner: '',
    attacks: [],
    ac: '',
    hpMax: '',
    showStats: false,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    scale: 1,
    rotation: 0,
    z: 0,
    visible: true,
    ownerId: '',
    lockedBy: null,
    hpCurrent: 0,
    hpTemp: 0,
    faction: 'neutral',
    speed: DEFAULT_SPEED,
    conditions: [],
    effects: [],
    damageDefenses: [],
    ...overrides,
  };
}

function entry(id: string, tokenId: string, initiative: number): InitiativeEntry {
  return { id, tokenId, name: tokenId, imageUrl: '', initiative, bonus: '' };
}

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    code: 'TEST',
    name: 'T',
    scene: {
      maps: [
        {
          id: 'm1',
          name: 'M',
          url: '',
          width: 0,
          height: 0,
          tokens: [],
          fog: defaultFog(DEFAULT_GRID),
          combat: emptyCombatState(),
        },
      ],
      activeMapId: 'm1',
      grid: { ...DEFAULT_GRID },
    },
    library: [],
    sheets: {},
    chat: [],
    players: [],
    nextZ: 0,
    resources: {},
    controllers: {},
    ...overrides,
  };
}

function setup(): RoomManager {
  const manager = new RoomManager();
  vi.spyOn(manager, 'saveSoon').mockImplementation(() => {});
  return manager;
}

function resources(hpMax: number, current: number): PlayerResources {
  return {
    hp: { current, max: hpMax, temp: 0, deathSuccesses: 0, deathFailures: 0 },
    hitDice: [],
    spellSlots: [],
    pact: { current: 0, max: 0, level: 0 },
    resources: [],
    notes: '',
  };
}

describe('RoomManager ход', () => {
  it('startCombat инициализирует раунд, активного и ресурсы хода', () => {
    const manager = setup();
    const room = makeRoom();
    room.scene.maps[0].tokens = [token('t1', { speed: 40 }), token('t2')];

    manager.startCombat(room, 'm1');
    const combat = room.scene.maps[0].combat;

    expect(combat.active).toBe(true);
    expect(combat.entries).toHaveLength(2);
    expect(combat.round).toBe(1);
    expect(combat.currentIndex).toBe(0);
    const active = combat.entries[0];
    expect(combat.turns[active.id].movementMax).toBe(active.tokenId === 't1' ? 40 : DEFAULT_SPEED);
  });

  it('endTurn переходит по кругу и увеличивает раунд на обороте', () => {
    const manager = setup();
    const room = makeRoom();
    const combat = room.scene.maps[0].combat;
    combat.active = true;
    combat.entries = [entry('e1', 't1', 20), entry('e2', 't2', 10)];
    combat.round = 1;
    combat.currentIndex = 0;
    manager.beginTurn(room, 'm1', 'e1');

    manager.endTurn(room, 'm1');
    expect(combat.currentIndex).toBe(1);
    expect(combat.round).toBe(1);

    manager.endTurn(room, 'm1');
    expect(combat.currentIndex).toBe(0);
    expect(combat.round).toBe(2);
  });

  it('новый ход сбрасывает израсходованные ресурсы, сохраняя концентрацию', () => {
    const manager = setup();
    const room = makeRoom();
    const combat = room.scene.maps[0].combat;
    combat.active = true;
    combat.entries = [entry('e1', 't1', 20), entry('e2', 't2', 10)];
    combat.currentIndex = 0;
    combat.round = 1;
    manager.beginTurn(room, 'm1', 'e1');
    combat.turns.e1.actionUsed = true;
    combat.turns.e1.bonusActionUsed = true;
    combat.turns.e1.movementUsed = 30;
    combat.turns.e1.concentrationId = 'ef1';

    manager.endTurn(room, 'm1');
    manager.endTurn(room, 'm1');

    expect(combat.currentIndex).toBe(0);
    expect(combat.turns.e1.actionUsed).toBe(false);
    expect(combat.turns.e1.bonusActionUsed).toBe(false);
    expect(combat.turns.e1.movementUsed).toBe(0);
    expect(combat.turns.e1.concentrationId).toBe('ef1');
  });

  it('setTurn задаёт активного по id', () => {
    const manager = setup();
    const room = makeRoom();
    const combat = room.scene.maps[0].combat;
    combat.active = true;
    combat.entries = [entry('e1', 't1', 20), entry('e2', 't2', 10)];
    combat.round = 1;
    combat.currentIndex = 0;
    manager.beginTurn(room, 'm1', 'e1');

    manager.setTurn(room, 'm1', { id: 'e2' });
    expect(combat.currentIndex).toBe(1);
    expect(combat.turns.e2).toBeDefined();
  });

  it('перестановка в инициативе сохраняет активного', () => {
    const manager = setup();
    const room = makeRoom();
    const combat = room.scene.maps[0].combat;
    combat.active = true;
    combat.entries = [entry('e1', 't1', 20), entry('e2', 't2', 10), entry('e3', 't3', 5)];
    combat.currentIndex = 1;
    manager.beginTurn(room, 'm1', 'e2');

    manager.moveCombatant(room, 'm1', 'e2', 2);

    expect(combat.entries.map((e) => e.id)).toEqual(['e1', 'e3', 'e2']);
    expect(combat.entries[combat.currentIndex].id).toBe('e2');
  });

  it('удаление активного переводит ход на другого', () => {
    const manager = setup();
    const room = makeRoom();
    const combat = room.scene.maps[0].combat;
    combat.active = true;
    combat.entries = [entry('e1', 't1', 20), entry('e2', 't2', 10)];
    combat.currentIndex = 0;
    manager.beginTurn(room, 'm1', 'e1');

    manager.removeCombatant(room, 'm1', 'e1');

    expect(combat.entries).toHaveLength(1);
    expect(combat.currentIndex).toBe(0);
    expect(combat.entries[0].id).toBe('e2');
  });

  it('ре-ролл инициативы и добор токенов сохраняют активного', () => {
    const manager = setup();
    const room = makeRoom();
    room.scene.maps[0].tokens = [token('t1'), token('t2')];
    const combat = room.scene.maps[0].combat;
    combat.active = true;
    combat.entries = [entry('e1', 't1', 20)];
    combat.currentIndex = 0;
    manager.beginTurn(room, 'm1', 'e1');

    manager.addMapTokensToCombat(room, 'm1');
    expect(combat.entries).toHaveLength(2);
    expect(combat.entries[combat.currentIndex].id).toBe('e1');

    manager.rollCombat(room, 'm1');
    expect(combat.entries[combat.currentIndex].id).toBe('e1');
  });

  it('добор токена в активный бой создаёт ресурсы хода', () => {
    const manager = setup();
    const room = makeRoom();
    const combat = room.scene.maps[0].combat;
    combat.active = true;
    combat.currentIndex = -1;
    room.scene.maps[0].tokens = [token('t1', { speed: 40 })];

    manager.addTokenToCombat(room, 'm1', room.scene.maps[0].tokens[0]);

    expect(combat.currentIndex).toBe(0);
    const entry = combat.entries[0];
    expect(combat.turns[entry.id]).toBeDefined();
    expect(combat.turns[entry.id].movementMax).toBe(40);
  });

  it('consumeAttack: действие открывает запас мультиатаки', () => {
    const manager = setup();
    const room = makeRoom();
    const combat = room.scene.maps[0].combat;
    combat.active = true;
    combat.entries = [entry('e1', 't1', 20)];
    combat.currentIndex = 0;
    const tk = token('t1', { statblock: { abilities: { ...DEFAULT_ABILITIES }, multiattack: 3 } });
    room.scene.maps[0].tokens = [tk];
    manager.beginTurn(room, 'm1', 'e1');

    expect(manager.attacksPerToken(room, tk)).toBe(3);
    expect(manager.consumeAttack(room, 'm1', tk)).toBe(true);
    expect(combat.turns.e1.actionUsed).toBe(true);
    expect(combat.turns.e1.attacksRemaining).toBe(2);

    expect(manager.consumeAttack(room, 'm1', tk)).toBe(true);
    expect(manager.consumeAttack(room, 'm1', tk)).toBe(true);
    expect(combat.turns.e1.attacksRemaining).toBe(0);
    expect(manager.consumeAttack(room, 'm1', tk)).toBe(false);
  });

  it('setMovement фиксирует передвижение и не уходит в минус', () => {
    const manager = setup();
    const room = makeRoom();
    const combat = room.scene.maps[0].combat;
    combat.active = true;
    combat.entries = [entry('e1', 't1', 20)];
    combat.currentIndex = 0;
    manager.beginTurn(room, 'm1', 'e1');

    manager.setMovement(room, 'm1', 't1', 15, 3);
    expect(combat.turns.e1.movementUsed).toBe(15);
    expect(combat.turns.e1.diagonalsUsed).toBe(3);

    manager.setMovement(room, 'm1', 't1', -5);
    expect(combat.turns.e1.movementUsed).toBe(0);
  });

  it('скорость берётся из листа контролёра, легендарные — из статблока', () => {
    const manager = setup();
    const sheet: CharacterSheet = {
      name: 'Герой',
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      proficiencyBonus: '2',
      saves: {},
      skills: {},
      attacks: [],
      classes: [],
      spells: [],
      hpMax: '',
      ac: '',
      speed: 40,
      damageDefenses: [],
    };
    const room = makeRoom({
      controllers: { p1: 'lib1' },
      sheets: { p1: sheet },
      scene: {
        maps: [
          {
            id: 'm1',
            name: 'M',
            url: '',
            width: 0,
            height: 0,
            tokens: [
              token('t1', {
                libraryItemId: 'lib1',
                speed: 30,
                statblock: { abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, legendary: { max: 3, actions: [] } },
              }),
            ],
            fog: defaultFog(DEFAULT_GRID),
            combat: emptyCombatState(),
          },
        ],
        activeMapId: 'm1',
        grid: { ...DEFAULT_GRID },
      },
    });

    const combat = room.scene.maps[0].combat;
    combat.active = true;
    combat.entries = [entry('e1', 't1', 20)];
    combat.currentIndex = 0;
    manager.beginTurn(room, 'm1', 'e1');

    expect(combat.turns.e1.movementMax).toBe(40);
    expect(combat.turns.e1.legendaryMax).toBe(3);
    expect(combat.turns.e1.legendaryRemaining).toBe(3);
  });
});

describe('RoomManager HP', () => {
  it('монстру урон идёт прямо в токен', () => {
    const manager = setup();
    const room = makeRoom();
    const goblin = token('t1', { hpMax: '20', hpCurrent: 20 });
    const changed = manager.adjustTokenHp(room, 'm1', goblin, -7);

    expect(goblin.hpCurrent).toBe(13);
    expect(changed).toEqual([{ mapId: 'm1', token: goblin }]);
  });

  it('персонажу урон идёт в ресурсы и зеркалится в токен', () => {
    const manager = setup();
    const room = makeRoom({ controllers: { p1: 'lib1' }, resources: { p1: resources(10, 10) } });
    room.scene.maps[0].tokens = [token('t1', { libraryItemId: 'lib1', hpMax: '10', hpCurrent: 10 })];

    const changed = manager.adjustTokenHp(room, 'm1', room.scene.maps[0].tokens[0], -4);

    expect(room.resources.p1.hp.current).toBe(6);
    expect(room.scene.maps[0].tokens[0].hpCurrent).toBe(6);
    expect(changed[0].token.hpCurrent).toBe(6);
  });

  it('лечение не превышает максимум', () => {
    const manager = setup();
    const room = makeRoom();
    const goblin = token('t1', { hpMax: '20', hpCurrent: 18 });

    manager.adjustTokenHp(room, 'm1', goblin, 10);

    expect(goblin.hpCurrent).toBe(20);
  });

  it('лечение персонажа не превышает максимум ресурсов и зеркалится', () => {
    const manager = setup();
    const room = makeRoom({ controllers: { p1: 'lib1' }, resources: { p1: resources(10, 8) } });
    room.scene.maps[0].tokens = [token('t1', { libraryItemId: 'lib1', hpMax: '10', hpCurrent: 8 })];

    manager.adjustTokenHp(room, 'm1', room.scene.maps[0].tokens[0], 5);

    expect(room.resources.p1.hp.current).toBe(10);
    expect(room.scene.maps[0].tokens[0].hpCurrent).toBe(10);
  });

  it('syncSheetToTokens без контролёра — no-op', () => {
    const manager = setup();
    const room = makeRoom();
    room.scene.maps[0].tokens = [token('t1', { hpCurrent: 3 })];

    expect(manager.syncSheetToTokens(room, 'p1')).toEqual([]);
    expect(room.scene.maps[0].tokens[0].hpCurrent).toBe(3);
  });

  it('syncSheetToTokens обновляет HP/AC/скорость связанного токена', () => {
    const manager = setup();
    const room = makeRoom({
      controllers: { p1: 'lib1' },
      resources: { p1: resources(12, 5) },
      sheets: {
        p1: {
          name: 'Герой',
          abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
          proficiencyBonus: '2',
          saves: {},
          skills: {},
          attacks: [],
          classes: [],
          spells: [],
          hpMax: '',
          ac: '16',
          speed: 35,
          damageDefenses: [],
        },
      },
    });
    room.scene.maps[0].tokens = [token('t1', { libraryItemId: 'lib1', hpMax: '1', hpCurrent: 1 })];

    const changed = manager.syncSheetToTokens(room, 'p1');
    const synced = room.scene.maps[0].tokens[0];

    expect(synced.hpMax).toBe('12');
    expect(synced.hpCurrent).toBe(5);
    expect(synced.ac).toBe('16');
    expect(synced.speed).toBe(35);
    expect(changed).toHaveLength(1);
  });
});

describe('RoomManager заклинания', () => {
  it('spendSpellSlot: обычная ячейка, затем pact', () => {
    const manager = setup();
    const res = resources(10, 10);
    res.spellSlots = [{ level: 2, current: 1, max: 1 }];
    res.pact = { current: 1, max: 1, level: 2 };
    const room = makeRoom({ resources: { p1: res } });

    expect(manager.spendSpellSlot(room, 'p1', 2)).toBe('slot');
    expect(res.spellSlots[0].current).toBe(0);
    expect(manager.spendSpellSlot(room, 'p1', 2)).toBe('pact');
    expect(res.pact.current).toBe(0);
    expect(manager.spendSpellSlot(room, 'p1', 2)).toBeNull();
    expect(manager.spendSpellSlot(room, 'p1', 1)).toBeNull();
  });

  it('saveBonusForToken: профишенси персонажа и явный спасбросок монстра', () => {
    const manager = setup();
    const sheet: CharacterSheet = {
      name: 'Герой',
      abilities: { ...DEFAULT_ABILITIES, con: 16, dex: 8 },
      proficiencyBonus: '3',
      saves: { con: true },
      skills: {},
      attacks: [],
      classes: [{ className: 'fighter', level: 5 }],
      spells: [],
      hpMax: '',
      ac: '',
      speed: 30,
      damageDefenses: [],
    };
    const room = makeRoom({ controllers: { p1: 'lib1' }, sheets: { p1: sheet } });
    const char = token('t1', { libraryItemId: 'lib1' });
    const monster = token('t2', {
      statblock: { abilities: { ...DEFAULT_ABILITIES, dex: 20 }, saves: { dex: 9 } },
    });

    expect(manager.saveBonusForToken(room, char, 'con')).toBe(6);
    expect(manager.saveBonusForToken(room, char, 'dex')).toBe(-1);
    expect(manager.saveBonusForToken(room, monster, 'dex')).toBe(9);
    expect(manager.saveBonusForToken(room, monster, 'str')).toBe(0);
  });
});

describe('RoomManager состояния', () => {
  it('tickConditions: истечение по раундам и повторный спасбросок', () => {
    const manager = setup();
    const room = makeRoom();
    const tk = token('t1', {
      conditions: [
        { key: 'prone', name: 'Сбит с ног', rounds: 1 },
        { key: 'paralyzed', name: 'Парализован', rounds: null, save: { ability: 'con', dc: 0, timing: 'start' } },
      ],
    });
    room.scene.maps[0].tokens = [tk];

    const res = manager.tickConditions(room, tk, 'start');
    expect(res.removed).toContain('Сбит с ног');
    expect(res.saves).toHaveLength(1);
    expect(res.saves[0].success).toBe(true);
    expect(tk.conditions).toHaveLength(0);
  });

  it('HP уходит в минус, персонаж — без сознания', () => {
    const manager = setup();
    const room = makeRoom({ controllers: { p1: 'lib1' }, resources: { p1: resources(10, 5) } });
    const tk = token('t1', { libraryItemId: 'lib1' });
    room.scene.maps[0].tokens = [tk];

    manager.adjustTokenHp(room, 'm1', tk, -12);

    expect(room.resources.p1.hp.current).toBe(-7);
    expect(tk.conditions.some((c) => c.key === 'unconscious')).toBe(true);
  });

  it('урон лежачему добавляет провал; крит — два; 3 провала → мёртв', () => {
    const manager = setup();
    const room = makeRoom({ controllers: { p1: 'lib1' }, resources: { p1: resources(10, 0) } });
    const tk = token('t1', { libraryItemId: 'lib1' });
    room.scene.maps[0].tokens = [tk];

    manager.adjustTokenHp(room, 'm1', tk, -3);
    expect(room.resources.p1.hp.deathFailures).toBe(1);
    manager.adjustTokenHp(room, 'm1', tk, -3, { crit: true });

    expect(room.resources.p1.hp.deathFailures).toBe(3);
    expect(tk.conditions.some((c) => c.key === 'dead')).toBe(true);
  });

  it('лечение сбрасывает death-сейвы и снимает «Без сознания»', () => {
    const manager = setup();
    const room = makeRoom({ controllers: { p1: 'lib1' }, resources: { p1: resources(10, 0) } });
    room.resources.p1.hp.deathFailures = 2;
    const tk = token('t1', { libraryItemId: 'lib1' });
    room.scene.maps[0].tokens = [tk];

    manager.adjustTokenHp(room, 'm1', tk, 4);

    expect(room.resources.p1.hp.current).toBe(4);
    expect(room.resources.p1.hp.deathFailures).toBe(0);
    expect(tk.conditions.some((c) => c.key === 'unconscious')).toBe(false);
  });

  it('монстр при HP ≤ 0 сразу мёртв', () => {
    const manager = setup();
    const room = makeRoom();
    const monster = token('t1', { hpMax: '10', hpCurrent: 10 });

    manager.adjustTokenHp(room, 'm1', monster, -15);

    expect(monster.hpCurrent).toBe(-5);
    expect(monster.conditions.some((c) => c.key === 'dead')).toBe(true);
  });

  it('истощение снижает скорость в начале хода', () => {
    const manager = setup();
    const room = makeRoom();
    const tk = token('t1', { conditions: [{ key: 'exhaustion', name: 'Истощение', level: 2, rounds: null }] });
    room.scene.maps[0].tokens = [tk];
    const combat = room.scene.maps[0].combat;
    combat.active = true;
    combat.entries = [entry('e1', 't1', 10)];
    combat.currentIndex = 0;

    manager.beginTurn(room, 'm1', 'e1');

    expect(combat.turns.e1.movementMax).toBe(DEFAULT_SPEED - 10);
  });
});
