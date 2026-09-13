import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_GRID,
  DEFAULT_SPEED,
  defaultFog,
  emptyCombatState,
  emptyTurnState,
  type CharacterSheet,
  type ClientToServerEvents,
  type PlayerResources,
  type Token,
} from 'shared';
import type { Room } from '../roomTypes';
import { RoomManager } from '../rooms';
import type { ConnCtx } from './context';
import { registerCombatHandlers } from './combat';
import { registerTokenHandlers } from './token';
import { registerActionHandlers } from './actions';
import { registerSpellHandlers } from './spells';
import { registerDiceHandlers } from './dice';

function makeToken(id: string, overrides: Partial<Token> = {}): Token {
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
    w: 50,
    h: 50,
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

function makeRoom(tokens: Token[], controllers: Record<string, string>): Room {
  const combat = {
    ...emptyCombatState(),
    active: true,
    round: 1,
    currentIndex: 0,
    entries: [{ id: 'e1', tokenId: 't1', name: 'A', imageUrl: '', initiative: 10, bonus: '' }],
    turns: { e1: { ...emptyTurnState(30), movementUsed: 0 } },
  };
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
          tokens,
          fog: defaultFog(DEFAULT_GRID),
          combat,
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
    controllers,
  };
}

interface FakeCtx {
  ctx: ConnCtx;
  invoke: <E extends keyof ClientToServerEvents>(
    event: E,
    ...args: Parameters<ClientToServerEvents[E]>
  ) => void;
  emitted: { event: string; payload: unknown }[];
  manager: RoomManager;
  room: Room;
}

function makeCtx(room: Room, opts: { playerId?: string | null; dm?: boolean } = {}): FakeCtx {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const emitted: { event: string; payload: unknown }[] = [];
  const manager = new RoomManager();
  vi.spyOn(manager, 'saveSoon').mockImplementation(() => {});
  const dm = opts.dm === true;
  const pid = opts.playerId ?? (dm ? 'dm' : null);

  const ctx = {
    io: {},
    socket: {
      emit: (event: string, payload: unknown) => {
        emitted.push({ event, payload });
      },
    },
    manager,
    roomCode: room.code,
    playerId: pid,
    pendingLeaves: new Map(),
    on: (event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
    },
    onDisconnect: () => {},
    broadcast: () => {},
    broadcastAll: () => {},
    broadcastMaps: () => {},
    getRoom: () => room,
    cancelPendingLeave: () => {},
    isDm: () => dm,
    dmRoom: () => (dm ? room : null),
    canControlToken: (r: Room, mapId: string, token: Token) =>
      dm || (!!pid && manager.controlsToken(r, mapId, pid, token)),
    visibleToken: (_room: Room, token: Token) => token,
    visibleLibrary: () => room.library,
    broadcastLibrary: () => {},
    emitToken: (event: string, mapId: string, token: Token) => {
      emitted.push({ event, payload: { mapId, token } });
    },
    syncCombat: (r: Room, mapId: string) => {
      emitted.push({
        event: 'combat:update',
        payload: { mapId, combat: r.scene.maps.find((m) => m.id === mapId)?.combat },
      });
    },
    cleanLabel: (label?: string) => label,
    systemMessage: (_room: Room, text: string) => {
      emitted.push({ event: 'system', payload: text });
    },
    emitJoined: () => {},
    classIdentity: () => '',
  } as unknown as ConnCtx;

  const invoke = <E extends keyof ClientToServerEvents>(
    event: E,
    ...args: Parameters<ClientToServerEvents[E]>
  ) => {
    const handler = handlers.get(event as string);
    if (!handler) throw new Error(`handler ${String(event)} не зарегистрирован`);
    handler(...(args as unknown[]));
  };

  return { ctx, invoke, emitted, manager, room };
}

const combatOf = (room: Room) => room.scene.maps[0].combat;

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
    room.scene.maps[0].tokens.push(makeToken('t2'));
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
    expect(combatOf(room).turns.e1.movementUsed).toBe(20);
    expect(combatOf(room).turns.e1.diagonalsUsed).toBe(2);
  });

  it('setMovement чужого игрока игнорируется', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p2: 'lib2' });
    const f = makeCtx(room, { playerId: 'p2' });
    registerCombatHandlers(f.ctx);
    f.invoke('combat:setMovement', { mapId: 'm1', tokenId: 't1', used: 20 });
    expect(combatOf(room).turns.e1.movementUsed).toBe(0);
  });
});

