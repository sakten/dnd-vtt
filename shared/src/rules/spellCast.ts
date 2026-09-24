import type { ActionCost, AreaSpec } from '../domain/actions';
import { abilityMod, type AbilityKey } from '../domain/core';
import type { CharacterSheet, ClassLevel, PlayerResources } from '../domain/sheet';
import type { Spell } from './spells';
import { clampLevel } from './classes';
import { FEAT_CAST_PREFIX } from './feats';
import { sheetProficiencyBonus, spellcastingAbility } from './spellLimits';

/**
 * Чистые правила накладывания заклинаний (Ф6): время/слот действия, скейл
 * кантрипов и апкаст, дистанция, ячейки и боевые характеристики кастера.
 */

/** Слот действия по времени накладывания заклинания. */
export function spellActionCost(spell: Spell): ActionCost {
  const unit = spell.time[0]?.unit;
  if (unit === 'action') return 'action';
  if (unit === 'bonus') return 'bonus';
  if (unit === 'reaction') return 'reaction';
  return 'special';
}

export function isCantrip(spell: Spell): boolean {
  return spell.level === 0;
}

export function isHealingSpell(spell: Spell): boolean {
  return spell.healing === true;
}

/** Суммарный уровень персонажа (для скейла кантрипов 5/11/17). */
export function characterLevel(classes: ClassLevel[]): number {
  return classes.reduce((acc, c) => acc + clampLevel(c.level), 0);
}

/** Скейл апкаста на круге: ступени (`tiers`) либо линейный (шаг `every`). */
export interface SpellUpcastAt {
  dice?: string;
  attack?: number;
  flat?: number;
  targets?: number;
}

/**
 * Числовой апкаст заклинания (данные, без разбора текста в рантайме):
 * линейный — `dice`/`attack`/`targets` за каждые `every` кругов выше `above`,
 * ступени — значения с ближайшего достигнутого круга.
 */
export function spellUpcastAt(spell: Spell, castLevel: number): SpellUpcastAt {
  const up = spell.upcast;
  if (!up) return {};
  if (up.tiers?.length) {
    const tier = [...up.tiers].filter((t) => castLevel >= t.level).pop();
    if (!tier) return {};
    return {
      ...(tier.dice ? { dice: tier.dice } : {}),
      ...(tier.attack !== undefined ? { attack: tier.attack } : {}),
    };
  }
  if (up.above === undefined || castLevel <= up.above) return {};
  const steps = Math.floor((castLevel - up.above) / Math.max(1, up.every ?? 1));
  if (steps <= 0) return {};
  return {
    ...(up.dice ? { dice: Array.from({ length: steps }, () => up.dice!).join(' + ') } : {}),
    ...(up.attack ? { attack: up.attack * steps } : {}),
    ...(up.flat ? { flat: up.flat * steps } : {}),
    ...(up.targets ? { targets: up.targets * steps } : {}),
  };
}

/** Кость кантрипа по уровню персонажа (5/11/17) — из данных `cantrip`. */
export function spellCantripDice(spell: Spell, characterLvl: number): string | undefined {
  const tiers = spell.cantrip;
  if (!tiers?.length) return undefined;
  let dice: string | undefined;
  for (const tier of tiers) {
    if (characterLvl >= tier.level) dice = tier.dice;
  }
  return dice;
}

/** Доп. кости апкаста: числа из `upcast` (выражение добавки `1d6` / `1d6 + 1d6`). */
export function spellUpcastDice(spell: Spell, castLevel: number): string | undefined {
  return spell.upcast ? spellUpcastAt(spell, castLevel).dice : undefined;
}

/**
 * Выражение урона/лечения заклинания с учётом круга накладывания и уровня
 * персонажа (кантрипы). null — если костей нет (manual-заклинание).
 */
