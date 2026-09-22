import fsp from 'node:fs/promises';
import sharp from 'sharp';

/** Размеры производных: миниатюра для списков/панелей и «токенная» для стола. */
export const THUMB_SIZE = 128;
export const TOKEN_SIZE = 256;
const WEBP_QUALITY = 78;

const DERIVATIVES: { suffix: string; size: number }[] = [
  { suffix: 'thumb', size: THUMB_SIZE },
  { suffix: 'token', size: TOKEN_SIZE },
];

export function derivativePath(filePath: string, suffix: string): string {
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

/**
 * Генерирует недостающие webp-производные рядом с оригиналом (без увеличения).
 * Оригинал не трогаем; карты сюда не попадают (решение владельца — карты не сжимаем).
 */
export async function writeImageDerivatives(filePath: string): Promise<void> {
  for (const { suffix, size } of DERIVATIVES) {
    const dest = derivativePath(filePath, suffix);
    if (await exists(dest)) continue;
    await sharp(filePath)
      .rotate()
      .resize(size, size, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(dest);
  }
}
