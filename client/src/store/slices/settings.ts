import { detectLang, setLocale, type Lang } from '../../i18n';
import type { GameState, Slice } from '../types';

export const createSettingsSlice: Slice<Pick<GameState, 'lang' | 'setLang'>> = (set) => {
  const lang = detectLang();
  setLocale(lang);
  return {
    lang,
    setLang: (next: Lang) => {
      setLocale(next);
      set({ lang: next });
    },
  };
};
