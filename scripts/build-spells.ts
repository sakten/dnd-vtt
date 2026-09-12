import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLASSES, normalizeSpell, type RawSpell } from 'shared';

/**
 * Сборка `shared/src/data/spells.json` из данных 5e.tools (Ф5).
 * Источники: PHB24 (XPHB), XGE, TCE; уровни 0–6; дедуп по имени (XPHB > XGE > TCE).
 * Классовые списки берём из `gendata-spell-source-lookup.json`.
 * Запуск: `npm run spells`.
 */

const BASE = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data';
const SPELL_FILES: { file: string; source: string }[] = [
  { file: 'spells/spells-xphb.json', source: 'XPHB' },
  { file: 'spells/spells-xge.json', source: 'XGE' },
  { file: 'spells/spells-tce.json', source: 'TCE' },
];
const LOOKUP_FILE = 'generated/gendata-spell-source-lookup.json';
const PRIORITY: Record<string, number> = { XPHB: 0, XGE: 1, TCE: 2 };
const CLASS_KEYS: Record<string, string> = {
  Artificer: 'artificer',
  Bard: 'bard',
  Cleric: 'cleric',
  Druid: 'druid',
  Monk: 'monk',
  Paladin: 'paladin',
  Ranger: 'ranger',
  Sorcerer: 'sorcerer',
  Warlock: 'warlock',
  Wizard: 'wizard',
};

/** Приоритет источников правил при выборе записи класса (2024 впереди). */
const CLASS_SOURCE_PREF = ['XPHB', 'EFA', 'TCE', 'PHB'];

interface RawClassEntry {
  source?: string;
  spellcastingAbility?: string;
  casterProgression?: string;
  cantripProgression?: number[];
  preparedSpellsProgression?: number[];
  spellsKnownProgression?: number[];
  preparedSpellsChange?: string;
  additionalSpells?: unknown;
}

interface RawSubclassEntry {
  name?: string;
  shortName?: string;
  source?: string;
  className?: string;
  additionalSpells?: unknown;
}

interface RawClassFile {
  class?: RawClassEntry[];
  subclass?: RawSubclassEntry[];
}

interface Grant {
  key: string;
  level: number;
}

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

function buildNameIndex(spells: { name: string; key: string; level: number }[]): Map<string, Grant> {
  const map = new Map<string, Grant>();
  for (const s of spells) map.set(s.name.toLowerCase(), { key: s.key, level: s.level });
  return map;
}

function resolveName(name: string, index: Map<string, Grant>): Grant | null {
  const clean = name.split('|')[0].split('#')[0].trim().toLowerCase();
  return index.get(clean) ?? null;
}

function collectList(value: unknown, index: Map<string, Grant>): Grant[] {
  if (typeof value === 'string') {
    const grant = resolveName(value, index);
    return grant ? [grant] : [];
  }
  if (Array.isArray(value)) return value.flatMap((v) => collectList(v, index));
  return [];
}

function dedupeGrants(list: Grant[]): Grant[] {
  const seen = new Set<string>();
  const out: Grant[] = [];
  for (const grant of list) {
    if (seen.has(grant.key)) continue;
    seen.add(grant.key);
    out.push(grant);
  }
  return out.sort((a, b) => a.level - b.level || a.key.localeCompare(b.key));
}

/** Разбирает `additionalSpells`: prepared/known → выдаваемые, expanded → доступные на выбор. */
function collectAdditional(additional: unknown, index: Map<string, Grant>): { granted: Grant[]; pool: Grant[] } {
  const granted: Grant[] = [];
  const pool: Grant[] = [];
  for (const item of Array.isArray(additional) ? additional : []) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    // Вариантные списки (Land/Genie/Divine Soul) — отдельной задачей.
    if (obj.name) continue;
    const fields: [string, Grant[]][] = [
      ['prepared', granted],
      ['known', granted],
      ['expanded', pool],
    ];
    for (const [field, target] of fields) {
      const value = obj[field];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const v of Object.values(value as Record<string, unknown>)) target.push(...collectList(v, index));
      } else {
        target.push(...collectList(value, index));
      }
    }
  }
  return { granted: dedupeGrants(granted), pool: dedupeGrants(pool) };
}

function matchSubclass(
  subs: RawSubclassEntry[],
  classNameEn: string,
  subKey: string,
  ourSource: string
): RawSubclassEntry | undefined {
  const target = norm(subKey);
  const candidates = subs.filter(
    (s) => s.className === classNameEn && norm(String(s.shortName ?? s.name ?? '')) === target
  );
  if (!candidates.length) return undefined;
  const order = ourSource === 'PHB' ? ['XPHB', 'PHB'] : [ourSource, 'XPHB', 'PHB'];
  for (const src of order) {
    const match = candidates.find((s) => s.source === src);
    if (match) return match;
  }
  return candidates[0];
}

interface LookupEntry {
  class?: Record<string, Record<string, unknown>>;
  classVariant?: Record<string, Record<string, unknown>>;
}
type Lookup = Record<string, Record<string, LookupEntry> | undefined>;

