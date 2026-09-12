import type { ClassLevel } from '../types';
import raw from '../data/subclassSpells.json';
import { maxSpellLevel } from './spellLimits';

/**
 * Выдаваемые заклинания классов/подклассов (домены, клятвы, патроны, классовые).
 * Данные сгенерированы `scripts/build-spells.ts` → `shared/src/data/subclassSpells.json`.
 * `granted` — всегда подготовлены (не считаются в лимит); `pool` — добавляются в выбор.
 */

export interface SpellGrant {
  key: string;
  className: string;
  level: number;
}

interface RawGrant {
  key: string;
  level: number;
}

interface GrantData {
  classes: Record<string, RawGrant[]>;
  subclasses: Record<string, { granted: RawGrant[]; pool: RawGrant[] }>;
}

const DATA = raw as unknown as GrantData;

function collect(classes: ClassLevel[], pick: (className: string, subclass: string | undefined) => RawGrant[]): SpellGrant[] {
  const out: SpellGrant[] = [];
  const seen = new Set<string>();
  for (const entry of classes) {
    const maxLevel = maxSpellLevel(entry.className, entry.level, entry.subclass);
    for (const grant of pick(entry.className, entry.subclass)) {
      if (grant.level > maxLevel) continue;
      const dedupe = `${entry.className}:${grant.key}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      out.push({ key: grant.key, className: entry.className, level: grant.level });
    }
  }
  return out;
}

/** Выдаваемые (всегда подготовленные) заклинания для классов/подклассов листа. */
export function grantedSpells(classes: ClassLevel[]): SpellGrant[] {
  return collect(classes, (className, subclass) => [
    ...(DATA.classes[className] ?? []),
    ...(subclass ? DATA.subclasses[`${className}.${subclass}`]?.granted ?? [] : []),
  ]);
}

/** Заклинания, добавляемые в пул выбора (expanded-списки). */
export function poolSpells(classes: ClassLevel[]): SpellGrant[] {
  return collect(classes, (className, subclass) =>
    subclass ? DATA.subclasses[`${className}.${subclass}`]?.pool ?? [] : []
  );
}
