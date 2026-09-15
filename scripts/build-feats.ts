import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ABILITIES, collectText, type AbilityKey } from 'shared';

/**
 * Сборка `shared/src/data/feats.json` из данных 5e.tools (R8.8, слой выборов).
 * Источник: XPHB (PHB'24), категории origin/general/fightingStyle; эпические дары (EB) — вне 1–12.
 * Ключ — `XPHB:<camelName>`. Механики — ручной слой `rules/feats.ts`.
 * Запуск: `npm run feats`.
 */

const BASE = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data';

type FeatCategory = 'origin' | 'general' | 'fightingStyle';

const CATEGORIES: Record<string, FeatCategory> = {
  O: 'origin',
  G: 'general',
  FS: 'fightingStyle',
  'FS:P': 'fightingStyle',
  'FS:R': 'fightingStyle',
};

interface RawPrerequisite {
  level?: number;
  ability?: Record<string, number>[];
  spellcasting?: boolean;
  feature?: unknown;
}

interface RawAdditionalSpell {
  name?: string;
  ability?: { choose?: string[] };
  known?: Record<string, unknown>;
}

interface RawFeat {
  name?: string;
  source?: string;
  category?: string;
  prerequisite?: (RawPrerequisite | string)[];
  repeatable?: boolean;
  srd52?: boolean;
  entries?: unknown;
  additionalSpells?: RawAdditionalSpell[];
}

interface CatalogFeat {
  key: string;
  name: string;
  category: FeatCategory;
  levelReq?: number;
  prereq?: string;
  repeatable?: boolean;
  abilityChoose?: AbilityKey[];
  spellLists?: { name: string; className: string }[];
  description: string;
}

function camel(name: string): string {
  const words = name
    .replace(/['’]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  return words
    .map((word, index) => (index === 0 ? word.toLowerCase() : word[0]!.toUpperCase() + word.slice(1).toLowerCase()))
    .join('');
}

async function fetchJson<T>(path: string): Promise<T> {
  const url = `${BASE}/${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Не удалось скачать ${url}: ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

function prerequisiteOf(raw: RawFeat): { levelReq?: number; prereq?: string } {
  const parts: string[] = [];
  let levelReq: number | undefined;
  for (const item of raw.prerequisite ?? []) {
    if (typeof item === 'string') {
      parts.push(item);
      continue;
    }
    if (item.level) {
      levelReq = levelReq === undefined ? item.level : Math.min(levelReq, item.level);
      parts.push(`${item.level} уровень`);
    }
    for (const ability of item.ability ?? []) {
      for (const [key, value] of Object.entries(ability)) {
        const label = ABILITIES[key as AbilityKey] ?? key;
        parts.push(`${label} ${value}`);
      }
    }
    if (item.spellcasting) parts.push('использование заклинаний');
    if (item.feature) parts.push('классовая черта');
  }
  return { ...(levelReq !== undefined && { levelReq }), ...(parts.length && { prereq: parts.join(', ') }) };
}

function spellListsOf(raw: RawFeat): CatalogFeat['spellLists'] {
  const lists: NonNullable<CatalogFeat['spellLists']> = [];
  for (const entry of raw.additionalSpells ?? []) {
    if (!entry?.name || !entry.known) continue;
    const name = String(entry.name).replace(/ Spells$/i, '');
    lists.push({ name, className: name.toLowerCase() });
  }
  return lists.length ? lists : undefined;
}

function abilityChooseOf(raw: RawFeat): CatalogFeat['abilityChoose'] {
  const choose = raw.additionalSpells?.[0]?.ability?.choose;
  return choose?.length ? (choose as AbilityKey[]) : undefined;
}

/** Убирает служебные маркеры 5e.tools из имени блока (`{@variantrule X|XPHB}` → `X`). */
function plainName(value: string): string {
  return value.replace(/\{@\w+\s+([^|}]+)(?:\|[^}]*)?\}/g, '$1').trim();
}

/**
 * Тексты фита: блоки с именем («Enhanced Unarmed Strike») склеиваются как «Имя: текст»,
 * вводная строка «You gain the following benefits.» отбрасывается.
 */
function benefitLines(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    // `{@table Skill List; Skills|…}` → «skills», иначе в тексте остаётся служебная часть.
    const cleaned = value.replace(/\{@table\s+[^;|}]+;\s*([^|}]+)[^}]*\}/g, '$1');
    const text = collectText(cleaned).join(' ');
    if (text) out.push(text);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) benefitLines(item, out);
    return out;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const entries = obj.entries ?? obj.items ?? obj.entry;
    if (typeof obj.name === 'string' && entries) {
      const text = collectText(entries).join(' ');
      if (text) out.push(`${plainName(obj.name)}: ${text}`);
      return out;
    }
    if (entries) benefitLines(entries, out);
  }
  return out;
}

function descriptionOf(raw: RawFeat): string {
  const lines = benefitLines(raw.entries).filter(
    (line) => !/^You gain the following benefits\.?$/i.test(line.trim())
  );
  if (lines.length) return lines.join('\n\n');
  const paragraphs = collectText(raw.entries).filter(Boolean);
  return paragraphs.join('\n\n');
}

async function main() {
  const file = await fetchJson<{ feat?: RawFeat[] }>('feats.json');
  const feats: CatalogFeat[] = [];
  for (const raw of file.feat ?? []) {
    if (raw.source !== 'XPHB') continue;
    const category = CATEGORIES[raw.category ?? ''];
    if (!category || !raw.name) continue;
    const name = String(raw.name).split('|')[0]!.trim();
    feats.push({
      key: `XPHB:${camel(name)}`,
      name,
      category,
      ...prerequisiteOf(raw),
      ...(raw.repeatable ? { repeatable: true } : {}),
      ...(abilityChooseOf(raw) ? { abilityChoose: abilityChooseOf(raw) } : {}),
      ...(spellListsOf(raw) ? { spellLists: spellListsOf(raw) } : {}),
      description: descriptionOf(raw),
    });
  }
  feats.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  const byCategory: Record<string, number> = {};
  for (const f of feats) byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;

  const dir = dirname(fileURLToPath(import.meta.url));
  const outPath = resolve(dir, '../shared/src/data/feats.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify({
      attribution:
        'SRD 5.2 content © Wizards of the Coast LLC, licensed under CC-BY-4.0. ' +
        'Non-SRD feats include name and mechanics only.',
      count: feats.length,
      feats,
    })
  );
  console.log(`Записано ${feats.length} черт → ${outPath}`);
  console.log('По категориям:', JSON.stringify(byCategory));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