export function spellDamageExpression(spell: Spell, castLevel: number, characterLvl: number): string | null {
  const base = spell.damage?.dice?.[0]?.trim();
  if (!base) return null;
  if (spell.level === 0) return spellCantripDice(spell, characterLvl) ?? base;
  if (castLevel > spell.level) {
    // Ступени (Shadow Blade/Elemental Weapon): кость ступени заменяет базовую, а не добавляется.
    if (spell.upcast?.tiers?.length) return spellUpcastAt(spell, castLevel).dice ?? base;
    const extra = spellUpcastDice(spell, castLevel);
    if (extra) return `${base} + ${extra}`;
  }
  return base;
}

/** Заклинание накладывается на себя (5e.tools: `type:'self'` либо `distance.type:'self'`). */
export function spellIsSelf(spell: Spell): boolean {
  return spell.range.type === 'self' || spell.range.distance?.type === 'self';
}

/** Дистанция заклинания в футах; null — без ограничения (special/unlimited). */
export function spellRangeFeet(spell: Spell): number | null {
  const distance = spell.range.distance;
  if (spellIsSelf(spell)) return 0;
  if (!distance) return null;
  const amount = distance.amount ?? 0;
  switch (distance.type) {
    case 'feet':
      return amount;
    case 'touch':
      return 5;
    case 'miles':
      return amount * 5280;
    default:
      return null;
  }
}

/**
 * Смайты (XPHB 2024): кастуются бонусным действием после попадания оружием,
 * в данных `range: self`, но цель выбирается кликом по существу в досягаемости.
 */
export const SMITE_SPELLS = new Set([
  'XPHB:Searing Smite',
  'XPHB:Ensnaring Strike',
  'XPHB:Divine Smite',
  'XPHB:Thunderous Smite',
  'XPHB:Wrathful Smite',
  'XPHB:Blinding Smite',
  'XPHB:Shining Smite',
  'XPHB:Staggering Smite',
  'XPHB:Banishing Smite',
  'XPHB:Hail of Thorns',
  'XPHB:Lightning Arrow',
]);

/** Вид оружия, после попадания которым доступен смайт (по описанию заклинания). */
export const SMITE_RANGE: Record<string, 'melee' | 'ranged'> = {
  'XPHB:Searing Smite': 'melee',
  'XPHB:Ensnaring Strike': 'ranged',
  'XPHB:Divine Smite': 'melee',
  'XPHB:Thunderous Smite': 'melee',
  'XPHB:Wrathful Smite': 'melee',
  'XPHB:Blinding Smite': 'melee',
  'XPHB:Shining Smite': 'melee',
  'XPHB:Staggering Smite': 'melee',
  'XPHB:Banishing Smite': 'melee',
  'XPHB:Hail of Thorns': 'ranged',
  'XPHB:Lightning Arrow': 'ranged',
};

/** Смайты, применяемые и после промаха (Lightning Arrow: «после попадания или промаха»). */
export const SMITE_ON_MISS = new Set(['XPHB:Lightning Arrow']);

/**
 * Лимит «1 минута» = 10 раундов (решение владельца): заклинания с длительностью
 * ровно 1 минута гаснут через 10 раундов, даже если эффект не снят спасом или
 * концентрацией. Длительности больше минуты (10 минут/час/сутки) не лимитируются.
 */
export function spellMaxRounds(spell: Spell): number | undefined {
  const timed = spell.duration.find((d) => d.type === 'timed' && d.duration?.type === 'minute');
  return timed?.duration?.amount === 1 ? 10 : undefined;
}

/** Цель по умолчанию: self или существо. Эманация (2024) исходит от кастера — тоже self. */
export function spellTargetKind(spell: Spell): 'self' | 'creature' {
  // True Strike (XPHB): в данных range self, но каст бьёт по выбранной цели — клик по существу.
  if (spell.key === 'XPHB:True Strike') return 'creature';
  // Magic Stone (XGE): каст на себя (камни в руке), бросок — грантованым действием.
  if (spell.key === 'XGE:Magic Stone') return 'self';
  return spellIsSelf(spell) || spell.range.type === 'emanation' ? 'self' : 'creature';
}

