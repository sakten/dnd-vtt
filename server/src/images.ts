import fsp from 'node:fs/promises';
import sharp from 'sharp';

/** Размеры производных: миниатюра для списков/панелей и «токенная» для стола. */
export const THUMB_SIZE = 128;
export const TOKEN_SIZE = 256;
const WEBP_QUALITY = 78;
/** Больше двух одновременных перекодирований на слабом VPS дают пик памяти. */
const MAX_PARALLEL = 2;

export type DerivativeKind = 'thumb' | 'token';

const DERIVATIVES: { suffix: DerivativeKind; size: number }[] = [
  { suffix: 'thumb', size: THUMB_SIZE },
  { suffix: 'token', size: TOKEN_SIZE },
];

export function derivativePath(filePath: string, suffix: DerivativeKind): string {
  return `${filePath}.${suffix}.webp`;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

let running = 0;
const waiting: (() => void)[] = [];

function acquire(): Promise<void> {
  if (running < MAX_PARALLEL) {
    running += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => waiting.push(() => {
    running += 1;
    resolve();
  }));
}

function release(): void {
  running -= 1;
  waiting.shift()?.();
}

const inflight = new Map<string, Promise<void>>();

/**
 * Досоздаёт отсутствующую производную (thumb/token) и возвращает её путь.
 * Старые загрузки (до появления производных) и карты получают webp при первом
 * запросе; параллельные запросы ждут одно перекодирование.
 */
export async function ensureDerivative(filePath: string, suffix: DerivativeKind): Promise<string> {
  const dest = derivativePath(filePath, suffix);
  if (await exists(dest)) return dest;
  const size = suffix === 'thumb' ? THUMB_SIZE : TOKEN_SIZE;
  let task = inflight.get(dest);
  if (!task) {
    task = (async () => {
      await acquire();
      try {
        if (!(await exists(dest))) {
          await sharp(filePath)
            .rotate()
            .resize(size, size, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: WEBP_QUALITY })
            .toFile(dest);
        }
      } finally {
        release();
      }
    })();
    inflight.set(dest, task);
    task.finally(() => inflight.delete(dest)).catch(() => void 0);
  }
  await task;
  return dest;
}

/**
 * Генерирует недостающие webp-производные рядом с оригиналом (без увеличения).
 * Оригинал не трогаем. Карты (kind=map) получают только миниатюру — сам файл
 * карты для стола остаётся исходным (решение владельца — карты не сжимаем).
 */
export async function writeImageDerivatives(filePath: string, opts: { token?: boolean } = {}): Promise<void> {
  for (const { suffix } of DERIVATIVES) {
    if (suffix === 'token' && opts.token === false) continue;
    await ensureDerivative(filePath, suffix);
  }
}
