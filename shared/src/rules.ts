import {
  abilityMod,
  type AbilityKey,
  type CharacterSheet,
  type ClassLevel,
  type PlayerResources,
  type ResourceItem,
  type RestType,
} from './types';

export type CasterType = 'full' | 'half' | 'pact' | 'none';

export interface ResourceDef {
  key: string;
  name: string;
  reset: (level: number) => RestType;
  max: (level: number, mods: Record<AbilityKey, number>) => number;
}

export interface SubclassDef {
  name: string;
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

const clampLevel = (level: number) => Math.min(20, Math.max(1, Math.round(level)));
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

const always = () => 'long' as RestType;
const shortRest = () => 'short' as RestType;

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
      berserker: { name: 'Путь берсерка' },
      wildHeart: { name: 'Путь дикого сердца' },
      worldTree: { name: 'Путь мирового древа' },
      zealot: { name: 'Путь фанатика' },
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
      dance: { name: 'Коллегия танца' },
      glamour: { name: 'Коллегия обаяния' },
      lore: { name: 'Коллегия знания' },
      valor: { name: 'Коллегия доблести' },
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
      life: { name: 'Домен жизни' },
      light: {
        name: 'Домен света',
        resources: [
          { key: 'wardingFlare', name: 'Ослепляющая вспышка', reset: always, max: abilityModMax('wis', 1) },
        ],
      },
      trickery: { name: 'Домен обмана' },
      war: {
        name: 'Домен войны',
        resources: [
          { key: 'warPriest', name: 'Военный жрец', reset: always, max: abilityModMax('wis', 1) },
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
      land: { name: 'Круг земли' },
      moon: { name: 'Круг луны' },
      sea: { name: 'Круг моря' },
      stars: { name: 'Круг звёзд' },
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
        resources: [
          { key: 'superiorityDice', name: 'Кости превосходства', reset: shortRest, max: perLevel([0, 0, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6]) },
        ],
      },
      champion: { name: 'Чемпион' },
      eldritchKnight: { name: 'Мистический рыцарь', caster: 'third' },
      psiWarrior: { name: 'Пси-воин' },
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
      openHand: { name: 'Воин открытой ладони' },
      shadow: { name: 'Воин тени' },
      fourElements: { name: 'Воин четырёх стихий' },
      mercy: { name: 'Воин милосердия' },
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
      devotion: { name: 'Клятва преданности' },
      glory: { name: 'Клятва славы' },
      ancients: { name: 'Клятва древних' },
      vengeance: { name: 'Клятва мести' },
    },
  },
  ranger: {
    key: 'ranger',
    name: 'Следопыт',
    caster: 'half',
    resources: [],
    subclasses: {
      beastMaster: { name: 'Повелитель зверей' },
      feyWanderer: { name: 'Странник фей' },
      gloomStalker: { name: 'Сумеречный охотник' },
      hunter: { name: 'Охотник' },
    },
  },
  rogue: {
    key: 'rogue',
    name: 'Плут',
    caster: 'none',
    resources: [],
    subclasses: {
      arcaneTrickster: { name: 'Мистический ловкач', caster: 'third' },
      assassin: { name: 'Убийца' },
      swashbuckler: { name: 'Головорез' },
      thief: { name: 'Вор' },
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
      draconic: { name: 'Драконье происхождение' },
      wildMagic: { name: 'Дикая магия' },
      aberrantMind: { name: 'Аберрантный разум' },
      clockwork: { name: 'Механическое наследие' },
    },
  },
  warlock: {
    key: 'warlock',
    name: 'Колдун',
    caster: 'pact',
    resources: [],
    subclasses: {
      archfey: { name: 'Архифея' },
      celestial: {
        name: 'Небожитель',
        resources: [{ key: 'healingLight', name: 'Целительный свет', reset: always, max: (level) => clampLevel(level) + 1 }],
      },
      fiend: { name: 'Исчадие' },
      greatOldOne: { name: 'Великий Древний' },
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
      abjurer: { name: 'Школа ограждения' },
      diviner: { name: 'Школа прорицания' },
      evoker: { name: 'Школа воплощения' },
      illusionist: { name: 'Школа иллюзии' },
    },
  },
  artificer: {
    key: 'artificer',
    name: 'Изобретатель',
    caster: 'half',
    resources: [],
    subclasses: {
      alchemist: { name: 'Алхимик' },
      armorer: { name: 'Бронник' },
      artillerist: { name: 'Артиллерист' },
      battleSmith: { name: 'Боевой кузнец' },
    },
  },
};

