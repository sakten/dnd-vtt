import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectText, firstSentence, type ManeuverEntry, type ManeuversData } from 'shared';

/**
 * Сборка `shared/src/data/maneuvers.json` из 5e.tools (XPHB, 2024).
 * Источник: `optionalfeatures.json` (`featureType: MV:B`).
 * Запуск: `npm run maneuvers`.
 */

const BASES = [
  'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data',
  'https://cdn.jsdelivr.net/gh/5etools-mirror-3/5etools-src@main/data',
];

interface RawOptionalFeature {
  name?: unknown;
  source?: unknown;
  srd52?: unknown;
  featureType?: unknown;
  entries?: unknown;
}

async function fetchJson<T>(path: string): Promise<T> {
  let lastError: unknown;
  for (const base of BASES) {
    try {
      const res = await fetch(`${base}/${path}`);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return (await res.json()) as T;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Не удалось скачать ${path}: ${String(lastError)}`);
}

async function main() {
  const optional = await fetchJson<{ optionalfeature?: RawOptionalFeature[] }>('optionalfeatures.json');
  const raw = (optional.optionalfeature ?? []).filter(
    (f) => f.source === 'XPHB' && Array.isArray(f.featureType) && f.featureType.includes('MV:B')
  );
  const maneuvers: ManeuverEntry[] = raw
    .map((f) => {
      const name = String(f.name ?? '').trim();
      const paragraphs = collectText(f.entries).filter(Boolean);
      const text = paragraphs.join('\n\n');
      return {
        key: `XPHB:${name}`,
        name,
        source: 'XPHB' as const,
        ...(f.srd52 === true ? { srd: true } : { nonSrd: true }),
        description: f.srd52 === true ? text : firstSentence(paragraphs[0] ?? text),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const output: ManeuversData = {
    attribution:
      'SRD 5.2 content © Wizards of the Coast LLC, licensed under CC-BY-4.0. ' +
      'XPHB Battle Master Maneuvers (2024 Fighter).',
    count: maneuvers.length,
    maneuvers,
  };
  const dir = dirname(fileURLToPath(import.meta.url));
  const outPath = resolve(dir, '../shared/src/data/maneuvers.json');
  writeFileSync(outPath, JSON.stringify(output));
  console.log(`Записано ${maneuvers.length} манёвров → ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
