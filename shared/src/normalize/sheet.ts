import { DEFAULT_ABILITIES, DEFAULT_SPEED, MAX_CLASSES, MAX_SHEET_SPELLS, type AbilityKey } from '../domain/core';
import type { CharacterSheet, ClassLevel, SheetSpell } from '../domain/sheet';
import type { AttackEntry } from '../domain/token';
import { normalizeAttacks, normalizeDamageDefenses } from './attacks';
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
export function normalizeSheetSpells(raw: unknown): SheetSpell[] {
  if (!Array.isArray(raw)) return [];
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

export function normalizeSheet(
  raw: Partial<CharacterSheet> & { attack?: Partial<AttackEntry> | null }
): CharacterSheet {
  const abilities = { ...DEFAULT_ABILITIES };
  if (raw.abilities && typeof raw.abilities === 'object') {
    const source = raw.abilities as Record<string, unknown>;
    for (const key of Object.keys(DEFAULT_ABILITIES) as AbilityKey[]) {
      const n = Number(source[key]);
      if (Number.isFinite(n)) abilities[key] = Math.min(30, Math.max(0, Math.round(n)));
    }
  }
  return {
    name: typeof raw.name === 'string' ? raw.name.slice(0, 40) : '',
    abilities,
    proficiencyBonus: typeof raw.proficiencyBonus === 'string' ? raw.proficiencyBonus.slice(0, 10) : '2',
    saves: raw.saves ?? {},
    skills: raw.skills ?? {},
    attacks: normalizeAttacks(raw.attacks, raw.attack),
    classes: normalizeClasses(raw.classes),
    spells: normalizeSheetSpells((raw as { spells?: unknown }).spells),
    hpMax: typeof raw.hpMax === 'string' ? raw.hpMax.slice(0, 10) : '',
    ac: typeof raw.ac === 'string' ? raw.ac.slice(0, 10) : '',
    speed: clampInt((raw as { speed?: unknown }).speed, 0, 1000, DEFAULT_SPEED),
    damageDefenses: normalizeDamageDefenses((raw as { damageDefenses?: unknown }).damageDefenses),
  };
}
