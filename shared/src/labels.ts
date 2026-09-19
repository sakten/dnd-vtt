import type { AbilityKey } from './domain/core';
import type { DamageDefenseType } from './domain/damage';
import type { LightAreaKind } from './domain/scene';
import type { SenseType } from './domain/sense';

export const SENSE_NAMES: Record<SenseType, string> = {
  darkvision: 'Тёмное зрение',
  blindsight: 'Слепое зрение',
  devilsight: 'Дьявольское зрение',
};

export const LIGHT_AREA_NAMES: Record<LightAreaKind, string> = {
  darkness: 'Тьма',
  magical: 'Магическая тьма',
  obscured: 'Мгла',
};

/** Список типов урона; первые три — физические (в таком порядке в выпадающих списках). */
export const DAMAGE_TYPES: { key: string; name: string }[] = [
  { key: 'slashing', name: 'Режущий' },
  { key: 'piercing', name: 'Колющий' },
  { key: 'bludgeoning', name: 'Дробящий' },
  { key: 'acid', name: 'Кислота' },
  { key: 'cold', name: 'Холод' },
  { key: 'fire', name: 'Огонь' },
  { key: 'force', name: 'Силовой' },
  { key: 'lightning', name: 'Молния' },
  { key: 'necrotic', name: 'Некротический' },
  { key: 'poison', name: 'Яд' },
  { key: 'psychic', name: 'Психический' },
  { key: 'radiant', name: 'Излучение' },
  { key: 'thunder', name: 'Гром' },
];

export function damageTypeName(key: string | undefined): string | undefined {
  if (!key) return undefined;
  return DAMAGE_TYPES.find((d) => d.key === key)?.name ?? key;
}

/** Цвета типов урона: чат, FX-эффекты и иконки существ. */
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

export const DEFENSE_TYPE_NAMES: Record<DamageDefenseType, string> = {
  resistance: 'Сопротивление',
  immunity: 'Иммунитет',
  vulnerability: 'Уязвимость',
};

export const ABILITIES: { key: AbilityKey; name: string }[] = [
  { key: 'str', name: 'Сила' },
  { key: 'dex', name: 'Ловкость' },
  { key: 'con', name: 'Телосложение' },
  { key: 'int', name: 'Интеллект' },
  { key: 'wis', name: 'Мудрость' },
  { key: 'cha', name: 'Харизма' },
];

export const SKILLS: { key: string; name: string; ability: AbilityKey }[] = [
  { key: 'athletics', name: 'Атлетика', ability: 'str' },
  { key: 'acrobatics', name: 'Акробатика', ability: 'dex' },
  { key: 'sleightOfHand', name: 'Ловкость рук', ability: 'dex' },
  { key: 'stealth', name: 'Скрытность', ability: 'dex' },
  { key: 'arcana', name: 'Магия', ability: 'int' },
  { key: 'history', name: 'История', ability: 'int' },
  { key: 'investigation', name: 'Анализ', ability: 'int' },
  { key: 'nature', name: 'Природа', ability: 'int' },
  { key: 'religion', name: 'Религия', ability: 'int' },
  { key: 'animalHandling', name: 'Уход за животными', ability: 'wis' },
  { key: 'insight', name: 'Проницательность', ability: 'wis' },
  { key: 'medicine', name: 'Медицина', ability: 'wis' },
  { key: 'perception', name: 'Восприятие', ability: 'wis' },
  { key: 'survival', name: 'Выживание', ability: 'wis' },
  { key: 'deception', name: 'Обман', ability: 'cha' },
  { key: 'intimidation', name: 'Запугивание', ability: 'cha' },
  { key: 'performance', name: 'Выступление', ability: 'cha' },
  { key: 'persuasion', name: 'Убеждение', ability: 'cha' },
];
