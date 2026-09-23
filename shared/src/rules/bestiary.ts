import type { ActionDef, ActionTargeting, AreaSpec, MonsterAbilityEffect } from '../domain/actions';
import type { BestiaryEntry, BestiarySummonProfile, MonsterSize, RawBestiaryMonster } from '../domain/bestiary';
import type { AbilityKey } from '../domain/core';
import type { DamageDefense } from '../domain/damage';
import type { ConditionKey, EffectDuration } from '../domain/effects';
import type { Sense } from '../domain/sense';
import type { AttackEntry, TokenFields, TokenStatblock } from '../domain/token';
import { CONDITION_KEYS } from './conditions';
import { bestiaryTokenPath } from './bestiaryIcon';
import { buildAppearance } from './appearance';
import { collectText, stripTags } from './spells';

/**
 * Разбор записей бестиария 5e.tools (SRD 5.2) в сжатую запись каталога:
 * быстрые атаки (`token.attacks`) + особые действия (`statblock.actions`),
 * мультиатака, легендарные, заклинания. Консервативно: что не парсится
 * надёжно — уходит в текстовое описание, без ложной автоматизации.
 */

const ABILITIES: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const ABILITY_WORDS: Record<string, AbilityKey> = {
  strength: 'str',
  dexterity: 'dex',
  constitution: 'con',
  intelligence: 'int',
  wisdom: 'wis',
  charisma: 'cha',
};
const SIZE_CODES = new Set<MonsterSize>(['T', 'S', 'M', 'L', 'H', 'G']);
const SIZE_CELLS: Record<MonsterSize, number> = { T: 1, S: 1, M: 1, L: 2, H: 3, G: 4 };
const DAMAGE_WORDS = new Set([
  'bludgeoning',
  'piercing',
  'slashing',
  'fire',
  'cold',
  'acid',
  'poison',
  'lightning',
  'thunder',
  'force',
  'necrotic',
  'radiant',
  'psychic',
]);
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
const SENSE_RES: { re: RegExp; type: Sense['type'] }[] = [
  { re: /darkvision (\d+)/i, type: 'darkvision' },
  { re: /blindsight (\d+)/i, type: 'blindsight' },
  { re: /devil'?s sight (\d+)/i, type: 'devilsight' },
];
const AREA_SHAPES: Record<string, AreaSpec['shape']> = {
  cone: 'cone',
  cube: 'cube',
  sphere: 'sphere',
  line: 'line',
  cylinder: 'cylinder',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** id действия внутри записи: `xmm:wolf:bite`. */
export function slugId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function textOf(value: unknown): string {
  return collectText(value).join(' ');
}

function firstString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstString(item);
      if (found) return found;
    }
    return '';
  }
  return '';
}

export function parseMonsterSize(value: unknown): MonsterSize {
  const code = firstString(value).toUpperCase();
  return SIZE_CODES.has(code as MonsterSize) ? (code as MonsterSize) : 'M';
}

export function cellsForSize(size: MonsterSize): number {
  return SIZE_CELLS[size];
}

function parseType(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = parseType(item);
      if (found) return found;
    }
    return '';
  }
  if (isRecord(value)) {
    if (Array.isArray(value.choose)) {
      return value.choose.map((option) => parseType(option)).filter(Boolean).join('/');
    }
    return parseType(value.type);
  }
  return '';
}

function parseCr(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (isRecord(value)) return parseCr(value.cr);
  return '';
}

function parseAc(value: unknown): number {
  if (!Array.isArray(value)) return 10;
  for (const item of value) {
    if (typeof item === 'number') return item;
    if (isRecord(item) && typeof item.ac === 'number') return item.ac;
    if (isRecord(item) && typeof item.special === 'string') {
      const base = /(\d+)/.exec(item.special);
      if (base) return Number(base[1]);
    }
  }
  return 10;
}

