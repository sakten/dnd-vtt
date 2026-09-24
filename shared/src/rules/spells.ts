import type { AreaSpec } from '../domain/actions';
import type { AbilityKey } from '../domain/core';
import type { ConditionKey } from '../domain/effects';
import { conditionKeyOf } from './conditions';

/**
 * Нормализация заклинаний из данных 5e.tools (Ф5). Чистые функции без I/O,
 * чтобы их можно было покрыть тестами; скачивание и запись JSON — в `scripts/build-spells.ts`.
 */

export type SpellSource = 'XPHB' | 'XGE' | 'TCE';
export type SpellSchool =
  | 'Abjuration'
  | 'Conjuration'
  | 'Divination'
  | 'Enchantment'
  | 'Evocation'
  | 'Illusion'
  | 'Necromancy'
  | 'Transmutation';
export type SpellAutomation = 'full' | 'manual';

export interface SpellTime {
  number: number;
  unit: string;
  condition?: string;
}

export interface SpellDistance {
  type: string;
  amount?: number;
}

export interface SpellRange {
  type: string;
  distance?: SpellDistance;
}

export interface SpellDuration {
  type: string;
  concentration?: boolean;
  duration?: SpellDistance;
  ends?: string[];
}

export interface SpellComponents {
  v?: boolean;
  s?: boolean;
  m?: string | boolean;
}

export interface SpellDamage {
  dice: string[];
  types: string[];
}

export interface Spell {
  /** Уникальный ключ `источник:имя`. */
  key: string;
  name: string;
  source: SpellSource;
  level: number;
  school: SpellSchool;
  ritual?: boolean;
  concentration?: boolean;
  time: SpellTime[];
  range: SpellRange;
  components: SpellComponents;
  duration: SpellDuration[];
  /** Классы (наши ключи), у которых заклинание в списке. */
  classes: string[];
  damage?: SpellDamage;
  save?: AbilityKey[];
  spellAttack?: 'melee' | 'ranged';
  /** Лечение: кости есть, а типа урона нет. */
  healing?: boolean;
  /** Успешный спасбросок даёт половину урона (иначе 0). */
  saveHalf?: boolean;
  /** Коды areaTags 5e.tools (ST, S, C, L, MT, …). */
  area?: string[];
  /** Геометрия области (Ф7): форма и размер в футах; у линии — ширина. */
  areaSpec?: AreaSpec;
  /** Накладываемые состояния (ключи каталога). */
  conditions?: ConditionKey[];
  automation: SpellAutomation;
  /** SRD 5.2: контент под CC-BY (полный текст правил хранится; галка для фильтрации). */
  srd?: boolean;
  /** SRD — полный текст; не-SRD — одно предложение. */
  description: string[];
  higherLevel?: string[];
  /** Числовой скейл апкаста (механика; не-SRD хранит только его, без текста). */
  upcast?: SpellUpcast;
  /** Скейл кантрипа по уровням персонажа 5/11/17 (механика). */
  cantrip?: SpellUpcastTier[];
  /** Базовое число атак/снарядов (Scorching Ray: 3, Magic Missile: 3), больше 1. */
  attacks?: number;
}

/** Ступень апкаста/кантрипа: действует с круга (или уровня персонажа) `level`. */
export interface SpellUpcastTier {
  level: number;
  dice?: string;
  attack?: number;
  /** Число лучей/снарядов с этой ступени (Eldritch Blast: 2/3/4). */
  count?: number;
}

/**
 * Числовой скейл ячейки выше базовой (без текста — механика). Линейный вид:
 * за каждые `every` кругов выше `above` — +`dice`/`attack`/`flat`/`attacks`/`targets`;
 * либо `tiers` с фиксированных кругов (приоритетнее линейного).
 */
export interface SpellUpcast {
  above?: number;
  every?: number;
  dice?: string;
  attack?: number;
  /** Плоская прибавка за шаг (Armor of Agathys: +5 врем. HP и урона). */
  flat?: number;
  /** Доп. лучи/дротики/снаряды за шаг (Magic Missile, Scorching Ray). */
  attacks?: number;
  targets?: number;
  tiers?: SpellUpcastTier[];
}

const ORD = '(?:st|nd|rd|th)';
const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function numberWord(token: string): number {
  const n = Number(token);
  return Number.isFinite(n) ? n : NUMBER_WORDS[token.toLowerCase()] ?? 0;
}

