import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CharacterSheet, ChatMessage, RollMessage, Wall } from 'shared';
import { makeConnCtx } from '../test/ctx';
import { makeRoom, makeToken } from '../test/fixtures';
import type { Room } from '../roomTypes';
import { inDoorReach, pickExpression, registerDoorHandlers } from './doors';

const DOOR: Wall = { id: 'd1', kind: 'door', x1: 100, y1: 0, x2: 100, y2: 50 };

function sheet(overrides: Partial<CharacterSheet> = {}): CharacterSheet {
  return {
    name: 'Иван',
    abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: '2',
    saves: {},
    skills: {},
    attacks: [],
    classes: [],
    spells: [],
    hpMax: '',
    ac: '',
    speed: 30,
    senses: [],
    damageDefenses: [],
    ...overrides,
  };
}

interface RoomOpts {
  controllers?: Record<string, string>;
  sheets?: Record<string, CharacterSheet>;
}

/** Комната с дверью и токеном у неё (по умолчанию — персонаж игрока p1). */
function makeDoorRoom(opts: RoomOpts = {}) {
  const room: Room = makeRoom({
    controllers: opts.controllers ?? { p1: 'lib1' },
    sheets: opts.sheets ?? { p1: sheet() },
  });
  const map = room.scene.maps[0]!;
  map.walls = [{ ...DOOR }];
  const token = makeToken('t1', { libraryItemId: 'lib1', isPlayerToken: true, x: 50, y: 25 });
  map.tokens.push(token);
  return { room, map, token };
}

const texts = (events: { event: string; payload: unknown }[]) =>
  events
    .filter((e) => e.event === 'chat:message')
    .map((e) => {
      const message = e.payload as ChatMessage;
      return message.kind === 'text' ? message.text : '';
    });

const wallsUpdates = (events: { event: string }[]) => events.filter((e) => e.event === 'walls:update');

const rolls = (events: { event: string; payload: unknown }[]): RollMessage[] =>
  events
    .filter((e) => e.event === 'chat:message')
    .map((e) => e.payload as ChatMessage)
    .filter((m): m is RollMessage => m.kind === 'roll');

afterEach(() => vi.restoreAllMocks());

