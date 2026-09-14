import type { ReactNode } from 'react';

let resolved: Record<string, ReactNode> | null = null;
let pending: Promise<Record<string, ReactNode>> | null = null;

/** Ленивая загрузка рисованных иконок заклинаний (отдельный чанк), кэш на сессию. */
export function loadSpellIcons(): Promise<Record<string, ReactNode>> {
  if (resolved) return Promise.resolve(resolved);
  pending ??= import('../components/spellIcons').then((mod) => {
    resolved = mod.SPELL_ICONS;
    return resolved;
  });
  return pending;
}

/** Уже загруженная карта иконок (для синхронного первого рендера). */
export function spellIconsSync(): Record<string, ReactNode> | null {
  return resolved;
}