/**
 * Числовой скейл апкаста из текста `entriesHigherLevel` (после `stripTags`: у
 * `{@scaledamage}` остаётся инкремент). Понимает линейный вид («increases by 1d6
 * for each slot level above 1», «for every two slot levels above 3rd»), доп. цели
 * и ступени (Elemental Weapon, Magic Weapon, Shadow Blade). Текст не сохраняется —
 * только числа (не-SRD хранит механику, не правила).
 */
export function deriveUpcast(higherLevel: string[]): SpellUpcast | undefined {
  const text = stripTags(higherLevel.join(' ')).replace(/\s+/g, ' ').trim();
  if (!text) return undefined;

  // Ступени: Elemental Weapon — «level 5-6 … bonus … +2 … extra damage … 2d4».
  const tiers: SpellUpcastTier[] = [];
  for (const m of text.matchAll(/level (\d+)\s*-\s*(\d+) spell slot[^.]*?bonus[^+.\d]*\+(\d+)[^.]*?(\d+d\d+)/gi)) {
    tiers.push({ level: Number(m[1]), attack: Number(m[3]), dice: m[4] });
  }
  for (const m of text.matchAll(/level (\d+)\+ spell slot[^.]*?bonus[^+.\d]*\+(\d+)[^.]*?(\d+d\d+)/gi)) {
    tiers.push({ level: Number(m[1]), attack: Number(m[2]), dice: m[3] });
  }
  // Magic Weapon — «bonus increases to +2 with a level 3-5 spell slot», «+3 … 6+».
  for (const m of text.matchAll(/bonus increases to \+(\d+) with a level (\d+)(?:-(\d+))?\+? spell slot/gi)) {
    tiers.push({ level: Number(m[2]), attack: Number(m[1]) });
  }
  // Shadow Blade — «3rd- or 4th-level … damage increases to 3d8» / «7th level or higher … 5d8».
  for (const m of text.matchAll(new RegExp(`(\\d+)${ORD}- or (\\d+)${ORD}-level spell slot[^.]*?damage increases to (\\d+d\\d+)`, 'gi'))) {
    tiers.push({ level: Number(m[1]), dice: m[3] });
  }
  for (const m of text.matchAll(new RegExp(`(\\d+)${ORD} level or higher[^.]*?damage increases to (\\d+d\\d+)`, 'gi'))) {
    tiers.push({ level: Number(m[1]), dice: m[2] });
  }
  if (tiers.length) {
    tiers.sort((a, b) => a.level - b.level);
    return { tiers };
  }

  // Линейный скейл костей/лечения: «increases by 1d6 for each spell slot level above 1».
  const linear = text.match(
    /increases? by ([\d]+d[\d]+(?:\s*\+\s*[\d]+d[\d]+)*) for (?:every (two|three) |each |every )(?:spell )?slot levels? above (\d+)/i
  );
  if (linear) {
    const every = linear[2] ? (linear[2].toLowerCase() === 'two' ? 2 : 3) : undefined;
    return {
      above: Number(linear[3]),
      ...(every ? { every } : {}),
      dice: linear[1]!.replace(/\s*\+\s*/g, ' + '),
    };
  }

  // Доп. лучи/снаряды за круг (Magic Missile: «one more dart», Scorching Ray: «one additional ray»).
  const attacks = text.match(
    /creates? (one|two|three|four|\d+) (?:additional|more) (?:ray|beam|dart|bolt|projectile) for each (?:spell )?slot levels? above (\d+)/i
  );
  if (attacks) return { above: Number(attacks[2]), attacks: numberWord(attacks[1]!) };

  // Плоская прибавка за круг (Armor of Agathys: врем. HP и холод +5).
  const flat = text.match(/(?:both )?increase by (\d+) for each (?:spell )?slot levels? above (\d+)/i);
  if (flat) return { above: Number(flat[2]), flat: Number(flat[1]) };

  // Дополнительные цели: «one additional creature for each spell slot level above 1».
  const targets = text.match(
    /one additional (?:willing )?(?:creature|humanoid|beast|undead|construct|elemental|fiend|celestial|monstrosity) for each (?:spell )?slot levels? above (\d+)/i
  );
  if (targets) return { above: Number(targets[1]), targets: 1 };

  return undefined;
}

