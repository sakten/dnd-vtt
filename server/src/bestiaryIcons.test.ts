import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { bestiaryIconSvgForKey, bestiaryPortraitFile, bestiaryPortraitSlug } from './bestiaryIcons';

const WOLF = 'XMM:Wolf';

const tempDir = () => mkdtempSync(path.join(tmpdir(), 'vtt-icons-'));

describe('bestiaryIcons', () => {
  it('слаг для имён файлов', () => {
    expect(bestiaryPortraitSlug('XMM:Adult Red Dragon')).toBe('xmm-adult-red-dragon');
    expect(bestiaryPortraitSlug(WOLF)).toBe('xmm-wolf');
  });

  it('картинка-файл имеет приоритет по расширению', () => {
    const dir = tempDir();
    expect(bestiaryPortraitFile(WOLF, 'icon', { iconDir: dir })).toBeUndefined();
    writeFileSync(path.join(dir, 'xmm-wolf.svg'), '<svg/>');
    expect(bestiaryPortraitFile(WOLF, 'icon', { iconDir: dir })).toContain('xmm-wolf.svg');
    writeFileSync(path.join(dir, 'xmm-wolf.png'), 'png');
    expect(bestiaryPortraitFile(WOLF, 'icon', { iconDir: dir })).toContain('xmm-wolf.png');
  });

  it('токен падает на иконку, если своей картинки нет', () => {
    const icons = tempDir();
    const tokens = tempDir();
    writeFileSync(path.join(icons, 'xmm-wolf.png'), 'icon');
    expect(bestiaryPortraitFile(WOLF, 'token', { iconDir: icons, tokenDir: tokens })).toContain(
      path.join(icons, 'xmm-wolf.png')
    );
    writeFileSync(path.join(tokens, 'xmm-wolf.webp'), 'token');
    expect(bestiaryPortraitFile(WOLF, 'token', { iconDir: icons, tokenDir: tokens })).toContain(
      path.join(tokens, 'xmm-wolf.webp')
    );
  });

  it('неизвестный ключ — нет картинки и нет файла', () => {
    expect(bestiaryPortraitFile('NOPE:Nothing', 'icon')).toBeUndefined();
    expect(bestiaryIconSvgForKey('NOPE:Nothing')).toBeUndefined();
  });

  it('SVG генерируется для любого существа каталога', () => {
    expect(bestiaryIconSvgForKey(WOLF)?.startsWith('<svg')).toBe(true);
  });
});
