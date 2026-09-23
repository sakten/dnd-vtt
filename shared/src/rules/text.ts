/**
 * Локализованные данные контента: `<lang>`-оверлеи в `shared/src/data/text.<lang>/`.
 * Имена — мелкий чанк (грузится на старте), описания — ленивые чанки (по требованию).
 * Добавление языка = папка `text.<lang>/` со своими json, без правок кода.
 */

interface NamesData {
  attribution: string;
  spells: Record<string, string>;
  features: Record<string, string>;
  feats: Record<string, string>;
  weapons: Record<string, string>;
}

interface SpellTextData {
  spellDescriptions: Record<string, string[]>;
  spellHigherLevel: Record<string, string[]>;
}

interface FeatTextData {
  featDescriptions: Record<string, string>;
  featPrereq: Record<string, string>;
}

interface FeatureTextData {
  featureDescriptions: Record<string, string>;
}

const namesByLang = new Map<string, NamesData>();
const spellByLang = new Map<string, SpellTextData>();
const featByLang = new Map<string, FeatTextData>();
const featureByLang = new Map<string, Map<string, Record<string, string>>>();
/** Время последнего провала чанка: до истечения паузы повтор не начинаем. */
const failedAt = new Map<string, number>();
const pending = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

/**
 * Языки с оверлеями контента (`data/text.<lang>/`). База данных — EN, оверлея
 * у него нет; для остальных языков без папки загрузка пропускается, и UI
 * использует базовые (EN) имена. Синхронно с папками — проверяет текст-тест.
 */
export const CONTENT_LANGS = ['ru'] as const;

export function hasContentLang(lang: string): boolean {
  return (CONTENT_LANGS as readonly string[]).includes(lang);
}

/** Фоновые повторы после сбоя и пауза, после которой провал можно повторить. */
const CHUNK_RETRIES = 2;
const CHUNK_RETRY_DELAY_MS = 500;
const FAILED_RETRY_MS = 10_000;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function notify(): void {
  for (const listener of listeners) listener();
}

