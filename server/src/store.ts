import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHAT_SAVE_DEBOUNCE_MS, SAVE_DEBOUNCE_MS } from './config';
import type { PersistedRoom } from './roomTypes';

export const HERE = path.dirname(fileURLToPath(import.meta.url));

export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(HERE, '..', 'data');

export const ROOMS_DIR = path.join(DATA_DIR, 'rooms');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

export async function ensureDirs() {
  await fs.mkdir(ROOMS_DIR, { recursive: true });
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

export interface RoomRepository {
  loadAll(): Promise<PersistedRoom[]>;
  /** Сохранить с дебаунсом: комната и чат — раздельными файлами (по умолчанию 2 мин, env). */
  save(code: string, snapshot: () => PersistedRoom, chat?: () => PersistedRoom['chat']): void;
  /** Отменить отложенные записи и удалить файлы комнаты (включая чат). */
  remove(code: string): void;
  /** Записать все отложенные комнаты и чаты (остановка сервера). */
  flush(): Promise<void>;
}

export interface RoomRepositoryOptions {
  /** Каталог данных (по умолчанию `server/data/rooms`). */
  dir?: string;
  roomDebounceMs?: number;
  chatDebounceMs?: number;
}

/**
 * Персистенция комнат: комната (`<code>.json`) и чат (`<code>.chat.json`) —
 * раздельные файлы с debounce, атомарной записью и flush. Чат пишется только
 * при изменении и реже (история растёт — не переписываем её на каждое событие).
 */
export function createRoomRepository(options: RoomRepositoryOptions = {}): RoomRepository {
  const dir = options.dir ?? ROOMS_DIR;
  const roomDelay = options.roomDebounceMs ?? SAVE_DEBOUNCE_MS;
  const chatDelay = options.chatDebounceMs ?? CHAT_SAVE_DEBOUNCE_MS;
  const roomTimers = new Map<string, { timer: ReturnType<typeof setTimeout>; snapshot: () => PersistedRoom }>();
  const chatTimers = new Map<string, { timer: ReturnType<typeof setTimeout>; chat: () => PersistedRoom['chat'] }>();
  /** JSON последней записанной истории чата: без изменений файл не трогаем. */
  const lastChat = new Map<string, string>();

  const roomPath = (code: string) => path.join(dir, `${code}.json`);
  const chatPath = (code: string) => path.join(dir, `${code}.chat.json`);

  const writeJson = async (target: string, json: string) => {
    await fs.mkdir(dir, { recursive: true });
    // Уникальный tmp: параллельные записи одной комнаты (таймер + flush) не пересекаются.
    const tmp = `${target}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(tmp, json);
      await fs.rename(tmp, target);
    } catch (e) {
      await fs.unlink(tmp).catch(() => void 0);
      throw e;
    }
  };

  const writeRoom = (code: string, room: PersistedRoom) => {
    const { chat: _chat, ...rest } = room;
    return writeJson(roomPath(code), JSON.stringify(rest));
  };

  return {
    async loadAll() {
      await fs.mkdir(dir, { recursive: true });
      const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json') && !f.endsWith('.chat.json'));
      const rooms: PersistedRoom[] = [];
      for (const file of files) {
        try {
          const raw = await fs.readFile(path.join(dir, file), 'utf8');
          const room = JSON.parse(raw) as PersistedRoom;
          const code = typeof room.code === 'string' && room.code ? room.code : file.replace(/\.json$/, '');
          // Чат до этого среза лежал в файле комнаты: подхватываем отдельный файл, если он есть.
          const chatRaw = await fs.readFile(chatPath(code), 'utf8').catch(() => null);
          if (chatRaw !== null) {
            try {
              room.chat = JSON.parse(chatRaw) as PersistedRoom['chat'];
            } catch (e) {
              console.warn(`Не удалось прочитать чат комнаты ${code}:`, e);
            }
          }
          lastChat.set(code, JSON.stringify(room.chat ?? []));
          rooms.push(room);
        } catch (e) {
          console.warn(`Не удалось прочитать комнату ${file}:`, e);
        }
      }
      return rooms;
    },
    save(code, snapshot, chat) {
      const existing = roomTimers.get(code);
      if (existing) clearTimeout(existing.timer);
      const timer = setTimeout(() => {
        roomTimers.delete(code);
        writeRoom(code, snapshot()).catch((e) => console.error(`Не удалось сохранить комнату ${code}:`, e));
      }, roomDelay);
      roomTimers.set(code, { timer, snapshot });

      if (!chat) return;
      const existingChat = chatTimers.get(code);
      if (existingChat) clearTimeout(existingChat.timer);
      const chatTimer = setTimeout(() => {
        chatTimers.delete(code);
        const json = JSON.stringify(chat());
        if (json === (lastChat.get(code) ?? '[]')) return;
        lastChat.set(code, json);
        writeJson(chatPath(code), json).catch((e) => console.error(`Не удалось сохранить чат ${code}:`, e));
      }, chatDelay);
      chatTimers.set(code, { timer: chatTimer, chat });
    },
    remove(code) {
      const roomTimer = roomTimers.get(code);
      if (roomTimer) {
        clearTimeout(roomTimer.timer);
        roomTimers.delete(code);
      }
      const chatTimer = chatTimers.get(code);
      if (chatTimer) {
        clearTimeout(chatTimer.timer);
        chatTimers.delete(code);
      }
      lastChat.delete(code);
      fs.unlink(roomPath(code)).catch(() => void 0);
      fs.unlink(chatPath(code)).catch(() => void 0);
    },
    async flush() {
      const pending = [...roomTimers.entries()];
      roomTimers.clear();
      const pendingChat = [...chatTimers.entries()];
      chatTimers.clear();
      await Promise.all([
        ...pending.map(([code, { snapshot }]) =>
          writeRoom(code, snapshot()).catch((e) => console.error(`Не удалось сохранить комнату ${code} при остановке:`, e))
        ),
        ...pendingChat.map(([code, { chat }]) => {
          const json = JSON.stringify(chat());
          if (json === (lastChat.get(code) ?? '[]')) return Promise.resolve();
          lastChat.set(code, json);
          return writeJson(chatPath(code), json).catch((e) =>
            console.error(`Не удалось сохранить чат ${code} при остановке:`, e)
          );
        }),
      ]);
    },
  };
}

/** Имя плоского (legacy) файла из url вида `/uploads/<name>`; null — если это не он. */
export function flatUploadName(url: string): string | null {
  if (!url.startsWith('/uploads/')) return null;
  const name = url.slice('/uploads/'.length);
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) return null;
  return name;
}

export function removeRoomUploads(urls: string[]) {
  for (const url of urls) {
    const name = flatUploadName(url);
    if (!name) continue;
    fs.unlink(path.join(UPLOADS_DIR, name)).catch(() => void 0);
  }
}

export function roomUploadDir(code: string) {
  return path.join(UPLOADS_DIR, code);
}

export function removeRoomUploadDir(code: string) {
  fs.rm(roomUploadDir(code), { recursive: true, force: true }).catch(() => void 0);
}

export async function flatUploadSize(url: string): Promise<number> {
  const name = flatUploadName(url);
  if (!name) return 0;
  try {
    return (await fs.stat(path.join(UPLOADS_DIR, name))).size;
  } catch {
    return 0;
  }
}

export async function dirSize(dir: string): Promise<number> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  let total = 0;
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await dirSize(full);
    } else {
      try {
        total += (await fs.stat(full)).size;
      } catch {
        void 0;
      }
    }
  }
  return total;
}
