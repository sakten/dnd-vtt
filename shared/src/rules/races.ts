import raw from '../data/races.json';
import type { ActionDef } from '../domain/actions';
import type { AutomationDef, AutomationEffect } from '../domain/automation';
import type { AbilityKey } from '../domain/core';
import type { RaceDef, RaceSelection } from '../domain/race';
import type { CharacterSheet, RestType } from '../domain/sheet';
import { SKILLS } from '../labels';
import { clampLevel, effectiveMaxHp, proficiencyBonus } from './classes';
import { sheetProficiencyBonus } from './spellLimits';
import type { ChoiceFeature } from './feats';

/** Виды PHB 2024 из сгенерированного каталога (`npm run races`). */
interface RaceData {
  attribution: string;
  count: number;
  races: RaceDef[];
}

const data = raw as unknown as RaceData;

export const RACES: RaceDef[] = data.races;
const byKey = new Map(RACES.map((race) => [race.key, race]));

export function raceByKey(key: string | undefined): RaceDef | undefined {
  return key ? byKey.get(key) : undefined;
}

export type RaceChoiceKind = 'ancestry' | 'legacy' | 'lineage' | 'giant' | 'skill' | 'size';

export interface RaceChoiceOption {
  key: string;
  /** Подпись варианта; для навыков не задаётся — UI берёт локализованное имя. */
  label?: string;
}

export interface RaceChoiceDef {
  id: string;
  kind: RaceChoiceKind;
  label: string;
  options: RaceChoiceOption[];
}

const DRAGON_ANCESTRY: RaceChoiceOption[] = [
  { key: 'black', label: 'Чёрный (кислота)' },
  { key: 'blue', label: 'Синий (электричество)' },
  { key: 'brass', label: 'Латунный (огонь)' },
  { key: 'bronze', label: 'Бронзовый (электричество)' },
  { key: 'copper', label: 'Медный (кислота)' },
  { key: 'gold', label: 'Золотой (огонь)' },
  { key: 'green', label: 'Зелёный (яд)' },
  { key: 'red', label: 'Красный (огонь)' },
  { key: 'silver', label: 'Серебряный (холод)' },
  { key: 'white', label: 'Белый (холод)' },
];

const DRAGON_DAMAGE: Record<string, string> = {
  black: 'acid',
  blue: 'lightning',
  brass: 'fire',
  bronze: 'lightning',
  copper: 'acid',
  gold: 'fire',
  green: 'poison',
  red: 'fire',
  silver: 'cold',
  white: 'cold',
};

const TIEFLING_LEGACIES: RaceChoiceOption[] = [
  { key: 'abyssal', label: 'Бездна (яд)' },
  { key: 'chthonic', label: 'Хтонь (некротика)' },
  { key: 'infernal', label: 'Инфернал (огонь)' },
];

const TIEFLING_RESISTANCE: Record<string, string> = {
  abyssal: 'poison',
  chthonic: 'necrotic',
  infernal: 'fire',
};

const ELF_LINEAGES: RaceChoiceOption[] = [
  { key: 'drow', label: 'Дроу' },
  { key: 'high', label: 'Высокий эльф' },
  { key: 'wood', label: 'Лесной эльф' },
];

const GNOME_LINEAGES: RaceChoiceOption[] = [
  { key: 'forest', label: 'Лесной гном' },
  { key: 'rock', label: 'Скальный гном' },
];

const GIANT_ANCESTRY: RaceChoiceOption[] = [
  { key: 'cloud', label: 'Прыжок облака' },
  { key: 'fire', label: 'Ожог огня' },
  { key: 'frost', label: 'Холод мороза' },
  { key: 'hill', label: 'Кувырок холма' },
  { key: 'stone', label: 'Стойкость камня' },
  { key: 'storm', label: 'Гром бури' },
];

const SIZE_OPTIONS: RaceChoiceOption[] = [
  { key: 'small', label: 'Маленький' },
  { key: 'medium', label: 'Средний' },
];

const SKILL_OPTIONS: RaceChoiceOption[] = SKILLS.map((skill) => ({ key: skill.key }));

