import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bestiaryEntryFromRaw, type BestiaryEntry, type RawBestiaryMonster } from 'shared';

/**
 * Сборка `shared/src/data/bestiary.json` из данных 5e.tools (R8.9).
 * Источники: XMM (только `srd52`) + XPHB (шаблоны призывов/спутников PHB'24).
 * Запуск: `npm run bestiary`.
 */

const BASE = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/bestiary';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Не удалось скачать ${url}: ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

async function main() {
  const [xmm, xphb] = await Promise.all([
    fetchJson<{ monster?: RawBestiaryMonster[] }>(`${BASE}/bestiary-xmm.json`),
    fetchJson<{ monster?: RawBestiaryMonster[] }>(`${BASE}/bestiary-xphb.json`),
  ]);

  const dir = dirname(fileURLToPath(import.meta.url));
  const spellsRaw = JSON.parse(readFileSync(resolve(dir, '../shared/src/data/spells.json'), 'utf8')) as {
    spells: { key: string }[];
  };
  const knownSpells = new Set(spellsRaw.spells.map((s) => s.key));

  const raw = [
    ...(xmm.monster ?? []).filter((m) => m.srd52 === true),
    ...(xphb.monster ?? []),
  ];
  const byKey = new Map<string, BestiaryEntry>();
  for (const monster of raw) {
    const entry = bestiaryEntryFromRaw(monster, knownSpells);
    if (entry) byKey.set(entry.key, entry);
  }
  const entries = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));

  const output = {
    attribution:
      'SRD 5.2 content © Wizards of the Coast LLC, licensed under CC-BY-4.0. ' +
      'XPHB entries are the summon/companion stat blocks referenced by PHB\'24 spells and features.',
    count: entries.length,
    entries,
  };

  const outPath = resolve(dir, '../shared/src/data/bestiary.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(output));

  const stats = {
    xmm: entries.filter((e) => e.source === 'XMM').length,
    xphb: entries.filter((e) => e.source === 'XPHB').length,
    attacks: entries.filter((e) => e.attacks.length).length,
    actions: entries.filter((e) => e.actions.length).length,
    spells: entries.filter((e) => e.spellcasting).length,
    legendary: entries.filter((e) => e.legendaryMax).length,
    familiar: entries.filter((e) => e.familiar).length,
  };
  console.log(`Записано ${entries.length} существ → ${outPath}`);
  console.log('Статистика:', JSON.stringify(stats));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
