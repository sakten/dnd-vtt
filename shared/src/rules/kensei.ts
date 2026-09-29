import type { ClassLevel, SheetHands } from '../domain/sheet';
import type { AttackEntry } from '../domain/token';
import { handAttackOf } from './hands';
import { weaponByKey, type WeaponDef } from './weapons';

/**
 * Кэнсэй-монах (XGE): кэнсэй-оружием считается оружие в основной (правой) руке,
 * допустимое по RAW — simple/martial без heavy/special (longbow разрешён явно).
 * Решение владельца: без отдельного выбора оружия на листе.
 */

/** Уровень монаха-кэнсэя (0 — не кэнсэй). */
export function kenseiMonkLevel(classes: ClassLevel[] | undefined): number {
  const entry = classes?.find((c) => c.className === 'monk');
  return entry && entry.subclass === 'kensei' ? Math.max(1, entry.level) : 0;
}

/** Допустимо ли оружие как кэнсэй-оружие: simple/martial без heavy/special; longbow — исключение. */
export function isKenseiWeaponKey(key: string | undefined): boolean {
  if (!key) return false;
  if (key === 'XPHB:Longbow') return true;
  const weapon = weaponByKey(key);
  if (!weapon || weapon.unarmed) return false;
  return !weapon.properties.includes('H') && !weapon.properties.includes('S');
}

export interface KenseiActor {
  attacks?: AttackEntry[];
  hands?: SheetHands;
  classes?: ClassLevel[];
}

/** Ключ кэнсэй-оружия в основной руке; undefined — кэнсэя нет или рука не подходит. */
export function kenseiWeaponKeyOf(actor: KenseiActor): string | undefined {
  if (kenseiMonkLevel(actor.classes) < 3) return undefined;
  const right = handAttackOf(actor.attacks, actor.hands, 'right');
  if (!right?.weaponKey) return undefined;
  return isKenseiWeaponKey(right.weaponKey) ? right.weaponKey : undefined;
}

/** Кэнсэй-оружие основной руки как запись справочника (для свойств и дистанции). */
export function kenseiWeaponDefOf(actor: KenseiActor): WeaponDef | undefined {
  const key = kenseiWeaponKeyOf(actor);
  return key ? weaponByKey(key) : undefined;
}

/** Атака выполнена кэнсэй-оружием основной руки. */
export function isKenseiAttack(actor: KenseiActor, attack: AttackEntry | undefined): boolean {
  const key = kenseiWeaponKeyOf(actor);
  return !!key && attack?.weaponKey === key;
}
