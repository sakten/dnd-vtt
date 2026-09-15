import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLASSES, collectText, firstSentence } from 'shared';

/**
 * Сборка `shared/src/data/features.json` из данных 5e.tools (R8.8).
 * Источники: XPHB (основной), XGE/TCE/PHB (подклассы); уровни 1–12.
 * Ключ — `класс[:подкласс]:camelName` (совпадает с ключами ресурсов CLASSES),
 * поэтому каталог и ресурсы сходятся без маппинга.
 * Запуск: `npm run features`.
 */

const BASE = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data';

const CLASS_KEYS: Record<string, string> = {
  Artificer: 'artificer',
  Barbarian: 'barbarian',
  Bard: 'bard',
  Cleric: 'cleric',
  Druid: 'druid',
  Fighter: 'fighter',
  Monk: 'monk',
  Paladin: 'paladin',
  Ranger: 'ranger',
  Rogue: 'rogue',
  Sorcerer: 'sorcerer',
  Warlock: 'warlock',
  Wizard: 'wizard',
};

const MAX_LEVEL = 20;

/** Переименования ключей каталога под ключи ресурсов CLASSES. */
const KEY_OVERRIDES: Record<string, string> = {
  'wizard.diviner:theThirdEye': 'wizard.diviner:thirdEye',
};

/** Приоритет источников правил при выборе записи класса (TCE раньше EFA — ключи артифайсера из TCE). */
const CLASS_SOURCE_PREF = ['XPHB', 'TCE', 'EFA', 'PHB'];

/** Подклассы, у которых shortName 5e.tools не совпадает с нашим ключом. */
const SUBCLASS_ALIASES: Record<string, { shortName: string; source: string }> = {
  'monk.fourElements': { shortName: 'Elements', source: 'XPHB' },
};

/** Служебные записи (не способности): ASI, плейсхолдеры подкласса и эпические дары. */
const PLACEHOLDER = new RegExp(
  '^(' +
    [
      'Ability Score Improvement',
      'Epic Boon',
      'Subclass Feature',
      'Primal Path',
      'Bard College',
      'Divine Domain',
      'Druid Circle',
      'Martial Archetype',
      'Monastic Tradition',
      'Sacred Oath',
      'Ranger Archetype',
      'Roguish Archetype',
      'Sorcerous Origin',
      'Otherworldly Patron',
      'Arcane Tradition',
      'Artificer Specialist',
      '.+ Feature',
      '.+ Subclass',
    ].join('|') +
    ')$'
);

interface RawClassEntry {
  name?: string;
  source?: string;
  srd52?: boolean;
}

interface RawSubclassEntry {
  name?: string;
  shortName?: string;
  source?: string;
  className?: string;
  srd52?: boolean;
}

interface RawFeature {
  name?: string;
  source?: string;
  level?: number;
  className?: string;
  subclassShortName?: string;
  subclassSource?: string;
  entries?: unknown;
  srd52?: boolean;
}

interface RawClassFile {
  class?: RawClassEntry[];
  subclass?: RawSubclassEntry[];
  classFeature?: RawFeature[];
  subclassFeature?: RawFeature[];
}

interface CatalogFeature {
  key: string;
  name: string;
  className: string;
  subclass?: string;
  level: number;
  source: string;
  description: string;
}

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

