import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_ABILITIES,
  DEFAULT_GRID,
  DEFAULT_SPEED,
  defaultFog,
  emptyCombatState,
  type ActionDef,
  type CharacterSheet,
  type EffectInstance,
  type InitiativeEntry,
  type PlayerResources,
  type TokenStatblock,
} from 'shared';
import { RoomManager } from './rooms';
import { actorStats } from './room/actor';
import { makeResources, makeRoom, makeToken as token } from './test/fixtures';

function entry(id: string, tokenId: string, initiative: number): InitiativeEntry {
  return { id, tokenId, name: tokenId, imageUrl: '', initiative, bonus: '' };
}

function setup(): RoomManager {
  const manager = new RoomManager();
  vi.spyOn(manager, 'saveSoon').mockImplementation(() => {});
  return manager;
}

function resources(hpMax: number, current: number): PlayerResources {
  return makeResources({ hp: { current, max: hpMax, temp: 0, deathSuccesses: 0, deathFailures: 0 } });
}

describe('RoomManager ход', () => {
  it('startCombat инициализирует раунд, активного и ресурсы хода', () => {
    const manager = setup();
    const room = makeRoom();
    room.scene.maps[0]!.tokens = [token('t1', { speed: 40 }), token('t2')];

    manager.startCombat(room, 'm1');
    const combat = room.scene.maps[0]!.combat;

    expect(combat.active).toBe(true);
    expect(combat.entries).toHaveLength(2);
    expect(combat.round).toBe(1);
    expect(combat.currentIndex).toBe(0);
    const active = combat.entries[0]!;
    expect(combat.turns[active.id]!.movementMax).toBe(active.tokenId === 't1' ? 40 : DEFAULT_SPEED);
  });

  it('endTurn переходит по кругу и увеличивает раунд на обороте', () => {
    const manager = setup();
    const room = makeRoom();
    const combat = room.scene.maps[0]!.combat;
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
    const combat = room.scene.maps[0]!.combat;
    combat.active = true;
    combat.entries = [entry('e1', 't1', 20), entry('e2', 't2', 10)];
    combat.currentIndex = 0;
    combat.round = 1;
    manager.beginTurn(room, 'm1', 'e1');
    combat.turns.e1!.actionUsed = true;
    combat.turns.e1!.bonusActionUsed = true;
    combat.turns.e1!.movementUsed = 30;
    combat.turns.e1!.concentrationId = 'ef1';

    manager.endTurn(room, 'm1');
    manager.endTurn(room, 'm1');

    expect(combat.currentIndex).toBe(0);
    expect(combat.turns.e1!.actionUsed).toBe(false);
    expect(combat.turns.e1!.bonusActionUsed).toBe(false);
    expect(combat.turns.e1!.movementUsed).toBe(0);
    expect(combat.turns.e1!.concentrationId).toBe('ef1');
  });

  it('setTurn задаёт активного по id', () => {
    const manager = setup();
    const room = makeRoom();
    const combat = room.scene.maps[0]!.combat;
    combat.active = true;
    combat.entries = [entry('e1', 't1', 20), entry('e2', 't2', 10)];
    combat.round = 1;
    combat.currentIndex = 0;
    manager.beginTurn(room, 'm1', 'e1');

    manager.setTurn(room, 'm1', { id: 'e2' });
    expect(combat.currentIndex).toBe(1);
    expect(combat.turns.e2).toBeDefined();
  });

  it('turnStateFor создаёт ход неактивного токена и реакция тратится в чужой ход', () => {
    const manager = setup();
    const room = makeRoom();
    room.scene.maps[0]!.tokens = [token('t1'), token('t2')];
    const combat = room.scene.maps[0]!.combat;
    combat.active = true;
    combat.entries = [entry('e1', 't1', 20), entry('e2', 't2', 10)];
    combat.currentIndex = 0;
    manager.beginTurn(room, 'm1', 'e1');

    const t2 = room.scene.maps[0]!.tokens[1]!;
    expect(manager.turnForToken(room, 'm1', t2)).toBeNull();
    expect(combat.turns.e2).toBeUndefined();

    expect(manager.turnStateFor(room, 'm1', t2)).toBeDefined();
    expect(combat.turns.e2).toBeDefined();
    expect(manager.spendSlot(room, 'm1', t2, 'reaction')).toBe(true);
    expect(combat.turns.e2!.reactionUsed).toBe(true);
    expect(manager.spendSlot(room, 'm1', t2, 'reaction')).toBe(false);
    expect(combat.turns.e1!.reactionUsed).toBe(false);
  });

  it('перестановка в инициативе сохраняет активного', () => {
    const manager = setup();
    const room = makeRoom();
    const combat = room.scene.maps[0]!.combat;
    combat.active = true;
    combat.entries = [entry('e1', 't1', 20), entry('e2', 't2', 10), entry('e3', 't3', 5)];
    combat.currentIndex = 1;
    manager.beginTurn(room, 'm1', 'e2');

    manager.moveCombatant(room, 'm1', 'e2', 2);

    expect(combat.entries.map((e) => e.id)).toEqual(['e1', 'e3', 'e2']);
    expect(combat.entries[combat.currentIndex]!.id).toBe('e2');
  });

  it('удаление активного переводит ход на другого', () => {
    const manager = setup();
    const room = makeRoom();
    const combat = room.scene.maps[0]!.combat;
    combat.active = true;
    combat.entries = [entry('e1', 't1', 20), entry('e2', 't2', 10)];
    combat.currentIndex = 0;
    manager.beginTurn(room, 'm1', 'e1');

    manager.removeCombatant(room, 'm1', 'e1');

    expect(combat.entries).toHaveLength(1);
    expect(combat.currentIndex).toBe(0);
    expect(combat.entries[0]!.id).toBe('e2');
  });

  it('ре-ролл инициативы и добор токенов сохраняют активного', () => {
    const manager = setup();
    const room = makeRoom();
    room.scene.maps[0]!.tokens = [token('t1'), token('t2')];
    const combat = room.scene.maps[0]!.combat;
    combat.active = true;
    combat.entries = [entry('e1', 't1', 20)];
    combat.currentIndex = 0;
    manager.beginTurn(room, 'm1', 'e1');

    manager.addMapTokensToCombat(room, 'm1');
    expect(combat.entries).toHaveLength(2);
    expect(combat.entries[combat.currentIndex]!.id).toBe('e1');

    manager.rollCombat(room, 'm1');
    expect(combat.entries[combat.currentIndex]!.id).toBe('e1');
  });

  it('добор токена в активный бой создаёт ресурсы хода', () => {
    const manager = setup();
    const room = makeRoom();
    const combat = room.scene.maps[0]!.combat;
    combat.active = true;
    combat.currentIndex = -1;
    room.scene.maps[0]!.tokens = [token('t1', { speed: 40 })];

    manager.addTokenToCombat(room, 'm1', room.scene.maps[0]!.tokens[0]!);

    expect(combat.currentIndex).toBe(0);
    const entry = combat.entries[0]!;
    expect(combat.turns[entry.id]).toBeDefined();
    expect(combat.turns[entry.id]!.movementMax).toBe(40);
  });

  it('consumeAttack: действие открывает запас мультиатаки', () => {
    const manager = setup();
    const room = makeRoom();
    const combat = room.scene.maps[0]!.combat;
    combat.active = true;
    combat.entries = [entry('e1', 't1', 20)];
    combat.currentIndex = 0;
    const tk = token('t1', { statblock: { abilities: { ...DEFAULT_ABILITIES }, multiattack: 3 } });
    room.scene.maps[0]!.tokens = [tk];
    manager.beginTurn(room, 'm1', 'e1');

    expect(manager.attacksPerToken(room, tk)).toBe(3);
    expect(manager.consumeAttack(room, 'm1', tk)).toBe(true);
    expect(combat.turns.e1!.actionUsed).toBe(true);
    expect(combat.turns.e1!.attacksRemaining).toBe(2);

    expect(manager.consumeAttack(room, 'm1', tk)).toBe(true);
    expect(manager.consumeAttack(room, 'm1', tk)).toBe(true);
    expect(combat.turns.e1!.attacksRemaining).toBe(0);
    expect(manager.consumeAttack(room, 'm1', tk)).toBe(false);
  });

  it('setMovement фиксирует передвижение и не уходит в минус', () => {
    const manager = setup();
    const room = makeRoom();
    const combat = room.scene.maps[0]!.combat;
    combat.active = true;
    combat.entries = [entry('e1', 't1', 20)];
    combat.currentIndex = 0;
    manager.beginTurn(room, 'm1', 'e1');

    manager.setMovement(room, 'm1', 't1', 15, 3);
    expect(combat.turns.e1!.movementUsed).toBe(15);
    expect(combat.turns.e1!.diagonalsUsed).toBe(3);

    manager.setMovement(room, 'm1', 't1', -5);
    expect(combat.turns.e1!.movementUsed).toBe(0);
  });

  it('скорость берётся из листа контролёра, легендарные — из статблока', () => {
    const manager = setup();
    const sheet: CharacterSheet = {
      name: 'Герой',
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      senses: [],
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
            zones: [],            walls: [],
            vision: { los: false, darkness: false },
            lightAreas: [],
            fog: defaultFog(DEFAULT_GRID),
            grid: { ...DEFAULT_GRID },
            combat: emptyCombatState(),
          },
        ],
        activeMapId: 'm1',
        grid: { ...DEFAULT_GRID },
      },
    });

    const combat = room.scene.maps[0]!.combat;
    combat.active = true;
    combat.entries = [entry('e1', 't1', 20)];
    combat.currentIndex = 0;
    manager.beginTurn(room, 'm1', 'e1');

    expect(combat.turns.e1!.movementMax).toBe(40);
    expect(combat.turns.e1!.legendaryMax).toBe(3);
    expect(combat.turns.e1!.legendaryRemaining).toBe(3);
  });

  const roar: ActionDef = {
    id: 'roar',
    name: 'Рёв',
    source: 'monster',
    costs: [],
    legendaryCost: 1,
  };

  const bossStatblock = (max: number): TokenStatblock => ({
    abilities: { ...DEFAULT_ABILITIES },
    legendary: { max, actions: [] },
    actions: [roar],
  });

  it('startCombat: слоты босса идут после чужих ходов, не больше легендарных', () => {
    const manager = setup();
    const room = makeRoom();
    room.scene.maps[0]!.tokens = [token('t1'), token('t2'), token('b1', { statblock: bossStatblock(3) })];

    manager.startCombat(room, 'm1');
    const combat = room.scene.maps[0]!.combat;
    const slots = combat.entries.filter((e) => e.legendaryOwnerId);
    expect(combat.entries).toHaveLength(5);
    expect(slots).toHaveLength(2);

    const before = slots.map((slot) => combat.entries[combat.entries.indexOf(slot) - 1]!.tokenId);
    expect(new Set(before)).toEqual(new Set(['t1', 't2']));
    const bossEntry = combat.entries.find((e) => e.tokenId === 'b1' && !e.legendaryOwnerId)!;
    manager.beginTurn(room, 'm1', bossEntry.id);
    expect(combat.turns[bossEntry.id]!.legendaryRemaining).toBe(3);
    expect(combat.turns[slots[0]!.id]).toBeUndefined();
  });

  it('endTurn пропускает слот с исчерпанным пулом', () => {
    const manager = setup();
    const room = makeRoom();
    room.scene.maps[0]!.tokens = [token('b1', { statblock: bossStatblock(1) })];
    const combat = room.scene.maps[0]!.combat;
    combat.active = true;
    combat.entries = [
      entry('e1', 't1', 20),
      entry('e2', 'b1', 15),
      { ...entry('s1', 'b1', 15), legendaryOwnerId: 'e2' },
      entry('e3', 't2', 10),
    ];
    combat.currentIndex = 1;
    manager.beginTurn(room, 'm1', 'e2');
    combat.turns.e2!.legendaryRemaining = 0;

    manager.endTurn(room, 'm1');

    expect(combat.entries[combat.currentIndex]!.id).toBe('e3');
    expect(combat.currentIndex).toBe(3);
  });

  it('redistributeSlots добавляет слоты после правки пула в бою', () => {
    const manager = setup();
    const room = makeRoom();
    const boss = token('b1', { statblock: bossStatblock(0) });
    room.scene.maps[0]!.tokens = [token('t1'), boss];
    manager.startCombat(room, 'm1');
    const combat = room.scene.maps[0]!.combat;
    expect(combat.entries.some((e) => e.legendaryOwnerId)).toBe(false);

    boss.statblock = { ...boss.statblock!, legendary: { max: 2, actions: [] } };
    manager.redistributeSlots(room, 'm1');

    expect(combat.entries.filter((e) => e.legendaryOwnerId)).toHaveLength(1);
  });

  it('spendLegendary списывает пул и не даёт уйти в минус', () => {
    const manager = setup();
    const room = makeRoom();
    const boss = token('b1', { statblock: bossStatblock(3) });
    room.scene.maps[0]!.tokens = [boss];
    const combat = room.scene.maps[0]!.combat;
    combat.active = true;
    combat.entries = [entry('e1', 'b1', 20)];
    combat.currentIndex = 0;
    manager.beginTurn(room, 'm1', 'e1');

    expect(manager.spendLegendary(room, 'm1', boss, 2)).toBe(true);
    expect(combat.turns.e1!.legendaryRemaining).toBe(1);
    expect(manager.spendLegendary(room, 'm1', boss, 2)).toBe(false);
    expect(combat.turns.e1!.legendaryRemaining).toBe(1);
  });

  it('перезарядка способности уменьшается в начале хода', () => {
    const manager = setup();
    const room = makeRoom();
    const boss = token('b1', { statblock: bossStatblock(1) });
    room.scene.maps[0]!.tokens = [boss];
    const combat = room.scene.maps[0]!.combat;
    combat.active = true;
    combat.entries = [entry('e1', 'b1', 20)];
    combat.currentIndex = 0;
    manager.beginTurn(room, 'm1', 'e1');

    manager.startAbilityCooldown(room, 'm1', boss, 'roar', 2);
    expect(combat.turns.e1!.abilityCooldowns).toEqual({ roar: 2 });

    manager.beginTurn(room, 'm1', 'e1');
    expect(combat.turns.e1!.abilityCooldowns).toEqual({ roar: 1 });

    manager.beginTurn(room, 'm1', 'e1');
    expect(combat.turns.e1!.abilityCooldowns).toBeUndefined();
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

  it('персонажу урон идёт в ресурсы; токен возвращается для рассылки без зеркала', () => {
    const manager = setup();
    const room = makeRoom({ controllers: { p1: 'lib1' }, resources: { p1: resources(10, 10) } });
    room.scene.maps[0]!.tokens = [token('t1', { libraryItemId: 'lib1', hpMax: '10', hpCurrent: 10 })];

    const changed = manager.adjustTokenHp(room, 'm1', room.scene.maps[0]!.tokens[0]!, -4);

    expect(room.resources.p1!.hp.current).toBe(6);
    expect(room.scene.maps[0]!.tokens[0]!.hpCurrent).toBe(10); // зеркала нет
    expect(changed[0]!.token).toBe(room.scene.maps[0]!.tokens[0]!);
  });

  it('лечение не превышает максимум', () => {
    const manager = setup();
    const room = makeRoom();
    const goblin = token('t1', { hpMax: '20', hpCurrent: 18 });

    manager.adjustTokenHp(room, 'm1', goblin, 10);

    expect(goblin.hpCurrent).toBe(20);
  });

  it('лечение персонажа не превышает максимум ресурсов', () => {
    const manager = setup();
    const room = makeRoom({ controllers: { p1: 'lib1' }, resources: { p1: resources(10, 8) } });
    room.scene.maps[0]!.tokens = [token('t1', { libraryItemId: 'lib1', hpMax: '10', hpCurrent: 8 })];

    manager.adjustTokenHp(room, 'm1', room.scene.maps[0]!.tokens[0]!, 5);

    expect(room.resources.p1!.hp.current).toBe(10);
    expect(room.scene.maps[0]!.tokens[0]!.hpCurrent).toBe(8); // зеркала нет
  });

  it('characterTokens без контролёра — пусто, токен не трогаем', () => {
    const manager = setup();
    const room = makeRoom();
    room.scene.maps[0]!.tokens = [token('t1', { hpCurrent: 3 })];

    expect(manager.characterTokens(room, 'p1')).toEqual([]);
    expect(room.scene.maps[0]!.tokens[0]!.hpCurrent).toBe(3);
  });

  it('characterTokens возвращает токены персонажа, статы — через actorStats', () => {
    const manager = setup();
    const room = makeRoom({
      controllers: { p1: 'lib1' },
      resources: { p1: resources(12, 5) },
      sheets: {
        p1: {
          senses: [],
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
    room.scene.maps[0]!.tokens = [token('t1', { libraryItemId: 'lib1', hpMax: '1', hpCurrent: 1 })];

    const changed = manager.characterTokens(room, 'p1');
    const collected = room.scene.maps[0]!.tokens[0]!;
    const stats = actorStats(room, collected);

    expect(changed).toHaveLength(1);
    expect(changed[0]!.token).toBe(collected);
    expect(stats.hp).toEqual({ max: 12, current: 5, temp: 0 });
    expect(stats.ac).toBe(16);
    expect(stats.speed).toBe(35);
    expect(collected.hpCurrent).toBe(1); // в токене зеркала нет
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
    expect(res.spellSlots[0]!.current).toBe(0);
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
      senses: [],
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

  it('«Уклонение» (эффект) даёт преимущество на спасброски Ловкости', () => {
    const manager = setup();
    const room = makeRoom();
    const tk = token('t1');
    room.scene.maps[0]!.tokens = [tk];
    manager.applyEffect(room, tk, {
      id: 'd1',
      name: 'Уклонение',
      sourceId: 't1',
      duration: { type: 'endOfTurn', of: 'target' },
      modifiers: [
        { id: 'd1:m0', target: 'attack', mode: 'disadvantage' },
        { id: 'd1:m1', target: 'save', mode: 'advantage', filter: { ability: 'dex' } },
      ],
    });

    expect(manager.savePartsForToken(room, tk, 'dex').mode).toBe('a');
    expect(manager.savePartsForToken(room, tk, 'con').mode).toBeUndefined();
  });

  it('ограничения эффекта блокируют слоты (Slow)', () => {
    const manager = setup();
    const room = makeRoom();
    const tk = token('t1');
    room.scene.maps[0]!.tokens = [tk];
    const combat = room.scene.maps[0]!.combat;
    combat.active = true;
    combat.entries = [entry('e1', 't1', 10)];
    combat.currentIndex = 0;
    manager.beginTurn(room, 'm1', 'e1');
    manager.applyEffect(room, tk, {
      id: 'slow1',
      name: 'Slow',
      sourceId: 't2',
      duration: { type: 'untilSave', ability: 'wis', dc: 20, timing: 'end' },
      modifiers: [],
      restrictions: { noReactions: true, actionOrBonusOnly: true },
    });

    expect(manager.spendSlot(room, 'm1', tk, 'reaction')).toBe(false);
    expect(manager.spendSlot(room, 'm1', tk, 'action')).toBe(true);
    expect(manager.spendSlot(room, 'm1', tk, 'bonus')).toBe(false);
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
    room.scene.maps[0]!.tokens = [tk];

    const res = manager.tickConditions(room, tk, 'start');
    expect(res.removed.map((r) => r.name)).toContain('Сбит с ног');
    expect(res.saves).toHaveLength(1);
    expect(res.saves[0]!.success).toBe(true);
    expect(tk.conditions).toHaveLength(0);
  });

  it('HP уходит в минус, персонаж — без сознания', () => {
    const manager = setup();
    const room = makeRoom({ controllers: { p1: 'lib1' }, resources: { p1: resources(10, 5) } });
    const tk = token('t1', { libraryItemId: 'lib1' });
    room.scene.maps[0]!.tokens = [tk];

    manager.adjustTokenHp(room, 'm1', tk, -12);

    expect(room.resources.p1!.hp.current).toBe(-7);
    expect(tk.conditions.some((c) => c.key === 'unconscious')).toBe(true);
  });

  it('урон лежачему добавляет провал; крит — два; 3 провала → мёртв', () => {
    const manager = setup();
    const room = makeRoom({ controllers: { p1: 'lib1' }, resources: { p1: resources(10, 0) } });
    const tk = token('t1', { libraryItemId: 'lib1' });
    room.scene.maps[0]!.tokens = [tk];

    manager.adjustTokenHp(room, 'm1', tk, -3);
    expect(room.resources.p1!.hp.deathFailures).toBe(1);
    manager.adjustTokenHp(room, 'm1', tk, -3, { crit: true });

    expect(room.resources.p1!.hp.deathFailures).toBe(3);
    expect(tk.conditions.some((c) => c.key === 'dead')).toBe(true);
  });

  it('лечение сбрасывает death-сейвы и снимает «Без сознания»', () => {
    const manager = setup();
    const room = makeRoom({ controllers: { p1: 'lib1' }, resources: { p1: resources(10, 0) } });
    room.resources.p1!.hp.deathFailures = 2;
    const tk = token('t1', { libraryItemId: 'lib1' });
    room.scene.maps[0]!.tokens = [tk];

    manager.adjustTokenHp(room, 'm1', tk, 4);

    expect(room.resources.p1!.hp.current).toBe(4);
    expect(room.resources.p1!.hp.deathFailures).toBe(0);
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
    room.scene.maps[0]!.tokens = [tk];
    const combat = room.scene.maps[0]!.combat;
    combat.active = true;
    combat.entries = [entry('e1', 't1', 10)];
    combat.currentIndex = 0;

    manager.beginTurn(room, 'm1', 'e1');

    expect(combat.turns.e1!.movementMax).toBe(DEFAULT_SPEED - 10);
  });
});

describe('RoomManager стабильность и оживление', () => {
  it('урон по лежачему снимает стабильность и начинает death-сейвы заново', () => {
    const manager = setup();
    const room = makeRoom({ controllers: { p1: 'lib1' }, resources: { p1: resources(10, 0) } });
    room.resources.p1!.hp.stable = true;
    const tk = token('t1', { libraryItemId: 'lib1' });
    room.scene.maps[0]!.tokens = [tk];

    manager.adjustTokenHp(room, 'm1', tk, -3);

    expect(room.resources.p1!.hp.stable).toBeUndefined();
    expect(room.resources.p1!.hp.deathFailures).toBe(1);
  });

  it('лечение не оживляет персонажа: счётчики и «Мёртв» сохраняются', () => {
    const manager = setup();
    const room = makeRoom({ controllers: { p1: 'lib1' }, resources: { p1: resources(10, -5) } });
    room.resources.p1!.hp.deathFailures = 3;
    const tk = token('t1', { libraryItemId: 'lib1', conditions: [{ key: 'dead', name: 'Мёртв', rounds: null }] });
    room.scene.maps[0]!.tokens = [tk];

    manager.adjustTokenHp(room, 'm1', tk, 20);

    expect(room.resources.p1!.hp.current).toBe(10);
    expect(room.resources.p1!.hp.deathFailures).toBe(3);
    expect(tk.conditions.some((c) => c.key === 'dead')).toBe(true);
  });

  it('лечение не оживляет монстра', () => {
    const manager = setup();
    const room = makeRoom();
    const monster = token('t1', {
      hpMax: '10',
      hpCurrent: -5,
      conditions: [{ key: 'dead', name: 'Мёртв', rounds: null }],
    });
    room.scene.maps[0]!.tokens = [monster];

    manager.adjustTokenHp(room, 'm1', monster, 12);

    expect(monster.hpCurrent).toBe(7);
    expect(monster.conditions.some((c) => c.key === 'dead')).toBe(true);
  });

  it('reviveToken: 1 HP, сейвы сброшены, «Мёртв»/«Без сознания» сняты', () => {
    const manager = setup();
    const room = makeRoom({ controllers: { p1: 'lib1' }, resources: { p1: resources(10, -5) } });
    room.resources.p1!.hp.deathFailures = 3;
    const tk = token('t1', { libraryItemId: 'lib1', conditions: [{ key: 'dead', name: 'Мёртв', rounds: null }] });
    room.scene.maps[0]!.tokens = [tk];

    manager.reviveToken(room, 'm1', tk);

    expect(room.resources.p1!.hp.current).toBe(1);
    expect(room.resources.p1!.hp.deathFailures).toBe(0);
    expect(tk.conditions).toEqual([]);
  });

  it('stabilizeToken: стабильность и сброс провалов', () => {
    const manager = setup();
    const room = makeRoom({ controllers: { p1: 'lib1' }, resources: { p1: resources(10, 0) } });
    room.resources.p1!.hp.deathFailures = 2;
    const tk = token('t1', { libraryItemId: 'lib1' });
    room.scene.maps[0]!.tokens = [tk];

    manager.stabilizeToken(room, tk);

    expect(room.resources.p1!.hp.stable).toBe(true);
    expect(room.resources.p1!.hp.deathFailures).toBe(0);
  });

  it('clearDeadState: снятие «Мёртв» сбрасывает сейвы, лежачий — «Без сознания»', () => {
    const manager = setup();
    const room = makeRoom({ controllers: { p1: 'lib1' }, resources: { p1: resources(10, -2) } });
    room.resources.p1!.hp.deathFailures = 3;
    const tk = token('t1', { libraryItemId: 'lib1', conditions: [{ key: 'dead', name: 'Мёртв', rounds: null }] });
    room.scene.maps[0]!.tokens = [tk];

    manager.clearDeadState(room, 'p1');

    expect(room.resources.p1!.hp.deathFailures).toBe(0);
    expect(tk.conditions.some((c) => c.key === 'dead')).toBe(false);
    expect(tk.conditions.some((c) => c.key === 'unconscious')).toBe(true);
  });

  it('Death Ward: падение до 0 от урона → 1 HP, эффект снят', () => {
    const manager = setup();
    const room = makeRoom({ controllers: { p1: 'lib1' }, resources: { p1: resources(20, 10) } });
    const tk = token('t1', {
      libraryItemId: 'lib1',
      effects: [
        { id: 'wd', name: 'Death Ward', duration: { type: 'rounds', rounds: 4800 }, modifiers: [], deathWard: true },
      ],
    });
    room.scene.maps[0]!.tokens = [tk];

    manager.adjustTokenHp(room, 'm1', tk, -30);

    expect(room.resources.p1!.hp.current).toBe(1);
    expect(tk.effects.some((e) => e.deathWard)).toBe(false);
    expect(tk.conditions.some((c) => c.key === 'unconscious')).toBe(false);
  });
});

describe('RoomManager иммунитеты к состояниям', () => {
  it('иммунитет блокирует наложение состояния, эффект остаётся', () => {
    const manager = setup();
    const room = makeRoom();
    const tk = token('t1');
    room.scene.maps[0]!.tokens = [tk];
    manager.applyEffect(room, tk, {
      id: 'fom',
      name: 'Freedom of Movement',
      duration: { type: 'rounds', rounds: 600 },
      modifiers: [],
      conditionImmunities: ['paralyzed', 'restrained'],
    });
    manager.applyEffect(room, tk, {
      id: 'hold',
      name: 'Hold Person',
      duration: { type: 'rounds', rounds: 10 },
      modifiers: [],
      conditions: ['paralyzed'],
    });

    expect(tk.conditions.some((c) => c.key === 'paralyzed')).toBe(false);
    expect(tk.effects.some((e) => e.id === 'hold')).toBe(true);
  });

  it('эскалация в иммунное состояние пропускается', () => {
    const manager = setup();
    const room = makeRoom();
    const tk = token('t1', {
      conditions: [{ key: 'incapacitated', name: 'Недееспособен', rounds: null, effectId: 'sleep' }],
    });
    room.scene.maps[0]!.tokens = [tk];
    tk.effects = [
      {
        id: 'sleep',
        name: 'Sleep',
        duration: { type: 'untilSave', ability: 'wis', dc: 99, timing: 'start' },
        modifiers: [],
        conditions: ['incapacitated'],
        escalate: { condition: 'unconscious' },
      },
      {
        id: 'hero',
        name: 'Heroism',
        duration: { type: 'rounds', rounds: 10 },
        modifiers: [],
        conditionImmunities: ['unconscious'],
      },
    ];

    const res = manager.tickEffects(room, tk, 'start');

    expect(res.escalated).toEqual([]);
    expect(tk.conditions.some((c) => c.key === 'incapacitated')).toBe(true);
  });

  it('Freedom of Movement не даёт снизить скорость', () => {
    const manager = setup();
    const room = makeRoom();
    const tk = token('t1', { speed: 30 });
    room.scene.maps[0]!.tokens = [tk];
    manager.applyEffect(room, tk, {
      id: 'slow',
      name: 'Slow',
      duration: { type: 'rounds', rounds: 10 },
      modifiers: [{ id: 'm1', target: 'speed', mode: 'multiply', value: 0.5 }],
    });
    expect(manager.tokenSpeed(room, tk)).toBe(15);

    manager.applyEffect(room, tk, {
      id: 'fom',
      name: 'Freedom of Movement',
      duration: { type: 'rounds', rounds: 600 },
      modifiers: [],
      immuneToSpeedReduction: true,
    });
    expect(manager.tokenSpeed(room, tk)).toBe(30);
  });
});

describe('RoomManager эффекты', () => {
  it('applyEffect связывает состояния, removeEffect снимает их вместе', () => {
    const manager = setup();
    const room = makeRoom();
    const tk = token('t1');
    room.scene.maps[0]!.tokens = [tk];

    manager.applyEffect(room, tk, {
      id: 'ef1',
      name: 'Haste',
      duration: { type: 'concentration' },
      concentration: true,
      sourceId: 't1',
      conditions: ['incapacitated'],
      modifiers: [],
    });

    expect(tk.effects).toHaveLength(1);
    expect(tk.conditions[0]?.effectId).toBe('ef1');

    manager.removeEffect(room, tk, 'ef1');
    expect(tk.effects).toHaveLength(0);
    expect(tk.conditions).toHaveLength(0);
  });

  it('пустой AC считается 13, эффекты применяются', () => {
    const manager = setup();
    const room = makeRoom();
    const tk = token('t1');
    expect(manager.acForToken(room, tk)).toBe(13);

    manager.applyEffect(room, tk, {
      id: 'ef1',
      name: 'Shield',
      duration: { type: 'endOfTurn', of: 'source' },
      sourceId: 't1',
      modifiers: [{ id: 'm1', target: 'ac', mode: 'add', value: 5 }],
    });
    expect(manager.acForToken(room, tk)).toBe(18);
  });

  it('эффекты меняют AC, скорость и доп. действия', () => {
    const manager = setup();
    const room = makeRoom();
    const tk = token('t1', { ac: '12' });
    room.scene.maps[0]!.tokens = [tk];

    manager.applyEffect(room, tk, {
      id: 'ef1',
      name: 'Mage Armor',
      duration: { type: 'permanent' },
      sourceId: 't1',
      modifiers: [{ id: 'm1', target: 'ac', mode: 'set', value: '13+dex' }],
    });
    expect(manager.acForToken(room, tk)).toBe(13);

    manager.applyEffect(room, tk, {
      id: 'ef2',
      name: 'Haste',
      duration: { type: 'concentration' },
      concentration: true,
      sourceId: 't1',
      modifiers: [
        { id: 'm2', target: 'ac', mode: 'add', value: 2 },
        { id: 'm3', target: 'speed', mode: 'multiply', value: 2 },
        { id: 'm4', target: 'extraActions', mode: 'add', value: 1 },
      ],
    });
    expect(manager.acForToken(room, tk)).toBe(15);
    expect(manager.tokenSpeed(room, tk)).toBe(60);

    const combat = room.scene.maps[0]!.combat;
    combat.active = true;
    combat.entries = [entry('e1', 't1', 10)];
    combat.currentIndex = 0;
    manager.beginTurn(room, 'm1', 'e1');
    expect(combat.turns.e1!.movementMax).toBe(60);
    expect(combat.turns.e1!.extraActions).toBe(1);
  });

  it('tickEffects: раунды и «до конца хода»', () => {
    const manager = setup();
    const room = makeRoom();
    const tk = token('t1', {
      effects: [
        { id: 'ef1', name: 'Shield', duration: { type: 'endOfTurn', of: 'source' }, sourceId: 't1', modifiers: [] },
        { id: 'ef2', name: 'Round', duration: { type: 'rounds', rounds: 1 }, modifiers: [] },
      ],
    });
    room.scene.maps[0]!.tokens = [tk];

    const res = manager.tickEffects(room, tk, 'start');

    expect(res.removed).toContain('Shield');
    expect(res.removed).toContain('Round');
    expect(tk.effects).toHaveLength(0);
  });

  it('«до конца хода» источника снимается с чужих токенов', () => {
    const manager = setup();
    const room = makeRoom();
    const caster = token('t1');
    const ally = token('t2', {
      effects: [
        {
          id: 'ef1',
          name: 'Bless',
          duration: { type: 'endOfTurn', of: 'source' },
          sourceId: 't1',
          modifiers: [],
        },
      ],
    });
    room.scene.maps[0]!.tokens = [caster, ally];

    manager.tickEffects(room, caster, 'start');

    expect(ally.effects).toHaveLength(0);
  });

  it('tickEffects: escalate меняет состояние при провале повторного спаса (Sleep)', () => {
    const manager = setup();
    const room = makeRoom();
    const tk = token('t1', {
      effects: [
        {
          id: 'ef1',
          name: 'Sleep',
          duration: { type: 'untilSave', ability: 'wis', dc: 100, timing: 'end' },
          conditions: ['incapacitated'],
          escalate: { condition: 'unconscious', duration: { type: 'concentration' } },
          modifiers: [],
        },
      ],
      conditions: [{ key: 'incapacitated', name: 'Недееспособен', effectId: 'ef1' }],
    });
    room.scene.maps[0]!.tokens = [tk];

    const res = manager.tickEffects(room, tk, 'end');

    expect(res.escalated).toEqual([{ name: 'Sleep', condition: 'unconscious' }]);
    expect(tk.effects[0]!.duration.type).toBe('concentration');
    expect(tk.conditions[0]!.key).toBe('unconscious');
  });

  it('урон снимает эффект с wakeOnDamage (Sleep)', () => {
    const manager = setup();
    const room = makeRoom();
    const tk = token('t1', {
      hpCurrent: 10,
      hpMax: '10',
      effects: [{ id: 'ef1', name: 'Sleep', duration: { type: 'concentration' }, wakeOnDamage: true, modifiers: [] }],
      conditions: [{ key: 'unconscious', name: 'Без сознания', effectId: 'ef1' }],
    });
    room.scene.maps[0]!.tokens = [tk];

    manager.adjustTokenHp(room, 'm1', tk, -3);

    expect(tk.effects).toHaveLength(0);
    expect(tk.conditions).toHaveLength(0);
    expect(tk.hpCurrent).toBe(7);
  });

  it('последняя цель Sleep уходит уроном — концентрация кастера снимается', () => {
    const manager = setup();
    const room = makeRoom();
    const caster = token('t1', {
      effects: [
        {
          id: 'anchor',
          name: 'Sleep',
          concentration: true,
          sourceId: 't1',
          sourceKey: 'XPHB:Sleep',
          duration: { type: 'concentration' },
          modifiers: [],
        },
      ],
    });
    const target = token('t2', {
      hpCurrent: 10,
      hpMax: '10',
      effects: [
        {
          id: 'ef1',
          name: 'Sleep',
          concentration: true,
          sourceId: 't1',
          sourceKey: 'XPHB:Sleep',
          duration: { type: 'concentration' },
          wakeOnDamage: true,
          modifiers: [],
        },
      ],
      conditions: [{ key: 'unconscious', name: 'Без сознания', effectId: 'ef1' }],
    });
    room.scene.maps[0]!.tokens = [caster, target];
    const combat = room.scene.maps[0]!.combat;
    combat.active = true;
    combat.entries = [entry('e1', 't1', 10), entry('e2', 't2', 5)];
    combat.currentIndex = 0;
    manager.beginTurn(room, 'm1', 'e1');
    combat.turns.e1!.concentrationId = 'anchor';

    const changed = manager.adjustTokenHp(room, 'm1', target, -3);

    expect(target.effects).toHaveLength(0);
    expect(caster.effects).toHaveLength(0);
    expect(combat.turns.e1!.concentrationId).toBeNull();
    expect(changed.some((c) => c.token.id === 't1')).toBe(true);
  });

  it('пока держится другая цель Sleep — концентрация остаётся', () => {
    const manager = setup();
    const room = makeRoom();
    const caster = token('t1', {
      effects: [
        {
          id: 'anchor',
          name: 'Sleep',
          concentration: true,
          sourceId: 't1',
          sourceKey: 'XPHB:Sleep',
          duration: { type: 'concentration' },
          modifiers: [],
        },
      ],
    });
    const victim = token('t2', {
      hpCurrent: 10,
      hpMax: '10',
      effects: [
        {
          id: 'ef1',
          name: 'Sleep',
          concentration: true,
          sourceId: 't1',
          sourceKey: 'XPHB:Sleep',
          duration: { type: 'concentration' },
          wakeOnDamage: true,
          modifiers: [],
        },
      ],
    });
    const sleeper = token('t3', {
      effects: [
        {
          id: 'ef2',
          name: 'Sleep',
          concentration: true,
          sourceId: 't1',
          sourceKey: 'XPHB:Sleep',
          duration: { type: 'concentration' },
          wakeOnDamage: true,
          modifiers: [],
        },
      ],
    });
    room.scene.maps[0]!.tokens = [caster, victim, sleeper];
    const combat = room.scene.maps[0]!.combat;
    combat.active = true;
    combat.entries = [entry('e1', 't1', 10)];
    combat.currentIndex = 0;
    manager.beginTurn(room, 'm1', 'e1');
    combat.turns.e1!.concentrationId = 'anchor';

    manager.adjustTokenHp(room, 'm1', victim, -3);

    expect(caster.effects.map((e) => e.id)).toEqual(['anchor']);
    expect(combat.turns.e1!.concentrationId).toBe('anchor');
  });

  it('зона каста остаётся — концентрация не снимается при уходе цели', () => {
    const manager = setup();
    const room = makeRoom();
    const caster = token('t1');
    const victim = token('t2', {
      hpCurrent: 10,
      hpMax: '10',
      effects: [
        {
          id: 'ef1',
          name: 'Sleep',
          concentration: true,
          sourceId: 't1',
          sourceKey: 'XPHB:Sleep',
          duration: { type: 'concentration' },
          wakeOnDamage: true,
          modifiers: [],
        },
      ],
    });
    room.scene.maps[0]!.tokens = [caster, victim];
    room.scene.maps[0]!.zones = [
      {
        id: 'z1',
        name: 'Sleep',
        sourceKey: 'XPHB:Sleep',
        sourceId: 't1',
        origin: { x: 0, y: 0 },
        area: { shape: 'sphere', size: 20 },
        duration: { type: 'concentration' },
        concentration: true,
      },
    ];
    const combat = room.scene.maps[0]!.combat;
    combat.active = true;
    combat.entries = [entry('e1', 't1', 10)];
    combat.currentIndex = 0;
    manager.beginTurn(room, 'm1', 'e1');
    combat.turns.e1!.concentrationId = 'anchor';

    manager.adjustTokenHp(room, 'm1', victim, -3);

    expect(combat.turns.e1!.concentrationId).toBe('anchor');
  });

  it('тик эффектов: уход последней цели снимает концентрацию', () => {
    const manager = setup();
    const room = makeRoom();
    const caster = token('t1');
    const target = token('t2', {
      effects: [
        {
          id: 'ef1',
          name: 'Hold Person',
          concentration: true,
          sourceId: 't1',
          sourceKey: 'XPHB:Hold Person',
          duration: { type: 'rounds', rounds: 1 },
          modifiers: [],
        },
      ],
    });
    caster.effects = [
      {
        id: 'anchor',
        name: 'Hold Person',
        concentration: true,
        sourceId: 't1',
        sourceKey: 'XPHB:Hold Person',
        duration: { type: 'concentration' },
        modifiers: [],
      },
    ];
    room.scene.maps[0]!.tokens = [caster, target];
    const combat = room.scene.maps[0]!.combat;
    combat.active = true;
    combat.entries = [entry('e1', 't1', 10)];
    combat.currentIndex = 0;
    manager.beginTurn(room, 'm1', 'e1');
    combat.turns.e1!.concentrationId = 'anchor';

    const res = manager.tickEffects(room, target, 'start');

    expect(res.pruned.some((c) => c.token.id === 't1')).toBe(true);
    expect(caster.effects).toHaveLength(0);
    expect(combat.turns.e1!.concentrationId).toBeNull();
  });

  it('clearConcentration снимает эффекты и чистит concentrationId', () => {
    const manager = setup();
    const room = makeRoom();
    const caster = token('t1');
    const ally = token('t2', {
      effects: [
        {
          id: 'ef1',
          name: 'Bless',
          concentration: true,
          sourceId: 't1',
          duration: { type: 'concentration' },
          modifiers: [],
        },
      ],
      conditions: [{ key: 'custom', name: 'X', effectId: 'ef1' }],
    });
    room.scene.maps[0]!.tokens = [caster, ally];
    const combat = room.scene.maps[0]!.combat;
    combat.active = true;
    combat.entries = [entry('e1', 't1', 10)];
    combat.currentIndex = 0;
    manager.beginTurn(room, 'm1', 'e1');
    manager.setConcentration(room, 'm1', caster, 'ef1');

    const changed = manager.clearConcentration(room, 't1');

    expect(changed.map((c) => c.token.id)).toEqual(['t2']);
    expect(ally.effects).toHaveLength(0);
    expect(ally.conditions).toHaveLength(0);
    expect(combat.turns.e1!.concentrationId).toBeNull();
  });

  it('concentrationCheck: успех сохраняет, провал снимает эффекты', () => {
    const manager = setup();
    const room = makeRoom();
    const strong = token('t1', {
      statblock: { abilities: { ...DEFAULT_ABILITIES, con: 30 }, saves: { con: 100 } },
      effects: [
        {
          id: 'ef1',
          name: 'Bless',
          concentration: true,
          sourceId: 't1',
          duration: { type: 'concentration' },
          modifiers: [],
        },
      ],
    });
    const weak = token('t2', {
      statblock: { abilities: { ...DEFAULT_ABILITIES, con: 1 }, saves: { con: -100 } },
      effects: [
        {
          id: 'ef2',
          name: 'Bless',
          concentration: true,
          sourceId: 't2',
          duration: { type: 'concentration' },
          modifiers: [],
        },
      ],
    });
    room.scene.maps[0]!.tokens = [strong, weak];

    const ok = manager.concentrationCheck(room, strong, 40);
    expect(ok?.success).toBe(true);
    expect(ok?.dc).toBe(20);
    expect(strong.effects).toHaveLength(1);

    const fail = manager.concentrationCheck(room, weak, 10);
    expect(fail?.success).toBe(false);
    expect(weak.effects).toHaveLength(0);
  });

  it('эффект-защита добавляется к сопротивлениям при расчёте урона', () => {
    const manager = setup();
    const room = makeRoom();
    const tk = token('t1', {
      effects: [
        {
          id: 'ef1',
          name: 'Stoneskin',
          concentration: true,
          sourceId: 't1',
          duration: { type: 'concentration' },
          modifiers: [
            { id: 'm1', target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'slashing' } },
          ],
        },
      ],
    });
    room.scene.maps[0]!.tokens = [tk];

    const defenses = manager.damageDefensesForToken(room, tk);
    expect(defenses.some((d) => d.type === 'resistance' && d.damageType === 'slashing')).toBe(true);
  });

  it('Aid начисляет и откатывает максимум HP у монстра', () => {
    const manager = setup();
    const room = makeRoom();
    const tk = token('t1', { hpMax: '10', hpCurrent: 10 });
    room.scene.maps[0]!.tokens = [tk];
    const aid: EffectInstance = {
      id: 'ef1',
      name: 'Aid',
      duration: { type: 'permanent' },
      modifiers: [{ id: 'm1', target: 'maxHp', mode: 'add', value: 5 }],
    };

    manager.applyEffect(room, tk, aid);
    expect(tk.hpMax).toBe('15');
    expect(tk.hpCurrent).toBe(15);

    manager.removeEffect(room, tk, 'ef1');
    expect(tk.hpMax).toBe('10');
    expect(tk.hpCurrent).toBe(10);
  });

  it('Aid у персонажа идёт в ресурсы и откатывается', () => {
    const manager = setup();
    const room = makeRoom({ controllers: { p1: 'lib1' }, resources: { p1: resources(20, 10) } });
    const tk = token('t1', { libraryItemId: 'lib1' });
    room.scene.maps[0]!.tokens = [tk];
    const aid: EffectInstance = {
      id: 'ef1',
      name: 'Aid',
      duration: { type: 'permanent' },
      modifiers: [{ id: 'm1', target: 'maxHp', mode: 'add', value: 5 }],
    };

    manager.applyEffect(room, tk, aid);
    expect(room.resources.p1!.hp.max).toBe(25);
    expect(room.resources.p1!.hp.current).toBe(15);

    manager.removeEffect(room, tk, 'ef1');
    expect(room.resources.p1!.hp.max).toBe(20);
    expect(room.resources.p1!.hp.current).toBe(15);
  });

  it('clearEffectsForPlayer снимает эффекты, состояния и концентрацию', () => {
    const manager = setup();
    const room = makeRoom({ controllers: { p1: 'lib1' }, resources: { p1: resources(20, 20) } });
    const conc = (id: string, sourceId: string): EffectInstance => ({
      id,
      name: 'Hex',
      duration: { type: 'concentration' },
      concentration: true,
      sourceId,
      modifiers: [],
    });
    const caster = token('t1', { libraryItemId: 'lib1' });
    const ally = token('t2');
    room.scene.maps[0]!.tokens = [caster, ally];

    manager.applyEffect(room, caster, {
      id: 'ef1',
      name: 'Aid',
      duration: { type: 'permanent' },
      modifiers: [{ id: 'm1', target: 'maxHp', mode: 'add', value: 5 }],
    });
    manager.applyEffect(room, caster, { ...conc('ef2', 't1'), conditions: ['custom'] });
    manager.applyEffect(room, ally, conc('ef3', 't1'));
    expect(room.resources.p1!.hp.max).toBe(25);
    expect(caster.conditions).toHaveLength(1);

    const changed = manager.clearEffectsForPlayer(room, 'p1');

    expect(changed.map((c) => c.token.id).sort()).toEqual(['t1', 't2']);
    expect(caster.effects).toHaveLength(0);
    expect(caster.conditions).toHaveLength(0);
    expect(ally.effects).toHaveLength(0);
    expect(room.resources.p1!.hp.max).toBe(20);
  });
});

describe('RoomManager настройки комнаты', () => {
  it('setTestMode переключает режим и попадает в toState', () => {
    const manager = setup();
    const room = makeRoom();

    expect(manager.toState(room).testMode).toBe(false);
    manager.setTestMode(room, true);
    expect(room.testMode).toBe(true);
    expect(manager.toState(room).testMode).toBe(true);
    manager.setTestMode(room, false);
    expect(manager.toState(room).testMode).toBe(false);
  });

  it('toState отсекает рантайм-поля и socketId игроков', () => {
    const manager = setup();
    const room = makeRoom();
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: 's1' });

    const state = manager.toState(room);

    expect('sheets' in state).toBe(false);
    expect('resources' in state).toBe(false);
    expect('nextZ' in state).toBe(false);
    expect('socketId' in state.players[0]!).toBe(false);
  });
});
