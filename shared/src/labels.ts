import type { AbilityKey } from './domain/core';

/**
 * Доменные ключи (без RU-названий): подписи живут в клиентском i18n
 * (`client/src/i18n/ru.ts`/`en.ts`, `domain.*`), сервер строки не носит.
 */

/** Ключи типов урона; первые три — физические (в таком порядке в выпадающих списках). */
export const DAMAGE_TYPES: { key: string }[] = [
  { key: 'slashing' },
  { key: 'piercing' },
  { key: 'bludgeoning' },
  { key: 'acid' },
  { key: 'cold' },
  { key: 'fire' },
  { key: 'force' },
  { key: 'lightning' },
  { key: 'necrotic' },
  { key: 'poison' },
  { key: 'psychic' },
  { key: 'radiant' },
  { key: 'thunder' },
];

/** Цвета типов урона: чат, FX-эффекты и иконки существ (не локализуются). */
export const DAMAGE_TYPE_COLORS: Record<string, string> = {
  fire: '#ff8a2b',
  cold: '#7fd4ff',
  lightning: '#ffe86b',
  acid: '#9bea3a',
  poison: '#7cd06a',
  necrotic: '#a06bff',
  radiant: '#ffe6a3',
  force: '#8fb7ff',
  thunder: '#dbe9ff',
  psychic: '#ff7fd0',
  bludgeoning: '#c9b8a3',
  piercing: '#d9d9d9',
  slashing: '#e0a0a0',
};

export function damageTypeColor(key: string | undefined): string | undefined {
  return key ? DAMAGE_TYPE_COLORS[key] : undefined;
}

export const ABILITIES: { key: AbilityKey }[] = [
  { key: 'str' },
  { key: 'dex' },
  { key: 'con' },
  { key: 'int' },
  { key: 'wis' },
  { key: 'cha' },
];

export const SKILLS: { key: string; ability: AbilityKey }[] = [
  { key: 'athletics', ability: 'str' },
  { key: 'acrobatics', ability: 'dex' },
  { key: 'sleightOfHand', ability: 'dex' },
  { key: 'stealth', ability: 'dex' },
  { key: 'arcana', ability: 'int' },
  { key: 'history', ability: 'int' },
  { key: 'investigation', ability: 'int' },
  { key: 'nature', ability: 'int' },
  { key: 'religion', ability: 'int' },
  { key: 'animalHandling', ability: 'wis' },
  { key: 'insight', ability: 'wis' },
  { key: 'medicine', ability: 'wis' },
  { key: 'perception', ability: 'wis' },
  { key: 'survival', ability: 'wis' },
  { key: 'deception', ability: 'cha' },
  { key: 'intimidation', ability: 'cha' },
  { key: 'performance', ability: 'cha' },
  { key: 'persuasion', ability: 'cha' },
];