export const CLASS_LIST = Object.values(CLASSES).map((c) => ({ key: c.key, name: c.name }));

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

export function subclassList(className: string): { key: string; name: string }[] {
  const def = CLASSES[className];
  if (!def) return [];
  return Object.entries(def.subclasses).map(([key, sub]) => ({ key, name: sub.name }));
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

interface AutoDef {
  key: string;
  name: string;
  reset: RestType;
  max: number;
}

export function autoResourceDefs(classes: ClassLevel[], mods: Record<AbilityKey, number>): AutoDef[] {
  const out: AutoDef[] = [];
  const push = (prefix: string, defs: ResourceDef[] | undefined, level: number) => {
    for (const d of defs ?? []) {
      out.push({ key: `${prefix}:${d.key}`, name: d.name, reset: d.reset(level), max: d.max(level, mods) });
    }
  };
  for (const entry of classes) {
    const def = CLASSES[entry.className];
    if (!def) continue;
    push(def.key, def.resources, entry.level);
    if (entry.subclass) push(`${def.key}.${entry.subclass}`, def.subclasses[entry.subclass]?.resources, entry.level);
  }
  return out;
}

export function sheetMods(abilities: Record<AbilityKey, number>): Record<AbilityKey, number> {
  return {
    str: abilityMod(abilities.str ?? 10),
    dex: abilityMod(abilities.dex ?? 10),
    con: abilityMod(abilities.con ?? 10),
    int: abilityMod(abilities.int ?? 10),
    wis: abilityMod(abilities.wis ?? 10),
    cha: abilityMod(abilities.cha ?? 10),
  };
}

const clampCurrent = (current: number, max: number) => Math.min(max, Math.max(0, Math.round(current || 0)));

export function emptyResources(): PlayerResources {
  return {
    hp: { current: 0, max: 0, temp: 0, deathSuccesses: 0, deathFailures: 0 },
    hitDice: [],
    spellSlots: [],
    pact: { current: 0, max: 0, level: 0 },
    resources: [],
  };
}

/**
 * Пересчитывает авто-ресурсы, ячейки и pact по классам листа.
 * mode='soft' — сохранить текущие значения (зажав по max); 'full' — сбросить к max.
 * Кастомные ресурсы (auto !== true) и HP не трогаются.
 */
export function syncResources(
  prev: PlayerResources,
  classes: ClassLevel[],
  mods: Record<AbilityKey, number>,
  mode: 'soft' | 'full'
): PlayerResources {
  const defs = autoResourceDefs(classes, mods);
  const prevByKey = new Map(prev.resources.filter((r) => r.auto).map((r) => [r.key ?? r.id, r]));
  const autoResources: ResourceItem[] = defs.map((d) => {
    const before = prevByKey.get(d.key);
    const current = mode === 'full' ? d.max : clampCurrent(before?.current ?? d.max, d.max);
    return { id: before?.id ?? crypto.randomUUID(), key: d.key, name: d.name, current, max: d.max, reset: d.reset, auto: true };
  });
  const custom = prev.resources.filter((r) => !r.auto);

  const maxes = spellSlotMaxes(classes);
  const prevSlot = new Map(prev.spellSlots.map((s) => [s.level, s.current]));
  const spellSlots = maxes.map((max, i) => {
    const level = i + 1;
    const current = mode === 'full' ? max : clampCurrent(prevSlot.get(level) ?? max, max);
    return { level, current, max };
  });

  const pact = pactMax(classes);
  const pactCurrent = mode === 'full' ? pact.count : clampCurrent(prev.pact.current ?? pact.count, pact.count);

  const hdMaxes = hitDiceMaxes(classes);
  const prevHd = new Map((prev.hitDice ?? []).map((h) => [h.die, h.current]));
  const hitDice = hdMaxes.map(({ die, max }) => ({
    die,
    max,
    current: mode === 'full' ? max : clampCurrent(prevHd.get(die) ?? max, max),
  }));

  return {
    hp: prev.hp,
    hitDice,
    spellSlots,
    pact: { current: pactCurrent, max: pact.count, level: pact.level },
    resources: [...autoResources, ...custom],
  };
}

const newId = () => crypto.randomUUID();

const finiteInt = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
};

