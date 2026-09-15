import type { AbilityKey } from '../domain/core';
import type { AutomationEffect } from '../domain/automation';
import type { FeatureChoice } from '../domain/feature';
import type { ClassLevel } from '../domain/sheet';
import raw from '../data/feats.json';
import { clampLevel, proficiencyBonus } from './classes';

/**
 * Каталог фитов PHB'24 (`npm run feats`) и ручной слой их механик (R8.8, выборы).
 * `featChoiceEffects` отдаёт пассивные эффекты выбранных фитов — их синкает сервер
 * скрытыми эффектами (как пассивные черты классов).
 */

export type FeatCategory = 'origin' | 'general' | 'fightingStyle';

export interface FeatDef {
  key: string;
  name: string;
  category: FeatCategory;
  levelReq?: number;
  prereq?: string;
  repeatable?: boolean;
  abilityChoose?: AbilityKey[];
  spellLists?: { name: string; className: string }[];
  description: string;
}

export const FEATS: FeatDef[] = (raw as unknown as { feats: FeatDef[] }).feats;

export function featByKey(key: string): FeatDef | undefined {
  return FEATS.find((feat) => feat.key === key);
}

export function featsByCategory(category: FeatCategory): FeatDef[] {
  return FEATS.filter((feat) => feat.category === category);
}

/** Пассивная механика фита-выбора: имя для чипа и постоянные эффекты. */
export interface ChoiceFeature {
  key: string;
  name: string;
  effects: AutomationEffect[];
}

function permanent(name: string, modifiers: AutomationEffect['modifiers']): AutomationEffect {
  return { name, duration: { type: 'permanent' }, modifiers };
}

function totalLevel(classes: ClassLevel[]): number {
  return classes.reduce((acc, entry) => acc + clampLevel(entry.level), 0) || 1;
}

type FeatMechanicsSource = (classes: ClassLevel[]) => ChoiceFeature;

const FEAT_MECHANICS: Record<string, FeatMechanicsSource> = {
  // Стойкий: +2 хитов за каждый уровень персонажа.
  'XPHB:tough': (classes) => ({
    key: 'XPHB:tough',
    name: 'Стойкий',
    effects: [permanent('Стойкий', [{ target: 'maxHp', mode: 'add', value: 2 * totalLevel(classes) }])],
  }),
  // Бдительный: +бонус владения к инициативе.
  'XPHB:alert': (classes) => ({
    key: 'XPHB:alert',
    name: 'Бдительный',
    effects: [
      permanent('Бдительный', [{ target: 'initiative', mode: 'add', value: proficiencyBonus(totalLevel(classes)) }]),
    ],
  }),
};

/** Пассивные эффекты фитов персонажа (Tough, Alert и подобные). */
export function featChoiceEffects(choices: FeatureChoice[] | undefined, classes: ClassLevel[]): ChoiceFeature[] {
  const out: ChoiceFeature[] = [];
  for (const choice of choices ?? []) {
    if (choice.kind !== 'feat') continue;
    const source = FEAT_MECHANICS[choice.key];
    if (!source) continue;
    out.push(source(classes));
  }
  return out;
}

/** Фиты с механикой из заклинаний (Magic Initiate и подобные). */
const SPELL_FEATS = new Set(['XPHB:magicInitiate']);

/** Реализована ли механика фита (иначе в UI показываем «(TODO)»). */
export function featMechanicsImplemented(key: string): boolean {
  return !!FEAT_MECHANICS[key] || SPELL_FEATS.has(key);
}

/** Префикс псевдокласса заклинаний фита: `feat:XPHB:magicInitiate`. */
export const FEAT_CAST_PREFIX = 'feat:';

/** Заклинания, выданные фитами: заговоры (без лимита) и заклинание 1 круга (бесплатно 1/долгий отдых). */
export function featSpellGrants(choices: FeatureChoice[] | undefined): { key: string; className: string; level: number }[] {
  const out: { key: string; className: string; level: number }[] = [];
  for (const choice of choices ?? []) {
    if (choice.kind !== 'feat' || !choice.list) continue;
    const className = `${FEAT_CAST_PREFIX}${choice.key}`;
    for (const key of choice.spells ?? []) out.push({ key, className, level: 0 });
    if (choice.spell) out.push({ key: choice.spell, className, level: 1 });
  }
  return out;
}
