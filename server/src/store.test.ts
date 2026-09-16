import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PersistedRoom } from './roomTypes';
import { createRoomRepository, dirSize, flatUploadName } from './store';

describe('flatUploadName', () => {
  it('возвращает имя плоского legacy-файла', () => {
    expect(flatUploadName('/uploads/a.png')).toBe('a.png');
  });

  it('отвергает вложенный путь (новый формат подпапок)', () => {
    expect(flatUploadName('/uploads/ABCD1234/a.png')).toBeNull();
  });

  it('отвергает чужие url и попытки обхода', () => {
    expect(flatUploadName('a.png')).toBeNull();
    expect(flatUploadName('/uploads/')).toBeNull();
    expect(flatUploadName('/uploads/..')).toBeNull();
    expect(flatUploadName('/uploads/..\\x')).toBeNull();
  });
});

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
});