describe('door:toggle', () => {
  it('DM открывает и закрывает дверь, не ломая замок', () => {
    const { room, map } = makeDoorRoom();
    map.walls[0]!.pickDc = 15;
    const dm = makeConnCtx(room, { dm: true });
    registerDoorHandlers(dm.ctx);

    dm.invoke('door:toggle', { mapId: 'm1', wallId: 'd1' });
    expect(map.walls[0]!.open).toBe(true);
    expect(map.walls[0]!.pickDc).toBe(15);
    expect(wallsUpdates(dm.emitted)).toHaveLength(1);
    expect(texts(dm.emitted).at(-1)).toContain('открыл');

    dm.invoke('door:toggle', { mapId: 'm1', wallId: 'd1' });
    expect(map.walls[0]!.open).toBe(false);
    expect(map.walls[0]!.pickDc).toBe(15);
  });

  it('игрок открывает незапертую дверь своим токеном рядом', () => {
    const { room, map } = makeDoorRoom();
    const player = makeConnCtx(room, { playerId: 'p1' });
    registerDoorHandlers(player.ctx);

    player.invoke('door:toggle', { mapId: 'm1', wallId: 'd1' });
    expect(map.walls[0]!.open).toBe(true);
    expect(wallsUpdates(player.emitted)).toHaveLength(1);
    expect(texts(player.emitted).at(-1)).toContain('открыл');
  });

  it('чужой токен и токен не в радиусе — ничего не делают', () => {
    const { room, map, token } = makeDoorRoom();
    token.x = 300; // далеко
    const player = makeConnCtx(room, { playerId: 'p1' });
    registerDoorHandlers(player.ctx);

    player.invoke('door:toggle', { mapId: 'm1', wallId: 'd1' });
    expect(map.walls[0]!.open).toBeUndefined();
    expect(wallsUpdates(player.emitted)).toHaveLength(0);

    token.x = 50;
    const stranger = makeConnCtx(room, { playerId: 'p2' });
    registerDoorHandlers(stranger.ctx);
    stranger.invoke('door:toggle', { mapId: 'm1', wallId: 'd1' });
    expect(map.walls[0]!.open).toBeUndefined();
    expect(wallsUpdates(stranger.emitted)).toHaveLength(0);
  });

  it('dmOnly-дверь игроку недоступна, DM — открывает', () => {
    const { room, map } = makeDoorRoom();
    map.walls[0]!.dmOnly = true;
    const player = makeConnCtx(room, { playerId: 'p1' });
    registerDoorHandlers(player.ctx);
    player.invoke('door:toggle', { mapId: 'm1', wallId: 'd1' });
    expect(map.walls[0]!.open).toBeUndefined();

    const dm = makeConnCtx(room, { dm: true });
    registerDoorHandlers(dm.ctx);
    dm.invoke('door:toggle', { mapId: 'm1', wallId: 'd1' });
    expect(map.walls[0]!.open).toBe(true);
  });

  it('в бою запертую дверь не взломать', () => {
    const { room, map } = makeDoorRoom();
    map.walls[0]!.pickDc = 15;
    map.combat.active = true;
    const player = makeConnCtx(room, { playerId: 'p1' });
    registerDoorHandlers(player.ctx);

    player.invoke('door:toggle', { mapId: 'm1', wallId: 'd1' });
    expect(map.walls[0]!.open).toBeUndefined();
    expect(player.selfEvents('chat:error')[0]!.payload).toContain('бою');
  });

  it('взлом вне боя: проверка карточкой, успех снимает замок, провал — повторяем', () => {
    const { room, map } = makeDoorRoom();
    map.walls[0]!.pickDc = 15;
    const player = makeConnCtx(room, { playerId: 'p1' });
    registerDoorHandlers(player.ctx);

    vi.spyOn(Math, 'random').mockReturnValue(0);
    player.invoke('door:toggle', { mapId: 'm1', wallId: 'd1' });
    expect(map.walls[0]!.open).toBeUndefined();
    expect(wallsUpdates(player.emitted)).toHaveLength(0);
    const failRoll = rolls(player.emitted).at(-1);
    expect(failRoll?.rollKind).toBe('check');
    expect(failRoll?.labelParams).toMatchObject({ subject: 'Взлом двери', dc: 15, checkOutcome: 'fail' });

    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    player.invoke('door:toggle', { mapId: 'm1', wallId: 'd1' });
    expect(map.walls[0]!.open).toBe(true);
    expect(map.walls[0]!.pickDc).toBe(0); // взломана — следующим не нужно
    expect(wallsUpdates(player.emitted)).toHaveLength(1);
    const okRoll = rolls(player.emitted).at(-1);
    expect(okRoll?.rollKind).toBe('check');
    expect(okRoll?.labelParams).toMatchObject({ subject: 'Взлом двери', dc: 15, checkOutcome: 'success' });
  });

  it('canInteract-токен без листа взламывает Ловкостью (ЛОВ статблока)', () => {
    const { room, map } = makeDoorRoom({
      controllers: { p1: 'lib2' },
      sheets: {},
    });
    const token = map.tokens[0]!;
    token.isPlayerToken = false;
    token.canInteract = true;
    token.libraryItemId = 'lib2';
    token.statblock = {
      abilities: { str: 10, dex: 20, con: 10, int: 10, wis: 10, cha: 10 },
    };
    map.walls[0]!.pickDc = 20;
    const player = makeConnCtx(room, { playerId: 'p1' });
    registerDoorHandlers(player.ctx);

    vi.spyOn(Math, 'random').mockReturnValue(0.999); // d20 = 20, +5 ЛОВ = 25 >= 20
    player.invoke('door:toggle', { mapId: 'm1', wallId: 'd1' });
    expect(map.walls[0]!.open).toBe(true);
    expect(map.walls[0]!.pickDc).toBe(0);
  });

  it('открытую дверь игрок закрывает бесплатно и в бою', () => {
    const { room, map } = makeDoorRoom();
    map.walls[0]!.open = true;
    map.combat.active = true;
    const player = makeConnCtx(room, { playerId: 'p1' });
    registerDoorHandlers(player.ctx);

    player.invoke('door:toggle', { mapId: 'm1', wallId: 'd1' });
    expect(map.walls[0]!.open).toBe(false);
    expect(texts(player.emitted).at(-1)).toContain('закрыл');
  });
});

