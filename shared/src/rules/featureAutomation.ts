import type { AutomationDef, AutomationEffect } from '../domain/automation';
import type { Modifier } from '../domain/effects';
import type { FeatureMechanics } from '../domain/feature';
import type { ClassLevel } from '../domain/sheet';
import { clampLevel } from './classes';
import { featuresFor } from './features';

/**
 * Ручной слой механик черт (R8.8). Наполняется партиями по классам:
 * `trait: 'passive'` — постоянные эффекты на носителя, `trait: 'active'` — кнопка,
 * `trait: 'choice'` — слот выбора (фиты/манёвры/метамагия). Значение может быть
 * функцией от классов (уровневые варианты, как урона Ярости). Черта без записи
 * остаётся необработанной и кнопкой не становится.
 */

export type FeatureMechanicsSource = FeatureMechanics | ((classes: ClassLevel[]) => FeatureMechanics);

export const FEATURE_MECHANICS: Record<string, FeatureMechanicsSource> = {
  // Варвар — ядро
  'barbarian:rage': (classes) => {
    const worldTree = classes.find((c) => c.className === 'barbarian' && c.subclass === 'worldTree')?.level ?? 0;
    return {
      trait: 'active',
      automation: {
        key: 'class:barbarian:rage',
        name: 'Ярость',
        resolution: 'effect',
        targeting: { kind: 'self' },
        effects: [
          {
            name: 'Ярость',
            duration: { type: 'rounds', rounds: 10 },
            to: 'self',
            restrictions: { noSpells: true },
            ...(worldTree >= 3 ? { tempHp: barbarianLevel(classes) } : {}),
            modifiers: [
              {
                target: 'damage',
                mode: 'add',
                value: barbarianLevel(classes) >= 9 ? 3 : 2,
                filter: { attackType: 'melee' },
              },
              { target: 'check', mode: 'advantage', filter: { ability: 'str' } },
              { target: 'save', mode: 'advantage', filter: { ability: 'str' } },
              { target: 'damage', mode: 'resistance', filter: { damageType: 'bludgeoning' } },
              { target: 'damage', mode: 'resistance', filter: { damageType: 'piercing' } },
              { target: 'damage', mode: 'resistance', filter: { damageType: 'slashing' } },
            ],
          },
        ],
      },
    };
  },
  'barbarian:recklessAttack': {
    trait: 'active',
    costs: ['free'],
    targeting: { kind: 'self' },
    automation: {
      key: 'class:barbarian:recklessAttack',
      name: 'Безрассудная атака',
      resolution: 'effect',
      targeting: { kind: 'self' },
      effects: [
        {
          name: 'Безрассудная атака',
          duration: { type: 'endOfTurn', of: 'target' },
          to: 'self',
          modifiers: [
            { target: 'attack', mode: 'advantage', filter: { attackType: 'melee', direction: 'self' } },
            { target: 'attack', mode: 'advantage', filter: { direction: 'against' } },
          ],
        },
      ],
    },
  },
  'barbarian:unarmoredDefense': {
    trait: 'passive',
    effects: [permanent('Защита без доспехов', [{ target: 'ac', mode: 'set', value: '10+dex+con' }])],
  },
  'barbarian:fastMovement': {
    trait: 'passive',
    effects: [permanent('Быстрое передвижение', [{ target: 'speed', mode: 'add', value: 10 }])],
  },
  'barbarian:dangerSense': {
    trait: 'passive',
    effects: [permanent('Чувство опасности', [{ target: 'save', mode: 'advantage', filter: { ability: 'dex' } }])],
  },
  'barbarian:feralInstinct': {
    trait: 'passive',
    effects: [permanent('Звериный инстинкт', [{ target: 'initiative', mode: 'advantage' }])],
  },
  'barbarian:extraAttack': { trait: 'passive', native: true },

  // Воин — ядро
  'fighter:extraAttack': { trait: 'passive', native: true },
  'fighter:twoExtraAttacks': { trait: 'passive', native: true },
  'fighter.battleMaster:improvedCombatSuperiority': { trait: 'passive', native: true },
  'fighter.psiWarrior:psionicStrike': {
    trait: 'active',
    costs: ['free'],
    targeting: { kind: 'self' },
    automation: {
      key: 'class:fighter.psiWarrior:psionicStrike',
      name: 'Псионический удар',
      resolution: 'effect',
      targeting: { kind: 'self' },
      effects: [
        {
          name: 'Псионический удар: наготове',
          duration: { type: 'endOfTurn', of: 'source' },
          to: 'self',
          hidden: true,
          modifiers: [],
        },
      ],
    },
  },
  'fighter.champion:improvedCritical': { trait: 'passive', native: true },
  'fighter.samurai:fightingSpirit': (classes) => {
    const level = classes.find((c) => c.className === 'fighter')?.level ?? 0;
    return {
      trait: 'active',
      automation: {
        key: 'class:fighter.samurai:fightingSpirit',
        name: 'Боевой дух',
        resolution: 'effect',
        targeting: { kind: 'self' },
        effects: [
          {
            name: 'Боевой дух',
            duration: { type: 'endOfTurn', of: 'target' },
            to: 'self',
            tempHp: level >= 15 ? 15 : level >= 10 ? 10 : 5,
            modifiers: [{ target: 'attack', mode: 'advantage', filter: { direction: 'self', weapon: true } }],
          },
        ],
      },
    };
  },
  'barbarian.worldTree:vitalityOfTheTree': { trait: 'passive', native: true },
  'barbarian.worldTree:batteringRoots': {
    trait: 'passive',
    effects: [permanent('Досягаемость мирового древа', [{ target: 'reach', mode: 'add', value: 10 }])],
  },
  'barbarian.zealot:zealousPresence': {
    trait: 'active',
    automation: {
      key: 'class:barbarian.zealot:zealousPresence',
      name: 'Фанатичное присутствие',
      resolution: 'effect',
      targeting: { kind: 'self' },
      effects: [
        {
          name: 'Фанатичное присутствие',
          duration: { type: 'endOfTurn', of: 'source' },
          radiusFeet: 30,
          to: 'targets',
          modifiers: [
            { target: 'attack', mode: 'advantage', filter: { direction: 'self' } },
            { target: 'save', mode: 'advantage' },
          ],
        },
      ],
    },
  },
  'fighter.psiWarrior:guardedMind': {
    trait: 'passive',
    effects: [permanent('Защищённый разум', [{ target: 'damage', mode: 'resistance', filter: { damageType: 'psychic' } }])],
  },
  'fighter.champion:remarkableAthlete': {
    trait: 'passive',
    effects: [
      permanent('Выдающийся атлет', [
        { target: 'initiative', mode: 'advantage' },
        { target: 'check', mode: 'advantage', filter: { skill: 'athletics' } },
      ]),
    ],
  },
};

