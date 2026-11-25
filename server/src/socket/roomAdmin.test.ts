import { describe, expect, it } from 'vitest';
import { makeCombatRoom, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';

describe('token:lock', () => {
  it('DM ставит и снимает лок, рассылая token:update', () => {
    const room = makeCombatRoom([makeToken('t1')]);
    const f = makeConnCtx(room, { all: true, dm: true });
    const token = room.scene.maps[0]!.tokens[0]!;

    f.invoke('token:lock', { mapId: 'm1', id: 't1', lock: true });
    expect(token.lockedBy).toBe('dm');
    expect(f.emitted.some((e) => e.event === 'token:update')).toBe(true);

    f.invoke('token:lock', { mapId: 'm1', id: 't1', lock: false });
    expect(token.lockedBy).toBeNull();
  });

  it('невалидный lock игнорируется', () => {
    const room = makeCombatRoom([makeToken('t1')]);
    const f = makeConnCtx(room, { all: true, dm: true });
    const token = room.scene.maps[0]!.tokens[0]!;
    f.invoke('token:lock', { mapId: 'm1', id: 't1', lock: null } as never);

    expect(token.lockedBy).toBeNull();
  });
});

describe('player:remove', () => {
  it('DM кикает игрока и шлёт player:kicked его сокету', () => {
    const room = makeCombatRoom([makeToken('t1')]);
    room.players.push({ id: 'p1', name: 'Игрок', role: 'player', isConnected: true, socketId: 's:p1' });
    const f = makeConnCtx(room, { all: true, dm: true });

    f.invoke('player:remove', { id: 'p1' });

    expect(room.players.some((p) => p.id === 'p1')).toBe(false);
    expect(f.emitted.some((e) => e.event === 'player:kicked' && e.to === 's:p1')).toBe(true);
  });

  it('нельзя кикнуть себя; неизвестный id ничего не делает', () => {
    const room = makeCombatRoom([makeToken('t1')]);
    const f = makeConnCtx(room, { all: true, dm: true });

    f.invoke('player:remove', { id: 'dm' });
    f.invoke('player:remove', { id: 'nope' });

    expect(room.players.some((p) => p.id === 'dm')).toBe(true);
    expect(f.emitted.some((e) => e.event === 'player:kicked')).toBe(false);
  });
});

describe('unlock on disconnect', () => {
  it('снимает лок токена при отключении владельца', () => {
    const room = makeCombatRoom([makeToken('t1')]);
    const f = makeConnCtx(room, { all: true, dm: true });
    const token = room.scene.maps[0]!.tokens[0]!;
    token.lockedBy = 'dm';

    f.disconnect();

    expect(token.lockedBy).toBeNull();
  });
});