/** Выборы, которые видны в карточке вида (порядок — порядок полей). */
export function raceChoiceDefs(raceKey: string | undefined): RaceChoiceDef[] {
  switch (raceKey) {
    case 'XPHB:Aasimar':
      return [{ id: 'size', kind: 'size', label: 'Размер', options: SIZE_OPTIONS }];
    case 'XPHB:Tiefling':
      return [
        { id: 'size', kind: 'size', label: 'Размер', options: SIZE_OPTIONS },
        { id: 'legacy', kind: 'legacy', label: 'Дьявольское наследие', options: TIEFLING_LEGACIES },
      ];
    case 'XPHB:Dragonborn':
      return [{ id: 'ancestry', kind: 'ancestry', label: 'Драконье наследие', options: DRAGON_ANCESTRY }];
    case 'XPHB:Elf':
      return [
        { id: 'lineage', kind: 'lineage', label: 'Эльфийская линия', options: ELF_LINEAGES },
        {
          id: 'skill',
          kind: 'skill',
          label: 'Обострённые чувства',
          options: SKILL_OPTIONS.filter((s) => ['insight', 'perception', 'survival'].includes(s.key)),
        },
      ];
    case 'XPHB:Gnome':
      return [{ id: 'lineage', kind: 'lineage', label: 'Гномья линия', options: GNOME_LINEAGES }];
    case 'XPHB:Goliath':
      return [{ id: 'giant', kind: 'giant', label: 'Гигантское наследие', options: GIANT_ANCESTRY }];
    case 'XPHB:Human':
      return [
        { id: 'size', kind: 'size', label: 'Размер', options: SIZE_OPTIONS },
        { id: 'skill', kind: 'skill', label: 'Умелый', options: SKILL_OPTIONS },
      ];
    default:
      return [];
  }
}

/** Ресурсы активных черт вида (использования, восстанавливаемые на отдыхе). */
export function raceResourceDefs(
  race: RaceSelection | undefined,
  classes: { level: number }[]
): { key: string; name: string; reset: RestType; max: number }[] {
  const def = raceByKey(race?.key);
  if (!def) return [];
  const totalLevel = classes.reduce((sum, c) => sum + clampLevel(c.level), 0);
  const pb = proficiencyBonus(Math.max(1, totalLevel));
  const out: { key: string; name: string; reset: RestType; max: number }[] = [];
  const add = (id: string, name: string, max: number, minLevel = 1) => {
    if (totalLevel < minLevel || max <= 0) return;
    out.push({ key: `race:${def.key}:${id}`, name, reset: 'long', max });
  };
  if (def.key === 'XPHB:Aasimar') {
    add('healingHands', 'Исцеляющие руки', 1);
    add('celestialRevelation', 'Небесное откровение', 1, 3);
  }
  if (def.key === 'XPHB:Dragonborn') {
    add('breathWeapon', 'Оружие дыхания', pb);
    add('draconicFlight', 'Драконий полёт', 1, 5);
  }
  if (def.key === 'XPHB:Dwarf') add('stonecunning', 'Камнечутьё', pb);
  if (def.key === 'XPHB:Goliath') {
    add('giantAncestry', 'Гигантское наследие', pb);
    add('largeForm', 'Большая форма', 1, 5);
  }
  if (def.key === 'XPHB:Orc') add('adrenalineRush', 'Прилив адреналина', pb);
  return out;
}

/** Итоговая скорость вида с учётом лесного эльфа (35 фт). */
export function raceSpeed(race: RaceSelection | undefined): number | undefined {
  const def = raceByKey(race?.key);
  if (!def) return undefined;
  if (race?.key === 'XPHB:Elf' && race.choices?.lineage === 'wood') return Math.max(def.speed, 35);
  return def.speed;
}

/** Тёмное зрение вида с учётом линии дроу (120 фт). */
export function raceDarkvision(race: RaceSelection | undefined): number | undefined {
  const def = raceByKey(race?.key);
  if (!def?.darkvision) return undefined;
  if (race?.key === 'XPHB:Elf' && race.choices?.lineage === 'drow') return 120;
  return def.darkvision;
}

/** Сопротивления урона вида с учётом выбранного наследия. */
export function raceResistances(race: RaceSelection | undefined): string[] {
  const def = raceByKey(race?.key);
  if (!def) return [];
  const out = new Set(def.resist ?? []);
  if (race?.key === 'XPHB:Dragonborn') {
    const type = DRAGON_DAMAGE[race.choices?.ancestry ?? ''];
    if (type) out.add(type);
  }
  if (race?.key === 'XPHB:Tiefling') {
    const type = TIEFLING_RESISTANCE[race.choices?.legacy ?? ''];
    if (type) out.add(type);
  }
  return [...out];
}

/** Бонус к максимуму хитов от вида (дварфийская выносливость: +1 за уровень). */
export function raceHpBonus(race: RaceSelection | undefined, classes: { level: number }[]): number {
  if (race?.key !== 'XPHB:Dwarf') return 0;
  return classes.reduce((sum, c) => sum + clampLevel(c.level), 0);
}

