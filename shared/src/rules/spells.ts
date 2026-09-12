import type { AbilityKey } from '../types';

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
export type SpellAutomation = 'full' | 'manual' | 'unsupported';

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
  /** Коды areaTags 5e.tools (ST, S, C, L, MT, …). */
  area?: string[];
  /** Накладываемые состояния (слаги 5e.tools). */
  conditions?: string[];
  automation: SpellAutomation;
  /** SRD — полный текст; не-SRD — одно предложение. */
  description: string[];
  higherLevel?: string[];
}

export interface RawSpell {
  name: string;
  source: string;
  level: number;
  school?: string;
  srd52?: boolean;
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
        case 'scaledamage':
        case 'scaledice':
          return first;
        case 'hit':
          return /^[+-]/.test(first) ? first : `+${first}`;
        case 'dc':
          return `DC ${first}`;
        case 'atk':
          return ATK_CODES[first.toLowerCase()] ?? first;
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

function collectDamageDice(entries: unknown): string[] {
  const text = JSON.stringify(entries ?? '');
  const dice: string[] = [];
  const seen = new Set<string>();
  const re = /\{@(?:damage|dice|scaledamage|scaledice)\s+([^|{}]+)/g;
  for (const match of text.matchAll(re)) {
    const value = match[1].trim();
    if (!/^\d*d\d+/i.test(value) || seen.has(value)) continue;
    seen.add(value);
    dice.push(value);
  }
  return dice;
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
  const duration = normalizeDuration(raw.duration);
  const save = toStringArray(raw.savingThrow)
    .map((ability) => ABILITIES[ability.toLowerCase()])
    .filter((a): a is AbilityKey => !!a);
  const attackCode = toStringArray(raw.spellAttack)[0]?.toLowerCase();
  const spellAttack = attackCode === 'r' ? 'ranged' : attackCode === 'm' ? 'melee' : undefined;
  const damageDice = collectDamageDice([raw.entries, raw.entriesHigherLevel]);
  const damageTypes = toStringArray(raw.damageInflict);
  const damage: SpellDamage | undefined =
    damageDice.length || damageTypes.length ? { dice: damageDice, types: damageTypes } : undefined;
  const paragraphs = collectText(raw.entries);
  const description = raw.srd52 ? paragraphs : [firstSentence(paragraphs[0] ?? '')].filter(Boolean);
  const higherLevel = raw.srd52 ? collectText(raw.entriesHigherLevel) : [];
  const conditions = toStringArray(raw.conditionInflict).map((c) => prettify(c));

  return {
    key: spellKey(raw.name, raw.source),
    name: raw.name,
    source: raw.source as SpellSource,
    level: Math.max(0, Math.min(9, Math.round(Number(raw.level) || 0))),
    school: SCHOOLS[raw.school ?? ''] ?? 'Evocation',
    ritual: raw.meta?.ritual === true || undefined,
    concentration: duration.some((d) => d.concentration) || undefined,
    time: normalizeTime(raw.time),
    range: normalizeRange(raw.range),
    components: normalizeComponents(raw.components),
    duration,
    classes,
    damage,
    save: save.length ? save : undefined,
    spellAttack,
    area: toStringArray(raw.areaTags),
    conditions: conditions.length ? conditions : undefined,
    automation: automationOf({ damage, save, spellAttack }),
    description,
    higherLevel: higherLevel.length ? higherLevel : undefined,
  };
}
