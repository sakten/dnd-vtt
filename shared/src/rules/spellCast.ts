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

/** Дополнительные кости апкаста: сколько раз повторить кость из описания. */
function upcastDice(spell: Spell, castLevel: number): string | null {
  const text = (spell.higherLevel ?? []).join(' ');
  const match = text.match(/increases? by ([0-9][0-9d+\s]*) for each (?:spell )?slot level above (\d+)/i);
  if (!match) return null;
  const per = match[1]?.trim().split(';')[0]?.trim();
  const above = Number(match[2]);
  if (!per || !Number.isFinite(above)) return null;
  const extra = castLevel - above;
  if (extra <= 0) return null;
  return Array.from({ length: extra }, () => per).join(' + ');
}

/** Кость кантрипа по уровню персонажа: 5/11/17 (из текста higherLevel). */
function cantripDice(spell: Spell, base: string, level: number): string {
  if (level < 5) return base;
  const text = (spell.higherLevel ?? []).join(' ');
  const match = text.match(
    /\b5\b[^()\d]*\(([^)]+)\)[^()\d]*\b11\b[^()\d]*\(([^)]+)\)(?:[^()\d]*\b17\b[^()\d]*\(([^)]+)\))?/i
  );
  if (!match) return base;
  const at11 = match[2]?.trim();
  const at17 = match[3]?.trim();
  if (level >= 17) return at17 || at11 || base;
  if (level >= 11) return at11 || base;
  return match[1]?.trim() || base;
}

/**
 * Выражение урона/лечения заклинания с учётом круга накладывания и уровня
 * персонажа (кантрипы). null — если костей нет (manual-заклинание).
 */
export function spellDamageExpression(spell: Spell, castLevel: number, characterLvl: number): string | null {
  const base = spell.damage?.dice?.[0]?.trim();
  if (!base) return null;
  if (spell.level === 0) return cantripDice(spell, base, characterLvl);
  if (castLevel > spell.level) {
    const extra = upcastDice(spell, castLevel);
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

/** Цель по умолчанию: self или существо. */
export function spellTargetKind(spell: Spell): 'self' | 'creature' {
  return spellIsSelf(spell) ? 'self' : 'creature';
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function parseCount(token: string): number {
  const n = Number(token);
  return Number.isFinite(n) ? n : NUMBER_WORDS[token.toLowerCase()] ?? 0;
}

/**
 * Число атак/снарядов заклинания (Scorching Ray, Eldritch Blast, Magic Missile).
 * База — из текста («three rays»), апкаст/уровень персонажа — из `higherLevel`.
 */
export function spellAttackCount(spell: Spell, castLevel: number, characterLvl: number): number {
  const text = (spell.description ?? []).join(' ');
  const higher = (spell.higherLevel ?? []).join(' ');
  let count = 1;

  const base = text.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b\s+(?:fiery\s+|glowing\s+|magical\s+)?(?:rays?|beams?|darts?|bolts?|projectiles?)/i
  );
  if (base) count = Math.max(count, parseCount(base[1] ?? ''));

  const upcast = higher.match(
    /creates?\s+(?:one|1|\d+)\s+(?:additional|more)\s+(?:fiery\s+|glowing\s+|magical\s+)?(?:ray|beam|dart|bolt|projectile)\s+for each\s+(?:spell\s+)?slot level above\s+(\d+)/i
  );
  if (upcast) count += Math.max(0, castLevel - Number(upcast[1]));

  if (spell.level === 0) {
    for (const tier of higher.matchAll(
      /\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:beams?|rays?|darts?|bolts?|projectiles?)\s+(?:at\s+)?level\s+(\d+)/gi
    )) {
      if (characterLvl >= Number(tier[2])) count = Math.max(count, parseCount(tier[1] ?? ''));
    }
  }

  return Math.max(1, count);
}

/**
 * Дополнительные цели за круг выше базового: «one additional creature/Humanoid/
 * Beast/Undead for each spell slot level above N» (Hold Person, Bless, Bane).
 * 0 — заклинание не расширяет число целей апкастом.
 */
export function spellExtraTargets(spell: Spell, castLevel: number): number {
  const text = [...(spell.higherLevel ?? []), ...(spell.description ?? [])].join(' ');
  const match = text.match(
    /(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+additional\s+(?:willing\s+)?(?:creatures?|humanoids?|beasts?|undead)\s+for\s+each\s+(?:spell\s+)?slot level above\s+(\d+)/i
  );
  if (!match) return 0;
  const per = parseCount(match[1] ?? '');
  const above = Number(match[2]);
  if (!per || !Number.isFinite(above)) return 0;
  return Math.max(0, castLevel - above) * per;
}

const AOE_TAGS = new Set(['S', 'C', 'L', 'N', 'Q', 'R', 'Y']);

/**
 * Заклинания, у которых `areaSpec` относится к выданному действию, а не к касту
 * (Dragon's Breath: касание + действие-выдох) — каст целится в существо.
 */
const GRANTED_ACTION_AREA = new Set(["XPHB:Dragon's Breath"]);

/** Заклинания-зоны без спасброска: прицел нужен для точки (Daylight). */
const POINT_ZONE_SPELLS = new Set(['XPHB:Daylight']);

/** Область применения каста, отличная от данных (Call Lightning: удар 5 фт, туча — отдельно). */
const CAST_AREA_OVERRIDES: Record<string, AreaSpec> = {
  'XPHB:Call Lightning': { shape: 'sphere', size: 5 },
};

/** Только явный оверрайд области каста (клиентский прицел предпочитает геометрию зоны). */
export function spellCastAreaOverride(spell: Spell): AreaSpec | undefined {
  return CAST_AREA_OVERRIDES[spell.key];
}

/** Область применения каста: оверрайд, иначе данные заклинания. */
export function spellCastArea(spell: Spell): AreaSpec | undefined {
  return CAST_AREA_OVERRIDES[spell.key] ?? spell.areaSpec;
}

/** Доступен ли режим области: есть геометрия, спасбросок и AoE-тег (или эманация/зона от точки). */
export function spellHasArea(spell: Spell): boolean {
  if (GRANTED_ACTION_AREA.has(spell.key)) return false;
  if (CAST_AREA_OVERRIDES[spell.key]) return true;
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
