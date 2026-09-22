import { describe, expect, it } from 'vitest';
import { makeRoom } from '../test/fixtures';
import { makeConnCtx, type TestCtx } from '../test/ctx';

interface JoinRes {
  ok?: boolean;
  error?: { code: string };
}

function joinAck(f: TestCtx, payload: { code: string; name: string; clientId: string }): Promise<JoinRes> {
  return new Promise((resolve) => {
    f.invoke('room:join', payload, resolve);
  });
}

function setup() {
  const room = makeRoom();
  const a = makeConnCtx(room, { all: true });
  const b = makeConnCtx(room, { all: true });
  return { room, a, b };
}

describe('вход в комнату по имени', () => {
  it('повторный вход тем же браузером — тот же игрок, имя без учёта регистра', async () => {
    const { room, a } = setup();
    expect((await joinAck(a, { code: room.code, name: 'Грим', clientId: 'c1' })).ok).toBe(true);
    expect((await joinAck(a, { code: room.code, name: 'грим', clientId: 'c1' })).ok).toBe(true);
    expect(room.players).toHaveLength(1);
    expect(room.players[0]!.name).toBe('Грим');
  });

  it('имя занято живой сессией другого браузера — nameTaken', async () => {
    const { room, a, b } = setup();
    await joinAck(a, { code: room.code, name: 'Грим', clientId: 'c1' });
    const res = await joinAck(b, { code: room.code, name: 'грим', clientId: 'c2' });
    expect(res.error?.code).toBe('nameTaken');
    expect(room.players).toHaveLength(1);
  });

  it('после отключения другой браузер входит в тот же аккаунт', async () => {
    const { room, a, b } = setup();
    await joinAck(a, { code: room.code, name: 'Грим', clientId: 'c1' });
    room.players[0]!.socketId = null; // как после disconnect
    const res = await joinAck(b, { code: room.code, name: 'Грим', clientId: 'c2' });
    expect(res.ok).toBe(true);
    expect(room.players).toHaveLength(1);
    expect(room.players[0]!.id).toBe('c1');
    expect(room.players[0]!.isConnected).toBe(true);
  });

  it('имя ведущего нельзя занять чужому, но ведущий входит со своим браузером', async () => {
    const { room, a, b } = setup();
    room.players.push({ id: 'dm1', name: 'Мастер', role: 'dm', isConnected: false, socketId: null, clientId: 'dm1' });
    const foreign = await joinAck(a, { code: room.code, name: 'мастер', clientId: 'c1' });
    expect(foreign.error?.code).toBe('nameTaken');
    const own = await joinAck(b, { code: room.code, name: 'Мастер', clientId: 'dm1' });
    expect(own.ok).toBe(true);
    expect(room.players).toHaveLength(1);
  });

  it('пустое имя — badRequest', async () => {
    const { room, a } = setup();
    const res = await joinAck(a, { code: room.code, name: '   ', clientId: 'c1' });
    expect(res.error?.code).toBe('badRequest');
    expect(room.players).toHaveLength(0);
  });
});
