import { abilityMod, type AttackEntry, type CharacterSheet } from '../types';

/**
 * Бонус инициативы токена: сначала явный initiativeBonus; иначе — модификатор
 * Ловкости из листа игрока, чьё имя совпадает с именем токена; иначе из листа
 * владельца (создателя). Пустая строка — если листа нет.
 */
export function initiativeBonus(
  token: { name: string; initiativeBonus?: string; ownerId?: string },
  players: { id: string; name: string }[],
  sheets: Record<string, CharacterSheet>
): string {
  const raw = (token.initiativeBonus ?? '').trim();
  if (raw) return raw;
  const byName = players.find((p) => p.name === token.name);
  const sheet = sheets[byName?.id ?? token.ownerId ?? ''];
  if (!sheet) return '';
  const mod = abilityMod(sheet.abilities.dex ?? 10);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/** Помечает нат. d20 преимуществом/помехой: 'd20+5' → 'd20a+5' / 'd20d+5'. */
export function withAdvantage(expression: string, mode: 'a' | 'd' | null | undefined): string {
  if (mode !== 'a' && mode !== 'd') return expression;
  return expression.replace(/^d20(?![0-9])/, `d20${mode}`);
}

export interface WeaponRoll {
  expression: string;
  label: string;
}

/**
 * Отображаемое имя атаки: `{prefix} — {name}`, либо просто имя.
 * Стабильный «subject» для структурной метки броска.
 */
export function attackSubject(entry: AttackEntry, prefix?: string): string {
  const name = entry.name.trim() || 'Атака';
  return prefix ? `${prefix} — ${name}` : name;
}

/**
 * Из записи атаки делает броски попадания/урона. prefix (например, имя токена)
 * добавляется к названию атаки: `Атака: {prefix} — {name}`.
 */
export function weaponRolls(
  entry: AttackEntry,
  prefix?: string
): { hit: WeaponRoll | null; damage: WeaponRoll | null } {
  const full = attackSubject(entry, prefix);
  const hit = entry.hit.trim();
  const damage = entry.damage.trim();
  return {
    hit: hit ? { expression: hit, label: `Атака: ${full}` } : null,
    damage: damage ? { expression: damage, label: `Урон: ${full}` } : null,
  };
}

export interface AttackRangeResult {
  outOfRange: boolean;
  disadvantage: boolean;
  /** Код причины помехи для структурной метки/i18n. */
  disadvantageCode?: 'adjacent' | 'long';
  disadvantageReason?: string;
  distanceFeet: number;
  reason?: string;
}

export interface GridBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Дистанция между токенами по сетке (в футах): от края занятой области до края,
 * по Чебышёву, с учётом размеров. Соседние области (касаются) = 1 клетка (5 фт),
 * через одну пустую клетку = 2 клетки (10 фт) и т.д. Большие токены не «удлиняют»
 * дистанцию — их можно достать вплотную.
 */
export function gridDistanceFeet(a: GridBox, b: GridBox, gridSize: number, feetPerCell = 5): number {
  const gapX = Math.max(0, Math.abs(a.x - b.x) - (a.w + b.w) / 2);
  const gapY = Math.max(0, Math.abs(a.y - b.y) - (a.h + b.h) / 2);
  const gapCells = Math.max(gapX, gapY) / gridSize;
  return (Math.round(gapCells) + 1) * feetPerCell;
}

/**
 * Попадание атаки по AC: нат. 20 — всегда попадание, нат. 1 — промах,
 * иначе сравнение суммы с AC. AC <= 0 — проверки нет (считаем попаданием).
 */
export function resolveAttack(total: number, crit: boolean, fumble: boolean, ac: number): boolean {
  if (ac <= 0) return true;
  if (crit) return true;
  if (fumble) return false;
  return total >= ac;
}

/**
 * Проверка дистанции атаки по правилам D&D:
 * - none — без ограничений;
 * - melee — цель дальше досягаемости → бить нельзя;
 * - ranged — дальше обычной → помеха; дальше дальней → бить нельзя;
 *   враг в соседней клетке (adjacentEnemy) → помеха.
 */
export function attackRange(
  attack: Pick<AttackEntry, 'rangeType' | 'rangeNormal' | 'rangeLong'>,
  distanceFeet: number,
  adjacentEnemy: boolean
): AttackRangeResult {
  const type = attack.rangeType ?? 'none';
  if (type === 'none') return { outOfRange: false, disadvantage: false, distanceFeet };
  if (type === 'melee') {
    const reach = attack.rangeNormal > 0 ? attack.rangeNormal : 5;
    if (distanceFeet > reach) {
      return { outOfRange: true, disadvantage: false, distanceFeet, reason: 'Вне досягаемости' };
    }
    return { outOfRange: false, disadvantage: false, distanceFeet };
  }
  const normal = attack.rangeNormal > 0 ? attack.rangeNormal : 0;
  const long = attack.rangeLong > 0 ? attack.rangeLong : 0;
  if (long > 0 && distanceFeet > long) {
    return { outOfRange: true, disadvantage: false, distanceFeet, reason: 'Слишком далеко' };
  }
  if (adjacentEnemy) {
    return {
      outOfRange: false,
      disadvantage: true,
      disadvantageCode: 'adjacent',
      disadvantageReason: 'враг рядом',
      distanceFeet,
    };
  }
  if (normal > 0 && distanceFeet > normal) {
    return {
      outOfRange: false,
      disadvantage: true,
      disadvantageCode: 'long',
      disadvantageReason: 'дальняя дистанция',
      distanceFeet,
    };
  }
  return { outOfRange: false, disadvantage: false, distanceFeet };
}