/** «40 + 10 for each spell level above 4» → +10 за круг выше 4-го; «5 + 10 per spell level» → +10 с круга 0. */
function parseHpScaling(value: unknown): { perLevel: number; baseLevel: number } | undefined {
  if (!isRecord(value) || typeof value.special !== 'string') return undefined;
  const above = /(\d+)\s*(?:Hit Points?\s*)?for each spell level above (\d+)/i.exec(value.special);
  if (above) return { perLevel: Number(above[1]), baseLevel: Number(above[2]) };
  const absolute = /(\d+)\s*(?:Hit Points?\s*)?per spell level/i.exec(value.special);
  return absolute ? { perLevel: Number(absolute[1]), baseLevel: 0 } : undefined;
}

/** «11 + the spell's level» → база 11 и +1 за круг; «10 + 1 per spell level» → +1 с круга 0. */
function parseAcScaling(value: unknown): { base: number; perLevel: number } | undefined {
  for (const item of Array.isArray(value) ? value : []) {
    if (!isRecord(item) || typeof item.special !== 'string') continue;
    const special = item.special.trim();
    const relative = /^(\d+)\s*\+\s*(?:(\d+)\s*[×x*]\s*)?the spell'?s level/i.exec(special);
    if (relative) return { base: Number(relative[1]), perLevel: relative[2] ? Number(relative[2]) : 1 };
    const absolute = /^(\d+)\s*\+\s*(\d+)\s*per spell level/i.exec(special);
    if (absolute) return { base: Number(absolute[1]), perLevel: Number(absolute[2]) };
  }
  return undefined;
}

function parseHp(value: unknown): { average: number; formula: string } {
  if (isRecord(value)) {
    const average = typeof value.average === 'number' ? value.average : 0;
    const formula = typeof value.formula === 'string' ? value.formula : '';
    if (average || formula) return { average, formula };
    if (typeof value.special === 'string') {
      const base = /(\d+)/.exec(value.special);
      return { average: base ? Number(base[1]) : 0, formula: '' };
    }
  }
  if (typeof value === 'number') return { average: value, formula: '' };
  return { average: 0, formula: '' };
}

function parseSpeed(value: unknown): number {
  if (typeof value === 'number') return value;
  if (!isRecord(value)) return 30;
  const walk = typeof value.walk === 'number' ? value.walk : 0;
  if (walk) return walk;
  let best = 0;
  for (const key of ['fly', 'swim', 'climb', 'burrow']) {
    const speed = value[key];
    if (typeof speed === 'number' && speed > best) best = speed;
  }
  return best || 30;
}

/** Fly Speed в любом виде 5e.tools (`fly: 60`, `fly: "60"`, `fly: true`, `fly: {…}`). */
function parseFly(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const fly = value.fly;
  if (typeof fly === 'number') return fly > 0;
  if (typeof fly === 'string') return Number.parseFloat(fly) > 0;
  if (fly === true) return true;
  return isRecord(fly);
}

function parseSenses(value: unknown): Sense[] {
  const out: Sense[] = [];
  for (const text of Array.isArray(value) ? value : []) {
    if (typeof text !== 'string') continue;
    for (const { re, type } of SENSE_RES) {
      const match = re.exec(text);
      if (!match) continue;
      if (!out.some((s) => s.type === type)) out.push({ type, range: Number(match[1]) });
      break;
    }
  }
  return out;
}

function parseAbilities(raw: RawBestiaryMonster): Record<AbilityKey, number> {
  const out = {} as Record<AbilityKey, number>;
  for (const key of ABILITIES) {
    const value = Number(raw[key]);
    out[key] = Number.isFinite(value) && value >= 1 && value <= 30 ? Math.round(value) : 10;
  }
  return out;
}