describe('action:use', () => {
  it('Рывок тратит действие и добавляет передвижение', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1', speed: 30 })], { p1: 'lib1' });
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'dash', slot: 'action' });

    expect(combatOf(room).turns.e1.actionUsed).toBe(true);
    expect(combatOf(room).turns.e1.movementMax).toBe(60);
    expect(f.emitted.some((e) => e.event === 'system' && String(e.payload).includes('Рывок'))).toBe(true);
  });

  it('игрок не может действовать не в свой ход', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.scene.maps[0].tokens.push(makeToken('t2'));
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    combatOf(room).currentIndex = 1;
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'dash' });
    expect(combatOf(room).turns.e1.actionUsed).toBe(false);
    expect(f.emitted.some((e) => e.event === 'chat:error')).toBe(true);
  });

  it('Атака списывает действие и оружие бьёт', () => {
    const room = makeRoom([makeToken('t1')], {});
    const token = room.scene.maps[0].tokens[0];
    token.attacks = [
      { name: 'Bite', hit: 'd20+5', damage: 'd6+3', rangeType: 'none', rangeNormal: 0, rangeLong: 0 },
    ];
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0 });

    expect(combatOf(room).turns.e1.actionUsed).toBe(true);
    expect(combatOf(room).turns.e1.attacksRemaining).toBe(0);
    expect(room.chat.length).toBeGreaterThan(0);
  });
});

describe('token:update права', () => {
  it('игрок-контролёр меняет hpTemp/conditions, но не faction/speed/statblock', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    const f = makeCtx(room, { playerId: 'p1' });
    registerTokenHandlers(f.ctx);
    const token = room.scene.maps[0].tokens[0];

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
    const token = room.scene.maps[0].tokens[0];

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
  return {
    hp: { current: 30, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
    hitDice: [],
    spellSlots: [{ level: 3, current: 1, max: 1 }],
    pact: { current: 0, max: 0, level: 0 },
    resources: [],
    notes: '',
  };
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

    expect(room.resources.p1.spellSlots[0].current).toBe(0);
    expect(combatOf(room).turns.e1.actionUsed).toBe(true);
    expect(room.chat.some((m) => m.kind === 'roll' && m.rollKind === 'save')).toBe(true);
  });

  it('без выбранного заклинания не кастует', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.sheets.p1 = casterSheet();
    room.resources.p1 = casterResources();
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Cure Wounds', slotLevel: 1 });

    expect(room.resources.p1.spellSlots[0].current).toBe(1);
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

    const t2 = room.scene.maps[0].tokens.find((t) => t.id === 't2')!;
    const t3 = room.scene.maps[0].tokens.find((t) => t.id === 't3')!;
    const t5 = room.scene.maps[0].tokens.find((t) => t.id === 't5')!;
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
    expect(subject(attacks[0])).toContain('(1/3)');
    expect(subject(attacks[2])).toContain('(3/3)');
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
    room.scene.maps[0].tokens[0].attacks = [
      { name: 'Огонь', hit: 'd20+20', damage: '2d6', damageType: 'fire', rangeType: 'none', rangeNormal: 0, rangeLong: 0 },
    ];
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });

    expect(room.scene.maps[0].tokens.find((t) => t.id === 't2')?.hpCurrent).toBe(30);
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

    expect(room.scene.maps[0].tokens[0].x).toBe(0);
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

    expect(combatOf(room).turns.e1.actionUsed).toBe(false);
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
    room.scene.maps[0].tokens[0].attacks = [
      { name: 'Меч', hit: 'd20+20', damage: '1d6', damageType: 'slashing', rangeType: 'melee', rangeNormal: 5, rangeLong: 0 },
    ];
    const f = makeCtx(room, { dm: true });
    registerDiceHandlers(f.ctx);

    f.invoke('dice:attack', { tokenId: 't1', targetId: 't2', attackIndex: 0 });

    const damage = room.chat.find((m) => m.kind === 'roll' && m.rollKind === 'damage');
    expect(damage && (damage as { crit?: boolean }).crit).toBe(true);
  });
});
