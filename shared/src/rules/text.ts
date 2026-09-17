import raw from '../data/text.ru.json';

export interface LocalizedTextData {
  attribution: string;
  spells: Record<string, string>;
  features: Record<string, string>;
  feats: Record<string, string>;
  weapons: Record<string, string>;
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

/** RU-название фита по ключу. */
export function featNameRu(key: string | undefined): string | undefined {
  if (!key) return undefined;
  return data.feats[key];
}

/** RU-название оружия по ключу. */
export function weaponNameRu(key: string | undefined): string | undefined {
  if (!key) return undefined;
  return data.weapons[key];
}

export const textAttribution = data.attribution;