/**
 * Скейл кантрипа по уровням персонажа (5/11/17): из `entriesHigherLevel`
 * («levels 5 (2d6), 11 (3d6), 17 (4d6)») либо из описания (TCE-кантрипы:
 * «At 5th level … extra 1d8», «11th level (2d8 and 3d8)»). Только числа.
 */
export function deriveCantripTiers(higherLevel: string[], description: string[]): SpellUpcastTier[] | undefined {
  const out: SpellUpcastTier[] = [];
  const hi = stripTags(higherLevel.join(' '));
  for (const m of hi.matchAll(/\b(\d+)\s*\(([^)]*)\)/g)) {
    const dice = m[2]?.match(/\d*d\d+/i);
    if (dice) out.push({ level: Number(m[1]), dice: dice[0] });
  }
  if (!out.length) {
    const desc = stripTags(description.join(' '));
    const fifth = desc.match(/at (\d+)(?:st|nd|rd|th) level[^.]*?extra (\d+d\d+)/i);
    if (fifth) out.push({ level: Number(fifth[1]), dice: fifth[2]! });
    for (const m of desc.matchAll(/(\d+)(?:st|nd|rd|th) level\s*\(([^)]*)\)/gi)) {
      const dice = m[2]?.match(/\d*d\d+/i);
      if (dice) out.push({ level: Number(m[1]), dice: dice[0] });
    }
  }
  // Лучи/снаряды от уровня персонажа (Eldritch Blast: 2/3/4 луча).
  for (const m of hi.matchAll(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:beams?|rays?|darts?|bolts?|projectiles?)\s+(?:at\s+)?level\s+(\d+)/gi
  )) {
    out.push({ level: Number(m[2]), count: numberWord(m[1]!) });
  }
  if (!out.length) return undefined;
  const seen = new Set<number>();
  return out
    .filter((t) => (seen.has(t.level) ? false : (seen.add(t.level), true)))
    .sort((a, b) => a.level - b.level);
}

/** Базовое число снарядов из описания («three fiery rays», «three glowing darts»), только >1. */
export function deriveAttackCount(description: string[]): number | undefined {
  const text = stripTags(description.join(' '));
  const m = text.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:fiery\s+|glowing\s+|magical\s+)?(?:rays?|beams?|darts?|bolts?|projectiles?)/i
  );
  if (!m) return undefined;
  const n = numberWord(m[1]!);
  return n > 1 ? n : undefined;
}

export interface RawSpell {
  name: string;
  source: string;
  level: number;
  school?: string;
  /** `true` — контент SRD 5.2; строка — официальное имя из SRD 5.2 (переименование без имён персонажей). */
  srd52?: boolean | string;
  meta?: { ritual?: boolean };
  time?: unknown;
  range?: unknown;
  components?: unknown;
  duration?: unknown;
  entries?: unknown;
  entriesHigherLevel?: unknown;
  damageInflict?: unknown;
  savingThrow?: unknown;
  spellAttack?: unknown;
  areaTags?: unknown;
  conditionInflict?: unknown;
}

const SCHOOLS: Record<string, SpellSchool> = {
  A: 'Abjuration',
  C: 'Conjuration',
  D: 'Divination',
  E: 'Enchantment',
  V: 'Evocation',
  I: 'Illusion',
  N: 'Necromancy',
  T: 'Transmutation',
};

const ABILITIES: Record<string, AbilityKey> = {
  strength: 'str',
  dexterity: 'dex',
  constitution: 'con',
  intelligence: 'int',
  wisdom: 'wis',
  charisma: 'cha',
};

/** Теги, тело которых берём как есть (без капитализации). */
const RAW_TAGS = new Set([
  'b', 'bold', 'i', 'italic', 's', 'strike', 'note', 'link', 'book', 'adventure', 'comic',
  'filter', 'quickref', 'unit', 'coin', 'table', 'magicitem', 'classFeature', 'subclassFeature',
  'variantrule', 'rule', 'handbook', 'damage', 'dice', 'scaledamage', 'scaledice',
]);

const ATK_CODES: Record<string, string> = {
  mw: 'Melee Weapon Attack',
  rw: 'Ranged Weapon Attack',
  ms: 'Melee Spell Attack',
  rs: 'Ranged Spell Attack',
  m: 'Melee Attack',
  r: 'Ranged Attack',
};

