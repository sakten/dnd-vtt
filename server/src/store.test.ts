import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PersistedRoom } from './roomTypes';
import { createRoomRepository, dirSize } from './store';

describe('dirSize', () => {
  let root = '';

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'vtt-dirsize-'));
    await mkdir(path.join(root, 'sub'));
    await writeFile(path.join(root, 'a.bin'), Buffer.alloc(100));
    await writeFile(path.join(root, 'sub', 'b.bin'), Buffer.alloc(250));
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('суммирует файлы рекурсивно', async () => {
    expect(await dirSize(root)).toBe(350);
  });

  it('отсутствующая папка = 0', async () => {
    expect(await dirSize(path.join(root, 'nope'))).toBe(0);
  });
});

describe('roomRepository', () => {
  it('комната и чат — раздельные файлы, читаются обратно, удаляются вместе', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'vtt-rooms-'));
    try {
      const repo = createRoomRepository({ dir, roomDebounceMs: 5, chatDebounceMs: 5 });
      const room = {
        code: 'TEST1',
        name: 'Тест',
        scene: { maps: [], activeMapId: null, grid: {} },
        library: [],
        sheets: {},
        chat: [{ id: 'c1', kind: 'text', text: 'привет' }],
        players: [],
      } as unknown as PersistedRoom;

      repo.save(room.code, () => room, () => room.chat);
      await repo.flush();

      const savedRoom = JSON.parse(await readFile(path.join(dir, 'TEST1.json'), 'utf8')) as PersistedRoom;
      expect(savedRoom.name).toBe('Тест');
      expect('chat' in savedRoom).toBe(false);
      const savedChat = JSON.parse(await readFile(path.join(dir, 'TEST1.chat.json'), 'utf8')) as PersistedRoom['chat'];
      expect(savedChat).toEqual(room.chat);

      const reloaded = await createRoomRepository({ dir }).loadAll();
      expect(reloaded).toHaveLength(1);
      expect(reloaded[0]!.chat).toEqual(room.chat);

      await repo.remove(room.code);
      await expect(readFile(path.join(dir, 'TEST1.json'))).rejects.toThrow();
      await expect(readFile(path.join(dir, 'TEST1.chat.json'))).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    }
  });

  it('чат без изменений не переписывается', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'vtt-rooms-'));
    try {
      const repo = createRoomRepository({ dir, roomDebounceMs: 5, chatDebounceMs: 5 });
      const room = { code: 'T2', chat: [] } as unknown as PersistedRoom;
      repo.save(room.code, () => room, () => room.chat);
      await repo.flush();
      await expect(readFile(path.join(dir, 'T2.chat.json'))).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    }
  });

  it('remove во время записи не воскрешает комнату', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'vtt-race-'));
    const { promises: fsp } = await import('node:fs');
    const realRename = fsp.rename.bind(fsp);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started!: () => void;
    const writing = new Promise<void>((resolve) => {
      started = resolve;
    });
    let blocked = false;
    const spy = vi.spyOn(fsp, 'rename').mockImplementation(async (from, to) => {
      if (!blocked && String(to).endsWith('RACE.json')) {
        blocked = true;
        started();
        await gate;
      }
      await realRename(from, to);
    });
    try {
      const repo = createRoomRepository({ dir, roomDebounceMs: 5, chatDebounceMs: 5 });
      const room = { code: 'RACE', chat: [] } as unknown as PersistedRoom;
      repo.save(room.code, () => room);
      await writing; // rename уже в полёте и висит на gate

      const removal = repo.remove(room.code);
      release();
      await removal;
      await new Promise((r) => setTimeout(r, 30)); // дать завершиться любой записи, начатой до remove
      await expect(readFile(path.join(dir, 'RACE.json'))).rejects.toThrow();

      // Поколение не блокирует новую комнату с тем же кодом.
      repo.save(room.code, () => room);
      await repo.flush();
      await expect(readFile(path.join(dir, 'RACE.json'))).resolves.toBeTruthy();
    } finally {
      spy.mockRestore();
      await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    }
  });
});
