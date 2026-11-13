import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTags } from 'shared';

/**
 * Сборка `shared/src/data/races.json` из данных 5e.tools (PHB 2024, XPHB).
 * Ключ — `XPHB:<имя вида>`; подрасы 2014 не входят (редакция one).
 * Запуск: `npm run races`.
 */

const BASES = [
  'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data',
  'https://cdn.jsdelivr.net/gh/5etools-mirror-3/5etools-src@main/data',
];

const SOURCE = 'XPHB';

interface RawRace {
  name?: string;
  source?: string;
  edition?: string;
  speed?: number;
  size?: string[];
  darkvision?: number;
  resist?: unknown;
  entries?: unknown;
  additionalSpells?: unknown;
  hasFluff?: boolean;
}

interface RawRacesFile {
  race?: RawRace[];
}

interface RaceTrait {
  name: string;
  description: string;
}

interface CatalogRace {
  key: string;
  name: string;
  source: string;
  speed: number;
  sizes: string[];
  darkvision?: number;
  resist?: string[];
  resistChoice?: string[];
  traits: RaceTrait[];
  additionalSpells?: unknown;
}

function textOf(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    const text = stripTags(value);
    if (text) out.push(text);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) textOf(item, out);
    return out;
  }
  if (!value || typeof value !== 'object') return out;
  const obj = value as Record<string, unknown>;
  if (obj.type === 'table' || obj.type === 'tableGroup') return out;
  const name = typeof obj.name === 'string' ? obj.name.trim() : '';
  if (obj.entries !== undefined) {
    if (name) out.push(`${name}.`);
    textOf(obj.entries, out);
  } else if (obj.items !== undefined) {
    textOf(obj.items, out);
  } else if (obj.entry !== undefined) {
    textOf(obj.entry, out);
  }
  return out;
}

function normalizeResist(value: unknown): { resist?: string[]; resistChoice?: string[] } {
  if (!Array.isArray(value)) return {};
  const fixed: string[] = [];
  const choices: string[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      fixed.push(item);
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const choose = (item as { choose?: { from?: unknown } }).choose;
    if (Array.isArray(choose?.from)) {
      for (const from of choose.from) if (typeof from === 'string') choices.push(from);
    }
  }
  return {
    ...(fixed.length ? { resist: [...new Set(fixed)] } : {}),
    ...(choices.length ? { resistChoice: [...new Set(choices)] } : {}),
  };
}

async function fetchJson<T>(path: string): Promise<T> {
  let lastError: unknown;
  for (const base of BASES) {
    const url = `${base}/${path}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return (await res.json()) as T;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Не удалось скачать ${path}: ${String(lastError)}`);
}

async function main() {
  const file = await fetchJson<RawRacesFile>('races.json');
  const races: CatalogRace[] = [];
  for (const raw of file.race ?? []) {
    if (raw.source !== SOURCE) continue;
    const name = raw.name?.trim();
    if (!name) continue;
    const traits: RaceTrait[] = [];
    for (const entry of Array.isArray(raw.entries) ? raw.entries : []) {
      if (!entry || typeof entry !== 'object') continue;
      const trait = entry as { name?: unknown; entries?: unknown };
      const traitName = typeof trait.name === 'string' ? trait.name.trim() : '';
      if (!traitName) continue;
      const paragraphs = textOf(trait.entries);
      traits.push({ name: traitName, description: paragraphs.join('\n\n') });
    }
    const resist = normalizeResist(raw.resist);
    races.push({
      key: `${SOURCE}:${name}`,
      name,
      source: SOURCE,
      speed: Number.isFinite(raw.speed) ? Math.max(0, Math.round(raw.speed!)) : 30,
      sizes: Array.isArray(raw.size) ? raw.size.filter((s): s is string => typeof s === 'string') : ['M'],
      ...(Number.isFinite(raw.darkvision) && raw.darkvision ? { darkvision: Math.round(raw.darkvision) } : {}),
      ...resist,
      traits,
      ...(raw.additionalSpells ? { additionalSpells: raw.additionalSpells } : {}),
    });
  }
  races.sort((a, b) => a.name.localeCompare(b.name));
  const outPath = resolve(dirname(fileURLToPath(import.meta.url)), '../shared/src/data/races.json');
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        attribution: 'Species from the System Reference Document 5.2 / PHB 2024, via 5e.tools.',
        count: races.length,
        races,
      },
      null,
      2
    ) + '\n'
  );
  console.log(`races: ${races.length} → ${outPath}`);
  if (races.length !== 10) console.warn(`Ожидалось 10 видов XPHB, получено ${races.length}`);
}

await main();