async function fetchJson<T>(path: string): Promise<T> {
  const url = `${BASE}/${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Не удалось скачать ${url}: ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

function extractClasses(lookup: Lookup, name: string, source: string): string[] {
  const entry = lookup[source.toLowerCase()]?.[name.toLowerCase()];
  if (!entry) return [];
  const out = new Set<string>();
  for (const field of ['class', 'classVariant'] as const) {
    const bySystem = entry[field];
    if (!bySystem) continue;
    for (const classList of Object.values(bySystem)) {
      if (!classList || typeof classList !== 'object') continue;
      for (const className of Object.keys(classList)) {
        const key = CLASS_KEYS[className];
        if (key) out.add(key);
      }
    }
  }
  return [...out].sort();
}

async function main() {
  const lookup = await fetchJson<Lookup>(LOOKUP_FILE);

  const spells = [];
  for (const { file, source } of SPELL_FILES) {
    const data = await fetchJson<{ spell?: RawSpell[] }>(file);
    const list = (data.spell ?? []).filter((s) => Number(s.level) >= 0 && Number(s.level) <= 6);
    console.log(`${source}: ${data.spell?.length ?? 0} всего, ${list.length} до 6 круга`);
    spells.push(...list);
  }

  const byName = new Map<string, RawSpell>();
  for (const spell of spells) {
    const key = spell.name.toLowerCase();
    const current = byName.get(key);
    if (!current || (PRIORITY[spell.source] ?? 9) < (PRIORITY[current.source] ?? 9)) byName.set(key, spell);
  }

  const normalized = [...byName.values()]
    .map((raw) => normalizeSpell(raw, extractClasses(lookup, raw.name, raw.source)))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  const output = {
    attribution:
      'SRD 5.2 content © Wizards of the Coast LLC, licensed under CC-BY-4.0. ' +
      'Non-SRD spells include name and mechanics only.',
    count: normalized.length,
    spells: normalized,
  };

  const dir = dirname(fileURLToPath(import.meta.url));
  const outPath = resolve(dir, '../shared/src/data/spells.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(output));

  const bySource: Record<string, number> = {};
  const byAutomation: Record<string, number> = {};
  for (const s of normalized) {
    bySource[s.source] = (bySource[s.source] ?? 0) + 1;
    byAutomation[s.automation] = (byAutomation[s.automation] ?? 0) + 1;
  }
  console.log(`Записано ${normalized.length} заклинаний → ${outPath}`);
  console.log('По источникам:', JSON.stringify(bySource));
  console.log('По automation:', JSON.stringify(byAutomation));

  await buildClassData(dir, buildNameIndex(normalized));
}

/** Собирает лимиты кастеров и выдаваемые заклинания классов/подклассов из `class-*.json`. */
async function buildClassData(dir: string, nameIndex: Map<string, Grant>) {
  const casting: Record<string, unknown> = {};
  const classGrants: Record<string, Grant[]> = {};
  const subclassGrants: Record<string, { granted: Grant[]; pool: Grant[] }> = {};

  for (const key of Object.values(CLASS_KEYS)) {
    let file: RawClassFile;
    try {
      file = await fetchJson<RawClassFile>(`class/class-${key}.json`);
    } catch {
      continue;
    }
    const entries = [...(file.class ?? [])].sort(
      (a, b) => CLASS_SOURCE_PREF.indexOf(a.source ?? '') - CLASS_SOURCE_PREF.indexOf(b.source ?? '')
    );
    const entry = entries[0];
    if (!entry) continue;

    if (entry.spellcastingAbility || entry.casterProgression) {
      const prepared = entry.preparedSpellsProgression ?? entry.spellsKnownProgression ?? null;
      casting[key] = {
        ability: entry.spellcastingAbility ?? null,
        casterProgression: entry.casterProgression ?? 'none',
        cantrips: Array.isArray(entry.cantripProgression) ? entry.cantripProgression : null,
        prepared: Array.isArray(prepared) ? prepared : null,
        change: entry.preparedSpellsChange ?? null,
      };
    }

    const classLevelGrants = collectAdditional(entry.additionalSpells, nameIndex).granted;
    if (classLevelGrants.length) classGrants[key] = classLevelGrants;

    const def = CLASSES[key];
    if (!def) continue;
    const classNameEn = Object.keys(CLASS_KEYS).find((k) => CLASS_KEYS[k] === key);
    for (const [subKey, subDef] of Object.entries(def.subclasses)) {
      const match = matchSubclass(file.subclass ?? [], classNameEn ?? '', subKey, subDef.source);
      if (!match) continue;
      const { granted, pool } = collectAdditional(match.additionalSpells, nameIndex);
      if (granted.length || pool.length) subclassGrants[`${key}.${subKey}`] = { granted, pool };
    }
  }

  const castingPath = resolve(dir, '../shared/src/data/spellcasting.json');
  writeFileSync(castingPath, JSON.stringify(casting));
  console.log(`Лимиты заклинаний: ${Object.keys(casting).length} классов → ${castingPath}`);

  const grantsPath = resolve(dir, '../shared/src/data/subclassSpells.json');
  writeFileSync(grantsPath, JSON.stringify({ classes: classGrants, subclasses: subclassGrants }));
  console.log(
    `Выдаваемые заклинания: классов ${Object.keys(classGrants).length}, подклассов ${Object.keys(subclassGrants).length} → ${grantsPath}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
