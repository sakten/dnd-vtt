import type { ClassLevel } from '../domain/sheet';
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
  /** Уровень класса, с которого доступна выдача (Haste у Circle of the Symbiote — с 6-го). */
  classLevel?: number;
}

interface GrantData {
  classes: Record<string, RawGrant[]>;
  subclasses: Record<string, { granted: RawGrant[]; pool: RawGrant[] }>;
}

/**
 * Ручные выдачи third-party подклассов (CBT): круговые заклинания Circle of the
 * Symbiote и Haste от Symbiotic Reflexes. Уровень в записи — круг заклинания;
 * `collect` отсекает записи выше доступного классу круга.
 */
const CBT_GRANTS: GrantData = {
  classes: {},
  subclasses: {
    'druid.symbiote': {
      granted: [
        { key: 'XPHB:Guidance', level: 0 },
        { key: 'XPHB:Entangle', level: 1 },
        { key: 'XPHB:Barkskin', level: 2 },
        { key: 'XPHB:Plant Growth', level: 3 },
        { key: 'XPHB:Hallucinatory Terrain', level: 4 },
        { key: 'XPHB:Tree Stride', level: 5 },
        { key: 'XPHB:Haste', level: 3, classLevel: 6 },
      ],
      pool: [],
    },
  },
};
function mergeGrants(base: GrantData, extra: GrantData): GrantData {
  const classes: GrantData['classes'] = { ...base.classes };
  for (const [key, list] of Object.entries(extra.classes)) {
    classes[key] = [...(classes[key] ?? []), ...list];
  }
  const subclasses: GrantData['subclasses'] = { ...base.subclasses };
  for (const [key, grants] of Object.entries(extra.subclasses)) {
    const prev = subclasses[key];
    subclasses[key] = {
      granted: [...(prev?.granted ?? []), ...grants.granted],
      pool: [...(prev?.pool ?? []), ...grants.pool],
    };
  }
  return { classes, subclasses };
}
const DATA = mergeGrants(raw as unknown as GrantData, CBT_GRANTS);

function collect(classes: ClassLevel[], pick: (className: string, subclass: string | undefined) => RawGrant[]): SpellGrant[] {
  const out: SpellGrant[] = [];
  const seen = new Set<string>();
  for (const entry of classes) {
    const maxLevel = maxSpellLevel(entry.className, entry.level, entry.subclass);
    for (const grant of pick(entry.className, entry.subclass)) {
      if (grant.level > maxLevel) continue;
      if (grant.classLevel !== undefined && grant.classLevel > entry.level) continue;
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
