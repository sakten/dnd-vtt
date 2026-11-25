import { afterEach, describe, expect, it } from 'vitest';
import { makeRoom } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { adminTokenOk, registerAdminHandlers } from './admin';

const originalToken = process.env.VTT_ADMIN_TOKEN;

afterEach(() => {
  if (originalToken === undefined) delete process.env.VTT_ADMIN_TOKEN;
  else process.env.VTT_ADMIN_TOKEN = originalToken;
});

function makeAdmin() {
  const f = makeConnCtx(makeRoom());
  registerAdminHandlers(f.ctx);
  return f;
}

function call(f: ReturnType<typeof makeAdmin>, event: 'admin:list' | 'admin:create' | 'admin:join' | 'admin:rename' | 'admin:delete', payload: unknown) {
  return new Promise<Record<string, unknown>>((resolve) => {
    (f.invoke as unknown as (name: string, data: unknown, cb: (res: Record<string, unknown>) => void) => void)(event, payload, resolve);
  });
}

describe('adminTokenOk', () => {
  it('без env пускает без токена', () => {
    delete process.env.VTT_ADMIN_TOKEN;
    expect(adminTokenOk()).toBe(true);
    expect(adminTokenOk('anything')).toBe(true);
  });

  it('с env требует точный токен', () => {
    process.env.VTT_ADMIN_TOKEN = 'secret';
    expect(adminTokenOk('secret')).toBe(true);
    expect(adminTokenOk('wrong')).toBe(false);
    expect(adminTokenOk()).toBe(false);
  });
});

describe('admin handlers', () => {
  it('admin:list отклоняет неверный токен и отдаёт комнаты с верным', async () => {
    process.env.VTT_ADMIN_TOKEN = 'secret';
    const f = makeAdmin();
    await expect(call(f, 'admin:list', { adminToken: 'wrong' })).resolves.toEqual({
      error: { code: 'wrongAdminToken' },
    });
    const ok = await call(f, 'admin:list', { adminToken: 'secret' });
    expect(ok.rooms).toEqual(f.manager.listRooms());
  });

  it('admin:create создаёт комнату, назначает DM и шлёт room:joined', async () => {
    delete process.env.VTT_ADMIN_TOKEN;
    const f = makeAdmin();
    const res = await call(f, 'admin:create', { name: 'Мастер', clientId: 'owner', roomName: 'Игра' });
    const code = String(res.code);
    expect(code.length).toBeGreaterThanOrEqual(10);
    expect(f.ctx.roomCode).toBe(code);
    expect(f.ctx.playerId).toBe('owner');
    const room = f.manager.get(code);
    expect(room?.players[0]).toMatchObject({ id: 'owner', role: 'dm', name: 'Мастер' });
    expect(f.selfEvents('room:joined').length).toBeGreaterThan(0);
  });

  it('admin:join добавляет нового DM и отклоняет неизвестную комнату', async () => {
    delete process.env.VTT_ADMIN_TOKEN;
    const f = makeAdmin();
    const created = await call(f, 'admin:create', { clientId: 'owner', roomName: 'Игра' });
    const code = String(created.code);
    f.ctx.roomCode = null;
    f.ctx.playerId = null;

    const joined = await call(f, 'admin:join', { code, clientId: 'owner2', name: 'Второй' });
    expect(joined).toEqual({ ok: true });
    expect(f.manager.get(code)?.players.some((p) => p.id === 'owner2' && p.role === 'dm')).toBe(true);

    const missing = await call(f, 'admin:join', { code: 'NOPE', clientId: 'x' });
    expect(missing).toEqual({ error: { code: 'roomNotFound' } });
  });

  it('admin:rename меняет имя и рассылает room:renamed', async () => {
    delete process.env.VTT_ADMIN_TOKEN;
    const f = makeAdmin();
    const created = await call(f, 'admin:create', { clientId: 'owner', roomName: 'Старое' });
    const code = String(created.code);

    expect(await call(f, 'admin:rename', { code, name: 'Новое' })).toEqual({ ok: true });
    expect(f.manager.get(code)?.name).toBe('Новое');
    expect(f.emitted.some((e) => e.event === 'room:renamed')).toBe(true);
  });

  it('admin:delete удаляет комнату и шлёт room:deleted', async () => {
    delete process.env.VTT_ADMIN_TOKEN;
    const f = makeAdmin();
    const created = await call(f, 'admin:create', { clientId: 'owner', roomName: 'Игра' });
    const code = String(created.code);

    expect(await call(f, 'admin:delete', { code })).toEqual({ ok: true });
    expect(f.manager.get(code)).toBeUndefined();
    expect(f.emitted.some((e) => e.event === 'room:deleted')).toBe(true);
  });
});
