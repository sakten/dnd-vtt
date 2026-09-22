import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { THUMB_SIZE, TOKEN_SIZE, writeImageDerivatives } from './images';

let dir: string;
let file: string;

beforeAll(async () => {
  dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'vtt-img-'));
  file = path.join(dir, 'token.png');
  await sharp({ create: { width: 600, height: 400, channels: 4, background: { r: 200, g: 60, b: 60, alpha: 1 } } })
    .png()
    .toFile(file);
});

afterAll(async () => {
  // На Windows sharp отпускает файл не мгновенно — даём ретраи.
  await fsp
    .rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    .catch(() => void 0);
});

describe('производные загруженных картинок', () => {
  it('генерирует thumb 128 и token 256 в webp с сохранением пропорций', async () => {
    await writeImageDerivatives(file);
    const thumb = await sharp(`${file}.thumb.webp`).metadata();
    const token = await sharp(`${file}.token.webp`).metadata();
    expect(thumb.format).toBe('webp');
    expect(thumb.width).toBe(THUMB_SIZE);
    expect(thumb.height).toBe(85);
    expect(token.format).toBe('webp');
    expect(token.width).toBe(TOKEN_SIZE);
    expect(token.height).toBe(171);
  });

  it('маленькие картинки не увеличиваются', async () => {
    const small = path.join(dir, 'small.png');
    await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } })
      .png()
      .toFile(small);
    await writeImageDerivatives(small);
    const token = await sharp(`${small}.token.webp`).metadata();
    expect(token.width).toBe(64);
    expect(token.height).toBe(64);
  });

  it('повторный вызов не перезаписывает готовые производные', async () => {
    const before = (await fsp.stat(`${file}.thumb.webp`)).mtimeMs;
    await new Promise((resolve) => setTimeout(resolve, 15));
    await writeImageDerivatives(file);
    const after = (await fsp.stat(`${file}.thumb.webp`)).mtimeMs;
    expect(after).toBe(before);
  });
});
