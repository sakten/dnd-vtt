import raw from '../data/text.ru.json';

export interface LocalizedTextData {
  attribution: string;
  spells: Record<string, string>;
  features: Record<string, string>;
  featureDescriptions: Record<string, string>;
  feats: Record<string, string>;
  featDescriptions: Record<string, string>;
  weapons: Record<string, string>;
  spellDescriptions: Record<string, string[]>;
  spellHigherLevel: Record<string, string[]>;
}

const data = raw as unknown as LocalizedTextData;

/** RU-название заклинания по ключу (undefined — перевода нет). */
export function spellNameRu(key: string | undefined): string | undefined {
  if (!key) return undefined;
  return data.spells[key];
}

/** RU-название классовой/подклассовой черты по ключу ресурса. */
export function featureNameRu(key: string | undefined): string | undefined {
  if (!key) return undefined;
  return data.features[key];
}

/** RU-описание черты по ключу (undefined — перевода нет, показываем EN). */
export function featureDescriptionRu(key: string | undefined): string | undefined {
  if (!key) return undefined;
  return data.featureDescriptions[key];
}

/** RU-название фита по ключу. */
export function featNameRu(key: string | undefined): string | undefined {
  if (!key) return undefined;
  return data.feats[key];
}

/** RU-описание фита по ключу (undefined — перевода нет, показываем EN). */
export function featDescriptionRu(key: string | undefined): string | undefined {
  if (!key) return undefined;
  return data.featDescriptions[key];
}

/** RU-название оружия по ключу. */
export function weaponNameRu(key: string | undefined): string | undefined {
  if (!key) return undefined;
  return data.weapons[key];
}

/** RU-абзацы описания заклинания по ключу (undefined — перевода нет, показываем EN). */
export function spellDescriptionRu(key: string | undefined): string[] | undefined {
  if (!key) return undefined;
  return data.spellDescriptions[key];
}

/** RU-абзацы «На больших уровнях» (undefined — блока нет). */
export function spellHigherLevelRu(key: string | undefined): string[] | undefined {
  if (!key) return undefined;
  return data.spellHigherLevel[key];
}

export const textAttribution = data.attribution;
