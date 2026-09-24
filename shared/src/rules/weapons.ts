import raw from '../data/weapons.json';
import { abilityMod, type AbilityKey } from '../domain/core';
import type { FeatureChoice } from '../domain/feature';
import type { ClassLevel } from '../domain/sheet';
import type { AttackEntry } from '../domain/token';
import { martialArtsDie, proficiencyBonus } from './classes';
import { d20Expr } from './sheet';

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

/** Есть ли у атаки свойство оружия из справочника (Heavy/Loading/…); без ключа — false. */
export function weaponHasProperty(attack: AttackEntry, code: string): boolean {
  return attack.weaponKey ? !!weaponByKey(attack.weaponKey)?.properties.includes(code) : false;
}

/**
 * Доступ к мастерствам оружия по классу (2024): «Владение оружием» есть у
 * варвара, воина, паладина, следопыта и плута — автоматически, без выбора игроком.
 */
const MASTERY_CLASSES = new Set(['barbarian', 'fighter', 'paladin', 'ranger', 'rogue']);

export function masteryAccessible(classes: ClassLevel[] | undefined): boolean {
  return (classes ?? []).some((c) => MASTERY_CLASSES.has(c.className) && c.level > 0);
}

/** Активное мастерство оружия атаки: класс даёт доступ, оружие — свойство. */
export function weaponMastery(attack: AttackEntry, classes: ClassLevel[] | undefined): string | undefined {
  if (!attack.weaponKey || !masteryAccessible(classes)) return undefined;
  return weaponByKey(attack.weaponKey)?.mastery.find(Boolean);
}

/**
 * Дистанции броска для метательного оружия ближнего боя. Справочник их не несёт
 * (5e.tools для melee отдаёт 5/0), поэтому таблица официальных дистанций 2024.
 */const THROWN_RANGES: Record<string, { normal: number; long: number }> = {
  'XPHB:Dagger': { normal: 20, long: 60 },
  'XPHB:Handaxe': { normal: 20, long: 60 },
  'XPHB:Javelin': { normal: 30, long: 120 },
  'XPHB:Light Hammer': { normal: 20, long: 60 },
  'XPHB:Spear': { normal: 20, long: 60 },
  'XPHB:Trident': { normal: 20, long: 60 },
};

/** Дистанции броска для метательного оружия ближнего боя; undefined — не метательное. */
export function thrownRange(weapon: WeaponDef): { normal: number; long: number } | undefined {
  if (weapon.rangeType !== 'melee' || !weapon.properties.includes('T')) return undefined;
  return THROWN_RANGES[weapon.key];
}

/**
 * Атаки для оружия: обычная, а у метательного ближнего боя — ещё и бросок
 * (отдельная ranged-атака той же формулы: 5/0 в ближнем, например 20/60 броском).
 */
export function weaponAttackEntries(weapon: WeaponDef, ctx: WeaponContext): AttackEntry[] {
  const base = weaponAttackEntry(weapon, ctx);
  const thrown = thrownRange(weapon);
  if (!thrown) return [base];
  return [base, { ...base, rangeType: 'ranged', rangeNormal: thrown.normal, rangeLong: thrown.long }];
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
  return d20Expr(bonus);
}

function damageExpression(dice: string, mod: number): string {
  if (!mod) return dice;
  return `${dice}${mod > 0 ? `+${mod}` : `${mod}`}`;
}

/** Модификатор характеристики, которым считается атака оружием (Graze, урон второй рукой). */
export function weaponAbilityMod(weapon: WeaponDef, ctx: WeaponContext): number {
  const str = abilityMod(ctx.abilities.str ?? 10);
  const dex = abilityMod(ctx.abilities.dex ?? 10);
  if (weapon.unarmed) {
    const monkLevel = ctx.classes.find((c) => c.className === 'monk')?.level ?? 0;
    return monkLevel > 0 ? dex : str;
  }
  return weapon.rangeType === 'ranged' ? dex : weapon.properties.includes('F') ? Math.max(str, dex) : str;
}

/**
 * Заготовка атаки из оружия: попадание/урон по характеристикам листа
 * (дальнее и фехтовальное — Ловкость или лучшая, иначе Сила; безоружный удар
 * у монаха — Ловкость и кость боевых искусств). `offhand` — атака второй рукой
 * (Light/Nick): урон без модификатора, но не выше нуля.
 */
export function weaponAttackEntry(
  weapon: WeaponDef,
  ctx: WeaponContext,
  opts: { offhand?: boolean; grip?: '1h' | '2h' } = {}
): AttackEntry {
  const totalLevel = ctx.classes.reduce((acc, entry) => acc + Math.max(1, entry.level), 0);
  const pb = proficiencyBonus(totalLevel || 1);

  if (weapon.unarmed) {
    const monkLevel = ctx.classes.find((c) => c.className === 'monk')?.level ?? 0;
    const mod = weaponAbilityMod(weapon, ctx);
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
      weaponKey: weapon.key,
    };
  }

  const mod = weaponAbilityMod(weapon, ctx);
  // Универсальное оружие: кость по хвату (`grip`), по умолчанию двуручная;
  // атака второй рукой всегда одноручная.
  const versatile = weapon.properties.includes('V') && !!weapon.versatileDamage;
  const dice = versatile && !opts.offhand && opts.grip !== '1h' ? weapon.versatileDamage! : weapon.damage;
  return {
    name: weapon.name,
    hit: hitExpression(pb + mod),
    damage: damageExpression(dice, opts.offhand ? Math.min(0, mod) : mod),
    damageType: weapon.damageType,
    rangeType: weapon.rangeType,
    rangeNormal: weapon.rangeNormal,
    rangeLong: weapon.rangeLong,
    weaponKey: weapon.key,
  };
}
