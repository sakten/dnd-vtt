import type { SheetHands } from '../domain/sheet';
import type { AttackEntry } from '../domain/token';
import { findUnarmedAttack, unarmedStrikeEntry, weaponByKey, type WeaponContext, type WeaponDef } from './weapons';

/**
 * Оружие в руках персонажа (S1): правая — основная, левая — вторая/щит.
 * `hands` листа хранит id записи атаки или `HANDS_SHIELD`; у двуручного оружия
 * левая рука блокируется. Правила хвата (универсальное) и основная атака —
 * здесь, чтобы клиент и сервер считали одинаково.
 */

export type HandKey = 'right' | 'left';

/** Значение руки-щита в `CharacterSheet.hands`. */
export const HANDS_SHIELD = 'shield';

/** Щит как предмет руки (механику КЗ не даёт — AC вводит игрок). */
export const SHIELD_DEF = { key: 'XPHB:Shield', name: 'Щит', ac: 2 } as const;

export function isTwoHandedAttack(attack: AttackEntry | undefined): boolean {
  return !!attack?.weaponKey && !!weaponByKey(attack.weaponKey)?.properties.includes('2H');
}

export function isVersatileAttack(attack: AttackEntry | undefined): boolean {
  return !!attack?.weaponKey && !!weaponByKey(attack.weaponKey)?.properties.includes('V');
}

/** Запись атаки в руке (щит возвращает undefined). */
export function handAttackOf(
  attacks: AttackEntry[] | undefined,
  hands: SheetHands | undefined,
  hand: HandKey
): AttackEntry | undefined {
  const id = hands?.[hand];
  if (!id || id === HANDS_SHIELD) return undefined;
  return (attacks ?? []).find((attack) => attack.id === id);
}

export function handHoldsShield(hands: SheetHands | undefined, hand: HandKey): boolean {
  return hands?.[hand] === HANDS_SHIELD;
}

/** Рука занята (оружие/щит); двуручное в правой блокирует и левую. */
export function handOccupied(
  attacks: AttackEntry[] | undefined,
  hands: SheetHands | undefined,
  hand: HandKey
): boolean {
  if (hand === 'left' && isTwoHandedAttack(handAttackOf(attacks, hands, 'right'))) return true;
  return !!hands?.[hand];
}

/** Хват универсального оружия в правой руке: левая свободна — двуручный. */
export function rightGrip(attacks: AttackEntry[] | undefined, hands: SheetHands | undefined): '1h' | '2h' {
  const right = handAttackOf(attacks, hands, 'right');
  if (isTwoHandedAttack(right)) return '2h';
  if (isVersatileAttack(right) && !handOccupied(attacks, hands, 'left')) return '2h';
  return '1h';
}

/**
 * Кость универсального оружия под текущий хват: в сохранённой формуле меняем
 * первый терм-кость, не трогая модификаторы (`1d10+1+str` → `1d8+1+str`).
 */
export function gripAdjustedDamage(damage: string, weapon: WeaponDef, grip: '1h' | '2h'): string {
  if (!weapon.properties.includes('V') || !weapon.versatileDamage) return damage;
  const want = grip === '2h' ? weapon.versatileDamage : weapon.damage;
  const other = grip === '2h' ? weapon.damage : weapon.versatileDamage;
  const trimmed = damage.trim();
  if (trimmed === other) return want;
  if (trimmed.startsWith(other) && /^[^0-9a-zа-я]/i.test(trimmed.slice(other.length))) {
    return want + trimmed.slice(other.length);
  }
  return damage;
}

/** Средний урон костей выражения (`2d6` → 7); модификаторы/токены игнорируются. */
export function diceScore(expression: string): number {
  let score = 0;
  for (const match of expression.matchAll(/(\d*)d(\d+)/gi)) {
    const count = match[1] ? Number(match[1]) : 1;
    const sides = Number(match[2]);
    if (Number.isFinite(count) && Number.isFinite(sides)) score += count * ((sides + 1) / 2);
  }
  return score;
}

export interface PrimaryAttack {
  attack: AttackEntry;
  kind: 'weapon' | 'unarmed';
}

/**
 * Основная атака: оружие правой руки или безоружный удар — смотря какая кость
 * больше (монах). Правая пуста/щит — безоружный.
 */
export function primaryHandAttack(
  attacks: AttackEntry[] | undefined,
  hands: SheetHands | undefined,
  ctx: WeaponContext
): PrimaryAttack {
  const list = attacks ?? [];
  const right = handAttackOf(list, hands, 'right');
  const unarmed = unarmedStrikeEntry(findUnarmedAttack(list), ctx);
  if (!right || diceScore(unarmed.damage) > diceScore(right.damage)) {
    return { attack: unarmed, kind: 'unarmed' };
  }
  return { attack: right, kind: 'weapon' };
}

/**
 * Нормализация рук: существующие id атак/щит, не более одного щита, двуручное —
 * только в правой (в левой переносится/сбрасывается), левая сбрасывается при
 * двуручном в правой.
 */
export function normalizeHands(raw: unknown, attacks: AttackEntry[]): SheetHands | undefined {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const validIds = new Set(attacks.map((attack) => attack.id).filter((id): id is string => !!id));
  const resolve = (value: unknown): string | undefined => {
    if (typeof value !== 'string' || !value) return undefined;
    if (value === HANDS_SHIELD) return HANDS_SHIELD;
    return validIds.has(value) ? value : undefined;
  };
  let right = resolve(source.right);
  let left = resolve(source.left);
  const byId = (id: string | undefined) => attacks.find((attack) => attack.id === id);

  if (isTwoHandedAttack(byId(left))) {
    if (!right) {
      right = left;
    }
    left = undefined;
  }
  if (isTwoHandedAttack(byId(right))) left = undefined;
  if (left === right) left = undefined;
  if (left === HANDS_SHIELD && right === HANDS_SHIELD) left = undefined;
  if (!right && !left) return undefined;
  return { ...(right ? { right } : {}), ...(left ? { left } : {}) };
}
