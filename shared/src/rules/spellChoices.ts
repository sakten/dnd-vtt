import type { FeatureChoice } from '../domain/feature';
import type { ClassLevel } from '../domain/sheet';
import { clampLevel } from './classes';

/**
 * Выборы заклинаний из классовых черт (R8.8, коллегии барда).
 * Магические находки (Знание, 6): два заклинания из списков жреца/друида/волшебника,
 * всегда подготовлены и считаются заклинаниями барда (кастуются слотами по Харизме).
 */

export const MAGICAL_DISCOVERIES_KEY = 'bard.lore:magicalDiscoveries';

/** Списки, из которых выбираются заклинания Магических находок. */
export const MAGICAL_DISCOVERIES_LISTS = [
  { className: 'cleric', name: 'Жрец' },
  { className: 'druid', name: 'Друид' },
  { className: 'wizard', name: 'Волшебник' },
];

/** Доступны ли Магические находки персонажу (бард-знание 6+). */
export function magicalDiscoveriesAvailable(classes: ClassLevel[]): boolean {
  const bard = classes.find((c) => c.className === 'bard');
  return !!bard && bard.subclass === 'lore' && clampLevel(bard.level) >= 6;
}

/** Выбранные заклинания черты (до двух). */
export function magicalDiscoveriesSpells(choices: FeatureChoice[] | undefined): string[] {
  const choice = (choices ?? []).find(
    (c) => c.kind === 'featureOption' && c.key === MAGICAL_DISCOVERIES_KEY
  );
  return (choice?.spells ?? []).filter(Boolean);
}

export interface ChoiceSpellGrant {
  key: string;
  /** Класс каста: выбранные заклинания считаются бардовскими. */
  className: string;
}

/** Заклинания, выданные выборами черт (Магические находки). */
export function choiceSpellGrants(choices: FeatureChoice[] | undefined): ChoiceSpellGrant[] {
  return magicalDiscoveriesSpells(choices).map((key) => ({ key, className: 'bard' }));
}