/** Эффективный максимум HP с бонусом вида; ручное значение из карточки уже включает всё. */
export function effectiveCharacterMaxHp(sheet: CharacterSheet): number {
  if (sheet.hpMax && Number.isFinite(Number(sheet.hpMax)) && Number(sheet.hpMax) > 0) {
    return effectiveMaxHp(sheet);
  }
  return effectiveMaxHp(sheet) + raceHpBonus(sheet.race, sheet.classes);
}

/** Выбранный навык вида (Elf Keen Senses / Human Skillful). */
export function raceSkill(race: RaceSelection | undefined): string | undefined {
  const defs = raceChoiceDefs(race?.key);
  const skillChoice = defs.find((choice) => choice.kind === 'skill');
  if (!skillChoice) return undefined;
  const key = race?.choices?.skill;
  return key && skillChoice.options.some((option) => option.key === key) ? key : undefined;
}

/**
 * Пассивные эффекты вида: тёмное зрение, сопротивления, преимущества на спасброски,
 * дворфийская выносливость. Навык вида применяется к листу отдельно (skill choice),
 * скорость выставляется в базовое поле листа.
 */
export function racePassiveEffects(race: RaceSelection | undefined): ChoiceFeature[] {
  const def = raceByKey(race?.key);
  if (!def) return [];
  const effects: AutomationEffect[] = [];
  const darkvision = raceDarkvision(race);
  if (darkvision) {
    effects.push({
      name: 'Тёмное зрение',
      duration: { type: 'permanent' },
      modifiers: [],
      senses: [{ type: 'darkvision', range: darkvision }],
    });
  }
  const resistances = raceResistances(race);
  if (resistances.length) {
    effects.push({
      name: 'Сопротивление урону',
      duration: { type: 'permanent' },
      modifiers: resistances.map((damageType) => ({
        target: 'damage',
        mode: 'resistance',
        filter: { damageType },
      })),
    });
  }
  if (def.key === 'XPHB:Dwarf') {
    effects.push({
      name: 'Дварфийская стойкость',
      duration: { type: 'permanent' },
      modifiers: [{ target: 'save', mode: 'advantage', filter: { conditions: ['poisoned'] } }],
    });
  }
  if (def.key === 'XPHB:Elf') {
    effects.push({
      name: 'Наследие фей',
      duration: { type: 'permanent' },
      modifiers: [{ target: 'save', mode: 'advantage', filter: { conditions: ['charmed'] } }],
    });
  }
  if (def.key === 'XPHB:Halfling') {
    effects.push({
      name: 'Храбрый',
      duration: { type: 'permanent' },
      modifiers: [{ target: 'save', mode: 'advantage', filter: { conditions: ['frightened'] } }],
    });
  }
  if (def.key === 'XPHB:Gnome') {
    effects.push({
      name: 'Гномья хитрость',
      duration: { type: 'permanent' },
      modifiers: ['int', 'wis', 'cha'].map((ability) => ({
        target: 'save',
        mode: 'advantage',
        filter: { ability: ability as 'int' | 'wis' | 'cha' },
      })),
    });
  }
  return effects.length ? [{ key: `race:${def.key}`, name: def.name, effects }] : [];
}

export const CELESTIAL_REVELATION_ID = 'race:XPHB:Aasimar:celestialRevelation';
export const RACE_REVELATION_OPTIONS = ['wings', 'radiance', 'shroud'] as const;

const totalLevelOf = (classes: { level: number }[]) =>
  classes.reduce((sum, c) => sum + clampLevel(c.level), 0);

const breathDice = (level: number) => `${1 + (level >= 5 ? 1 : 0) + (level >= 11 ? 1 : 0) + (level >= 17 ? 1 : 0)}d10`;

