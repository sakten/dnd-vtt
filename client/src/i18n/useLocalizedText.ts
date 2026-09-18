import { useEffect, useSyncExternalStore } from 'react';
import {
  featureClassOf,
  isFeatureTextLoaded,
  isFeatTextLoaded,
  isSpellTextLoaded,
  loadFeatureText,
  loadFeatText,
  loadSpellText,
  subscribeLocalizedText,
} from 'shared';
import { getLocale } from './index';

/** Лениво догружает описания заклинаний текущего языка и перерисовывает при готовности. */
export function useSpellText(): void {
  const lang = getLocale();
  const loaded = useSyncExternalStore(subscribeLocalizedText, () => isSpellTextLoaded(lang));
  useEffect(() => {
    if (!loaded) void loadSpellText(lang);
  }, [lang, loaded]);
}

/** Лениво догружает описания и требования фитов текущего языка. */
export function useFeatText(): void {
  const lang = getLocale();
  const loaded = useSyncExternalStore(subscribeLocalizedText, () => isFeatTextLoaded(lang));
  useEffect(() => {
    if (!loaded) void loadFeatText(lang);
  }, [lang, loaded]);
}

/** Лениво догружает описания черт класса, к которому относится ключ. */
export function useFeatureText(key: string | undefined): void {
  const lang = getLocale();
  const cls = featureClassOf(key);
  const loaded = useSyncExternalStore(subscribeLocalizedText, () => !cls || isFeatureTextLoaded(lang, cls));
  useEffect(() => {
    if (cls && !loaded) void loadFeatureText(lang, cls);
  }, [lang, cls, loaded]);
}
