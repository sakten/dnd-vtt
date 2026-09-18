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

/** Лениво догружает RU-описания заклинаний (в русской локали) и перерисовывает при готовности. */
export function useSpellText(): void {
  const loaded = useSyncExternalStore(subscribeLocalizedText, isSpellTextLoaded);
  useEffect(() => {
    if (!loaded && getLocale() === 'ru') void loadSpellText();
  }, [loaded]);
}

/** Лениво догружает RU-описания фитов (в русской локали). */
export function useFeatText(): void {
  const loaded = useSyncExternalStore(subscribeLocalizedText, isFeatTextLoaded);
  useEffect(() => {
    if (!loaded && getLocale() === 'ru') void loadFeatText();
  }, [loaded]);
}

/** Лениво догружает RU-описания черт того класса, к которому относится ключ. */
export function useFeatureText(key: string | undefined): void {
  const cls = featureClassOf(key);
  const loaded = useSyncExternalStore(subscribeLocalizedText, () => (cls ? isFeatureTextLoaded(cls) : true));
  useEffect(() => {
    if (cls && !loaded && getLocale() === 'ru') void loadFeatureText(cls);
  }, [cls, loaded]);
}