function camel(name: string): string {
  const words = name
    .replace(/['’]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  return words
    .map((word, index) => (index === 0 ? word.toLowerCase() : word[0]!.toUpperCase() + word.slice(1).toLowerCase()))
    .join('');
}

function cleanName(name: string): string {
  return name.split('|')[0]!.trim();
}

function matchSubclass(
  file: RawClassFile,
  classNameEn: string,
  subKey: string,
  ourSource: string
): RawSubclassEntry | undefined {
  const alias = SUBCLASS_ALIASES[`${CLASS_KEYS[classNameEn] ?? ''}.${subKey}`];
  const target = norm(alias?.shortName ?? subKey);
  const candidates = (file.subclass ?? []).filter(
    (s) => s.className === classNameEn && (norm(String(s.shortName ?? s.name ?? '')) === target || norm(String(s.name ?? '')) === target)
  );
  if (!candidates.length) return undefined;
  if (alias) {
    const exact = candidates.find((s) => s.source === alias.source);
    if (exact) return exact;
  }
  const order = ourSource === 'PHB' ? ['XPHB', 'PHB'] : [ourSource, 'XPHB', 'PHB'];
  for (const src of order) {
    const match = candidates.find((s) => s.source === src);
    if (match) return match;
  }
  return candidates[0];
}

async function fetchJson<T>(path: string): Promise<T> {
  const url = `${BASE}/${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Не удалось скачать ${url}: ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

function descriptionOf(raw: RawFeature): string {
  const paragraphs = collectText(raw.entries).filter(Boolean);
  const text = paragraphs.join('\n\n');
  if (!text) return '';
  return raw.srd52 ? text : firstSentence(paragraphs[0] ?? text);
}

async function main() {
  const features: CatalogFeature[] = [];
  const unmatched: string[] = [];
  const sources: Record<string, number> = {};

  for (const [classNameEn, classKey] of Object.entries(CLASS_KEYS)) {
    let file: RawClassFile;
    try {
      file = await fetchJson<RawClassFile>(`class/class-${classKey}.json`);
    } catch {
      console.warn(`Нет файла класса ${classKey}`);
      continue;
    }

    const entries = [...(file.class ?? [])].filter((c) => c.name === classNameEn);
    entries.sort(
      (a, b) => CLASS_SOURCE_PREF.indexOf(a.source ?? '') - CLASS_SOURCE_PREF.indexOf(b.source ?? '')
    );
    const classEntry = entries.find((c) => CLASS_SOURCE_PREF.includes(c.source ?? '')) ?? entries[0];
    const classSource = classEntry?.source ?? 'PHB';

    const def = CLASSES[classKey];
    if (!def) continue;

    const push = (prefix: string, subclass: string | undefined, raw: RawFeature) => {
      const name = cleanName(String(raw.name ?? ''));
      if (!name || PLACEHOLDER.test(name)) return;
      const level = Number(raw.level);
      if (!Number.isFinite(level) || level < 1 || level > MAX_LEVEL) return;
      const rawKey = `${prefix}:${camel(name)}`;
      const key = KEY_OVERRIDES[rawKey] ?? rawKey;
      const existing = features.find((f) => f.key === key);
      if (existing && existing.level <= level) return;
      const feature: CatalogFeature = {
        key,
        name,
        className: classKey,
        ...(subclass ? { subclass } : {}),
        level,
        source: String(raw.source ?? classSource),
        description: descriptionOf(raw),
      };
      if (existing) features[features.indexOf(existing)] = feature;
      else features.push(feature);
    };

    for (const raw of file.classFeature ?? []) {
      if (raw.className !== classNameEn || raw.source !== classSource || raw.subclassShortName) continue;
      push(classKey, undefined, raw);
    }

    for (const [subKey, subDef] of Object.entries(def.subclasses)) {
      const match = matchSubclass(file, classNameEn, subKey, subDef.source);
      if (!match) {
        unmatched.push(`${classKey}.${subKey}`);
        continue;
      }
      for (const raw of file.subclassFeature ?? []) {
        if (raw.className !== classNameEn || raw.subclassShortName !== match.shortName || raw.subclassSource !== match.source) continue;
        push(`${classKey}.${subKey}`, subKey, raw);
      }
    }

    console.log(
      `${classKey} (${classSource}): черт ${features.filter((f) => f.className === classKey).length}`
    );
  }

  features.sort(
    (a, b) =>
      Object.values(CLASS_KEYS).indexOf(a.className) - Object.values(CLASS_KEYS).indexOf(b.className) ||
      (a.subclass ?? '').localeCompare(b.subclass ?? '') ||
      a.level - b.level ||
      a.key.localeCompare(b.key)
  );

  for (const f of features) sources[f.source] = (sources[f.source] ?? 0) + 1;

  const output = {
    attribution:
      'SRD 5.2 content © Wizards of the Coast LLC, licensed under CC-BY-4.0. ' +
      'Non-SRD features include name and a short summary only.',
    count: features.length,
    features,
  };

  const dir = dirname(fileURLToPath(import.meta.url));
  const outPath = resolve(dir, '../shared/src/data/features.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(output));

  console.log(`Записано ${features.length} черт → ${outPath}`);
  console.log('По источникам:', JSON.stringify(sources));
  if (unmatched.length) console.log(`Не сопоставлены подклассы (${unmatched.length}): ${unmatched.join(', ')}`);

  const catalogKeys = new Set(features.map((f) => f.key));
  const poolLike = /:(focus|sorceryPoints|superiorityDice|psionicEnergyDice)$/;
  const missing: string[] = [];
  const check = (key: string) => {
    if (catalogKeys.has(key) || poolLike.test(key)) return;
    missing.push(key);
  };
  for (const [classKey, def] of Object.entries(CLASSES)) {
    for (const r of def.resources) check(`${classKey}:${r.key}`);
    for (const [subKey, subDef] of Object.entries(def.subclasses)) {
      for (const r of subDef.resources ?? []) check(`${classKey}.${subKey}:${r.key}`);
    }
  }
  console.log(`Ресурсы CLASSES без пары в каталоге (${missing.length}): ${missing.join(', ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
