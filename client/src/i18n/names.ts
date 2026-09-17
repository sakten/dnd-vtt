import { featNameRu, featureNameRu, spellNameRu, weaponNameRu } from 'shared';
import { getLocale } from './index';

function pick(ru: string | undefined, fallback: string): string {
  return getLocale() === 'ru' && ru ? ru : fallback;
}

/** Отображаемое имя заклинания: RU-оверлей в русской локали, иначе исходное (EN). */
export function spellDisplayName(spell: { key: string; name: string }): string {
  return pick(spellNameRu(spell.key), spell.name);
}

/** Отображаемое имя классовой черты по ключу ресурса. */
export function featureDisplayName(key: string | undefined, fallback: string): string {
  return pick(featureNameRu(key), fallback);
}

/** Отображаемое имя фита по ключу. */
export function featDisplayName(key: string | undefined, fallback: string): string {
  return pick(featNameRu(key), fallback);
}

/** Отображаемое имя оружия по ключу. */
export function weaponDisplayName(key: string | undefined, fallback: string): string {
  return pick(weaponNameRu(key), fallback);
}
