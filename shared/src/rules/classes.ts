import { abilityMod, type AbilityKey, type CharacterSheet, type ClassLevel, type RestType } from '../types';

export type CasterType = 'full' | 'half' | 'pact' | 'none';

export interface ResourceDef {
  key: string;
  name: string;
  reset: (level: number) => RestType;
  /** level — уровень класса; mods — модификаторы характеристик; totalLevel — суммарный уровень персонажа (для ПБ). */
  max: (level: number, mods: Record<AbilityKey, number>, totalLevel: number) => number;
}

export interface SubclassDef {
  name: string;
  /** Источник правил: 'PHB' (2024), 'XGE', 'TCE'. */
  source: string;
  caster?: 'third';
  resources?: ResourceDef[];
}

export interface ClassDef {
  key: string;
  name: string;
  caster: CasterType;
  resources: ResourceDef[];
  subclasses: Record<string, SubclassDef>;
}

/** Таблица мультиклассовых ячеек по caster level 1..20 (индекс = caster level - 1). */
export const MULTICLASS_SLOTS: number[][] = [
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/** Pact Magic: число ячеек и их уровень по уровню колдуна 1..20. */
export const PACT_SLOTS: { count: number; level: number }[] = [
  { count: 1, level: 1 },
  { count: 2, level: 1 },
  { count: 2, level: 2 },
  { count: 2, level: 2 },
  { count: 2, level: 3 },
  { count: 2, level: 3 },
  { count: 2, level: 4 },
  { count: 2, level: 4 },
  { count: 2, level: 5 },
  { count: 2, level: 5 },
  { count: 3, level: 5 },
  { count: 3, level: 5 },
  { count: 3, level: 5 },
  { count: 3, level: 5 },
  { count: 3, level: 5 },
  { count: 3, level: 5 },
  { count: 4, level: 5 },
  { count: 4, level: 5 },
  { count: 4, level: 5 },
  { count: 4, level: 5 },
];

export const clampLevel = (level: number) => Math.min(20, Math.max(1, Math.round(level)));
const perLevel =
  (table: number[]): ResourceDef['max'] =>
  (level) =>
    table[clampLevel(level) - 1] ?? 0;
const constant =
  (n: number): ResourceDef['max'] =>
  () =>
    n;
const abilityModMax =
  (key: AbilityKey, min = 0): ResourceDef['max'] =>
  (_level, mods) =>
    Math.max(min, mods[key]);

/** Профишенси-бонус по суммарному уровню персонажа. */
export function proficiencyBonus(level: number): number {
  return Math.floor((clampLevel(level) - 1) / 4) + 2;
}

const pbMax =
  (mult = 1, min = 0): ResourceDef['max'] =>
  (_level, _mods, totalLevel) =>
    Math.max(min, mult * proficiencyBonus(totalLevel));

const always = () => 'long' as RestType;
const shortRest = () => 'short' as RestType;

const wisMax = abilityModMax('wis', 1);
const chaMax = abilityModMax('cha', 1);
const intMax = abilityModMax('int', 1);
const strMax = abilityModMax('str', 1);
const conMax = abilityModMax('con', 1);
/** Пул использования = профишенси-бонус (по суммарному уровню персонажа). */
const pbUses = pbMax(1);

/** Одноразовая способность: 0 до уровня разблокировки, 1 — с него. */
const unlockAt =
  (level: number): ResourceDef['max'] =>
  (lvl) =>
    clampLevel(lvl) >= level ? 1 : 0;

/**
 * Ресурсы классов/подклассов. Значения — по правилам D&D 2024 (PHB) с дополнением
 * подклассов XGE/TCE; при расхождении сверяемся с 5e.tools.
 */
export const CLASSES: Record<string, ClassDef> = {
  barbarian: {
    key: 'barbarian',
    name: 'Варвар',
    caster: 'none',
    resources: [
      { key: 'rage', name: 'Ярость', reset: shortRest, max: perLevel([2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6]) },
    ],
    subclasses: {
      berserker: {
        name: 'Путь берсерка',
        source: 'PHB',
        resources: [
          { key: 'intimidatingPresence', name: 'Внушающее присутствие', reset: always, max: unlockAt(14) },
        ],
      },
      wildHeart: { name: 'Путь дикого сердца', source: 'PHB' },
      worldTree: { name: 'Путь мирового древа', source: 'PHB' },
      zealot: {
        name: 'Путь фанатика',
        source: 'PHB',
        resources: [
          {
            key: 'warriorOfTheGods',
            name: 'Воин богов',
            reset: always,
            max: perLevel([0, 0, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 7, 7, 7, 7]),
          },
          { key: 'zealousPresence', name: 'Фанатичное присутствие', reset: always, max: unlockAt(10) },
          { key: 'rageOfTheGods', name: 'Ярость богов', reset: always, max: unlockAt(14) },
        ],
      },
      ancestralGuardian: {
        name: 'Путь предков-хранителей',
        source: 'XGE',
        resources: [{ key: 'consultTheSpirits', name: 'Совет с духами', reset: shortRest, max: unlockAt(10) }],
      },
      stormHerald: { name: 'Путь вестника бури', source: 'XGE' },
      beast: {
        name: 'Путь зверя',
        source: 'TCE',
        resources: [
          { key: 'infectiousFury', name: 'Заразительная ярость', reset: always, max: pbUses },
          { key: 'callTheHunt', name: 'Зов охоты', reset: always, max: pbUses },
        ],
      },
      wildMagic: {
        name: 'Путь дикой магии',
        source: 'TCE',
        resources: [{ key: 'bolsteringMagic', name: 'Укрепляющая магия', reset: always, max: pbUses }],
      },
    },
  },
  bard: {
    key: 'bard',
    name: 'Бард',
    caster: 'full',
    resources: [
      {
        key: 'bardicInspiration',
        name: 'Бардовское вдохновение',
        reset: (level) => (level >= 5 ? 'short' : 'long'),
        max: abilityModMax('cha', 1),
      },
    ],
    subclasses: {
      dance: { name: 'Коллегия танца', source: 'PHB' },
      glamour: {
        name: 'Коллегия обаяния',
        source: 'PHB',
        resources: [
          { key: 'beguilingMagic', name: 'Обольщающая магия', reset: always, max: unlockAt(3) },
          { key: 'mantleOfMajesty', name: 'Мантия величества', reset: always, max: unlockAt(6) },
          { key: 'unbreakableMajesty', name: 'Несокрушимое величество', reset: shortRest, max: unlockAt(14) },
        ],
      },
      lore: { name: 'Коллегия знания', source: 'PHB' },
      valor: { name: 'Коллегия доблести', source: 'PHB' },
      swords: { name: 'Коллегия мечей', source: 'XGE' },
      whispers: {
        name: 'Коллегия шёпотов',
        source: 'XGE',
        resources: [
          { key: 'wordsOfTerror', name: 'Слова ужаса', reset: shortRest, max: unlockAt(3) },
          { key: 'shadowLore', name: 'Теневое знание', reset: always, max: unlockAt(14) },
        ],
      },
      creation: {
        name: 'Коллегия созидания',
        source: 'TCE',
        resources: [
          { key: 'performanceOfCreation', name: 'Сотворение представления', reset: always, max: unlockAt(3) },
          { key: 'animatingPerformance', name: 'Оживление представления', reset: always, max: unlockAt(6) },
        ],
      },
      eloquence: {
        name: 'Коллегия красноречия',
        source: 'TCE',
        resources: [
          { key: 'infectiousInspiration', name: 'Заразительное вдохновение', reset: always, max: chaMax },
          { key: 'universalSpeech', name: 'Универсальная речь', reset: always, max: unlockAt(6) },
        ],
      },
    },
  },
  cleric: {
    key: 'cleric',
    name: 'Жрец',
    caster: 'full',
    resources: [
      {
        key: 'channelDivinity',
        name: 'Проведение божественности',
        reset: shortRest,
        max: perLevel([0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3]),
      },
    ],
    subclasses: {
      life: { name: 'Домен жизни', source: 'PHB' },
      light: {
        name: 'Домен света',
        source: 'PHB',
        resources: [
          {
            key: 'wardingFlare',
            name: 'Ослепляющая вспышка',
            reset: (level) => (level >= 6 ? 'short' : 'long'),
            max: wisMax,
          },
          { key: 'coronaOfLight', name: 'Корона света', reset: always, max: wisMax },
        ],
      },
      trickery: { name: 'Домен обмана', source: 'PHB' },
      war: {
        name: 'Домен войны',
        source: 'PHB',
        resources: [{ key: 'warPriest', name: 'Военный жрец', reset: shortRest, max: wisMax }],
      },
      forge: {
        name: 'Домен кузни',
        source: 'XGE',
        resources: [{ key: 'blessingOfTheForge', name: 'Благословение кузни', reset: always, max: unlockAt(1) }],
      },
      grave: {
        name: 'Домен могилы',
        source: 'XGE',
        resources: [{ key: 'sentinelAtDeathsDoor', name: 'Страж у врат смерти', reset: always, max: wisMax }],
      },
      order: {
        name: 'Домен порядка',
        source: 'TCE',
        resources: [{ key: 'embodimentOfTheLaw', name: 'Воплощение закона', reset: always, max: wisMax }],
      },
      peace: {
        name: 'Домен мира',
        source: 'TCE',
        resources: [{ key: 'emboldeningBond', name: 'Укрепляющая связь', reset: always, max: pbUses }],
      },
      twilight: {
        name: 'Домен сумерек',
        source: 'TCE',
        resources: [
          { key: 'stepsOfNight', name: 'Шаги ночи', reset: always, max: pbUses },
          { key: 'eyesOfNight', name: 'Очи ночи', reset: always, max: unlockAt(1) },
        ],
      },
    },
  },
  druid: {
    key: 'druid',
    name: 'Друид',
    caster: 'full',
    resources: [
      { key: 'wildShape', name: 'Дикий облик', reset: shortRest, max: perLevel([0, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4]) },
    ],
    subclasses: {
      land: {
        name: 'Круг земли',
        source: 'PHB',
        resources: [{ key: 'naturalRecovery', name: 'Природное восстановление', reset: always, max: unlockAt(6) }],
      },
      moon: {
        name: 'Круг луны',
        source: 'PHB',
        resources: [{ key: 'moonlightStep', name: 'Лунный шаг', reset: always, max: wisMax }],
      },
      sea: { name: 'Круг моря', source: 'PHB' },
      stars: {
        name: 'Круг звёзд',
        source: 'PHB',
        resources: [
          { key: 'starMap', name: 'Звёздная карта', reset: always, max: wisMax },
          { key: 'cosmicOmen', name: 'Космическое знамение', reset: always, max: wisMax },
        ],
      },
      dreams: {
        name: 'Круг грёз',
        source: 'XGE',
        resources: [
          { key: 'balmOfTheSummerCourt', name: 'Бальзам Летнего двора', reset: always, max: (level) => clampLevel(level) },
          { key: 'hiddenPaths', name: 'Тайные тропы', reset: always, max: wisMax },
          { key: 'walkerInDreams', name: 'Скиталец во снах', reset: always, max: unlockAt(14) },
        ],
      },
      shepherd: {
        name: 'Круг пастыря',
        source: 'XGE',
        resources: [
          { key: 'spiritTotem', name: 'Тотем духа', reset: shortRest, max: unlockAt(2) },
          { key: 'faithfulSummons', name: 'Верный зов', reset: always, max: unlockAt(14) },
        ],
      },
      spores: {
        name: 'Круг спор',
        source: 'TCE',
        resources: [{ key: 'fungalInfestation', name: 'Грибковое заражение', reset: always, max: wisMax }],
      },
      wildfire: {
        name: 'Круг лесного пожара',
        source: 'TCE',
        resources: [
          { key: 'cauterizingFlames', name: 'Прижигающее пламя', reset: always, max: pbUses },
          { key: 'blazingRevival', name: 'Пламенное возрождение', reset: always, max: unlockAt(14) },
        ],
      },
    },
  },
  fighter: {
    key: 'fighter',
    name: 'Воин',
    caster: 'none',
    resources: [
      { key: 'secondWind', name: 'Второе дыхание', reset: shortRest, max: perLevel([2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]) },
      { key: 'actionSurge', name: 'Всплеск действия', reset: shortRest, max: perLevel([0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2]) },
      { key: 'indomitable', name: 'Неукротимость', reset: always, max: perLevel([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3]) },
    ],
    subclasses: {
      battleMaster: {
        name: 'Мастер боевых искусств',
        source: 'PHB',
        resources: [
          { key: 'superiorityDice', name: 'Кости превосходства', reset: shortRest, max: perLevel([0, 0, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6]) },
          { key: 'knowYourEnemy', name: 'Знай врага', reset: always, max: unlockAt(7) },
        ],
      },
      champion: { name: 'Чемпион', source: 'PHB' },
      eldritchKnight: { name: 'Мистический рыцарь', source: 'PHB', caster: 'third' },
      psiWarrior: {
        name: 'Пси-воин',
        source: 'PHB',
        resources: [
          { key: 'psionicEnergyDice', name: 'Кости пси-энергии', reset: shortRest, max: perLevel([0, 0, 4, 4, 6, 6, 6, 6, 8, 8, 8, 8, 10, 10, 10, 10, 12, 12, 12, 12]) },
          { key: 'psiPoweredLeap', name: 'Пси-усиленный прыжок', reset: shortRest, max: unlockAt(7) },
          { key: 'bulwarkOfForce', name: 'Оплот силы', reset: always, max: unlockAt(15) },
          { key: 'telekineticMaster', name: 'Телекинетический мастер', reset: always, max: unlockAt(18) },
        ],
      },
      arcaneArcher: {
        name: 'Мистический лучник',
        source: 'XGE',
        resources: [{ key: 'arcaneShot', name: 'Мистический выстрел', reset: shortRest, max: constant(2) }],
      },
      cavalier: {
        name: 'Кавалерист',
        source: 'XGE',
        resources: [
          { key: 'unwaveringMark', name: 'Неотступная метка', reset: always, max: strMax },
          { key: 'wardingManeuver', name: 'Защитный манёвр', reset: always, max: conMax },
        ],
      },
      samurai: {
        name: 'Самурай',
        source: 'XGE',
        resources: [
          { key: 'fightingSpirit', name: 'Боевой дух', reset: always, max: constant(3) },
          { key: 'strengthBeforeDeath', name: 'Сила прежде смерти', reset: always, max: unlockAt(18) },
        ],
      },
      runeKnight: {
        name: 'Рыцарь рун',
        source: 'TCE',
        resources: [
          { key: 'giantsMight', name: 'Мощь великана', reset: always, max: pbUses },
          { key: 'runicShield', name: 'Рунический щит', reset: always, max: pbUses },
        ],
      },
    },
  },
  monk: {
    key: 'monk',
    name: 'Монах',
    caster: 'none',
    resources: [
      { key: 'focus', name: 'Очки сосредоточения', reset: shortRest, max: (level) => clampLevel(level) },
    ],
    subclasses: {
      openHand: {
        name: 'Воин открытой ладони',
        source: 'PHB',
        resources: [{ key: 'wholenessOfBody', name: 'Целостность тела', reset: always, max: wisMax }],
      },
      shadow: { name: 'Воин тени', source: 'PHB' },
      fourElements: { name: 'Воин четырёх стихий', source: 'PHB' },
      mercy: {
        name: 'Воин милосердия',
        source: 'PHB',
        resources: [
          { key: 'flurryOfHealingAndHarm', name: 'Шквал исцеления и вреда', reset: always, max: wisMax },
          { key: 'handOfUltimateMercy', name: 'Длань высшего милосердия', reset: always, max: unlockAt(17) },
        ],
      },
      drunkenMaster: { name: 'Путь пьяного мастера', source: 'XGE' },
      kensei: { name: 'Путь кэнсэя', source: 'XGE' },
      sunSoul: { name: 'Путь солнечной души', source: 'XGE' },
      astralSelf: { name: 'Путь астрального «я»', source: 'TCE' },
    },
  },
  paladin: {
    key: 'paladin',
    name: 'Паладин',
    caster: 'half',
    resources: [
      { key: 'layOnHands', name: 'Наложение рук (запас)', reset: always, max: (level) => clampLevel(level) * 5 },
      { key: 'channelDivinity', name: 'Проведение божественности', reset: shortRest, max: perLevel([0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]) },
    ],
    subclasses: {
      devotion: {
        name: 'Клятва преданности',
        source: 'PHB',
        resources: [{ key: 'holyNimbus', name: 'Священный нимб', reset: always, max: unlockAt(20) }],
      },
      glory: {
        name: 'Клятва славы',
        source: 'PHB',
        resources: [
          { key: 'gloriousDefense', name: 'Славная защита', reset: always, max: chaMax },
          { key: 'livingLegend', name: 'Живая легенда', reset: always, max: unlockAt(20) },
        ],
      },
      ancients: {
        name: 'Клятва древних',
        source: 'PHB',
        resources: [
          { key: 'undyingSentinel', name: 'Бессмертный страж', reset: always, max: unlockAt(15) },
          { key: 'elderChampion', name: 'Древний чемпион', reset: always, max: unlockAt(20) },
        ],
      },
      vengeance: {
        name: 'Клятва мести',
        source: 'PHB',
        resources: [{ key: 'avengingAngel', name: 'Ангел возмездия', reset: always, max: unlockAt(20) }],
      },
      conquest: {
        name: 'Клятва завоевания',
        source: 'XGE',
        resources: [{ key: 'invincibleConqueror', name: 'Непобедимый завоеватель', reset: always, max: unlockAt(20) }],
      },
      redemption: { name: 'Клятва искупления', source: 'XGE' },
      watchers: {
        name: 'Клятва наблюдателей',
        source: 'TCE',
        resources: [{ key: 'mortalBulwark', name: 'Смертный оплот', reset: always, max: unlockAt(20) }],
      },
    },
  },
  ranger: {
    key: 'ranger',
    name: 'Следопыт',
    caster: 'half',
    resources: [],
    subclasses: {
      beastMaster: { name: 'Повелитель зверей', source: 'PHB' },
      feyWanderer: {
        name: 'Странник фей',
        source: 'PHB',
        resources: [
          { key: 'mistyWanderer', name: 'Туманный скиталец', reset: always, max: wisMax },
          { key: 'feyReinforcements', name: 'Подкрепление фей', reset: always, max: unlockAt(11) },
        ],
      },
      gloomStalker: {
        name: 'Сумеречный охотник',
        source: 'PHB',
        resources: [{ key: 'dreadAmbusher', name: 'Ужасающий засадник', reset: always, max: wisMax }],
      },
      hunter: { name: 'Охотник', source: 'PHB' },
      horizonWalker: {
        name: 'Скиталец по горизонту',
        source: 'XGE',
        resources: [
          { key: 'detectPortal', name: 'Обнаружение портала', reset: shortRest, max: unlockAt(3) },
          { key: 'etherealStep', name: 'Эфирный шаг', reset: shortRest, max: unlockAt(7) },
        ],
      },
      monsterSlayer: {
        name: 'Истребитель монстров',
        source: 'XGE',
        resources: [
          { key: 'slayersPrey', name: 'Добыча истребителя', reset: always, max: wisMax },
          { key: 'magicUsersNemesis', name: 'Погибель магов', reset: shortRest, max: unlockAt(11) },
        ],
      },
      swarmkeeper: {
        name: 'Повелитель роя',
        source: 'TCE',
        resources: [
          { key: 'writhingTide', name: 'Кишащий поток', reset: always, max: pbUses },
          { key: 'swarmingDispersal', name: 'Роевое рассеивание', reset: always, max: pbUses },
        ],
      },
    },
  },
  rogue: {
    key: 'rogue',
    name: 'Плут',
    caster: 'none',
    resources: [],
    subclasses: {
      arcaneTrickster: {
        name: 'Мистический ловкач',
        source: 'PHB',
        caster: 'third',
        resources: [{ key: 'spellThief', name: 'Похититель заклинаний', reset: always, max: unlockAt(17) }],
      },
      assassin: { name: 'Убийца', source: 'PHB' },
      soulknife: {
        name: 'Клинок души',
        source: 'PHB',
        resources: [
          { key: 'psionicEnergyDice', name: 'Кости пси-энергии', reset: shortRest, max: perLevel([0, 0, 4, 4, 6, 6, 6, 6, 8, 8, 8, 8, 10, 10, 10, 10, 12, 12, 12, 12]) },
          { key: 'psychicVeil', name: 'Психическая вуаль', reset: always, max: unlockAt(13) },
        ],
      },
      thief: { name: 'Вор', source: 'PHB' },
      inquisitive: {
        name: 'Дознаватель',
        source: 'XGE',
        resources: [{ key: 'unerringEye', name: 'Безошибочный глаз', reset: always, max: wisMax }],
      },
      mastermind: { name: 'Вдохновитель', source: 'XGE' },
      scout: { name: 'Разведчик', source: 'XGE' },
      swashbuckler: {
        name: 'Головорез',
        source: 'XGE',
        resources: [{ key: 'masterDuelist', name: 'Мастер дуэлянт', reset: shortRest, max: unlockAt(17) }],
      },
      phantom: {
        name: 'Призрак',
        source: 'TCE',
        resources: [{ key: 'wailsFromTheGrave', name: 'Стенания из могилы', reset: always, max: pbUses }],
      },
    },
  },
  sorcerer: {
    key: 'sorcerer',
    name: 'Чародей',
    caster: 'full',
    resources: [
      { key: 'sorceryPoints', name: 'Очки чародейства', reset: always, max: (level) => clampLevel(level) },
    ],
    subclasses: {
      draconic: {
        name: 'Драконье происхождение',
        source: 'PHB',
        resources: [
          { key: 'dragonWings', name: 'Драконьи крылья', reset: always, max: unlockAt(14) },
          { key: 'dragonCompanion', name: 'Дракон-спутник', reset: always, max: unlockAt(18) },
        ],
      },
      wildMagic: {
        name: 'Дикая магия',
        source: 'PHB',
        resources: [{ key: 'tamedSurge', name: 'Укрощённый всплеск', reset: always, max: unlockAt(18) }],
      },
      aberrantMind: {
        name: 'Аберрантный разум',
        source: 'PHB',
        resources: [{ key: 'warpingImplosion', name: 'Искажающий взрыв', reset: always, max: unlockAt(18) }],
      },
      clockwork: {
        name: 'Механическое наследие',
        source: 'PHB',
        resources: [
          { key: 'restoreBalance', name: 'Восстановление равновесия', reset: always, max: chaMax },
          { key: 'tranceOfOrder', name: 'Транс порядка', reset: always, max: unlockAt(14) },
          { key: 'clockworkCavalcade', name: 'Кавалькада механизмов', reset: always, max: unlockAt(18) },
        ],
      },
      divineSoul: {
        name: 'Божественная душа',
        source: 'XGE',
        resources: [
          { key: 'favoredByTheGods', name: 'Одарённый богами', reset: shortRest, max: unlockAt(1) },
          { key: 'unearthlyRecovery', name: 'Небесное исцеление', reset: always, max: unlockAt(18) },
        ],
      },
      shadow: {
        name: 'Теневая магия',
        source: 'XGE',
        resources: [{ key: 'strengthOfTheGrave', name: 'Сила могилы', reset: always, max: unlockAt(1) }],
      },
      storm: {
        name: 'Магия бури',
        source: 'XGE',
        resources: [{ key: 'windSoul', name: 'Душа ветра', reset: always, max: unlockAt(18) }],
      },
    },
  },
  warlock: {
    key: 'warlock',
    name: 'Колдун',
    caster: 'pact',
    resources: [],
    subclasses: {
      archfey: {
        name: 'Архифея',
        source: 'PHB',
        resources: [
          { key: 'stepsOfTheFey', name: 'Шаги фей', reset: always, max: chaMax },
          { key: 'beguilingDefenses', name: 'Обольщающая защита', reset: always, max: unlockAt(10) },
        ],
      },
      celestial: {
        name: 'Небожитель',
        source: 'PHB',
        resources: [
          { key: 'healingLight', name: 'Целительный свет', reset: always, max: (level) => clampLevel(level) + 1 },
          { key: 'searingVengeance', name: 'Обжигающая месть', reset: always, max: unlockAt(14) },
        ],
      },
      fiend: {
        name: 'Исчадие',
        source: 'PHB',
        resources: [
          { key: 'darkOnesOwnLuck', name: 'Удача тёмного покровителя', reset: always, max: chaMax },
          { key: 'hurlThroughHell', name: 'Низвержение в ад', reset: always, max: unlockAt(14) },
        ],
      },
      greatOldOne: {
        name: 'Великий Древний',
        source: 'PHB',
        resources: [{ key: 'clairvoyantCombatant', name: 'Ясновидящий боец', reset: shortRest, max: unlockAt(6) }],
      },
      hexblade: {
        name: 'Проклятый клинок',
        source: 'XGE',
        resources: [
          { key: 'hexbladesCurse', name: 'Проклятие проклятого клинка', reset: shortRest, max: unlockAt(1) },
          { key: 'accursedSpecter', name: 'Проклятый призрак', reset: always, max: unlockAt(6) },
        ],
      },
      fathomless: {
        name: 'Неведомый',
        source: 'TCE',
        resources: [
          { key: 'tentacleOfTheDeeps', name: 'Щупальце глубин', reset: always, max: pbUses },
          { key: 'graspingTentacles', name: 'Хватающие щупальца', reset: always, max: unlockAt(10) },
          { key: 'fathomlessPlunge', name: 'Погружение в пучину', reset: shortRest, max: unlockAt(14) },
        ],
      },
      genie: {
        name: 'Джинн',
        source: 'TCE',
        resources: [
          { key: 'elementalGift', name: 'Дар стихии', reset: always, max: pbUses },
          { key: 'limitedWish', name: 'Ограниченное желание', reset: always, max: unlockAt(14) },
        ],
      },
    },
  },
  wizard: {
    key: 'wizard',
    name: 'Волшебник',
    caster: 'full',
    resources: [
      { key: 'arcaneRecovery', name: 'Магическое восстановление', reset: always, max: constant(1) },
    ],
    subclasses: {
      abjurer: {
        name: 'Школа ограждения',
        source: 'PHB',
        resources: [{ key: 'arcaneWard', name: 'Магический барьер', reset: always, max: unlockAt(3) }],
      },
      diviner: {
        name: 'Школа прорицания',
        source: 'PHB',
        resources: [
          { key: 'portent', name: 'Предзнаменование', reset: always, max: perLevel([0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3]) },
          { key: 'thirdEye', name: 'Третий глаз', reset: shortRest, max: unlockAt(10) },
        ],
      },
      evoker: { name: 'Школа воплощения', source: 'PHB' },
      illusionist: {
        name: 'Школа иллюзии',
        source: 'PHB',
        resources: [{ key: 'illusorySelf', name: 'Иллюзорное «я»', reset: shortRest, max: unlockAt(10) }],
      },
      warMagic: {
        name: 'Школа военной магии',
        source: 'XGE',
        resources: [{ key: 'powerSurge', name: 'Всплески силы', reset: always, max: intMax }],
      },
      bladesinging: {
        name: 'Пение клинков',
        source: 'TCE',
        resources: [{ key: 'bladesong', name: 'Пение клинка', reset: always, max: pbUses }],
      },
      scribes: {
        name: 'Орден писцов',
        source: 'TCE',
        resources: [
          { key: 'manifestMind', name: 'Проявление разума', reset: always, max: pbUses },
          { key: 'ritualMastery', name: 'Мастерство ритуала', reset: always, max: unlockAt(2) },
          { key: 'manifestMindConjure', name: 'Проявление разума (призыв)', reset: always, max: unlockAt(6) },
          { key: 'oneWithTheWord', name: 'Единый со Словом', reset: always, max: unlockAt(14) },
        ],
      },
    },
  },
  artificer: {
    key: 'artificer',
    name: 'Изобретатель',
    caster: 'half',
    resources: [],
    subclasses: {
      alchemist: {
        name: 'Алхимик',
        source: 'TCE',
        resources: [
          { key: 'restorativeReagents', name: 'Восстанавливающие реагенты', reset: always, max: intMax },
          { key: 'chemicalMastery', name: 'Химическое мастерство', reset: always, max: unlockAt(15) },
        ],
      },
      armorer: {
        name: 'Бронник',
        source: 'TCE',
        resources: [
          { key: 'arcaneArmor', name: 'Магическая броня', reset: always, max: pbUses },
          { key: 'perfectedArmor', name: 'Совершенная броня', reset: always, max: pbUses },
        ],
      },
      artillerist: {
        name: 'Артиллерист',
        source: 'TCE',
        resources: [{ key: 'eldritchCannon', name: 'Мистическая пушка', reset: always, max: unlockAt(3) }],
      },
      battleSmith: {
        name: 'Боевой кузнец',
        source: 'TCE',
        resources: [{ key: 'arcaneJolt', name: 'Магический толчок', reset: always, max: intMax }],
      },
    },
  },
};

export const CLASS_LIST = Object.values(CLASSES).map((c) => ({ key: c.key, name: c.name }));

/** Спасброски, профишенси в которых даёт класс (по основному классу). */
export const CLASS_SAVES: Record<string, AbilityKey[]> = {
  barbarian: ['str', 'con'],
  bard: ['dex', 'cha'],
  cleric: ['wis', 'cha'],
  druid: ['int', 'wis'],
  fighter: ['str', 'con'],
  monk: ['str', 'dex'],
  paladin: ['wis', 'cha'],
  ranger: ['str', 'dex'],
  rogue: ['dex', 'int'],
  sorcerer: ['con', 'cha'],
  warlock: ['wis', 'cha'],
  wizard: ['int', 'wis'],
  artificer: ['con', 'int'],
};

export function classSaves(className: string): AbilityKey[] {
  return CLASS_SAVES[className] ?? [];
}

/** Кость хитов класса. */
export const HIT_DIE: Record<string, number> = {
  barbarian: 12,
  fighter: 10,
  paladin: 10,
  ranger: 10,
  bard: 8,
  cleric: 8,
  druid: 8,
  monk: 8,
  rogue: 8,
  warlock: 8,
  artificer: 8,
  sorcerer: 6,
  wizard: 6,
};

/** Максимум хитов: 1-й уровень — кость хитов + мод. Тел., далее — среднее кости + мод. Тел. */
export function computedMaxHp(classes: ClassLevel[], abilities: Record<AbilityKey, number>): number {
  const conMod = abilityMod(abilities.con ?? 10);
  let hp = 0;
  let first = true;
  for (const c of classes) {
    const die = HIT_DIE[c.className] ?? 8;
    for (let level = 0; level < c.level; level++) {
      if (first) {
        hp += die + conMod;
        first = false;
      } else {
        hp += Math.floor(die / 2) + 1 + conMod;
      }
    }
  }
  return Math.max(0, hp);
}

/** Эффективный max HP: ручное значение из карточки или авто-расчёт. */
export function effectiveMaxHp(sheet: CharacterSheet): number {
  const override = Number(sheet.hpMax);
  if (sheet.hpMax && Number.isFinite(override) && override > 0) return Math.round(override);
  return computedMaxHp(sheet.classes, sheet.abilities);
}

export function subclassList(className: string): { key: string; name: string; source: string }[] {
  const def = CLASSES[className];
  if (!def) return [];
  return Object.entries(def.subclasses).map(([key, sub]) => ({ key, name: sub.name, source: sub.source }));
}

function casterContribution(entry: ClassLevel): number {
  const def = CLASSES[entry.className];
  if (!def) return 0;
  if (def.caster === 'full') return entry.level;
  if (def.caster === 'half') return Math.floor(entry.level / 2);
  const sub = entry.subclass ? def.subclasses[entry.subclass] : undefined;
  if (def.caster === 'none' && sub?.caster === 'third') return Math.floor(entry.level / 3);
  return 0;
}

/** Суммарный caster level для мультиклассовых ячеек (pact не учитывается). */
export function casterLevelOf(classes: ClassLevel[]): number {
  const total = classes.reduce((acc, c) => acc + casterContribution(c), 0);
  return Math.min(20, Math.max(0, total));
}

/** Максимумы ячеек по уровням 1..9 (только стандартные, без pact). */
export function spellSlotMaxes(classes: ClassLevel[]): number[] {
  return MULTICLASS_SLOTS[casterLevelOf(classes) - 1] ?? [];
}

/** Максимум ячеек Pact Magic и их уровень. */
export function pactMax(classes: ClassLevel[]): { count: number; level: number } {
  const warlock = classes.find((c) => CLASSES[c.className]?.caster === 'pact');
  if (!warlock) return { count: 0, level: 0 };
  return PACT_SLOTS[clampLevel(warlock.level) - 1];
}

/** Кости хитов по размерам: количество = число уровней класса с такой костью. */
export function hitDiceMaxes(classes: ClassLevel[]): { die: number; max: number }[] {
  const counts = new Map<number, number>();
  for (const c of classes) {
    const die = HIT_DIE[c.className] ?? 8;
    counts.set(die, (counts.get(die) ?? 0) + c.level);
  }
  return [...counts.entries()].sort((a, b) => b[0] - a[0]).map(([die, max]) => ({ die, max }));
}