/** Коды `{@atkr m,r}` — проверки атаки/спасброска монстров. */
const ATK_ROLL_CODES: Record<string, string> = {
  m: 'Melee Attack Roll',
  r: 'Ranged Attack Roll',
  mw: 'Melee Weapon Attack Roll',
  rw: 'Ranged Weapon Attack Roll',
  ms: 'Melee Spell Attack Roll',
  rs: 'Ranged Spell Attack Roll',
};

const ABILITY_NAMES_EN: Record<string, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

function prettify(name: string): string {
  if (!/^[a-z0-9][a-z0-9' -]*$/.test(name)) return name;
  return name.replace(/\b[a-z]/g, (ch) => ch.toUpperCase());
}

/** Снимает разметку 5e.tools `{@tag ...}` и нормализует пробелы. */
export function stripTags(input: string): string {
  let text = input;
  let guard = 0;
  let prev = '';
  while (text !== prev && guard < 12) {
    prev = text;
    guard += 1;
    text = text.replace(/\{@(\w+)(?:\s+([^{}]*))?\}/g, (_m, tag: string, body: string | undefined) => {
      const first = (body ?? '').split('|')[0] ?? '';
      switch (tag) {
        case 'damage':
        case 'dice':
          return first;
        // {@scaledamage base|levels|increment} / {@scaledice ...} — в тексте нужен инкремент (3-й сегмент).
        case 'scaledamage':
        case 'scaledice': {
          const parts = (body ?? '').split('|');
          return parts[2] ?? first;
        }
        case 'hit':
          return /^[+-]/.test(first) ? first : `+${first}`;
        case 'dc':
          return `DC ${first}`;
        case 'atk':
          return ATK_CODES[first.toLowerCase()] ?? first;
        case 'atkr': {
          const codes = first
            .split(',')
            .map((code) => ATK_ROLL_CODES[code.trim().toLowerCase()] ?? code.trim())
            .filter(Boolean);
          return codes.length ? `${codes.join(' or ')}:` : '';
        }
        case 'actSave': {
          const ability = ABILITY_NAMES_EN[first.trim().toLowerCase()];
          return ability ? `${ability} Saving Throw:` : '';
        }
        case 'actSaveFail':
          return 'Failure:';
        case 'actSaveSuccess':
          return 'Success:';
        case 'h':
          return 'Hit: ';
        case 'recharge':
          return `Recharge ${first}`;
        default:
          return RAW_TAGS.has(tag) ? first : prettify(first);
      }
    });
  }
  return text.replace(/\s+/g, ' ').trim();
}

/** Первое предложение (для краткого описания не-SRD), с ограничением длины. */
export function firstSentence(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const match = clean.match(/^.+?[.!?](?=\s|$)/);
  const sentence = match ? match[0] : clean;
  return sentence.length > 280 ? `${sentence.slice(0, 277).trimEnd()}…` : sentence;
}

/** Рекурсивно собирает абзацы текста из `entries` (строки, списки, вложенные entries). */
export function collectText(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    const text = stripTags(value);
    if (text) out.push(text);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, out);
    return out;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj.type === 'table' || obj.type === 'tableGroup') {
      if (obj.caption) collectText(obj.caption, out);
      return out;
    }
    if (obj.entries) collectText(obj.entries, out);
    else if (obj.items) collectText(obj.items, out);
    else if (obj.entry) collectText(obj.entry, out);
  }
  return out;
}

const DICE_VALUE_RE = /^\d*d\d+/i;
/** Контекст лечения: «regains … Hit Points», «Temporary Hit Points», рост максимума HP. */
const HEAL_CONTEXT_RE = /regain|heal|temporary hit point|hit point.{0,30}increas/i;
const DAMAGE_CONTEXT_RE = /damage/i;
const MITIGATION_CONTEXT_RE = /\breduc/i;

/**
 * Кости из тегов 5e.tools: `{@damage}`/`{@scaledamage}` — всегда урон;
 * `{@dice}`/`{@scaledice}` — только если рядом урон/лечение (иначе это бросок
 * по таблице, «roll a d6» и т.п. — как у Mirror Image или Blink).
 */
