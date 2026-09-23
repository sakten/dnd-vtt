import type { AutomationDef, AutomationEffect } from '../domain/automation';
import type { Modifier } from '../domain/effects';
import type { FeatureMechanics } from '../domain/feature';
import type { ClassLevel } from '../domain/sheet';
import { bardicDie, clampLevel, proficiencyBonus } from './classes';
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
              { target: 'damage', mode: 'resistance', filter: { damageType: 'magicalBludgeoning' } },
              { target: 'damage', mode: 'resistance', filter: { damageType: 'magicalPiercing' } },
              { target: 'damage', mode: 'resistance', filter: { damageType: 'magicalSlashing' } },
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

  // Монах — ядро
  'monk:unarmoredDefense': {
    trait: 'passive',
    effects: [permanent('Защита без доспехов', [{ target: 'ac', mode: 'set', value: '10+dex+wis' }])],
  },
  'monk:unarmoredMovement': (classes) => ({
    trait: 'passive',
    effects: [
      permanent('Движение без доспехов', [
        { target: 'speed', mode: 'add', value: monkLevel(classes) >= 9 ? 15 : 10 },
      ]),
    ],
  }),
  'monk:extraAttack': { trait: 'passive', native: true },
  'monk:empoweredStrikes': { trait: 'passive', native: true },
  'monk:bonusUnarmedStrike': {
    trait: 'active',
    costs: ['bonus'],
    automation: {
      key: 'class:monk:bonusUnarmedStrike',
      name: 'Безоружный удар (бонус)',
      resolution: 'utility',
      utility: { kind: 'extraAttacks', amount: 1 },
    },
  },
  'monk:patientDefense': {
    trait: 'active',
    name: 'Терпеливая оборона (Отход)',
    costs: ['bonus'],
    automation: {
      key: 'class:monk:patientDefense',
      name: 'Терпеливая оборона',
      resolution: 'utility',
      utility: { kind: 'disengage' },
    },
  },
  'monk:stepOfTheWind': {
    trait: 'active',
    name: 'Шаг ветра (Рывок)',
    costs: ['bonus'],
    automation: {
      key: 'class:monk:stepOfTheWind',
      name: 'Шаг ветра',
      resolution: 'utility',
      utility: { kind: 'extraMovement' },
    },
  },
  'monk:focus/flurryOfBlows': (classes) => ({
    trait: 'active',
    automation: {
      key: 'class:monk:focus/flurryOfBlows',
      name: 'Шквал ударов',
      resolution: 'utility',
      utility: { kind: 'extraAttacks', amount: monkLevel(classes) >= 10 ? 3 : 2 },
    },
  }),
  'monk:focus/patientDefense': {
    trait: 'active',
    automation: {
      key: 'class:monk:focus/patientDefense',
      name: 'Терпеливая оборона',
      resolution: 'utility',
      utility: { kind: 'patientDefense' },
    },
  },
  'monk:focus/stepOfTheWind': {
    trait: 'active',
    automation: {
      key: 'class:monk:focus/stepOfTheWind',
      name: 'Шаг ветра',
      resolution: 'utility',
      utility: { kind: 'stepOfTheWind' },
    },
  },

  // Жрец — ядро
  'cleric:divineSpark': (classes) => {
    const dice = clericLevel(classes) >= 18 ? '4d8' : clericLevel(classes) >= 13 ? '3d8' : clericLevel(classes) >= 7 ? '2d8' : '1d8';
    return {
      trait: 'active',
      costs: ['action'],
      targeting: { kind: 'creature', range: 30 },
      resourceKey: 'cleric:channelDivinity',
      automation: {
        key: 'class:cleric:divineSpark',
        name: 'Божественная искра',
        resolution: 'save',
        save: { ability: 'con', half: true },
        damage: { dice: `${dice}+wis`, types: ['necrotic', 'radiant'] },
        heal: { dice: `${dice}+wis` },
      },
    };
  },
  'cleric:turnUndead': (classes) => ({
    trait: 'active',
    costs: ['action'],
    targeting: { kind: 'self' },
    resourceKey: 'cleric:channelDivinity',
    automation: {
      key: 'class:cleric:turnUndead',
      name: 'Изгнание нежити',
      resolution: 'effect',
      autoTargets: { feet: 30, side: 'hostile' },
      save: { ability: 'wis' },
      // Карающая нежить (5 ур.): кости по модификатору Мудрости, урон не снимает изгнание.
      ...(clericLevel(classes) >= 5
        ? { damage: { dice: '1d8', types: ['radiant'], abilityDice: { ability: 'wis', min: 1 } } }
        : {}),
      effects: [
        {
          name: 'Изгнание нежити',
          duration: { type: 'untilSave', ability: 'wis', dc: 0, timing: 'end' },
          to: 'targets',
          wakeOnDamage: true,
          modifiers: [],
          conditions: ['frightened', 'incapacitated'],
        },
      ],
    },
  }),
  'cleric:divineIntervention': {
    trait: 'active',
    costs: ['action'],
    resourceKey: 'cleric:divineIntervention',
    automation: {
      key: 'class:cleric:divineIntervention',
      name: 'Божественное вмешательство',
      resolution: 'manual',
    },
  },

  // Жрец — домены (XPHB)
  'cleric.life:discipleOfLife': { trait: 'passive', native: true },
  'cleric.life:blessedHealer': { trait: 'passive', native: true },
  'cleric.life:preserveLife': (classes) => ({
    trait: 'active',
    costs: ['action'],
    targeting: { kind: 'self' },
    resourceKey: 'cleric:channelDivinity',
    automation: {
      key: 'class:cleric.life:preserveLife',
      name: 'Поддержание жизни',
      resolution: 'utility',
      autoTargets: { feet: 30, side: 'ally' },
      utility: { kind: 'healPool', amount: 5 * clericLevel(classes) },
    },
  }),
  'cleric.light:wardingFlare': { trait: 'passive', native: true },
  'cleric.light:improvedWardingFlare': { trait: 'passive', native: true },
  'cleric.light:radianceOfTheDawn': (classes) => ({
    trait: 'active',
    costs: ['action'],
    targeting: { kind: 'self' },
    resourceKey: 'cleric:channelDivinity',
    automation: {
      key: 'class:cleric.light:radianceOfTheDawn',
      name: 'Сияние рассвета',
      resolution: 'save',
      autoTargets: { feet: 30, side: 'hostile' },
      save: { ability: 'con', half: true },
      damage: { dice: `2d10+${clericLevel(classes)}`, types: ['radiant'] },
    },
  }),
  'cleric.war:warPriest': {
    trait: 'active',
    costs: ['bonus'],
    resourceKey: 'cleric.war:warPriest',
    automation: {
      key: 'class:cleric.war:warPriest',
      name: 'Военный жрец',
      resolution: 'utility',
      utility: { kind: 'weaponAttack', amount: 1 },
    },
  },

  // Бард — ядро
  'bard:bardicInspiration': (classes) => {
    const bard = classes.find((c) => c.className === 'bard');
    const level = bard?.level ?? 0;
    // Боевое вдохновение (Доблесть, 3): кость можно тратить на урон и AC.
    const combat = bard?.subclass === 'valor' && level >= 3;
    return {
      trait: 'active',
      costs: ['bonus'],
      targeting: { kind: 'creature', range: 60 },
      resourceKey: 'bard:bardicInspiration',
      automation: {
        key: 'class:bard:bardicInspiration',
        name: 'Бардовское вдохновение',
        resolution: 'effect',
        effects: [
          {
            name: `Бардовское вдохновение (d${bardicDie(level)})`,
            duration: { type: 'rounds', rounds: 600 },
            to: 'targets',
            bonusDie: `1d${bardicDie(level)}`,
            ...(combat ? { bonusDieUses: ['damage', 'ac'] as ('damage' | 'ac')[] } : {}),
            modifiers: [],
          },
        ],
      },
    };
  },
  'bard.valor:extraAttack': { trait: 'passive', native: true },
  // Мантия вдохновения (Обаяние, 3): бонусное действие, трата BI, 2×кость временных HP до CHA существ.
  'bard.glamour:mantleOfInspiration': (classes) => {
    const bard = classes.find((c) => c.className === 'bard');
    const level = bard?.level ?? 0;
    if (level < 3) return { trait: 'passive' };
    return {
      trait: 'active',
      costs: ['bonus'],
      targeting: { kind: 'creature', range: 60 },
      resourceKey: 'bard:bardicInspiration',
      automation: {
        key: 'class:bard.glamour:mantleOfInspiration',
        name: 'Мантия вдохновения',
        resolution: 'utility',
        targetsAbility: 'cha',
        utility: { kind: 'tempHp', dice: `1d${bardicDie(level)}`, multiplier: 2, thenMove: true },
        // Движение без провокации атак по возможности до конца следующего хода цели.
        effects: [
          {
            name: 'Мантия вдохновения',
            duration: { type: 'endOfTurn', of: 'target' },
            to: 'targets',
            restrictions: { ignoresOpportunityAttacks: true },
            modifiers: [],
          },
        ],
      },
    };
  },
  'bard:jackOfAllTrades': (classes) => {
    const bard = classes.find((c) => c.className === 'bard')?.level ?? 0;
    if (bard < 2) return { trait: 'passive' };
    const total = classes.reduce((acc, c) => acc + clampLevel(c.level), 0) || 1;
    const half = Math.max(1, Math.floor(proficiencyBonus(total) / 2));
    return {
      trait: 'passive',
      effects: [permanent('Всезнайка', [{ target: 'check', mode: 'add', value: half }])],
    };
  },
};

function barbarianLevel(classes: ClassLevel[]): number {
  return clampLevel(classes.find((c) => c.className === 'barbarian')?.level ?? 0);
}

function monkLevel(classes: ClassLevel[]): number {
  return clampLevel(classes.find((c) => c.className === 'monk')?.level ?? 0);
}

function clericLevel(classes: ClassLevel[]): number {
  return clampLevel(classes.find((c) => c.className === 'cleric')?.level ?? 0);
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