/**
 * Число атак/снарядов заклинания (Scorching Ray, Eldritch Blast, Magic Missile):
 * база — `attacks`, апкаст — `upcast.attacks`, уровни персонажа — тиры `cantrip.count`.
 * Только числа из данных, без разбора текста.
 */
export function spellAttackCount(spell: Spell, castLevel: number, characterLvl: number): number {
  const base = spell.attacks ?? 1;
  if (spell.level === 0) {
    let count = base;
    for (const tier of spell.cantrip ?? []) {
      if (tier.count && characterLvl >= tier.level) count = tier.count;
    }
    return Math.max(1, count);
  }
  const up = spell.upcast;
  if (up?.attacks && up.above !== undefined) {
    const steps = Math.floor((castLevel - up.above) / Math.max(1, up.every ?? 1));
    if (steps > 0) return Math.max(1, base + up.attacks * steps);
  }
  return Math.max(1, base);
}

/**
 * Дополнительные цели за круг выше базового: из `upcast.targets` (числа в данных).
 * 0 — заклинание не расширяет число целей апкастом.
 */
export function spellExtraTargets(spell: Spell, castLevel: number): number {
  return spell.upcast?.targets ? spellUpcastAt(spell, castLevel).targets ?? 0 : 0;
}

const AOE_TAGS = new Set(['S', 'C', 'L', 'N', 'Q', 'R', 'Y']);

/**
 * Заклинания, у которых `areaSpec` относится к выданному действию, а не к касту
 * (Dragon's Breath: касание + действие-выдох) — каст целится в существо.
 */
const GRANTED_ACTION_AREA = new Set(["XPHB:Dragon's Breath"]);

/** Заклинания-зоны без спасброска: прицел нужен для точки (Daylight). */
const POINT_ZONE_SPELLS = new Set(['XPHB:Daylight']);

/**
 * Wall of Thorns (XPHB): варианты формы стены — вертикальная/горизонтальная
 * линия 60×5 или круг: внутри свободно 10 фт от центра, стена 5 фт наружу
 * (кольцо `inner` 10, внешний радиус 15).
 */
export function wallOfThornsArea(variant?: string): AreaSpec {
  if (variant === 'ring') return { shape: 'ring', size: 15, inner: 10 };
  return { shape: 'line', size: 60, width: 5 };
}

/** Направление-заготовка линии стены (вертикальная/горизонтальная ось); null — не стена/круг. */
export function spellCastDirection(
  spellKey: string,
  variant: string | undefined,
  origin: { x: number; y: number }
): { x: number; y: number } | null {
  if (spellKey !== 'XPHB:Wall of Thorns' || variant === 'ring') return null;
  return variant === 'horizontal' ? { x: origin.x + 100, y: origin.y } : { x: origin.x, y: origin.y + 100 };
}

/** Область применения каста, отличная от данных (Call Lightning: удар 5 фт, туча — отдельно). */
const CAST_AREA_OVERRIDES: Record<string, AreaSpec> = {
  'XPHB:Call Lightning': { shape: 'sphere', size: 5 },
};

/** Только явный оверрайд области каста (Call Lightning); прицел клиента предпочитает геометрию зоны. */
export function spellCastAreaOverride(spell: Spell): AreaSpec | undefined {
  return CAST_AREA_OVERRIDES[spell.key];
}

/** Область применения каста: вариант (Wall of Thorns), оверрайд, иначе данные заклинания. */
export function spellCastArea(spell: Spell, variant?: string): AreaSpec | undefined {
  if (spell.key === 'XPHB:Wall of Thorns') return wallOfThornsArea(variant);
  return CAST_AREA_OVERRIDES[spell.key] ?? spell.areaSpec;
}

