import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TokenFields } from 'shared';
import { makeCombatRoom as makeRoom, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { LEAVE_GRACE_MS } from './context';

describe('интеграция: полное соединение', () => {
  it('room:create → map:add → library:add → token:add', () => {
    const f = makeConnCtx(makeRoom([], {}), { dm: true, all: true });

    f.invoke('room:create', { name: 'Мастер', clientId: 'dm', roomName: 'Игра' }, () => void 0);
    const code = f.ctx.roomCode!;
    const room = f.manager.get(code)!;
    expect(room.name).toBe('Игра');
    expect(f.selfEvents('room:joined')).toHaveLength(1);

    f.invoke('map:add', { name: 'Карта', url: '/uploads/m.png', width: 800, height: 600 });
    expect(room.scene.maps).toHaveLength(1);
    const mapId = room.scene.maps[0]!.id;

    f.invoke('library:add', { name: 'Гоблин' } as TokenFields);
    expect(room.library).toHaveLength(1);
    const item = room.library[0]!;

    f.invoke('token:add', { mapId, libraryItemId: item.id, x: 50, y: 50 });
    expect(room.scene.maps[0]!.tokens).toHaveLength(1);
  });
});

describe('интеграция: отключение', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('через LEAVE_GRACE_MS игрок помечается отключённым', () => {
    vi.useFakeTimers();
    const room = makeRoom([makeToken('t1')], {});
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: 's:p1' });
    const f = makeConnCtx(room, { playerId: 'p1', all: true });

    f.disconnect();
    expect(room.players.find((p) => p.id === 'p1')!.isConnected).toBe(true);

    f.advance(LEAVE_GRACE_MS);
    expect(room.players.find((p) => p.id === 'p1')!.isConnected).toBe(false);
    expect(room.chat.some((m) => m.kind === 'text' && m.text.includes('вышел'))).toBe(true);
  });
});
