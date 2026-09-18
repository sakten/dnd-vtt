import namesRaw from '../data/text.ru/names.json';

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

const names = namesRaw as NamesData;

export const textAttribution = names.attribution;

/** RU-название заклинания по ключу (undefined — перевода нет). */
export function spellNameRu(key: string | undefined): string | undefined {
  if (!key) return undefined;
  return names.spells[key];
}

/** RU-название классовой/подклассовой черты по ключу ресурса. */
export function featureNameRu(key: string | undefined): string | undefined {
  if (!key) return undefined;
  return names.features[key];
}

/** RU-название фита по ключу. */
export function featNameRu(key: string | undefined): string | undefined {
  if (!key) return undefined;
  return names.feats[key];
}

/** RU-название оружия по ключу. */
export function weaponNameRu(key: string | undefined): string | undefined {
  if (!key) return undefined;
  return names.weapons[key];
}

/** Класс черты по ключу (`class.subclass:feature` / `class:feature`). */
export function featureClassOf(key: string | undefined): string | undefined {
  if (!key) return undefined;
  const [head] = key.split(':');
  const cls = head?.split('.')[0];
  return cls || undefined;
}

let spellText: SpellTextData | null = null;
let featText: FeatTextData | null = null;
const featureText = new Map<string, Record<string, string>>();
const pending = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

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

export function isSpellTextLoaded(): boolean {
  return spellText !== null;
}

export function isFeatTextLoaded(): boolean {
  return featText !== null;
}

export function isFeatureTextLoaded(className: string): boolean {
  return featureText.has(className);
}

function loadChunk(id: string, load: () => Promise<{ default: unknown }>, apply: (data: unknown) => void): Promise<void> {
  const running = pending.get(id);
  if (running) return running;
  const promise = load()
    .then((mod) => {
      apply(mod.default);
      notify();
    })
    .finally(() => {
      pending.delete(id);
    });
  pending.set(id, promise);
  return promise;
}

/** Догружает RU-описания заклинаний (чанк `text.ru/spells.json`). */
export function loadSpellText(): Promise<void> {
  if (spellText) return Promise.resolve();
  return loadChunk('spells', () => import('../data/text.ru/spells.json'), (data) => {
    spellText = data as SpellTextData;
  });
}

/** Догружает RU-описания фитов (чанк `text.ru/feats.json`). */
export function loadFeatText(): Promise<void> {
  if (featText) return Promise.resolve();
  return loadChunk('feats', () => import('../data/text.ru/feats.json'), (data) => {
    featText = data as FeatTextData;
  });
}

/** Догружает RU-описания черт одного класса (чанк `text.ru/features/<класс>.json`). */
export function loadFeatureText(className: string): Promise<void> {
  if (featureText.has(className)) return Promise.resolve();
  return loadChunk(`feature:${className}`, () => import(`../data/text.ru/features/${className}.json`), (data) => {
    featureText.set(className, (data as FeatureTextData).featureDescriptions);
  });
}

/** RU-описание черты по ключу (undefined — чанк класса ещё не загружен или перевода нет). */
export function featureDescriptionRu(key: string | undefined): string | undefined {
  if (!key) return undefined;
  const cls = featureClassOf(key);
  if (!cls) return undefined;
  return featureText.get(cls)?.[key];
}

/** RU-описание фита по ключу (undefined — чанк не загружен или перевода нет). */
export function featDescriptionRu(key: string | undefined): string | undefined {
  if (!key) return undefined;
  return featText?.featDescriptions[key];
}

/** RU-строка требований фита по ключу (undefined — чанк не загружен или требований нет). */
export function featPrereqRu(key: string | undefined): string | undefined {
  if (!key) return undefined;
  return featText?.featPrereq[key];
}

/** RU-абзацы описания заклинания по ключу (undefined — чанк не загружен или перевода нет). */
export function spellDescriptionRu(key: string | undefined): string[] | undefined {
  if (!key) return undefined;
  return spellText?.spellDescriptions[key];
}

/** RU-абзацы «На больших уровнях» (undefined — блока нет). */
export function spellHigherLevelRu(key: string | undefined): string[] | undefined {
  if (!key) return undefined;
  return spellText?.spellHigherLevel[key];
}
