import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_GRID,
  DEFAULT_SPEED,
  defaultFog,
  emptyCombatState,
  emptyTurnState,
  type ClientToServerEvents,
  type Token,
} from 'shared';
import type { Room } from '../roomTypes';
import { RoomManager } from '../rooms';
import type { ConnCtx } from './context';
import { registerCombatHandlers } from './combat';
import { registerTokenHandlers } from './token';

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

  const ctx = {
    io: {},
    socket: {
      emit: (event: string, payload: unknown) => {
        emitted.push({ event, payload });
      },
    },
    manager,
    roomCode: room.code,
    playerId: opts.playerId ?? (dm ? 'dm' : null),
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
    canControlToken: () => dm,
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
    systemMessage: () => {},
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
