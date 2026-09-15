import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Сборка `shared/src/data/weapons.json` из данных 5e.tools (R8.8).
 * Источники: XPHB/PHB (приоритет XPHB), простые и воинские виды оружия.
 * Сохраняются свойства (finesse/light/thrown/reach/versatile/…), мастерства
 * (Vex/Nick и т.п. — механика мастерств пока не реализована) и безоружный удар.
 * Запуск: `npm run weapons`.
 */

const BASE = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data';

const SOURCE_PREF = ['XPHB', 'PHB'];
const DAMAGE_TYPES: Record<string, string> = { B: 'bludgeoning', P: 'piercing', S: 'slashing' };

/** Свойства 5e.tools → наши коды (для механических проверок в будущем). */
const KNOWN_PROPERTIES = new Set([
  '2H',
  'A',
  'AF',
  'F',
  'H',
  'L',
  'LD',
  'R',
  'RLD',
  'S',
  'T',
  'V',
]);

interface RawWeapon {
  name?: string;
  source?: string;
  type?: string;
  weapon?: boolean;
  firearm?: boolean;
  weaponCategory?: string;
  property?: unknown;
  mastery?: unknown;
  range?: string;
  dmg1?: string;
  dmg2?: string;
  dmgType?: string;
}

interface WeaponDef {
  key: string;
  name: string;
  source: string;
  category: 'simple' | 'martial';
  rangeType: 'melee' | 'ranged';
  damage: string;
  damageType: string;
  rangeNormal: number;
  rangeLong: number;
  properties: string[];
  versatileDamage?: string;
  mastery: string[];
  unarmed?: boolean;
}

function stripSource(value: unknown): string {
  return typeof value === 'string' ? value.split('|')[0]!.trim() : '';
}

/** Коды свойств/мастерств из данных 5e.tools (строка или массив, с источником). */
function codeList(value: unknown): string[] {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  return list.map(stripSource).filter(Boolean);
}

function parseRange(raw: RawWeapon): { normal: number; long: number } {
  const type = stripSource(raw.type ?? '');
  if (type === 'M') {
    const reach = codeList(raw.property).includes('R');
    return { normal: reach ? 10 : 5, long: 0 };
  }
  const [normal, long] = (raw.range ?? '').split('/').map((v) => Number(v));
  return {
    normal: Number.isFinite(normal) ? Math.max(0, Math.round(normal!)) : 0,
    long: Number.isFinite(long) ? Math.max(0, Math.round(long!)) : 0,
  };
}

function normalizeWeapon(raw: RawWeapon): WeaponDef | null {
  const name = stripSource(String(raw.name ?? ''));
  const type = stripSource(String(raw.type ?? ''));
  const category = raw.weaponCategory === 'simple' ? 'simple' : raw.weaponCategory === 'martial' ? 'martial' : null;
  if (!name || (type !== 'M' && type !== 'R') || !category) return null;
  const damageType = DAMAGE_TYPES[String(raw.dmgType ?? '').toUpperCase()];
  if (!damageType || !raw.dmg1) return null;
  const properties = codeList(raw.property).filter((p) => KNOWN_PROPERTIES.has(p));
  const { normal, long } = parseRange(raw);
  return {
    key: `${String(raw.source)}:${name}`,
    name,
    source: String(raw.source),
    category,
    rangeType: type === 'M' ? 'melee' : 'ranged',
    damage: String(raw.dmg1),
    damageType,
    rangeNormal: normal,
    rangeLong: long,
    properties,
    ...(properties.includes('V') && raw.dmg2 ? { versatileDamage: String(raw.dmg2) } : {}),
    mastery: codeList(raw.mastery),
  };
}

async function main() {
  const url = `${BASE}/items-base.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Не удалось скачать ${url}: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as { baseitem?: RawWeapon[] };

  const list = (data.baseitem ?? []).filter(
    (w) => w.weapon === true && !w.firearm && SOURCE_PREF.includes(String(w.source))
  );
  const byName = new Map<string, WeaponDef>();
  for (const raw of list) {
    const weapon = normalizeWeapon(raw);
    if (!weapon) continue;
    const current = byName.get(weapon.name);
    const priority = SOURCE_PREF.indexOf(weapon.source);
    const currentPriority = current ? SOURCE_PREF.indexOf(current.source) : 99;
    if (!current || priority < currentPriority) byName.set(weapon.name, weapon);
  }

  const weapons = [...byName.values()].sort(
    (a, b) => a.category.localeCompare(b.category) || a.rangeType.localeCompare(b.rangeType) || a.name.localeCompare(b.name)
  );
  weapons.unshift({
    key: 'XPHB:Unarmed Strike',
    name: 'Unarmed Strike',
    source: 'XPHB',
    category: 'simple',
    rangeType: 'melee',
    damage: '1',
    damageType: 'bludgeoning',
    rangeNormal: 5,
    rangeLong: 0,
    properties: [],
    mastery: [],
    unarmed: true,
  });

  const output = {
    attribution:
      'SRD 5.2 content © Wizards of the Coast LLC, licensed under CC-BY-4.0. ' +
      'Weapon properties and mastery names are data only; mastery mechanics are not implemented yet.',
    count: weapons.length,
    weapons,
  };

  const dir = dirname(fileURLToPath(import.meta.url));
  const outPath = resolve(dir, '../shared/src/data/weapons.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(output));

  const byCategory: Record<string, number> = {};
  for (const w of weapons) byCategory[w.category] = (byCategory[w.category] ?? 0) + 1;
  console.log(`Записано ${weapons.length} единиц оружия → ${outPath}`);
  console.log('По категориям:', JSON.stringify(byCategory));
  console.log('С мастерствами:', weapons.filter((w) => w.mastery.length).length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
