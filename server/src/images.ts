import fsp from 'node:fs/promises';
import sharp from 'sharp';

/** Размеры производных: миниатюра для списков/панелей, «токенная» для стола и превью карты. */
export const THUMB_SIZE = 128;
export const TOKEN_SIZE = 256;
/** Превью карты для стола: длинная сторона до 4096 — чётко, но в разы легче оригинала. */
export const SCREEN_SIZE = 4096;
const WEBP_QUALITY = 78;
const SCREEN_QUALITY = 85;
/** Больше двух одновременных перекодирований на слабом VPS дают пик памяти. */
const MAX_PARALLEL = 2;

export type DerivativeKind = 'thumb' | 'token' | 'screen';

const DERIVATIVES: { suffix: DerivativeKind; size: number; quality: number }[] = [
  { suffix: 'thumb', size: THUMB_SIZE, quality: WEBP_QUALITY },
  { suffix: 'token', size: TOKEN_SIZE, quality: WEBP_QUALITY },
  { suffix: 'screen', size: SCREEN_SIZE, quality: SCREEN_QUALITY },
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
 * Досоздаёт отсутствующую производную (thumb/token/screen) и возвращает её путь.
 * Старые загрузки (до появления производных) и карты получают webp при первом
 * запросе; параллельные запросы ждут одно перекодирование.
 */
export async function ensureDerivative(filePath: string, suffix: DerivativeKind): Promise<string> {
  const dest = derivativePath(filePath, suffix);
  if (await exists(dest)) return dest;
  const spec = DERIVATIVES.find((d) => d.suffix === suffix)!;
  let task = inflight.get(dest);
  if (!task) {
    task = (async () => {
      await acquire();
      try {
        if (!(await exists(dest))) {
          await sharp(filePath)
            .rotate()
            .resize(spec.size, spec.size, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: spec.quality })
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
 * Оригинал не трогаем. Картам (`screen: true`) кроме миниатюры нужна лёгкая
 * копия до 4K для стола — её показываем, пока грузится исходный файл.
 */
export async function writeImageDerivatives(filePath: string, opts: { token?: boolean; screen?: boolean } = {}): Promise<void> {
  for (const { suffix } of DERIVATIVES) {
    if (suffix === 'token' && opts.token === false) continue;
    if (suffix === 'screen' && opts.screen !== true) continue;
    await ensureDerivative(filePath, suffix);
  }
}
