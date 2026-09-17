import { en } from './en';
import { ru, type MessageKey } from './ru';

export type { MessageKey };

export type Lang = 'ru' | 'en';
export const LANGS: Lang[] = ['ru', 'en'];
export const LANG_STORAGE_KEY = 'vtt-lang';

const MESSAGES: Record<Lang, Partial<Record<MessageKey, string>>> = { ru, en };

let current: Lang | null = null;

export function isLang(value: unknown): value is Lang {
  return value === 'ru' || value === 'en';
}

function readStoredLang(): string | null {
  try {
    return localStorage.getItem(LANG_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Приоритет: `?lang=` → localStorage → `navigator.language` (`en*` → en, иначе ru). */
export function detectLang(opts: { search?: string; stored?: string | null; navigator?: string } = {}): Lang {
  const search = opts.search ?? (typeof window !== 'undefined' ? window.location.search : '');
  const param = new URLSearchParams(search).get('lang');
  if (isLang(param)) return param;

  const stored = opts.stored !== undefined ? opts.stored : readStoredLang();
  if (isLang(stored)) return stored;

  const nav = opts.navigator ?? (typeof navigator !== 'undefined' ? navigator.language : '');
  return nav.toLowerCase().startsWith('en') ? 'en' : 'ru';
}

export function getLocale(): Lang {
  return current ?? detectLang();
}

export function setLocale(lang: Lang) {
  current = lang;
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    void 0;
  }
}

export function interpolate(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  let out = text;
  for (const [name, value] of Object.entries(params)) out = out.split(`{${name}}`).join(String(value));
  return out;
}

/** Перевод по ключу; отсутствующий ключ падает на RU, затем на сам ключ. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const text = MESSAGES[getLocale()][key] ?? ru[key] ?? key;
  return interpolate(text, params);
}

/** Формы множественного числа: ru — one/few/many, en — one/many. */
export function plural(n: number, forms: { one: string; few: string; many: string }): string {
  if (getLocale() === 'en') return n === 1 ? forms.one : forms.many;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms.one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms.few;
  return forms.many;
}