/** Активные кнопки вида с ресурсами и целями. */
export function raceActions(race: RaceSelection | undefined, classes: { level: number }[]): ActionDef[] {
  const def = raceByKey(race?.key);
  if (!def) return [];
  const level = totalLevelOf(classes);
  const out: ActionDef[] = [];
  const push = (action: ActionDef) => out.push(action);
  const resource = (id: string) => `race:${def.key}:${id}`;

  if (def.key === 'XPHB:Aasimar') {
    push({
      id: resource('healingHands'),
      name: 'Исцеляющие руки',
      source: 'race',
      costs: ['action'],
      targeting: { kind: 'creature', range: 5 },
      resourceKey: resource('healingHands'),
      description: 'Коснитесь существа и восстановите ему количество хитов, равное броску ПБ d4.',
    });
    if (level >= 3) {
      push({
        id: CELESTIAL_REVELATION_ID,
        name: 'Небесное откровение',
        source: 'race',
        costs: ['bonus'],
        targeting: { kind: 'self' },
        resourceKey: resource('celestialRevelation'),
        description: 'Примите облик: Небесные крылья, Внутреннее сияние или Некротический саван.',
      });
    }
  }

  if (def.key === 'XPHB:Dragonborn') {
    const damageType = DRAGON_DAMAGE[race?.choices?.ancestry ?? ''];
    if (damageType) {
      push({
        id: resource('breathWeaponCone'),
        name: 'Оружие дыхания (конус)',
        source: 'race',
        costs: ['action'],
        targeting: { kind: 'area', range: 15, area: { shape: 'cone', size: 15 } },
        resourceKey: resource('breathWeapon'),
        description: 'Конус 15 фт: спасбросок Ловкости, при провале урон дыханием, при успехе половина.',
      });
      push({
        id: resource('breathWeaponLine'),
        name: 'Оружие дыхания (линия)',
        source: 'race',
        costs: ['action'],
        targeting: { kind: 'area', range: 30, area: { shape: 'line', size: 30, width: 5 } },
        resourceKey: resource('breathWeapon'),
        description: 'Линия 30×5 фт: спасбросок Ловкости, при провале урон дыханием, при успехе половина.',
      });
    }
    if (level >= 5) {
      push({
        id: resource('draconicFlight'),
        name: 'Драконий полёт',
        source: 'race',
        costs: ['bonus'],
        targeting: { kind: 'self' },
        resourceKey: resource('draconicFlight'),
        description: 'Призрачные крылья на 10 минут: полёт, не мешает сложная местность и существа.',
      });
    }
  }

  if (def.key === 'XPHB:Dwarf') {
    push({
      id: resource('stonecunning'),
      name: 'Камнечутьё',
      source: 'race',
      costs: ['bonus'],
      targeting: { kind: 'self' },
      resourceKey: resource('stonecunning'),
      description: 'На 10 минут вы чувствуете вибрации в камне и земле (слепое зрение 60 фт).',
    });
  }

  if (def.key === 'XPHB:Goliath') {
    if (race?.choices?.giant === 'cloud') {
      push({
        id: resource('giantAncestry'),
        name: 'Прыжок облака',
        source: 'race',
        costs: ['bonus'],
        targeting: { kind: 'point', range: 30 },
        resourceKey: resource('giantAncestry'),
        description: 'Телепорт до 30 фт в свободное видимое пространство.',
      });
    }
    if (level >= 5) {
      push({
        id: resource('largeForm'),
        name: 'Большая форма',
        source: 'race',
        costs: ['bonus'],
        targeting: { kind: 'self' },
        resourceKey: resource('largeForm'),
        description: 'На 10 минут: преимущество на проверки Силы и +10 фт скорости.',
      });
    }
  }

  if (def.key === 'XPHB:Orc') {
    push({
      id: resource('adrenalineRush'),
      name: 'Прилив адреналина',
      source: 'race',
      costs: ['bonus'],
      targeting: { kind: 'self' },
      resourceKey: resource('adrenalineRush'),
      description: 'Рывок и временные хиты, равные бонусу мастерства.',
    });
  }

  return out;
}

/** Варианты активной черты (выбор до прицеливания). */
export function raceActionChoiceOptions(actionId: string): readonly string[] | undefined {
  return actionId === CELESTIAL_REVELATION_ID ? RACE_REVELATION_OPTIONS : undefined;
}

/** СЛ/атака вида для спасбросков активных черт (Breath Weapon — CON, Revelation — CHA). */
export function raceActionStats(
  actionId: string,
  sheet: CharacterSheet
): { ability: AbilityKey; mod: number; dc: number; attack: number } | null {
  const ability: AbilityKey | undefined = actionId.includes(':breathWeapon')
    ? 'con'
    : actionId === CELESTIAL_REVELATION_ID
      ? 'cha'
      : undefined;
  if (!ability) return null;
  const mod = Math.floor(((sheet.abilities[ability] ?? 10) - 10) / 2);
  return { ability, mod, dc: 8 + sheetProficiencyBonus(sheet) + mod, attack: 0 };
}

