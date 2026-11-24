import type { AutomationDef } from '../domain/automation';
import type { FeatureChoice } from '../domain/feature';

/** Типизированный хук урона: фича реагирует на урон указанного типа. */
export interface DamageTypeHook {
  /** Ключ фичи/фита. */
  key: string;
  /** Тип урона. */
  damageType: string;
  /** Не чаще раза в ход. */
  oncePerTurn?: boolean;
}

/** Реестр хуков урона (Fueled Spellfire и подобные). */
export const DAMAGE_TYPE_HOOKS: DamageTypeHook[] = [
  { key: 'FRHoF:spellfireAdept', damageType: 'radiant', oncePerTurn: true },
];

/** Хуки выбранных фич под указанные типы урона. */
export function damageTypeHooksFor(
  choices: readonly FeatureChoice[] | undefined,
  damageTypes: readonly string[]
): DamageTypeHook[] {
  const chosen = new Set((choices ?? []).filter((c) => c.kind === 'feat').map((c) => c.key));
  const types = new Set(damageTypes);
  return DAMAGE_TYPE_HOOKS.filter((hook) => chosen.has(hook.key) && types.has(hook.damageType));
}

/** Все литеральные типы урона в автоматизации (включая составной урон/всплеск/зону). */
export function automationDamageTypes(def: AutomationDef): string[] {
  const out = new Set<string>();
  const walk = (value: unknown, depth: number): void => {
    if (depth > 6 || !value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1);
      return;
    }
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'types' && Array.isArray(item)) {
        for (const type of item) if (typeof type === 'string') out.add(type);
        continue;
      }
      walk(item, depth + 1);
    }
  };
  walk(def.damage, 0);
  walk(def.successDamage, 0);
  walk(def.burst, 0);
  walk(def.zone, 0);
  walk(def.weaponAttack, 0);
  return [...out];
}
