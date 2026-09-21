import { MAX_ATTACKS } from '../domain/core';
import { MAX_DEFENSES, type DamageDefense } from '../domain/damage';
import type { CharacterSheet } from '../domain/sheet';
import type { AttackEntry } from '../domain/token';
import { newId } from './internal';

export function emptyAttack(): AttackEntry {
  return { name: '', hit: '', damage: '', rangeType: 'melee', rangeNormal: 5, rangeLong: 0 };
}

export function emptyAttacks(): AttackEntry[] {
  return [emptyAttack()];
}

function coerceAttack(raw: Partial<AttackEntry> | null | undefined): AttackEntry {
  const rangeNormal = Number(raw?.rangeNormal);
  const rangeLong = Number(raw?.rangeLong);
  return {
    name: typeof raw?.name === 'string' ? raw.name : '',
    hit: typeof raw?.hit === 'string' ? raw.hit : '',
    damage: typeof raw?.damage === 'string' ? raw.damage : '',
    rangeType: raw?.rangeType === 'ranged' || raw?.rangeType === 'none' ? raw.rangeType : 'melee',
    rangeNormal: Number.isFinite(rangeNormal) ? Math.max(0, Math.round(rangeNormal)) : 5,
    rangeLong: Number.isFinite(rangeLong) ? Math.max(0, Math.round(rangeLong)) : 0,
    damageType: typeof raw?.damageType === 'string' && raw.damageType ? raw.damageType.slice(0, 20) : undefined,
    kind: raw?.kind === 'unarmed' ? 'unarmed' : undefined,
  };
}

export function attackIsEmpty(a: AttackEntry): boolean {
  return !a.name.trim() && !a.hit.trim() && !a.damage.trim();
}

export function attackIsActive(a: AttackEntry): boolean {
  return !!a.hit.trim() || !!a.damage.trim();
}

/**
 * Приводит список атак к валидному виду: динамическая длина (до `MAX_ATTACKS`),
 * обрезка пустых строк в конце, минимум одна строка.
 */
export function normalizeAttacks(attacks: unknown): AttackEntry[] {
  const list = Array.isArray(attacks) ? attacks : [];
  const result = list.slice(0, MAX_ATTACKS).map((a) => coerceAttack(a as Partial<AttackEntry> | undefined));
  while (result.length > 1 && attackIsEmpty(result[result.length - 1]!)) result.pop();
  if (result.length === 0) result.push(emptyAttack());
  return result;
}

/** Чистит список защит (тип + тип урона), дедуп по паре, лимит. */
export function normalizeDamageDefenses(raw: unknown): DamageDefense[] {
  if (!Array.isArray(raw)) return [];
  const out: DamageDefense[] = [];
  const seen = new Set<string>();
  for (const item of raw.slice(0, MAX_DEFENSES)) {
    if (!item || typeof item !== 'object') continue;
    const d = item as Partial<DamageDefense>;
    if (d.type !== 'resistance' && d.type !== 'immunity' && d.type !== 'vulnerability') continue;
    if (typeof d.damageType !== 'string' || !d.damageType) continue;
    const damageType = d.damageType.slice(0, 20);
    const dedupe = `${d.type}:${damageType}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({ id: typeof d.id === 'string' && d.id ? d.id : newId(), type: d.type, damageType });
  }
  return out;
}

export function activeAttacks(sheet: CharacterSheet): AttackEntry[] {
  return sheet.attacks.filter(attackIsActive);
}