function collectTaggedDice(entries: unknown): { damage: string[]; heal: string[] } {
  const text = JSON.stringify(entries ?? '');
  const out = { damage: [] as string[], heal: [] as string[] };
  const seen = new Set<string>();
  const re = /\{@(damage|dice|scaledamage|scaledice)\s+([^|{}]+)/g;
  for (const match of text.matchAll(re)) {
    const value = (match[2] ?? '').trim();
    if (!DICE_VALUE_RE.test(value) || seen.has(value)) continue;
    const explicit = match[1] === 'damage' || match[1] === 'scaledamage';
    const start = match.index ?? 0;
    const window = text.slice(Math.max(0, start - 140), start + match[0].length + 80);
    if (!explicit && HEAL_CONTEXT_RE.test(window)) {
      out.heal.push(value);
    } else if (explicit || (DAMAGE_CONTEXT_RE.test(window) && !MITIGATION_CONTEXT_RE.test(window))) {
      out.damage.push(value);
    } else {
      continue;
    }
    seen.add(value);
  }
  return out;
}

export function normalizeTime(raw: unknown): SpellTime[] {
  if (!Array.isArray(raw) || raw.length === 0) return [{ number: 1, unit: 'action' }];
  return raw.map((item) => {
    const t = (item ?? {}) as { number?: unknown; unit?: unknown; condition?: unknown };
    const number = Number(t.number);
    return {
      number: Number.isFinite(number) ? Math.max(0, Math.round(number)) : 1,
      unit: typeof t.unit === 'string' ? t.unit : 'action',
      condition: typeof t.condition === 'string' ? t.condition : undefined,
    };
  });
}

export function normalizeRange(raw: unknown): SpellRange {
  const r = (raw ?? {}) as { type?: unknown; distance?: unknown };
  const distanceRaw = (r.distance ?? {}) as { type?: unknown; amount?: unknown };
  const amount = Number(distanceRaw.amount);
  return {
    type: typeof r.type === 'string' ? r.type : 'special',
    distance:
      typeof distanceRaw.type === 'string'
        ? { type: distanceRaw.type, amount: Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : undefined }
        : undefined,
  };
}

export function normalizeDuration(raw: unknown): SpellDuration[] {
  if (!Array.isArray(raw) || raw.length === 0) return [{ type: 'instant' }];
  return raw.map((item) => {
    const d = (item ?? {}) as { type?: unknown; concentration?: unknown; duration?: unknown; ends?: unknown };
    const inner = (d.duration ?? {}) as { type?: unknown; amount?: unknown };
    const amount = Number(inner.amount);
    return {
      type: typeof d.type === 'string' ? d.type : 'special',
      concentration: d.concentration === true || undefined,
      duration:
        typeof inner.type === 'string'
          ? { type: inner.type, amount: Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : undefined }
          : undefined,
      ends: Array.isArray(d.ends) ? d.ends.filter((x): x is string => typeof x === 'string') : undefined,
    };
  });
}

const SHAPE_BY_RANGE: Record<string, AreaSpec['shape']> = {
  cone: 'cone',
  line: 'line',
  cube: 'cube',
  cylinder: 'cylinder',
  sphere: 'sphere',
  radius: 'sphere',
  emanation: 'sphere',
};

/**
 * Геометрия области: форма/размер. Для cone/line/cube/cylinder/emanation размер
 * есть в `range.distance.amount`; для сфер в точке радиус берём из текста.
 */
export function deriveAreaSpec(range: SpellRange, text: string): AreaSpec | undefined {
  const sized = SHAPE_BY_RANGE[range.type];
  const amount = range.distance?.amount ?? 0;
  if (sized && amount > 0) {
    return sized === 'line' ? { shape: 'line', size: amount, width: 5 } : { shape: sized, size: amount };
  }
  const radius = text.match(/(\d+)[- ]foot[- ]radius/i) ?? text.match(/radius of (\d+) feet/i);
  if (radius) return { shape: 'sphere', size: Number(radius[1]) };
  const square = text.match(/(\d+)[- ]foot\s+(?:on a side\s+)?square/i);
  if (square) return { shape: 'cube', size: Number(square[1]) };
  const cube = text.match(/(\d+)[- ]foot\s+(?:on a side\s+)?cube/i);
  if (cube) return { shape: 'cube', size: Number(cube[1]) };
  const line = text.match(/(\d+)[- ]foot[- ](?:long\s+)?line/i);
  if (line) return { shape: 'line', size: Number(line[1]), width: 5 };
  const cone = text.match(/(\d+)[- ]foot\s+cone/i);
  if (cone) return { shape: 'cone', size: Number(cone[1]) };
  return undefined;
}

export function normalizeComponents(raw: unknown): SpellComponents {
  const c = (raw ?? {}) as { v?: unknown; s?: unknown; m?: unknown };
  return {
    v: c.v === true || undefined,
    s: c.s === true || undefined,
    m: typeof c.m === 'string' ? c.m : c.m === true ? true : undefined,
  };
}

export function automationOf(input: { damage?: SpellDamage; save?: AbilityKey[]; spellAttack?: 'melee' | 'ranged' }): SpellAutomation {
  if (input.damage?.dice.length) return 'full';
  return 'manual';
}

function toStringArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
}

