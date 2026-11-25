import path from 'node:path';
import { existsSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, manager } from './index';
import { UPLOADS_DIR, removeRoomUploadDir } from './store';
import type { Room } from './roomTypes';

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

let room: Room;

beforeAll(() => {
  room = manager.create('HTTP test', { test: true });
  room.players.push({
    id: 'p1',
    name: 'Игрок',
    role: 'player',
    isConnected: true,
    socketId: 's:p1',
  });
});

afterAll(async () => {
  manager.deleteRoom(room.code);
  await removeRoomUploadDir(room.code);
});

describe('HTTP слой', () => {
  it('health отдаёт ok и security headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('upload без комнаты/игрока запрещён', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('x-room', room.code)
      .attach('image', PNG, 'test.png');
    expect(res.status).toBe(403);
  });

  it('upload отклоняет расширение не-картинки', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('x-room', room.code)
      .set('x-player', 'p1')
      .attach('image', Buffer.from('not image'), 'test.exe');
    expect(res.status).toBe(400);
  });

  it('upload отклоняет файл without magic bytes и удаляет его', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('x-room', room.code)
      .set('x-player', 'p1')
      .attach('image', Buffer.from('not image'), 'test.png');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Файл не является изображением' });
  });

  it('upload принимает PNG и возвращает URL', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('x-room', room.code)
      .set('x-player', 'p1')
      .attach('image', PNG, 'test.png');

    expect(res.status).toBe(200);
    const url = String(res.body.url);
    expect(url).toMatch(new RegExp(`^/uploads/${room.code}/[a-f0-9-]+\\.png$`));
    const file = url.replace(`/uploads/${room.code}/`, '');
    expect(existsSync(path.join(UPLOADS_DIR, room.code, file))).toBe(true);
  });
});