describe('door:update (настройки двери)', () => {
  it('DM меняет dmOnly/Сл, клампит DC и удаляет настройки нулём; игрок — не может', () => {
    const { room, map } = makeDoorRoom();
    map.walls.push({ id: 'w1', kind: 'wall', x1: 0, y1: 0, x2: 50, y2: 0 });
    const dm = makeConnCtx(room, { dm: true });
    registerDoorHandlers(dm.ctx);

    dm.invoke('door:update', { mapId: 'm1', wallId: 'd1', patch: { dmOnly: true, pickDc: 17 } });
    expect(map.walls[0]!).toMatchObject({ dmOnly: true, pickDc: 17 });
    expect(wallsUpdates(dm.emitted)).toHaveLength(1);

    dm.invoke('door:update', { mapId: 'm1', wallId: 'd1', patch: { pickDc: 99 } });
    expect(map.walls[0]!.pickDc).toBe(40);

    dm.invoke('door:update', { mapId: 'm1', wallId: 'w1', patch: { dmOnly: true, pickDc: 20 } });
    expect(map.walls[1]!.dmOnly).toBeUndefined();
    expect(map.walls[1]!.pickDc).toBeUndefined();

    dm.invoke('door:update', { mapId: 'm1', wallId: 'd1', patch: { dmOnly: false, pickDc: 0 } });
    expect(map.walls[0]!.dmOnly).toBeUndefined();
    expect(map.walls[0]!.pickDc).toBeUndefined();

    const player = makeConnCtx(room, { playerId: 'p1' });
    registerDoorHandlers(player.ctx);
    player.invoke('door:update', { mapId: 'm1', wallId: 'd1', patch: { dmOnly: true, pickDc: 25 } });
    expect(map.walls[0]!.dmOnly).toBeUndefined();
    expect(map.walls[0]!.pickDc).toBeUndefined();
  });
});

describe('дверная геометрия', () => {
  it('inDoorReach считает от края подошвы', () => {
    const door = DOOR;
    expect(inDoorReach({ x: 50, y: 25, w: 50, h: 50 }, door, 50)).toBe(true);
    expect(inDoorReach({ x: 200, y: 25, w: 50, h: 50 }, door, 50)).toBe(false);
    // 2×2 вплотную к двери
    expect(inDoorReach({ x: 50, y: 50, w: 100, h: 100 }, door, 50)).toBe(true);
  });

  it('pickExpression: лист (число/кость владения), экспертиза и статблок', () => {
    const { room, token } = makeDoorRoom({ sheets: { p1: sheet({ skills: { sleightOfHand: 1 }, proficiencyBonus: '3' }) } });
    expect(pickExpression(room, token)).toBe('d20+2+3'); // ЛОВ 14 (+2) + владение 1×3

    const dice = makeDoorRoom({ sheets: { p1: sheet({ skills: { sleightOfHand: 2 }, proficiencyBonus: 'd4' }) } });
    expect(pickExpression(dice.room, dice.token)).toBe('d20+2+2d4'); // экспертиза костью владения

    token.libraryItemId = '';
    room.controllers = {};
    token.statblock = { abilities: { str: 10, dex: 20, con: 10, int: 10, wis: 10, cha: 10 } };
    expect(pickExpression(room, token)).toBe('d20+5');
  });
});