/** Автоматизация активной черты вида по id действия. */
export function raceActionAutomation(
  actionId: string,
  race: RaceSelection | undefined,
  classes: { level: number }[],
  choice?: string
): AutomationDef | undefined {
  const def = raceByKey(race?.key);
  if (!def) return undefined;
  const level = totalLevelOf(classes);
  const pb = proficiencyBonus(Math.max(1, level));

  if (actionId === `race:${def.key}:healingHands`) {
    return {
      key: actionId,
      name: 'Исцеляющие руки',
      resolution: 'auto',
      targeting: { kind: 'creature', range: 5 },
      heal: { dice: `${pb}d4` },
    };
  }

  if (actionId === CELESTIAL_REVELATION_ID) {
    if (choice === 'shroud') {
      return {
        key: actionId,
        name: 'Небесное откровение: Некротический саван',
        resolution: 'save',
        save: { ability: 'cha' },
        autoTargets: { feet: 10, side: 'hostile' },
        effects: [
          {
            name: 'Некротический саван',
            duration: { type: 'endOfTurn', of: 'source' },
            to: 'targets',
            conditions: ['frightened'],
            modifiers: [],
          },
        ],
      };
    }
    if (choice === 'radiance') {
      return {
        key: actionId,
        name: 'Небесное откровение: Внутреннее сияние',
        resolution: 'effect',
        targeting: { kind: 'self' },
        effects: [
          {
            name: 'Внутреннее сияние',
            duration: { type: 'rounds', rounds: 10 },
            to: 'self',
            light: { bright: 10, dim: 10 },
            modifiers: [],
          },
        ],
      };
    }
    return {
      key: actionId,
      name: 'Небесное откровение: Небесные крылья',
      resolution: 'effect',
      targeting: { kind: 'self' },
      effects: [
        {
          name: 'Небесные крылья',
          duration: { type: 'rounds', rounds: 10 },
          to: 'self',
          conditions: ['flying'],
          modifiers: [],
        },
      ],
    };
  }

  if (actionId === `race:${def.key}:breathWeaponCone` || actionId === `race:${def.key}:breathWeaponLine`) {
    const damageType = DRAGON_DAMAGE[race?.choices?.ancestry ?? ''];
    if (!damageType) return undefined;
    return {
      key: actionId,
      name: 'Оружие дыхания',
      resolution: 'save',
      save: { ability: 'dex', half: true },
      damage: { dice: breathDice(level), types: [damageType] },
    };
  }

  if (actionId === `race:${def.key}:draconicFlight`) {
    return {
      key: actionId,
      name: 'Драконий полёт',
      resolution: 'effect',
      targeting: { kind: 'self' },
      effects: [
        {
          name: 'Драконий полёт',
          duration: { type: 'rounds', rounds: 100 },
          to: 'self',
          conditions: ['flying'],
          modifiers: [],
        },
      ],
    };
  }

  if (actionId === `race:${def.key}:stonecunning`) {
    return {
      key: actionId,
      name: 'Камнечутьё',
      resolution: 'effect',
      targeting: { kind: 'self' },
      effects: [
        {
          name: 'Камнечутьё',
          duration: { type: 'rounds', rounds: 100 },
          to: 'self',
          senses: [{ type: 'blindsight', range: 60 }],
          modifiers: [],
        },
      ],
    };
  }

  if (actionId === `race:${def.key}:giantAncestry`) {
    return {
      key: actionId,
      name: 'Прыжок облака',
      resolution: 'utility',
      targeting: { kind: 'point', range: 30 },
      utility: { kind: 'teleport', amount: 30 },
    };
  }

  if (actionId === `race:${def.key}:largeForm`) {
    return {
      key: actionId,
      name: 'Большая форма',
      resolution: 'effect',
      targeting: { kind: 'self' },
      effects: [
        {
          name: 'Большая форма',
          duration: { type: 'rounds', rounds: 100 },
          to: 'self',
          modifiers: [
            { target: 'speed', mode: 'add', value: 10 },
            { target: 'check', mode: 'advantage', filter: { ability: 'str' } },
          ],
        },
      ],
    };
  }

  if (actionId === `race:${def.key}:adrenalineRush`) {
    return {
      key: actionId,
      name: 'Прилив адреналина',
      resolution: 'utility',
      targeting: { kind: 'self' },
      utility: { kind: 'extraMovement' },
      effects: [
        {
          name: 'Прилив адреналина',
          duration: { type: 'endOfTurn', of: 'target' },
          to: 'self',
          hidden: true,
          tempHp: pb,
          modifiers: [],
        },
      ],
    };
  }

  return undefined;
}