/** Доступен ли режим области: есть геометрия, спасбросок и AoE-тег (или эманация/зона от точки). */
export function spellHasArea(spell: Spell): boolean {
  if (GRANTED_ACTION_AREA.has(spell.key)) return false;
  if (CAST_AREA_OVERRIDES[spell.key]) return true;
  // Wall of Thorns: геометрия приходит из варианта формы (`spellCastArea`).
  if (spell.key === 'XPHB:Wall of Thorns') return true;
  if (!spell.areaSpec) return false;
  if (POINT_ZONE_SPELLS.has(spell.key)) return true;
  if ((spell.save?.length ?? 0) === 0) return false;
  if (spell.range.type === 'emanation') return true;
  return (spell.area ?? []).some((t) => AOE_TAGS.has(t));
}

/** Область исходит от кастера (конус/линия/куб/эманация) или от выбранной точки. */
export function spellAreaOrigin(spell: Spell): 'self' | 'point' {
  if (
    spell.range.type === 'cone' ||
    spell.range.type === 'line' ||
    spell.range.type === 'cube' ||
    spell.range.type === 'emanation'
  ) {
    return 'self';
  }
  return spellIsSelf(spell) ? 'self' : 'point';
}

/** Максимальный круг ячейки из списка (0 — нет подходящей). */
export function maxCastableFromSlots(
  spell: Spell,
  slots: { level: number; current: number }[] | undefined
): number {
  if (spell.level === 0) return 0;
  let max = 0;
  for (const slot of slots ?? []) {
    if (slot.current > 0 && slot.level >= spell.level) max = Math.max(max, slot.level);
  }
  return max;
}

/**
 * Круги ячеек, которыми заклинание реально можно наложить (`current > 0`), по
 * возрастанию. Пустые промежуточные круги не попадают. Без настроенных ячеек
 * (ни ресурсов, ни статблока) — базовый круг заклинания.
 */
export function castableLevels(
  spell: Spell,
  resources: PlayerResources | null,
  monsterSlots?: { level: number; current: number }[]
): number[] {
  if (spell.level === 0) return [];
  const levels = new Set<number>();
  const fromSlots = (slots?: { level: number; current: number }[]) => {
    for (const slot of slots ?? []) {
      if (slot.current > 0 && slot.level >= spell.level) levels.add(slot.level);
    }
  };
  if (resources) {
    fromSlots(resources.spellSlots);
    if (resources.pact.current > 0 && resources.pact.level >= spell.level) levels.add(resources.pact.level);
  } else if (monsterSlots) {
    fromSlots(monsterSlots);
  } else {
    return [spell.level];
  }
  return [...levels].sort((a, b) => a - b);
}

/**
 * Максимальный доступный круг ячейки под заклинание (0 — кантрип/нет ячеек).
 * У персонажа — `resources` (обычные + пакт), у монстра — `monsterSlots` статблока;
 * без настроенных ячеек монстра каст не ограничиваем (DM ведёт вручную).
 */
export function maxCastableLevel(
  spell: Spell,
  resources: PlayerResources | null,
  monsterSlots?: { level: number; current: number }[]
): number {
  if (spell.level === 0) return 0;
  const levels = castableLevels(spell, resources, monsterSlots);
  return levels.length ? Math.max(...levels) : 0;
}

export interface SpellStats {
  ability: AbilityKey;
  mod: number;
  dc: number;
  attack: number;
}

/** Боевые характеристики кастера для класса заклинания (DC, атака); `feat:*` — заклинания фитов. */
export function casterStats(sheet: CharacterSheet, className: string): SpellStats | null {
  const entry = sheet.classes.find((c) => c.className === className);
  const featKey = className.startsWith(FEAT_CAST_PREFIX) ? className.slice(FEAT_CAST_PREFIX.length) : null;
  const feat = featKey ? sheet.choices?.find((c) => c.kind === 'feat' && c.key === featKey) : undefined;
  const ability = feat ? (feat.ability ?? 'int') : spellcastingAbility(className, entry?.subclass);
  if (!ability) return null;
  const proficiency = sheetProficiencyBonus(sheet);
  const mod = abilityMod(sheet.abilities[ability] ?? 10);
  return { ability, mod, dc: 8 + proficiency + mod, attack: proficiency + mod };
}
