import { useEffect, useSyncExternalStore } from 'react';
import { featName, featureName, isNamesLoaded, loadNames, spellName, subscribeLocalizedText, weaponName } from 'shared';
import { getLocale } from './index';

/** Отображаемое имя заклинания: оверлей текущего языка, иначе исходное (EN). */
export function spellDisplayName(spell: { key: string; name: string }): string {
  return spellName(spell.key, getLocale()) ?? spell.name;
}

/** Отображаемое имя классовой черты по ключу ресурса. */
export function featureDisplayName(key: string | undefined, fallback: string): string {
  return featureName(key, getLocale()) ?? fallback;
}

/** Отображаемое имя фита по ключу. */
export function featDisplayName(key: string | undefined, fallback: string): string {
  return featName(key, getLocale()) ?? fallback;
}

/** Отображаемое имя оружия по ключу. */
export function weaponDisplayName(key: string | undefined, fallback: string): string {
  return weaponName(key, getLocale()) ?? fallback;
}

/** Гарантирует загрузку имён текущего языка; дерево перерисуется при готовности. */
export function useNames(): void {
  const lang = getLocale();
  const loaded = useSyncExternalStore(subscribeLocalizedText, () => isNamesLoaded(lang));
  useEffect(() => {
    if (!loaded) void loadNames(lang);
  }, [lang, loaded]);
}
