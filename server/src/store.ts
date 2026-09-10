import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CharacterSheet, ChatMessage, LibraryItem, PlayerResources, Role, Scene } from 'shared';

export interface PersistedRoom {
  code: string;
  name?: string;
  scene: Scene;
  library: LibraryItem[];
  sheets: Record<string, CharacterSheet>;
  resources?: Record<string, PlayerResources>;
  chat: ChatMessage[];
  players: { id: string; name: string; role: Role }[];
  nextZ: number;
  controllers?: Record<string, string>;
}

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

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function saveRoomSoon(room: () => PersistedRoom) {
  const code = room().code;
  const existing = saveTimers.get(code);
  if (existing) clearTimeout(existing);
  saveTimers.set(
    code,
    setTimeout(() => {
      saveTimers.delete(code);
      fs.writeFile(path.join(ROOMS_DIR, `${code}.json`), JSON.stringify(room(), null, 2)).catch(() => void 0);
    }, 1000)
  );
}

export function cancelRoomSave(code: string) {
  const existing = saveTimers.get(code);
  if (existing) {
    clearTimeout(existing);
    saveTimers.delete(code);
  }
}

export async function saveRoomNow(room: PersistedRoom) {
  await ensureDirs();
  await fs.writeFile(path.join(ROOMS_DIR, `${room.code}.json`), JSON.stringify(room, null, 2));
}

export function removeRoomFile(code: string) {
  fs.unlink(path.join(ROOMS_DIR, `${code}.json`)).catch(() => void 0);
}
