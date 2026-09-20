import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectText, type InvocationEntry, type InvocationPrereq, type InvocationsData } from 'shared';

/**
 * Сборка `shared/src/data/invocations.json` из 5e.tools (XPHB, 2024).
 * Источник: `optionalfeatures.json` (`featureType: EI`) + таблица варлока.
 * Запуск: `npm run invocations`.
 */

const BASE = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data';

interface RawOptionalFeature {
  name?: unknown;
  source?: unknown;
  srd52?: unknown;
  featureType?: unknown;
  prerequisite?: unknown;
  entries?: unknown;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Не удалось скачать ${url}: ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

function parsePrereq(value: unknown, byName: Map<string, string>): InvocationPrereq | undefined {
  const out: InvocationPrereq = {};
  for (const item of Array.isArray(value) ? value : []) {
    if (!item || typeof item !== 'object') continue;
    const q = item as Record<string, unknown>;
    const level = q.level;
    if (level && typeof level === 'object' && Number.isFinite((level as { level?: unknown }).level)) {
      out.level = Number((level as { level: number }).level);
    }
    for (const ref of Array.isArray(q.optionalfeature) ? q.optionalfeature : []) {
      const [name = '', source = 'xphb'] = String(ref).split('|');
      const pact = /^pact of the (blade|chain|tome)$/i.exec(name.trim());
      if (pact) out.pact = pact[1]!.toLowerCase() as InvocationPrereq['pact'];
      else out.requires = byName.get(name.trim().toLowerCase()) ?? `${source.toUpperCase()}:${name.trim()}`;
    }
    if (Array.isArray(q.spell) && q.spell.length) {
      const choose = String((q.spell[0] as { choose?: unknown }).choose ?? '');
      out.cantrip = /spell attack/i.test(choose) ? 'spellAttack' : 'damage';
    }
  }
  return Object.keys(out).length ? out : undefined;
}

async function main() {
  const [optional, warlock] = await Promise.all([
    fetchJson<{ optionalfeature?: RawOptionalFeature[] }>(`${BASE}/optionalfeatures.json`),
    fetchJson<{ class?: { name?: unknown; source?: unknown; classTableGroups?: unknown }[] }>(
      `${BASE}/class/class-warlock.json`
    ),
  ]);

  const raw = (optional.optionalfeature ?? []).filter(
    (f) => f.source === 'XPHB' && Array.isArray(f.featureType) && f.featureType.includes('EI')
  );
  const byName = new Map<string, string>();
  for (const f of raw) byName.set(String(f.name ?? '').trim().toLowerCase(), `XPHB:${String(f.name ?? '').trim()}`);

  const invocations: InvocationEntry[] = raw
    .map((f) => {
      const name = String(f.name ?? '').trim();
      const prereq = parsePrereq(f.prerequisite, byName);
      const description = collectText(f.entries).join('\n\n').slice(0, 1500);
      return {
        key: `XPHB:${name}`,
        name,
        level: prereq?.level ?? 1,
        ...(prereq ? { prereq } : {}),
        ...(f.srd52 === true ? {} : { nonSrd: true }),
        description,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const xphbWarlock = (warlock.class ?? []).find((c) => c.name === 'Warlock' && c.source === 'XPHB');
  const groups = Array.isArray(xphbWarlock?.classTableGroups) ? xphbWarlock!.classTableGroups : [];
  const rows = Array.isArray(groups[0]?.rows) ? (groups[0].rows as unknown[][]) : [];
  const limits = rows.map((row) => Number(row[0]) || 0);

  const output: InvocationsData = {
    attribution:
      'SRD 5.2 content © Wizards of the Coast LLC, licensed under CC-BY-4.0. ' +
      'XPHB Eldritch Invocations (2024 Warlock).',
    count: invocations.length,
    limits: limits.length === 20 ? limits : [1, 3, 3, 3, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10],
    invocations,
  };

  const dir = dirname(fileURLToPath(import.meta.url));
  const outPath = resolve(dir, '../shared/src/data/invocations.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(output));

  const nonSrd = invocations.filter((i) => i.nonSrd);
  console.log(`Записано ${invocations.length} инвокаций → ${outPath}`);
  console.log(`Лимиты по уровням: ${limits.join(',')}`);
  if (nonSrd.length) console.log(`Внимание, не в SRD: ${nonSrd.map((i) => i.name).join(', ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