export function spellKey(name: string, source: string): string {
  return `${source}:${name}`;
}

/** Приводит сырую запись 5e.tools к нашему `Spell`. `classes` передаются уже вычисленными. */
export function normalizeSpell(raw: RawSpell, classes: string[]): Spell {
  const level = Math.max(0, Math.min(9, Math.round(Number(raw.level) || 0)));
  const duration = normalizeDuration(raw.duration);
  const save = toStringArray(raw.savingThrow)
    .map((ability) => ABILITIES[ability.toLowerCase()])
    .filter((a): a is AbilityKey => !!a);
  const attackCode = toStringArray(raw.spellAttack)[0]?.toLowerCase();
  const spellAttack = attackCode === 'r' ? 'ranged' : attackCode === 'm' ? 'melee' : undefined;
  const tagged = collectTaggedDice([raw.entries, raw.entriesHigherLevel]);
  const damageTypes = toStringArray(raw.damageInflict);
  const damageDice = tagged.damage.length ? tagged.damage : tagged.heal;
  const damage: SpellDamage | undefined =
    damageDice.length || damageTypes.length ? { dice: damageDice, types: damageTypes } : undefined;
  const paragraphs = collectText(raw.entries);
  const description = raw.srd52 ? paragraphs : [firstSentence(paragraphs[0] ?? '')].filter(Boolean);
  const hiText = collectText(raw.entriesHigherLevel);
  // Текст правил храним только для SRD (лицензия); скейлы — всегда числа:
  // `srd` — галка для фильтрации контента, `upcast`/`cantrip` — механика.
  const srd = raw.srd52 ? true : undefined;
  const higherLevel = raw.srd52 ? hiText : [];
  const upcast = deriveUpcast(hiText);
  const cantrip = level === 0 ? deriveCantripTiers(hiText, paragraphs) : undefined;
  const attacks = deriveAttackCount(paragraphs);
  const conditions = toStringArray(raw.conditionInflict).map((c) => conditionKeyOf(c));
  const rulesText = collectText([raw.entries, raw.entriesHigherLevel]).join(' ').toLowerCase();
  const healing = tagged.heal.length && !tagged.damage.length && !damageTypes.length ? true : undefined;
  const saveHalf =
    save.length && damageDice.length && /half as much damage|half the damage|half the initial damage/.test(rulesText)
      ? true
      : undefined;
  const range = normalizeRange(raw.range);
  const areaSpec = deriveAreaSpec(range, rulesText);

  return {
    key: spellKey(raw.name, raw.source),
    name: raw.name,
    source: raw.source as SpellSource,
    level,
    school: SCHOOLS[raw.school ?? ''] ?? 'Evocation',
    ritual: raw.meta?.ritual === true || undefined,
    srd,
    concentration: duration.some((d) => d.concentration) || undefined,
    time: normalizeTime(raw.time),
    range,
    components: normalizeComponents(raw.components),
    duration,
    classes,
    damage,
    save: save.length ? save : undefined,
    spellAttack,
    healing,
    saveHalf,
    area: toStringArray(raw.areaTags),
    areaSpec,
    conditions: conditions.length ? conditions : undefined,
    automation: automationOf({ damage, save, spellAttack }),
    description,
    higherLevel: higherLevel.length ? higherLevel : undefined,
    upcast,
    cantrip,
    attacks,
  };
}