function parseSaves(value: unknown): Partial<Record<AbilityKey, number>> | undefined {
  if (!isRecord(value)) return undefined;
  const out: Partial<Record<AbilityKey, number>> = {};
  for (const key of ABILITIES) {
    const text = value[key];
    if (typeof text !== 'string') continue;
    const num = Number(text.replace(/[^\d-]/g, ''));
    if (Number.isFinite(num)) out[key] = num;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Иммунитеты/сопротивления/уязвимости: только канонические типы урона (условные — мимо). */
export function parseDamageDefenses(value: unknown, keys: Set<string>): string[] {
  const out: string[] = [];
  for (const item of Array.isArray(value) ? value : []) {
    const key = typeof item === 'string' ? item.trim().toLowerCase() : '';
    if (key && keys.has(key) && !out.includes(key)) out.push(key);
  }
  return out;
}

/** Иммунитеты к состояниям: только канонические ключи (условные записи — мимо). */
export function parseConditionImmunities(value: unknown): ConditionKey[] {
  const out: ConditionKey[] = [];
  const keys = new Set<string>(CONDITION_KEYS.filter((k) => k !== 'custom' && k !== 'surrounded' && k !== 'dead'));
  for (const item of Array.isArray(value) ? value : []) {
    const key = typeof item === 'string' ? item.trim().toLowerCase() : '';
    if (key && keys.has(key) && !out.includes(key as ConditionKey)) out.push(key as ConditionKey);
  }
  return out;
}

interface ParsedAttack {
  hit: string;
  /** Бонус атаки берётся у кастера (шаблоны призывов: «your spell attack modifier»). */
  spellAttack?: boolean;
  melee: boolean;
  ranged: boolean;
  reach: number;
  rangeNormal: number;
  rangeLong: number;
  damage: string;
  damageType?: string;
}

interface DamagePart {
  dice: string;
  type?: string;
}

interface DamageMatch {
  index: number;
  end: number;
  dice: string;
  word: string;
}

/** Все кости урона в тексте: `13 (1d10 + 8) Slashing damage` и `1d8 + 4 Piercing damage`. */
function damageMatches(text: string): DamageMatch[] {
  const out: DamageMatch[] = [];
  for (const match of text.matchAll(/\(([^)]*\d+d[\d\s+*-]*)\)\s*([A-Za-z]+) damage/gi)) {
    const index = match.index ?? 0;
    out.push({ index, end: index + match[0].length, dice: match[1]!.trim(), word: match[2]! });
  }
  for (const match of text.matchAll(/(\d+d[\d\s+*/+-]*(?:\+\s*summonSpellLevel)?)\s+([A-Za-z]+) damage/gi)) {
    const index = match.index ?? 0;
    if (out.some((m) => index > m.index && index < m.end)) continue;
    out.push({
      index,
      end: index + match[0].length,
      dice: match[1]!.trim(),
      word: match[2]!,
    });
  }
  return out.sort((a, b) => a.index - b.index);
}

/**
 * Кости урона из текста с фильтром условных частей: «plus 2 (1d4) … if the
 * attack roll had Advantage» не сливаем с базовым уроном (это не всегда).
 */
function parseDamageParts(text: string): DamagePart[] {
  const matches = damageMatches(text);
  const out: DamagePart[] = [];
  matches.forEach((match, i) => {
    const next = matches[i + 1]?.index ?? text.length;
    const tail = text.slice(match.end, Math.min(next, match.end + 70));
    const clause = tail.split(/\.\s/)[0] ?? '';
    if (/\b(?:if|when|while)\b/i.test(clause)) return;
    const word = match.word.toLowerCase();
    out.push({ dice: match.dice, ...(DAMAGE_WORDS.has(word) ? { type: word } : {}) });
  });
  if (out.length) return out;
  const flat = /\bHit:\s*(\d+)\s+([A-Za-z]+) damage/gi.exec(text);
  if (flat) {
    const word = flat[2]!.toLowerCase();
    return [{ dice: flat[1]!, ...(DAMAGE_WORDS.has(word) ? { type: word } : {}) }];
  }
  return out;
}

/** Атака из текста действия: `Melee Attack Roll: +14, reach 10 ft. Hit: 13 (1d10 + 8) Slashing damage…`. */
export function parseAttackText(text: string): ParsedAttack | undefined {
  const numeric = /Attack Roll:\s*([+-]\d+)/i.exec(text);
  const spellAttack = !numeric && /your spell attack modifier/i.test(text);
  if (!numeric && !spellAttack) return undefined;
  const parts = parseDamageParts(text);
  if (!parts.length) return undefined;
  const first = parts[0]!;
  let damage = first.dice;
  for (const extra of parts.slice(1)) {
    damage += ` + ${extra.dice}${extra.type && extra.type !== first.type ? extra.type : ''}`;
  }
  const range = /range (\d+)(?:\/(\d+))? ft/i.exec(text);
  return {
    hit: numeric?.[1] ?? '+0',
    ...(spellAttack ? { spellAttack: true } : {}),
    melee: /\bMelee Attack Roll/i.test(text),
    ranged: /\bRanged Attack Roll/i.test(text),
    reach: Number(/reach (\d+) ft/i.exec(text)?.[1] ?? 0),
    rangeNormal: Number(range?.[1] ?? 0),
    rangeLong: Number(range?.[2] ?? 0),
    damage,
    damageType: first.type,
  };
}

/** «The dragon makes three Rend attacks» → 3. */
export function parseMultiattack(text: string): number | undefined {
  const match = /makes (\w+)[\w' -]*? attacks?\b/i.exec(text);
  if (!match) return undefined;
  const word = match[1]!.toLowerCase();
  if (NUMBER_WORDS[word]) return NUMBER_WORDS[word];
  const num = Number(word);
  return Number.isFinite(num) && num >= 1 && num <= 10 ? num : undefined;
}

interface ParsedSave {
  ability: AbilityKey;
  dc: number;
  area?: AreaSpec;
  range?: number;
  damage?: { dice: string; types?: string[] };
  effects: MonsterAbilityEffect[];
}

const CONDITION_KEYSET = new Set<string>(CONDITION_KEYS);

/** Сейв-действие: `Dexterity Saving Throw: DC 21, each creature in a 60-foot Cone. Failure: 59 (17d6) Fire damage…`. */
export function parseSaveText(text: string): ParsedSave | undefined {
  const abilityMatch = /(\w+) Saving Throw/i.exec(text);
  const dcMatch = /DC (\d+)/i.exec(text);
  const ability = abilityMatch ? ABILITY_WORDS[abilityMatch[1]!.toLowerCase()] : undefined;
  if (!ability || !dcMatch) return undefined;
  const dc = Number(dcMatch[1]);

  let area: AreaSpec | undefined;
  const shapeMatch = /(\d+)-foot(?:-radius)? (Cone|Cube|Sphere|Line|Cylinder)\b/i.exec(text);
  if (shapeMatch) {
    const shape = AREA_SHAPES[shapeMatch[2]!.toLowerCase()]!;
    const width = shape === 'line' ? Number(/that is (\d+) feet wide/i.exec(text)?.[1] ?? 0) : 0;
    area = { shape, size: Number(shapeMatch[1]), ...(width ? { width } : {}) };
  }
  const rangeMatch = area ? undefined : /(?:one creature )?within (\d+) feet|range (\d+) ft/i.exec(text);
  const range = rangeMatch ? Number(rangeMatch[1] ?? rangeMatch[2]) : undefined;

  const damageParts = parseDamageParts(text);
  let damage: ParsedSave['damage'];
  if (damageParts.length) {
    const first = damageParts[0]!;
    let dice = first.dice;
    for (const extra of damageParts.slice(1)) {
      dice += ` + ${extra.dice}${extra.type && extra.type !== first.type ? extra.type : ''}`;
    }
    damage = { dice, ...(first.type ? { types: [first.type] } : {}) };
  }

  const effects = conditionEffects(text, { ability, dc });

  return { ability, dc, ...(area ? { area } : {}), ...(range ? { range } : {}), ...(damage ? { damage } : {}), effects };
}

/** Состояния из текста провала: только при однозначной длительности (иначе — вручную). */
export function conditionEffects(text: string, save?: { ability: AbilityKey; dc: number }): MonsterAbilityEffect[] {
  const out: MonsterAbilityEffect[] = [];
  const condition = /has the (\w+) condition/i.exec(text)?.[1]?.toLowerCase();
  if (!condition || !CONDITION_KEYSET.has(condition)) return out;
  let duration: EffectDuration | undefined;
  if (/until the end of its next turn/i.test(text)) duration = { type: 'endOfTurn', of: 'target' };
  else if (condition === 'prone') duration = { type: 'endOfTurn', of: 'target' };
  else if (save && /until it succeeds on a(?: DC \d+| [A-Za-z]+)? saving throw/i.test(text))
    duration = { type: 'untilSave', ability: save.ability, dc: save.dc, timing: 'end' };
  else if (/for 1 minute/i.test(text) && save) duration = { type: 'untilSave', ability: save.ability, dc: save.dc, timing: 'end' };
  if (duration) out.push({ condition: condition as ConditionKey, duration });
  return out;
}

interface ParsedLegendary {
  max: number;
  actions: ActionDef[];
}

/** Легендарные действия: до 3 за раунд, стоимость из «Costs 2 Actions». */
export function parseLegendary(value: unknown, key: string): ParsedLegendary | undefined {
  if (!Array.isArray(value) || !value.length) return undefined;
  const actions: ActionDef[] = [];
  for (const item of value.slice(0, 6)) {
    if (!isRecord(item) || typeof item.name !== 'string') continue;
    const name = stripTags(item.name).slice(0, 60);
    if (!name) continue;
    const text = textOf(item.entries);
    const costMatch = /Costs (\d) Actions?/i.exec(text);
    actions.push({
      id: `${key}:${slugId(name)}`,
      name,
      source: 'monster',
      costs: [],
      legendaryCost: costMatch ? Math.min(3, Number(costMatch[1])) : 1,
      description: text.slice(0, 400),
    });
  }
  if (!actions.length) return undefined;
  return { max: 3, actions };
}

/** Кастование монстра: список известных нам заклинаний + СЛ/бонус атаки из заголовка. */
export function parseSpellcasting(
  value: unknown,
  knownSpells: Set<string>
): TokenStatblock['spellcasting'] | undefined {
  const sc = Array.isArray(value) ? value[0] : value;
  if (!isRecord(sc)) return undefined;
  const names: { name: string; source: string }[] = [];
  const push = (item: unknown) => {
    if (typeof item !== 'string') return;
    for (const match of item.matchAll(/\{@spell ([^|{}]+)(?:\|([^|{}]+))?/g)) {
      names.push({ name: match[1]!.trim(), source: (match[2] ?? '').trim() });
    }
  };
  for (const group of [sc.will, sc.spells]) {
    if (Array.isArray(group)) group.forEach(push);
  }
  if (isRecord(sc.daily)) for (const group of Object.values(sc.daily)) push2(group, push);
  if (Array.isArray(sc.daily)) sc.daily.forEach((day) => isRecord(day) && push2(day.spells, push));

  const spells: string[] = [];
  for (const { name, source } of names) {
    const candidates = source ? [`${source}:${name}`] : [...knownSpells].filter((k) => k.split(':')[1] === name);
    const found = candidates.find((k) => knownSpells.has(k));
    if (found && !spells.includes(found)) spells.push(found);
  }

  const header = textOf(sc.headerEntries);
  const dc = Number(/spell save DC (\d+)/i.exec(header)?.[1] ?? /DC (\d+)/i.exec(header)?.[1] ?? 0) || undefined;
  const attack = Number(/([+-]\d+) to hit/i.exec(header)?.[1] ?? 0) || undefined;
  const ability = typeof sc.ability === 'string' && ABILITIES.includes(sc.ability as AbilityKey) ? (sc.ability as AbilityKey) : undefined;
  if (!spells.length && !dc && !attack) return undefined;
  return {
    ability: ability ?? 'cha',
    ...(dc ? { dc } : {}),
    ...(attack ? { attack } : {}),
    spells,
  };
}

function push2(value: unknown, push: (item: unknown) => void): void {
  if (Array.isArray(value)) value.forEach(push);
}

interface ParsedAction {
  name: string;
  text: string;
  recharge?: number;
  legendaryCost?: number;
}

function splitRecharge(name: string): { name: string; recharge?: number } {
  const match = /\{@recharge (\d)\}/i.exec(name);
  return { name: stripTags(name.replace(/\s*\{@recharge \d\}\s*/i, ' ')).trim(), ...(match ? { recharge: Number(match[1]) } : {}) };
}

function rawActions(value: unknown): ParsedAction[] {
  if (!Array.isArray(value)) return [];
  const out: ParsedAction[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.name !== 'string') continue;
    const { name, recharge } = splitRecharge(item.name);
    const text = textOf(item.entries);
    if (!name || !text) continue;
    out.push({ name: name.slice(0, 60), text, ...(recharge ? { recharge } : {}) });
  }
  return out;
}

function targetingFor(attack: ParsedAttack | undefined, save: ParsedSave | undefined): ActionTargeting | undefined {
  if (save?.area) return { kind: 'area', area: save.area };
  if (save) return { kind: 'creature', range: save.range ?? 60 };
  if (attack) {
    const range = attack.reach || attack.rangeNormal || 5;
    return { kind: 'creature', range: Math.max(5, range) };
  }
  return undefined;
}

/** Полная запись каталога из сырой записи 5e.tools; `null` — не монстр/битая запись. */
export function bestiaryEntryFromRaw(raw: RawBestiaryMonster, knownSpells: Set<string>): BestiaryEntry | null {
  const name = typeof raw.name === 'string' ? stripTags(raw.name).trim() : '';
  const source = typeof raw.source === 'string' ? raw.source : '';
  if (!name || !source) return null;
  const key = `${source}:${name}`;
  const idBase = `${source.toLowerCase()}:${slugId(name)}`;
  const abilities = parseAbilities(raw);
  const saves = parseSaves(raw.save);
  const size = parseMonsterSize(raw.size);
  const { average: hpAverage, formula: hpFormula } = parseHp(raw.hp);
  const hpScaling = parseHpScaling(raw.hp);
  const acScaling = parseAcScaling(raw.ac);
  const acBase = acScaling?.base ?? parseAc(raw.ac);
  const ac = hpScaling && acScaling ? acBase + acScaling.perLevel * hpScaling.baseLevel : acBase;

  const attacks: AttackEntry[] = [];
  const actions: ActionDef[] = [];
  const manual: string[] = [];
  let multiattack: number | undefined;
  let multiattackHalfLevel = false;
  let spellAttack = false;
  let spellDc = false;

  for (const entry of rawActions(raw.action)) {
    if (/your spell attack modifier/i.test(entry.text)) spellAttack = true;
    if (/your spell save DC/i.test(entry.text)) spellDc = true;
    if (/^multiattack$/i.test(entry.name)) {
      const count = parseMultiattack(entry.text);
      if (count && count > 1) multiattack = count;
      else if (/half (?:this |the )?spell'?s level/i.test(entry.text)) multiattackHalfLevel = true;
      else manual.push(`**${entry.name}.** ${entry.text}`);
      continue;
    }
    const attack = parseAttackText(entry.text);
    const effects = attack ? conditionEffects(entry.text) : [];
    if (entry.recharge && attack) {
      const type: 'melee' | 'ranged' = attack.melee && !attack.rangeNormal ? 'melee' : attack.ranged ? 'ranged' : 'melee';
      actions.push({
        id: `${idBase}:${slugId(entry.name)}`,
        name: entry.name,
        source: 'monster',
        costs: ['action'],
        recharge: entry.recharge,
        targeting: targetingFor(attack, undefined),
        ability: {
          attack: {
            rangeType: type,
            bonus: attack.hit.replace('+', ''),
            damage: attack.damage,
            ...(attack.damageType ? { types: [attack.damageType] } : {}),
          },
          ...(effects.length ? { effects } : {}),
        },
        description: entry.text.slice(0, 400),
      });
      continue;
    }
    if (attack && effects.length) {
      const type: 'melee' | 'ranged' = attack.melee && !attack.rangeNormal ? 'melee' : attack.ranged ? 'ranged' : 'melee';
      actions.push({
        id: `${idBase}:${slugId(entry.name)}`,
        name: entry.name,
        source: 'monster',
        costs: ['action'],
        targeting: targetingFor(attack, undefined),
        ability: {
          attack: {
            rangeType: type,
            bonus: attack.hit.replace('+', ''),
            damage: attack.damage,
            ...(attack.damageType ? { types: [attack.damageType] } : {}),
          },
          effects,
        },
        description: entry.text.slice(0, 400),
      });
      continue;
    }
    if (attack) {
      const melee = attack.melee && !attack.rangeNormal;
      attacks.push({
        name: entry.name,
        hit: attack.hit,
        damage: attack.damage,
        rangeType: melee ? 'melee' : attack.ranged || attack.rangeNormal ? 'ranged' : 'melee',
        rangeNormal: melee ? Math.max(5, attack.reach) : attack.rangeNormal || Math.max(5, attack.reach),
        rangeLong: attack.rangeLong,
        ...(attack.damageType ? { damageType: attack.damageType } : {}),
      });
      if (attack.damage.split('+').length > 2 || /\bplus\b/i.test(entry.text)) {
        manual.push(`**${entry.name}.** ${entry.text}`);
      }
      continue;
    }
    const save = parseSaveText(entry.text);
    if (save) {
      actions.push({
        id: `${idBase}:${slugId(entry.name)}`,
        name: entry.name,
        source: 'monster',
        costs: ['action'],
        ...(entry.recharge ? { recharge: entry.recharge } : {}),
        targeting: targetingFor(undefined, save),
        ability: {
          save: { ability: save.ability },
          dc: save.dc,
          ...(save.damage ? { damage: save.damage } : {}),
          ...(save.effects.length ? { effects: save.effects } : {}),
        },
        description: entry.text.slice(0, 400),
      });
      continue;
    }
    manual.push(`**${entry.name}.** ${entry.text}`);
  }

  for (const entry of rawActions(raw.bonus)) {
    actions.push({
      id: `${idBase}:${slugId(entry.name)}`,
      name: entry.name,
      source: 'monster',
      costs: ['bonus'],
      description: entry.text.slice(0, 400),
    });
  }
  for (const entry of rawActions(raw.reaction)) {
    actions.push({
      id: `${idBase}:${slugId(entry.name)}`,
      name: entry.name,
      source: 'monster',
      costs: ['reaction'],
      description: entry.text.slice(0, 400),
    });
  }

  const traits = rawActions(raw.trait).map((t) => `**${t.name}.** ${t.text}`);
  const legendary = parseLegendary(raw.legendary, idBase);
  if (legendary) {
    actions.push(...legendary.actions);
    manual.push(...legendary.actions.map((a) => `**Legendary: ${a.name}.** ${a.description ?? ''}`));
  }

  const spellcasting = parseSpellcasting(raw.spellcasting, knownSpells);
  if (spellcasting) {
    const list = spellcasting.spells?.map((k) => k.split(':')[1]).join(', ');
    manual.push(`**Spellcasting.**${spellcasting.dc ? ` DC ${spellcasting.dc}.` : ''}${list ? ` ${list}.` : ''}`);
  }

  const description = [...traits, ...manual].join('\n\n').slice(0, 6000);

  const summon: BestiarySummonProfile | undefined =
    hpScaling || acScaling || spellAttack || spellDc || multiattackHalfLevel
      ? {
          ...(hpScaling ? { hpPerLevel: hpScaling.perLevel, baseLevel: hpScaling.baseLevel } : {}),
          ...(acScaling ? { acPerLevel: acScaling.perLevel } : {}),
          ...(spellAttack ? { spellAttack: true } : {}),
          ...(spellDc ? { spellDc: true } : {}),
          ...(multiattackHalfLevel ? { multiattackHalfLevel: true } : {}),
        }
      : undefined;

  const entry: Omit<BestiaryEntry, 'appearance'> = {
    key,
    name,
    source,
    size,
    type: parseType(raw.type),
    cr: parseCr(raw.cr) || '—',
    ...(raw.familiar === true ? { familiar: true } : {}),
    immunities: parseDamageDefenses(raw.immune, DAMAGE_WORDS),
    resistances: parseDamageDefenses(raw.resist, DAMAGE_WORDS),
    vulnerabilities: parseDamageDefenses(raw.vulnerable, DAMAGE_WORDS),
    conditionImmunities: parseConditionImmunities(raw.conditionImmune),
    ac,
    hpAverage,
    hpFormula,
    abilities,
    ...(saves ? { saves } : {}),
    cells: cellsForSize(size),
    speed: parseSpeed(raw.speed),
    ...(parseFly(raw.speed) ? { fly: true } : {}),
    senses: parseSenses(raw.senses),
    ...(multiattack ? { multiattack } : {}),
    attacks: attacks.slice(0, 12),
    actions: actions.slice(0, 50),
    ...(legendary ? { legendaryMax: legendary.max } : {}),
    ...(spellcasting ? { spellcasting } : {}),
    ...(summon ? { summon } : {}),
    description,
  };
  return { ...entry, appearance: buildAppearance(entry as BestiaryEntry) };
}

/** Параметры спавна шаблона призыва: круг ячейки и бонусы кастера. */
export interface BestiarySpawnOptions {
  /** Круг ячейки: HP/AC/урон скейлятся от `baseLevel`. */
  slotLevel?: number;
  /** Модификатор атаки заклинанием кастера (заменяет «spell attack» в атаках). */
  spellAttackBonus?: number;
}

/** Подстановка круга в формулы шаблона: `1d10 + 3 + summonSpellLevel` → `1d10 + 3 + 4`. */
export function resolveSummonDamage(damage: string, slotLevel: number): string {
  return damage.replace(/summonSpellLevel/gi, String(slotLevel));
}

/** Поля токена/предмета библиотеки для выставления существа из каталога. */
export function bestiaryTokenFields(entry: BestiaryEntry, opts: BestiarySpawnOptions = {}): TokenFields {
  const base = entry.key.toLowerCase().replace(/[^a-z0-9:]+/g, '-');
  const defense = (type: DamageDefense['type'], list: string[]): DamageDefense[] =>
    list.map((damageType) => ({ id: `${base}:${type}:${damageType}`, type, damageType }));
  const dexMod = Math.floor((entry.abilities.dex - 10) / 2);
  const profile = entry.summon;
  const level = opts.slotLevel;
  const steps = profile && level !== undefined && profile.baseLevel !== undefined ? Math.max(0, level - profile.baseLevel) : 0;
  const hpMax = profile?.hpPerLevel && steps ? entry.hpAverage + profile.hpPerLevel * steps : entry.hpAverage;
  const ac = profile?.acPerLevel && steps ? entry.ac + profile.acPerLevel * steps : entry.ac;
  const bonusHit = profile?.spellAttack && opts.spellAttackBonus !== undefined ? `+${opts.spellAttackBonus}` : null;
  const multiattack =
    profile?.multiattackHalfLevel && level !== undefined ? Math.max(1, Math.floor(level / 2)) : entry.multiattack;
  const attacks = entry.attacks.map((attack) => ({
    ...attack,
    ...(bonusHit !== null && attack.hit === '+0' ? { hit: bonusHit } : {}),
    ...(level !== undefined ? { damage: resolveSummonDamage(attack.damage, level) } : {}),
  }));
  const actions = entry.actions.map((action) => {
    const attackBonus = action.ability?.attack?.bonus;
    if (bonusHit === null || attackBonus !== '0') return action;
    return { ...action, ability: { ...action.ability, attack: { ...action.ability!.attack!, bonus: bonusHit.replace('+', '') } } };
  });
  return {
    name: entry.name,
    description: entry.description.slice(0, 2000),
    imageUrl: bestiaryTokenPath(entry),
    cells: entry.cells,
    round: false,
    initiativeBonus: dexMod >= 0 ? `+${dexMod}` : `${dexMod}`,
    isPlayerToken: false,
    owner: '',
    attacks,
    ac: String(ac),
    hpMax: String(hpMax),
    showStats: false,
    canInteract: false,
    damageDefenses: [
      ...defense('immunity', entry.immunities),
      ...defense('resistance', entry.resistances),
      ...defense('vulnerability', entry.vulnerabilities),
    ],
    statblock: {
      abilities: entry.abilities,
      ...(entry.cr ? { cr: entry.cr } : {}),
      ...(entry.saves ? { saves: entry.saves } : {}),
      ...(entry.conditionImmunities.length ? { conditionImmunities: [...entry.conditionImmunities] } : {}),
      ...(entry.spellcasting ? { spellcasting: entry.spellcasting } : {}),
      ...(multiattack ? { multiattack } : {}),
      ...(entry.legendaryMax ? { legendary: { max: entry.legendaryMax, actions: [] } } : {}),
      ...(actions.length ? { actions } : {}),
    },
  };
}
