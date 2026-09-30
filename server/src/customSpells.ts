import Ajv2020 from 'ajv/dist/2020.js';
import {
  CUSTOM_SPELL_PREFIX,
  compileSpec,
  formatSpecIssues,
  isRecord,
  resolveSpec,
  validateSpec,
  type AutomationSpec,
  type AutomationSpecCopy,
  type MaterializedAutomation,
  type Spell,
  type SpellDef,
} from 'shared';
import { MATERIALIZED_AUTOMATION_SCHEMA } from 'shared/automationSchema';

/**
 * Импорт кастомных заклинаний комнаты (R16 срез 5): `CUSTOM:`-записи в том же
 * формате, что канон (`SpellDef = meta + automation`). Два входа:
 * - копия `{ extends, patch?, remove? }` — база из канона или уже импортированной
 *   записи комнаты, патч по именованным путям (`resolveSpec`), meta наследуется;
 * - полная запись (экспорт 1:1) — meta + automation.
 * `resolveSpec` — только слой импорта: в комнате хранится слитая запись.
 * Ошибка — исключение с причиной (хендлер отдаёт `customInvalid` в чат).
 */

const ajv = new Ajv2020({ allErrors: true, strict: false });
const checkAutomation = ajv.compile(MATERIALIZED_AUTOMATION_SCHEMA);

export type CustomSpellLookup = (key: string) => SpellDef | undefined;

const META_FIELDS = [
  'level',
  'school',
  'ritual',
  'concentration',
  'time',
  'range',
  'components',
  'duration',
  'classes',
  'damage',
  'save',
  'spellAttack',
  'healing',
  'saveHalf',
  'area',
  'areaSpec',
  'conditions',
  'srd',
  'description',
  'higherLevel',
  'upcast',
  'cantrip',
  'attacks',
] as const;

const REQUIRED_META = ['level', 'school', 'time', 'range', 'components', 'duration', 'classes', 'description'] as const;
const SOURCES = new Set<Spell['source']>(['XPHB', 'XGE', 'TCE', 'CUSTOM']);

function bad(what: string): never {
  throw new Error(`Кастомное заклинание: ${what}`);
}

function str(value: unknown, what: string, max = 200): string {
  if (typeof value !== 'string' || !value.trim()) bad(`${what} — непустая строка обязательна`);
  const text = value.trim();
  if (text.length > max) bad(`${what} длиннее ${max} символов`);
  return text;
}

function customKey(rawKey: unknown, fallback: string): string {
  const text = typeof rawKey === 'string' && rawKey.trim() ? rawKey.trim() : fallback;
  const key = text.startsWith(CUSTOM_SPELL_PREFIX) ? text : `${CUSTOM_SPELL_PREFIX}${text}`;
  if (key.length > 120) bad('ключ длиннее 120 символов');
  return key;
}

/** Meta полной записи: обязательные поля проверены, известные скопированы. */
function pickMeta(raw: Record<string, unknown>): Omit<Spell, 'key' | 'name'> {
  for (const field of REQUIRED_META) {
    if (raw[field] === undefined) bad(`нет поля ${field}`);
  }
  const meta: Record<string, unknown> = {};
  for (const field of META_FIELDS) {
    if (raw[field] !== undefined) meta[field] = structuredClone(raw[field]);
  }
  const level = meta.level;
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 0 || level > 9) bad('level — целое 0..9');
  for (const field of ['time', 'duration', 'classes', 'description'] as const) {
    if (!Array.isArray(meta[field])) bad(`${field} — массив`);
  }
  if (!isRecord(meta.range)) bad('range — объект');
  if (!isRecord(meta.components)) bad('components — объект');
  const source: Spell['source'] =
    typeof raw.source === 'string' && SOURCES.has(raw.source as Spell['source'])
      ? (raw.source as Spell['source'])
      : 'CUSTOM';
  return { ...(meta as unknown as Omit<Spell, 'key' | 'name'>), source };
}

/** Схема + семантика (`validateSpec`) + пробная компиляция — ошибки до записи в комнату. */
function validateRecord(record: SpellDef): SpellDef {
  if (!checkAutomation(record.automation)) {
    bad(`схема: ${ajv.errorsText(checkAutomation.errors, { separator: '; ' })}`);
  }
  const spec: AutomationSpec = { key: record.key, name: record.name, ...structuredClone(record.automation) };
  const issues = validateSpec(spec);
  if (issues.length) bad(formatSpecIssues(issues));
  compileSpec(spec, { spell: record, opts: {} });
  return record;
}

/** Импорт кастомного заклинания: копия `extends` или полная запись. */
export function importCustomSpell(raw: unknown, lookup: CustomSpellLookup): SpellDef {
  if (!isRecord(raw)) bad('ожидается объект JSON');
  return typeof raw.extends === 'string' && raw.extends
    ? importCopy(raw, lookup)
    : importFull(raw);
}

function importCopy(raw: Record<string, unknown>, lookup: CustomSpellLookup): SpellDef {
  const extendsKey = str(raw.extends, 'extends', 120);
  const base = lookup(extendsKey);
  if (!base) bad(`база ${extendsKey} не найдена`);
  const name = raw.name !== undefined ? str(raw.name, 'name', 80) : `${base.name} (custom)`;
  const key = customKey(raw.key, name);
  const copy: AutomationSpecCopy = { key, name, extends: extendsKey };
  if (raw.patch !== undefined) {
    if (!isRecord(raw.patch)) bad('patch — объект');
    copy.patch = structuredClone(raw.patch);
  }
  if (raw.remove !== undefined) {
    if (!Array.isArray(raw.remove)) bad('remove — массив');
    copy.remove = raw.remove.map((p) => str(p, 'remove[]', 200));
  }
  const baseSpec: AutomationSpec = { key: base.key, name: base.name, ...structuredClone(base.automation) };
  const spec = resolveSpec(copy, { [base.key]: baseSpec });
  const { key: _key, name: _name, ...automation } = spec;
  return validateRecord({ ...structuredClone(base), key, name, automation });
}

function importFull(raw: Record<string, unknown>): SpellDef {
  if (!isRecord(raw.automation)) bad('automation — объект обязателен');
  const name = str(raw.name, 'name', 80);
  const key = customKey(raw.key, name);
  const meta = pickMeta(raw);
  const automation = structuredClone(raw.automation) as MaterializedAutomation;
  return validateRecord({ ...meta, key, name, automation });
}

/** Лёгкая проверка записи с диска (гидрация): форма без полной валидации. */
export function isCustomSpellDef(value: unknown): value is SpellDef {
  return (
    isRecord(value) &&
    typeof value.key === 'string' &&
    value.key.startsWith(CUSTOM_SPELL_PREFIX) &&
    typeof value.name === 'string' &&
    isRecord(value.automation)
  );
}