function barbarianLevel(classes: ClassLevel[]): number {
  return clampLevel(classes.find((c) => c.className === 'barbarian')?.level ?? 0);
}

function permanent(name: string, modifiers: Omit<Modifier, 'id'>[]): AutomationEffect {
  return { name, duration: { type: 'permanent' }, modifiers };
}

/** Механика черты: статичная запись или вычисленная по классам персонажа. */
export function featureMechanics(key: string, classes: ClassLevel[] = []): FeatureMechanics | undefined {
  const source = FEATURE_MECHANICS[key];
  if (!source) return undefined;
  return typeof source === 'function' ? source(classes) : source;
}

/** Автоматизация активной черты по id действия (`class:<key>`), когда нет строки в `AUTOMATION_ACTIONS`. */
export function featureActionAutomation(actionId: string, classes: ClassLevel[] | undefined): AutomationDef | undefined {
  if (!actionId.startsWith('class:') || !classes) return undefined;
  return featureMechanics(actionId.slice('class:'.length), classes)?.automation;
}

export interface PassiveFeature {
  key: string;
  name: string;
  effects: NonNullable<FeatureMechanics['effects']>;
}

/** Пассивные черты персонажа с постоянными эффектами (для синка на токен). */
export function passiveFeatures(classes: ClassLevel[]): PassiveFeature[] {
  const out: PassiveFeature[] = [];
  for (const feature of featuresFor(classes)) {
    const mech = featureMechanics(feature.key, classes);
    if (!mech || mech.trait !== 'passive' || !mech.effects?.length) continue;
    out.push({ key: feature.key, name: feature.name, effects: mech.effects });
  }
  return out;
}