/**
 * Приводит присланное игроком состояние ресурсов к корректному виду:
 * максимумы авто-ресурсов, ячеек и pact берутся из правил, значения зажимаются.
 */
export function sanitizeResources(
  input: PlayerResources,
  classes: ClassLevel[],
  mods: Record<AbilityKey, number>,
  hpMaxOverride?: number
): PlayerResources {
  const defs = autoResourceDefs(classes, mods);
  const incomingByKey = new Map(
    (Array.isArray(input.resources) ? input.resources : []).filter((r) => r.auto).map((r) => [r.key, r])
  );
  const autoResources: ResourceItem[] = defs.map((d) => {
    const before = incomingByKey.get(d.key);
    return {
      id: before?.id ?? newId(),
      key: d.key,
      name: d.name,
      current: clampCurrent(before?.current ?? d.max, d.max),
      max: d.max,
      reset: d.reset,
      auto: true,
    };
  });
  const custom: ResourceItem[] = (Array.isArray(input.resources) ? input.resources : [])
    .filter((r) => !r.auto)
    .map((r) => {
      const max = Math.max(0, finiteInt(r.max));
      return {
        id: typeof r.id === 'string' && r.id ? r.id : newId(),
        name: (typeof r.name === 'string' ? r.name : '').slice(0, 40) || 'Ресурс',
        current: clampCurrent(finiteInt(r.current), max),
        max,
        reset: r.reset === 'short' || r.reset === 'never' ? r.reset : 'long',
      };
    });

  const maxes = spellSlotMaxes(classes);
  const incomingSlots = new Map(
    (Array.isArray(input.spellSlots) ? input.spellSlots : []).map((s) => [finiteInt(s.level), finiteInt(s.current)])
  );
  const spellSlots = maxes.map((max, i) => ({
    level: i + 1,
    current: clampCurrent(incomingSlots.get(i + 1) ?? max, max),
    max,
  }));

  const pact = pactMax(classes);
  const hdMaxes = hitDiceMaxes(classes);
  const inputHd = new Map(
    (Array.isArray(input.hitDice) ? input.hitDice : []).map((h) => [finiteInt(h.die), finiteInt(h.current)])
  );
  const hitDice = hdMaxes.map(({ die, max }) => ({
    die,
    max,
    current: clampCurrent(inputHd.get(die) ?? max, max),
  }));
  const hpMax =
    hpMaxOverride !== undefined ? Math.max(0, Math.round(hpMaxOverride)) : Math.max(0, finiteInt(input.hp?.max));
  const hp = {
    max: hpMax,
    current: clampCurrent(finiteInt(input.hp?.current), hpMax),
    temp: Math.max(0, finiteInt(input.hp?.temp)),
    deathSuccesses: Math.min(3, Math.max(0, finiteInt(input.hp?.deathSuccesses))),
    deathFailures: Math.min(3, Math.max(0, finiteInt(input.hp?.deathFailures))),
  };

  return {
    hp,
    hitDice,
    spellSlots,
    pact: { current: clampCurrent(finiteInt(input.pact?.current, pact.count), pact.count), max: pact.count, level: pact.level },
    resources: [...autoResources, ...custom],
  };
}

/** Восстанавливает ресурсы по отдыху: короткий — 'short' + pact, долгий — всё, HP до max. */
export function applyRest(res: PlayerResources, type: 'short' | 'long'): PlayerResources {
  const restore = (r: ResourceItem) => (type === 'long' ? r.reset !== 'never' : r.reset === 'short');
  return {
    hp:
      type === 'long'
        ? { ...res.hp, current: res.hp.max, temp: 0, deathSuccesses: 0, deathFailures: 0 }
        : res.hp,
    hitDice: type === 'long' ? res.hitDice.map((h) => ({ ...h, current: h.max })) : res.hitDice,
    spellSlots: type === 'long' ? res.spellSlots.map((s) => ({ ...s, current: s.max })) : res.spellSlots,
    pact: { ...res.pact, current: res.pact.max },
    resources: res.resources.map((r) => (restore(r) ? { ...r, current: r.max } : r)),
  };
}
