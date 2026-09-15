import raw from '../data/weapons.json';
import { abilityMod, type AbilityKey } from '../domain/core';
import type { FeatureChoice } from '../domain/feature';
import type { ClassLevel } from '../domain/sheet';
import type { AttackEntry } from '../domain/token';
import { martialArtsDie, proficiencyBonus } from './classes';

/**
 * Справочник оружия 5e.tools (`npm run weapons`): кость урона, свойства и
 * мастерства (Vex/Nick и т.п. — данные на будущее, механика не реализована).
 */
export interface WeaponDef {
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

interface WeaponData {
  attribution: string;
  count: number;
  weapons: WeaponDef[];
}

const data = raw as unknown as WeaponData;

export const WEAPONS: WeaponDef[] = data.weapons;

export function weaponByKey(key: string): WeaponDef | undefined {
  return WEAPONS.find((weapon) => weapon.key === key);
}

/** Явный безоружный удар (kind или имя). */
export function isUnarmedAttack(attack: AttackEntry): boolean {
  return attack.kind === 'unarmed' || /unarmed|безоруж/i.test(attack.name);
}

/** Явный безоружный удар из листа/токена — переопределяет расчётный. */
export function findUnarmedAttack(attacks: AttackEntry[] | undefined): AttackEntry | undefined {
  return (attacks ?? []).find(isUnarmedAttack);
}

/** Безоружный удар: явная атака из листа переопределяет расчётную (у монаха — кость боевых искусств). */
export function unarmedStrikeEntry(explicit: AttackEntry | undefined, ctx: WeaponContext): AttackEntry {
  if (explicit && (explicit.hit.trim() || explicit.damage.trim())) return explicit;
  const weapon = WEAPONS.find((w) => w.unarmed);
  if (!weapon) {
    const mod = abilityMod(ctx.abilities.str ?? 10);
    return {
      name: 'Безоружный удар',
      hit: hitExpression(mod),
      damage: `${Math.max(1, 1 + mod)}`,
      damageType: 'bludgeoning',
      rangeType: 'melee',
      rangeNormal: 5,
      rangeLong: 0,
    };
  }
  const base = { ...weaponAttackEntry(weapon, ctx), name: 'Безоружный удар' };
  // Tavern Brawler: безоружный удар бьёт d4 + Сила (у монаха остаётся кость боевых искусств).
  const brawler = (ctx.choices ?? []).some((c) => c.kind === 'feat' && c.key === 'XPHB:tavernBrawler');
  const monk = ctx.classes.some((c) => c.className === 'monk' && c.level > 0);
  if (!brawler || monk) return base;
  return { ...base, kind: 'unarmed', damage: damageExpression('1d4', abilityMod(ctx.abilities.str ?? 10)) };
}

export interface WeaponContext {
  abilities: Partial<Record<AbilityKey, number>>;
  classes: ClassLevel[];
  /** Выборы персонажа: фиты вроде Tavern Brawler меняют расчёт безоружного удара. */
  choices?: FeatureChoice[];
}

function hitExpression(bonus: number): string {
  return bonus >= 0 ? `d20+${bonus}` : `d20${bonus}`;
}

function damageExpression(dice: string, mod: number): string {
  if (!mod) return dice;
  return `${dice}${mod > 0 ? `+${mod}` : `${mod}`}`;
}

/**
 * Заготовка атаки из оружия: попадание/урон по характеристикам листа
 * (дальнее и фехтовальное — Ловкость или лучшая, иначе Сила; безоружный удар
 * у монаха — Ловкость и кость боевых искусств).
 */
export function weaponAttackEntry(weapon: WeaponDef, ctx: WeaponContext): AttackEntry {
  const totalLevel = ctx.classes.reduce((acc, entry) => acc + Math.max(1, entry.level), 0);
  const pb = proficiencyBonus(totalLevel || 1);
  const str = abilityMod(ctx.abilities.str ?? 10);
  const dex = abilityMod(ctx.abilities.dex ?? 10);

  if (weapon.unarmed) {
    const monkLevel = ctx.classes.find((c) => c.className === 'monk')?.level ?? 0;
    const mod = monkLevel > 0 ? dex : str;
    const dice = monkLevel > 0 ? `1d${martialArtsDie(monkLevel)}` : weapon.damage;
    return {
      name: weapon.name,
      kind: 'unarmed',
      hit: hitExpression(pb + mod),
      damage: damageExpression(dice, mod),
      damageType: weapon.damageType,
      rangeType: 'melee',
      rangeNormal: weapon.rangeNormal,
      rangeLong: 0,
    };
  }

  const mod =
    weapon.rangeType === 'ranged' ? dex : weapon.properties.includes('F') ? Math.max(str, dex) : str;
  return {
    name: weapon.name,
    hit: hitExpression(pb + mod),
    damage: damageExpression(weapon.damage, mod),
    damageType: weapon.damageType,
    rangeType: weapon.rangeType,
    rangeNormal: weapon.rangeNormal,
    rangeLong: weapon.rangeLong,
  };
}
