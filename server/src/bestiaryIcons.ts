import { existsSync } from 'node:fs';
import path from 'node:path';
import { bestiaryIconSvg, type BestiaryEntry } from 'shared';
import bestiaryData from 'shared/bestiaryData';
import { BESTIARY_ICONS_DIR, BESTIARY_TOKENS_DIR } from './store';

const byKey = new Map(bestiaryData.entries.map((entry) => [entry.key, entry]));

/** Форматы картинок в порядке приоритета (будущее — PNG/JPG; webp/svg терпим). */
const PORTRAIT_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'svg'];

export type PortraitKind = 'icon' | 'token';

export interface PortraitDirs {
  iconDir?: string;
  tokenDir?: string;
}

export function bestiaryEntryByKey(key: string): BestiaryEntry | undefined {
  return byKey.get(key);
}

/** Имя файла-картинки для ключа (`XMM:Adult Red Dragon` → `xmm-adult-red-dragon.png`). */
export function bestiaryPortraitSlug(key: string): string {
  return key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function fileIn(dir: string, slug: string): string | undefined {
  for (const ext of PORTRAIT_EXTENSIONS) {
    const file = path.join(dir, `${slug}.${ext}`);
    if (existsSync(file)) return file;
  }
  return undefined;
}

/**
 * Файл-картинка существа: иконки — `data/bestiary/icons/`, токены —
 * `data/bestiary/tokens/` (токен падает на иконку). Нет файла — undefined.
 */
export function bestiaryPortraitFile(key: string, kind: PortraitKind, dirs: PortraitDirs = {}): string | undefined {
  if (!byKey.has(key)) return undefined;
  const slug = bestiaryPortraitSlug(key);
  const iconDir = dirs.iconDir ?? BESTIARY_ICONS_DIR;
  if (kind === 'icon') return fileIn(iconDir, slug);
  return fileIn(dirs.tokenDir ?? BESTIARY_TOKENS_DIR, slug) ?? fileIn(iconDir, slug);
}

/** SVG-иконка для ключа (генерируется на лету), undefined — неизвестный ключ. */
export function bestiaryIconSvgForKey(key: string): string | undefined {
  const entry = byKey.get(key);
  return entry ? bestiaryIconSvg(entry) : undefined;
}