/** Подписка на догрузку оверлеев (для useSyncExternalStore). */
export function subscribeLocalizedText(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Загрузка ленивого чанка: дедупликация, фоновые повторы после сбоя и пауза,
 * после которой провал можно повторить. Вызывающий ждёт только первую попытку.
 * Экспортирован для тестов.
 */
export function loadChunk(
  id: string,
  load: () => Promise<{ default: unknown }>,
  apply: (data: unknown) => void
): Promise<void> {
  const running = pending.get(id);
  if (running) return running;
  const failedTimestamp = failedAt.get(id);
  if (failedTimestamp !== undefined && Date.now() - failedTimestamp < FAILED_RETRY_MS) {
    return Promise.resolve();
  }

  // Первая попытка завершает возвращаемый промис (main.tsx рендерит экран, даже если
  // имён нет); повторы идут фоном, их успех доедет до подписчиков через `notify()`.
  let settle!: () => void;
  const first = new Promise<void>((resolve) => {
    settle = resolve;
  });
  const chain = (async () => {
    try {
      const mod = await load();
      apply(mod.default);
      notify();
      return;
    } catch {
      // Первый сбой не считаем окончательным: ниже фоновые повторы.
    } finally {
      settle();
    }
    for (let attempt = 1; attempt <= CHUNK_RETRIES; attempt++) {
      await delay(CHUNK_RETRY_DELAY_MS * attempt);
      try {
        const mod = await load();
        apply(mod.default);
        notify();
        return;
      } catch {
        // Повтор не удался — ждём следующего.
      }
    }
    failedAt.set(id, Date.now());
    console.warn(`Чанк локализации «${id}» не загружен после ${CHUNK_RETRIES + 1} попыток; повтор — после паузы или перезагрузки.`);
  })().finally(() => {
    settle();
    pending.delete(id);
  });
  pending.set(id, chain);
  return first;
}

/** RU/…-имена контента (список заклинаний, черт, фитов, оружия). */
export function loadNames(lang: string): Promise<void> {
  if (!hasContentLang(lang) || namesByLang.has(lang)) return Promise.resolve();
  return loadChunk(`names:${lang}`, () => import(`../data/text.${lang}/names.json`), (data) => {
    namesByLang.set(lang, data as NamesData);
  });
}

/** Ленивые описания заклинаний. */
export function loadSpellText(lang: string): Promise<void> {
  if (!hasContentLang(lang) || spellByLang.has(lang)) return Promise.resolve();
  return loadChunk(`spells:${lang}`, () => import(`../data/text.${lang}/spells.json`), (data) => {
    spellByLang.set(lang, data as SpellTextData);
  });
}

/** Ленивые описания и требования фитов. */
export function loadFeatText(lang: string): Promise<void> {
  if (!hasContentLang(lang) || featByLang.has(lang)) return Promise.resolve();
  return loadChunk(`feats:${lang}`, () => import(`../data/text.${lang}/feats.json`), (data) => {
    featByLang.set(lang, data as FeatTextData);
  });
}

/** Ленивые описания черт одного класса. */
export function loadFeatureText(lang: string, className: string): Promise<void> {
  if (!hasContentLang(lang) || featureByLang.get(lang)?.has(className)) return Promise.resolve();
  return loadChunk(`feature:${lang}:${className}`, () => import(`../data/text.${lang}/features/${className}.json`), (data) => {
    if (!featureByLang.has(lang)) featureByLang.set(lang, new Map());
    featureByLang.get(lang)!.set(className, (data as FeatureTextData).featureDescriptions);
  });
}

export function isNamesLoaded(lang: string): boolean {
  return namesByLang.has(lang);
}

export function isSpellTextLoaded(lang: string): boolean {
  return spellByLang.has(lang);
}

export function isFeatTextLoaded(lang: string): boolean {
  return featByLang.has(lang);
}

export function isFeatureTextLoaded(lang: string, className: string): boolean {
  return featureByLang.get(lang)?.has(className) ?? false;
}

/** RU/…-название заклинания по ключу. */
export function spellName(key: string | undefined, lang: string): string | undefined {
  if (!key) return undefined;
  return namesByLang.get(lang)?.spells[key];
}

/** RU/…-название классовой/подклассовой черты по ключу ресурса. */
export function featureName(key: string | undefined, lang: string): string | undefined {
  if (!key) return undefined;
  return namesByLang.get(lang)?.features[key];
}

/** RU/…-название фита по ключу. */
export function featName(key: string | undefined, lang: string): string | undefined {
  if (!key) return undefined;
  return namesByLang.get(lang)?.feats[key];
}

/** RU/…-название оружия по ключу. */
export function weaponName(key: string | undefined, lang: string): string | undefined {
  if (!key) return undefined;
  return namesByLang.get(lang)?.weapons[key];
}

/** Класс черты по ключу (`class.subclass:feature` / `class:feature`). */
export function featureClassOf(key: string | undefined): string | undefined {
  if (!key) return undefined;
  const [head] = key.split(':');
  const cls = head?.split('.')[0];
  return cls || undefined;
}

/** Абзацы описания заклинания (undefined — чанк не загружен или перевода нет). */
export function spellDescription(key: string | undefined, lang: string): string[] | undefined {
  if (!key) return undefined;
  return spellByLang.get(lang)?.spellDescriptions[key];
}

/** Абзацы «На больших уровнях». */
export function spellHigherLevel(key: string | undefined, lang: string): string[] | undefined {
  if (!key) return undefined;
  return spellByLang.get(lang)?.spellHigherLevel[key];
}

/** Описание фита. */
export function featDescription(key: string | undefined, lang: string): string | undefined {
  if (!key) return undefined;
  return featByLang.get(lang)?.featDescriptions[key];
}

/** Строка требований фита. */
export function featPrereq(key: string | undefined, lang: string): string | undefined {
  if (!key) return undefined;
  return featByLang.get(lang)?.featPrereq[key];
}

/** Описание черты (по классу из ключа). */
export function featureDescription(key: string | undefined, lang: string): string | undefined {
  if (!key) return undefined;
  const cls = featureClassOf(key);
  if (!cls) return undefined;
  return featureByLang.get(lang)?.get(cls)?.[key];
}
