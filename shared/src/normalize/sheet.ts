import { DEFAULT_ABILITIES, DEFAULT_SPEED, MAX_CLASSES, MAX_FEATURE_CHOICES, MAX_INVOCATIONS, MAX_SHEET_SPELLS, MAX_SHAPE_FORMS, type AbilityKey } from '../domain/core';
import { normalizeSenses } from './sense';
import type { FeatureChoice, FeatureChoiceKind } from '../domain/feature';
import type { CharacterSheet, ClassLevel, SheetSpell } from '../domain/sheet';
import { normalizeAttacks, normalizeDamageDefenses } from './attacks';
import { normalizeHands } from '../rules/hands';
import { SPELL_KEY_RE, clampInt } from './internal';

export function normalizeClasses(raw: unknown): ClassLevel[] {
  if (!Array.isArray(raw)) return [];
  const out: ClassLevel[] = [];
  for (const item of raw.slice(0, MAX_CLASSES)) {
    if (!item || typeof item !== 'object') continue;
    const c = item as Partial<ClassLevel>;
    if (typeof c.className !== 'string' || !c.className) continue;
    const n = Number(c.level);
    out.push({
      className: c.className,
      level: Number.isFinite(n) ? Math.min(20, Math.max(1, Math.round(n))) : 1,
      subclass: typeof c.subclass === 'string' && c.subclass ? c.subclass : undefined,
    });
  }
  return out;
}

/** Чистит список выбранных заклинаний: формат ключа, класс, дедуп, лимит. */
export function normalizeSheetSpells(raw: unknown): SheetSpell[] {  if (!Array.isArray(raw)) return [];
  const out: SheetSpell[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (out.length >= MAX_SHEET_SPELLS) break;
    if (!item || typeof item !== 'object') continue;
    const s = item as Partial<SheetSpell>;
    if (typeof s.key !== 'string' || !SPELL_KEY_RE.test(s.key)) continue;
    if (typeof s.className !== 'string' || !s.className) continue;
    const dedupe = `${s.className}:${s.key}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({ key: s.key.slice(0, 80), className: s.className.slice(0, 30) });
  }
  return out;
}

/** Чистит список воззваний варлока: ключ `ИСТОЧНИК:имя`, дедуп, лимит. */
export function normalizeInvocations(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (out.length >= MAX_INVOCATIONS) break;
    if (typeof item !== 'string' || item.length > 80 || !SPELL_KEY_RE.test(item) || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

const CHOICE_KINDS: FeatureChoiceKind[] = [
  'feat',
  'invocation',
  'maneuver',
  'metamagic',
  'fightingStyle',
  'pactBoon',
  'infusion',
  'featureOption',
];

/** Чистит выборы способностей: известный вид, непустой ключ, дедуп, лимит. */
export function normalizeSheetChoices(raw: unknown): FeatureChoice[] {
  if (!Array.isArray(raw)) return [];
  const out: FeatureChoice[] = [];
  const seen = new Set<string>();
  const abilityKeys = new Set<string>(Object.keys(DEFAULT_ABILITIES));
  for (const item of raw) {
    if (out.length >= MAX_FEATURE_CHOICES) break;
    if (!item || typeof item !== 'object') continue;
    const c = item as Partial<FeatureChoice>;
    if (!CHOICE_KINDS.includes(c.kind as FeatureChoiceKind)) continue;
    if (typeof c.key !== 'string' || !c.key.trim()) continue;
    const list = typeof c.list === 'string' && c.list.trim() ? c.list.trim().slice(0, 40) : undefined;
    // Повторяемые фиты (Magic Initiate) различаются списком — дедуп учитывает его.
    const dedupe = `${c.kind}:${c.key}:${list ?? ''}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const ability = typeof c.ability === 'string' && abilityKeys.has(c.ability) ? (c.ability as AbilityKey) : undefined;
    const spells = Array.isArray(c.spells)
      ? [
          ...new Set(
            c.spells
              .filter((s): s is string => typeof s === 'string' && !!s.trim())
              .map((s) => s.trim().slice(0, 80))
          ),
        ].slice(0, 4)
      : [];
    const spell = typeof c.spell === 'string' && c.spell.trim() ? c.spell.trim().slice(0, 80) : undefined;
    out.push({
      kind: c.kind as FeatureChoiceKind,
      key: c.key.trim().slice(0, 80),
      ...(ability && { ability }),
      ...(list && { list }),
      ...(spells.length && { spells }),
      ...(spell && { spell }),
    });
  }
  return out;
}

export function normalizeWildShape(raw: unknown): { known?: string[] } | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const source = (raw as { known?: unknown }).known;
  if (!Array.isArray(source)) return undefined;
  const known: string[] = [];
  const seen = new Set<string>();
  for (const item of source) {
    if (known.length >= MAX_SHAPE_FORMS) break;
    if (typeof item !== 'string' || item.length > 80 || !SPELL_KEY_RE.test(item) || seen.has(item)) continue;
    seen.add(item);
    known.push(item);
  }
  return { ...(known.length ? { known } : {}) };
}

export function normalizeSheet(raw: Partial<CharacterSheet>): CharacterSheet {
  const abilities = { ...DEFAULT_ABILITIES };
  if (raw.abilities && typeof raw.abilities === 'object') {
    const source = raw.abilities as Record<string, unknown>;
    for (const key of Object.keys(DEFAULT_ABILITIES) as AbilityKey[]) {
      const n = Number(source[key]);
      if (Number.isFinite(n)) abilities[key] = Math.min(30, Math.max(0, Math.round(n)));
    }
  }
  const invocations = normalizeInvocations((raw as { invocations?: unknown }).invocations);
  const wildShape = normalizeWildShape((raw as { wildShape?: unknown }).wildShape);
  const attacks = normalizeAttacks(raw.attacks);
  const hands = normalizeHands((raw as { hands?: unknown }).hands, attacks);
  return {
    name: typeof raw.name === 'string' ? raw.name.slice(0, 40) : '',
    abilities,
    proficiencyBonus: typeof raw.proficiencyBonus === 'string' ? raw.proficiencyBonus.slice(0, 10) : '2',
    saves: raw.saves ?? {},
    skills: raw.skills ?? {},
    attacks,
    ...(hands ? { hands } : {}),
    classes: normalizeClasses(raw.classes),
    spells: normalizeSheetSpells((raw as { spells?: unknown }).spells),
    choices: normalizeSheetChoices((raw as { choices?: unknown }).choices),
    ...(invocations.length ? { invocations } : {}),
    ...(wildShape ? { wildShape } : {}),
    hpMax: typeof raw.hpMax === 'string' ? raw.hpMax.slice(0, 10) : '',
    ac: typeof raw.ac === 'string' ? raw.ac.slice(0, 10) : '',
    speed: clampInt((raw as { speed?: unknown }).speed, 0, 1000, DEFAULT_SPEED),
    senses: normalizeSenses((raw as { senses?: unknown }).senses),
    damageDefenses: normalizeDamageDefenses((raw as { damageDefenses?: unknown }).damageDefenses),
  };
}
