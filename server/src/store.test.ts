import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dirSize, flatUploadName } from './store';

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
