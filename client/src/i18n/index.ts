import { ru, type MessageKey } from './ru';

export type { MessageKey };

export type Lang = string;
export const DEFAULT_LANG: Lang = 'ru';
export const LANG_STORAGE_KEY = 'vtt-lang';

type Dictionary = Partial<Record<MessageKey, string>>;

/**
 * Реестр словарей: любой `client/src/i18n/<код>.ts` с экспортом `dict` регистрируется сам.
 * Новый язык = файл словаря + папка `shared/src/data/text.<код>/`, правок кода не требуется.
 */
const dictionaries = import.meta.glob('./??.ts', { eager: true }) as Record<string, { dict?: Dictionary }>;
const MESSAGES: Record<Lang, Dictionary> = {};
for (const [path, mod] of Object.entries(dictionaries)) {
  if (mod.dict) MESSAGES[path.replace('./', '').replace('.ts', '')] = mod.dict;
}

/** Языки интерфейса: основной первым, дальше по алфавиту. */
export const LANGS: Lang[] = Object.keys(MESSAGES).sort((a, b) =>
  a === DEFAULT_LANG ? -1 : b === DEFAULT_LANG ? 1 : a.localeCompare(b)
);

let current: Lang | null = null;

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && value in MESSAGES;
}

/** Следующий язык в реестре (кнопка переключения). */
export function nextLang(lang: Lang): Lang {
  const index = LANGS.indexOf(lang);
  return LANGS[(index + 1) % LANGS.length] ?? DEFAULT_LANG;
}

function readStoredLang(): string | null {
  try {
    return localStorage.getItem(LANG_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Приоритет: `?lang=` → localStorage → `navigator.language`; неизвестный язык → `DEFAULT_LANG`. */
export function detectLang(opts: { search?: string; stored?: string | null; navigator?: string } = {}): Lang {
  const search = opts.search ?? (typeof window !== 'undefined' ? window.location.search : '');
  const param = new URLSearchParams(search).get('lang');
  if (isLang(param)) return param;

  const stored = opts.stored !== undefined ? opts.stored : readStoredLang();
  if (isLang(stored)) return stored;

  const nav = opts.navigator ?? (typeof navigator !== 'undefined' ? navigator.language : '');
  const base = nav.toLowerCase().split('-')[0];
  return isLang(base) ? base : DEFAULT_LANG;
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

/** Перевод по ключу; отсутствующий ключ падает на EN, затем на RU-источник, затем на сам ключ. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const text = MESSAGES[getLocale()]?.[key] ?? MESSAGES.en?.[key] ?? ru[key] ?? key;
  return interpolate(text, params);
}

const pluralRules = new Map<string, Intl.PluralRules>();

/** Формы множественного числа по правилам текущего языка (Intl.PluralRules). */
export function plural(n: number, forms: { one: string; few: string; many: string }): string {
  const lang = getLocale();
  let rules = pluralRules.get(lang);
  if (!rules) {
    rules = new Intl.PluralRules(lang);
    pluralRules.set(lang, rules);
  }
  const category = rules.select(n);
  if (category === 'one') return forms.one;
  if (category === 'few') return forms.few ?? forms.many;
  return forms.many ?? forms.few ?? forms.one;
}
