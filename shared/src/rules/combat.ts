import type { ErrorPayload } from '../domain/chat';
import { abilityMod, type AbilityKey } from '../domain/core';
import type { ConditionInstance } from '../domain/effects';
import type { ClassLevel } from '../domain/sheet';
import type { AttackEntry, AttackRangeType, Token } from '../domain/token';
import { collectAttackSources, sourcesCounts, sourcesMode } from './attackSources';

/** Помечает нат. d20 преимуществом/помехой: 'd20+5' → 'd20a+5' / 'd20d+5'.
 *  Терпимо к «1d20» и «D20» (иначе режим молча терялся) и к уже стоящей метке. */
export function withAdvantage(expression: string, mode: 'a' | 'd' | null | undefined): string {
  if (mode !== 'a' && mode !== 'd') return expression;
  return expression.replace(/^(1?)d20[ad]?(?![0-9])/i, `$1d20${mode}`);
}

export interface AttackAdvantageInput {
  /** Явный выбор Adv/Dis игрока. */
  explicit?: 'a' | 'd';
  attackerConditions?: ConditionInstance[];
  targetConditions?: ConditionInstance[];
  rangeType?: AttackRangeType;
  /** Принудительная помеха (дистанция/позиция), сверх состояний. */
  forcedDisadvantage?: boolean;
  /** Режим от эффектов (`attackRollParts(...).mode`). */
  effectMode?: 'a' | 'd';
  /** Учитывать состояния цели (по умолчанию — да). */
  includeTarget?: boolean;
  /** Атакующий не видит цель (RAW: помеха). */
  unseenTarget?: boolean;
  /** Цель не видит атакующего (RAW: преимущество; взаимно гасится с помехой). */
  unseenAttacker?: boolean;
}

export interface AttackAdvantageResult {
  advantage: number;
  disadvantage: number;
  mode?: 'a' | 'd';
}

/** Считает преимущества/помехи броска атаки: явный выбор → состояния → цель → эффекты. */
export function countAttackAdvantage(input: AttackAdvantageInput): AttackAdvantageResult {
  const sources = collectAttackSources(input);
  const { advantage, disadvantage } = sourcesCounts(sources);
  return { advantage, disadvantage, mode: sourcesMode(sources) };
}

/**
 * Отображаемое имя атаки: `{prefix} — {name}`, либо просто имя.
 * Стабильный «subject» для структурной метки броска.
 */
export function attackSubject(entry: AttackEntry, prefix?: string): string {
  const name = entry.name.trim() || 'Атака';
  return prefix ? `${prefix} — ${name}` : name;
}

/** Выражения бросков попадания/урона из записи атаки (null — поле пустое). */
/** Токены характеристик и бонуса владения в формулах атак (`d20+str`, `+pb`). */
const ABILITY_TOKENS = /([+-]?)(str|dex|con|int|wis|cha|pb|prof)\b/gi;

/**
 * Подставляет модификаторы характеристик и бонус владения в формулу:
 * `d20+str` → `d20+3`, `d20+pb` → `d20+2`. Неизвестная характеристика — 0.
 * Пробелы удаляются.
 */
export function resolveAbilityMods(
  expression: string,
  abilities?: Partial<Record<AbilityKey, number>>,
  proficiency = 2
): string {
  const compact = expression.replace(/\s+/g, '');
  return compact.replace(ABILITY_TOKENS, (_match, sign: string, key: string) => {
    const token = key.toLowerCase();
    const base =
      token === 'pb' || token === 'prof'
        ? Math.round(proficiency)
        : abilityMod(abilities?.[token as AbilityKey] ?? 10);
    const value = sign === '-' ? -base : base;
    return value >= 0 ? `+${value}` : `${value}`;
  });
}

export function weaponRolls(entry: AttackEntry): { hit: string | null; damage: string | null } {
  const hit = entry.hit.trim();
  const damage = entry.damage.trim();
  return { hit: hit || null, damage: damage || null };
}

/**
 * Выражение броска атаки: «голый» бонус (+5, 5) превращаем в `d20+5`,
 * готовые формулы (`d20+str`, `d20+pb`) не трогаем. Бестиарий хранит только бонус.
 */
export function attackRollExpression(hit: string): string {
  const expr = hit.trim();
  if (!expr) return '';
  if (/\d*d\d/i.test(expr)) return expr;
  return `d20${/^[+-]/.test(expr) ? expr : `+${expr}`}`;
}

export interface AttackRangeResult {
  outOfRange: boolean;
  disadvantage: boolean;
  /** Код причины помехи для структурной метки/i18n. */
  disadvantageCode?: 'adjacent' | 'long';
  disadvantageReason?: string;
  distanceFeet: number;
  /** Структурная причина, почему атаковать нельзя. */
  error?: ErrorPayload;
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
/**
 * Сторона существа — чистая фракция: разные ненейтральные фракции враждебны,
 * `neutral` — фон (не враг и не союзник, в автофильтрах не участвует).
 * `isPlayerToken` к стороне не относится (это признак «персонаж игрока»).
 */
export function hostileTokens(
  a: Pick<Token, 'faction'>,
  b: Pick<Token, 'faction'>
): boolean {
  if (a.faction === 'neutral' || b.faction === 'neutral') return false;
  return a.faction !== b.faction;
}

/** Подходит ли токен фильтру стороны относительно источника (`side`: только враги/союзники). */
export function sideMatches(
  source: Pick<Token, 'faction'>,
  token: Pick<Token, 'faction'>,
  side: 'hostile' | 'ally'
): boolean {
  return side === 'hostile'
    ? hostileTokens(source, token)
    : token.faction === source.faction && token.faction !== 'neutral';
}

/**
 * Минимальная грань d20 для критического попадания (Чемпион: 19 со 3 ур.,
 * 18 с 15 ур.; прочие — только natural 20).
 */
export function critRangeFor(classes: ClassLevel[]): number {
  const champion = classes.find((c) => c.className === 'fighter' && c.subclass === 'champion')?.level ?? 0;
  if (champion >= 15) return 18;
  if (champion >= 3) return 19;
  return 20;
}

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
  adjacentEnemy: boolean,
  reachBonus = 0
): AttackRangeResult {
  const type = attack.rangeType ?? 'none';
  if (type === 'none') return { outOfRange: false, disadvantage: false, distanceFeet };
  if (type === 'melee') {
    const reach = (attack.rangeNormal > 0 ? attack.rangeNormal : 5) + Math.max(0, reachBonus);
    if (distanceFeet > reach) {
      return {
        outOfRange: true,
        disadvantage: false,
        distanceFeet,
        error: { code: 'attackOutOfReach', params: { feet: Math.round(distanceFeet) } },
      };
    }
    return { outOfRange: false, disadvantage: false, distanceFeet };
  }
  const normal = attack.rangeNormal > 0 ? attack.rangeNormal : 0;
  const long = attack.rangeLong > 0 ? attack.rangeLong : 0;
  if (long > 0 && distanceFeet > long) {
    return {
      outOfRange: true,
      disadvantage: false,
      distanceFeet,
      error: { code: 'attackTooFar', params: { feet: Math.round(distanceFeet) } },
    };
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
