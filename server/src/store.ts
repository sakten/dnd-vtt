import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

export async function loadPersistedRooms(): Promise<PersistedRoom[]> {
  await ensureDirs();
  const files = await fs.readdir(ROOMS_DIR);
  const rooms: PersistedRoom[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const raw = await fs.readFile(path.join(ROOMS_DIR, file), 'utf8');
      rooms.push(JSON.parse(raw) as PersistedRoom);
    } catch (e) {
      console.warn(`Не удалось прочитать комнату ${file}:`, e);
    }
  }
  return rooms;
}

async function writeRoom(room: PersistedRoom) {
  await ensureDirs();
  const target = path.join(ROOMS_DIR, `${room.code}.json`);
  // Уникальный tmp: параллельные записи одной комнаты (таймер + flush) не пересекаются.
  const tmp = `${target}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(tmp, JSON.stringify(room, null, 2));
    await fs.rename(tmp, target);
  } catch (e) {
    await fs.unlink(tmp).catch(() => void 0);
    throw e;
  }
}

export interface RoomRepository {
  loadAll(): Promise<PersistedRoom[]>;
  /** Сохранить с дебаунсом (1 с): snapshot вызывается в момент записи. */
  save(code: string, snapshot: () => PersistedRoom): void;
  /** Отменить отложенную запись и удалить файл комнаты. */
  remove(code: string): void;
  /** Записать все отложенные комнаты (остановка сервера). */
  flush(): Promise<void>;
}

/** Персистенция комнат на диск: debounce, атомарная запись, flush. */
export function createRoomRepository(): RoomRepository {
  const timers = new Map<string, { timer: ReturnType<typeof setTimeout>; snapshot: () => PersistedRoom }>();

  return {
    loadAll: () => loadPersistedRooms(),
    save(code, snapshot) {
      const existing = timers.get(code);
      if (existing) clearTimeout(existing.timer);
      const timer = setTimeout(() => {
        timers.delete(code);
        writeRoom(snapshot()).catch((e) => console.error(`Не удалось сохранить комнату ${code}:`, e));
      }, 1000);
      timers.set(code, { timer, snapshot });
    },
    remove(code) {
      const existing = timers.get(code);
      if (existing) {
        clearTimeout(existing.timer);
        timers.delete(code);
      }
      fs.unlink(path.join(ROOMS_DIR, `${code}.json`)).catch(() => void 0);
    },
    async flush() {
      const pending = [...timers.values()];
      timers.clear();
      await Promise.all(
        pending.map(({ snapshot }) =>
          writeRoom(snapshot()).catch((e) => console.error('Не удалось сохранить комнату при остановке:', e))
        )
      );
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
