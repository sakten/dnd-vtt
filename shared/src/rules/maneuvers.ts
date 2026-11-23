import type { ActionCost, ActionDef, ActionTargeting } from '../domain/actions';
import type { FeatureChoice } from '../domain/feature';
import type { ClassLevel } from '../domain/sheet';
import type { CharacterSheet } from '../domain/sheet';
import { abilityMod } from '../domain/core';
import { clampLevel, proficiencyBonus } from './classes';
import { characterLevel } from './spellCast';

/**
 * Боевой мастер (XPHB 2024): манёвры и кости превосходства.
 * Каталог — `shared/src/data/maneuvers.json`, ручной слой — `MANEUVERS_META`.
 * Автоматизированы пока Precision Attack, Bait and Switch, Parry, Riposte и
 * Distracting Strike; остальные — ручные кнопки с броском кости в чат.
 */

export const SUPERIORITY_RESOURCE = 'fighter.battleMaster:superiorityDice';
export const KNOW_YOUR_ENEMY_RESOURCE = 'fighter.battleMaster:knowYourEnemy';
export const KNOW_YOUR_ENEMY_ACTION = `class:${KNOW_YOUR_ENEMY_RESOURCE}`;
export const MANEUVER_ACTION_PREFIX = 'class:fighter.battleMaster:maneuver:';

export const MANEUVER_KEYS = {
  baitAndSwitch: 'XPHB:Bait and Switch',
  distractingStrike: 'XPHB:Distracting Strike',
  parry: 'XPHB:Parry',
  precisionAttack: 'XPHB:Precision Attack',
  riposte: 'XPHB:Riposte',
} as const;

export type ManeuverKind = 'hit' | 'miss' | 'reaction' | 'bonus' | 'check' | 'special';

export interface ManeuverMeta {
  /** Ключ каталога (`XPHB:<имя>`). */
  key: string;
  /** Часть id действия: `class:fighter.battleMaster:maneuver:<slug>`. */
  slug: string;
  /** Русское имя (кнопки/чат). */
  name: string;
  kind: ManeuverKind;
  /** Движок ведёт механику (окно/автоматизация); остальные — ручные кнопки. */
  automated?: boolean;
  rangeFeet?: number;
}

export const MANEUVERS_META: ManeuverMeta[] = [
  { key: 'XPHB:Ambush', slug: 'ambush', name: 'Засада', kind: 'check' },
  {
    key: MANEUVER_KEYS.baitAndSwitch,
    slug: 'bait-and-switch',
    name: 'Приманка и подмена',
    kind: 'bonus',
    automated: true,
    rangeFeet: 5,
  },
  { key: "XPHB:Commander's Strike", slug: 'commanders-strike', name: 'Удар командира', kind: 'special' },
  { key: 'XPHB:Commanding Presence', slug: 'commanding-presence', name: 'Командное присутствие', kind: 'check' },
  { key: 'XPHB:Disarming Attack', slug: 'disarming-attack', name: 'Обезоруживающая атака', kind: 'hit' },
  {
    key: MANEUVER_KEYS.distractingStrike,
    slug: 'distracting-strike',
    name: 'Отвлекающий удар',
    kind: 'hit',
    automated: true,
  },
  { key: 'XPHB:Evasive Footwork', slug: 'evasive-footwork', name: 'Уклончивая поступь', kind: 'bonus' },
  { key: 'XPHB:Feinting Attack', slug: 'feinting-attack', name: 'Обманная атака', kind: 'bonus' },
  { key: 'XPHB:Goading Attack', slug: 'goading-attack', name: 'Провоцирующая атака', kind: 'hit' },
  { key: 'XPHB:Lunging Attack', slug: 'lunging-attack', name: 'Выпад', kind: 'bonus' },
  { key: 'XPHB:Maneuvering Attack', slug: 'maneuvering-attack', name: 'Манёвренная атака', kind: 'hit' },
  { key: 'XPHB:Menacing Attack', slug: 'menacing-attack', name: 'Устрашающая атака', kind: 'hit' },
  { key: MANEUVER_KEYS.parry, slug: 'parry', name: 'Парирование', kind: 'reaction', automated: true },
  {
    key: MANEUVER_KEYS.precisionAttack,
    slug: 'precision-attack',
    name: 'Точный удар',
    kind: 'miss',
    automated: true,
  },
  { key: 'XPHB:Pushing Attack', slug: 'pushing-attack', name: 'Толкающая атака', kind: 'hit' },
  { key: 'XPHB:Rally', slug: 'rally', name: 'Сплочение', kind: 'bonus' },
  { key: MANEUVER_KEYS.riposte, slug: 'riposte', name: 'Ответный удар', kind: 'reaction', automated: true },
  { key: 'XPHB:Sweeping Attack', slug: 'sweeping-attack', name: 'Размашистая атака', kind: 'hit' },
  { key: 'XPHB:Tactical Assessment', slug: 'tactical-assessment', name: 'Тактическая оценка', kind: 'check' },
  { key: 'XPHB:Trip Attack', slug: 'trip-attack', name: 'Опрокидывающая атака', kind: 'hit' },
];

const byKey = new Map(MANEUVERS_META.map((m) => [m.key, m]));
const bySlug = new Map(MANEUVERS_META.map((m) => [m.slug, m]));

export function maneuverMeta(key: string): ManeuverMeta | undefined {
  return byKey.get(key);
}

export function maneuverMetaBySlug(slug: string): ManeuverMeta | undefined {
  return bySlug.get(slug);
}

export function maneuverActionId(slug: string): string {
  return `${MANEUVER_ACTION_PREFIX}${slug}`;
}

/** Id кнопки «Приманка и подмена» (выбор получателя AC передаётся вариантом). */
export const BAIT_AND_SWITCH_ACTION = `${MANEUVER_ACTION_PREFIX}bait-and-switch`;

export function maneuverSlugOfActionId(actionId: string): string | undefined {
  return actionId.startsWith(MANEUVER_ACTION_PREFIX) ? actionId.slice(MANEUVER_ACTION_PREFIX.length) : undefined;
}

export function fighterLevelOf(classes: readonly ClassLevel[]): number {
  const entry = classes.find((c) => c.className === 'fighter');
  return entry ? clampLevel(entry.level) : 0;
}

/** Воин-боевой мастер нужного уровня (манёвры доступны с 3-го). */
export function battleMasterLevel(classes: readonly ClassLevel[]): number {
  const entry = classes.find((c) => c.className === 'fighter');
  if (!entry || entry.subclass !== 'battleMaster') return 0;
  return clampLevel(entry.level);
}

/** Сколько манёвров известно на уровне воина (XPHB): 3/5/7/9 на 3/7/10/15. */
export function maneuverLimit(fighterLevel: number): number {
  const level = Math.max(0, Math.round(fighterLevel));
  if (level < 3) return 0;
  if (level >= 15) return 9;
  if (level >= 10) return 7;
  if (level >= 7) return 5;
  return 3;
}

/** Выбранные манёвры листа (ключи `XPHB:...`). */
export function maneuverChoices(choices?: readonly FeatureChoice[]): string[] {
  return (choices ?? []).filter((c) => c.kind === 'maneuver').map((c) => c.key);
}

export function hasManeuver(choices: readonly FeatureChoice[] | undefined, key: string): boolean {
  return maneuverChoices(choices).includes(key);
}

/** СЛ манёвра: 8 + ПБ + мод Силы или Ловкости (больший). */
export function maneuverSaveDc(
  sheet: Pick<CharacterSheet, 'classes' | 'abilities'>
): number {
  const str = abilityMod(sheet.abilities.str ?? 10);
  const dex = abilityMod(sheet.abilities.dex ?? 10);
  return 8 + proficiencyBonus(characterLevel(sheet.classes)) + Math.max(str, dex);
}

/** Кнопки выбранных манёвров; окна-триггеры (попадание/промах/реакция) кнопок не дают. */
export function maneuverActions(classes: readonly ClassLevel[], choices?: readonly FeatureChoice[]): ActionDef[] {
  const level = battleMasterLevel(classes);
  if (level < 3) return [];
  const out: ActionDef[] = [];
  for (const key of maneuverChoices(choices)) {
    const meta = maneuverMeta(key);
    if (!meta) continue;
    // Оконные триггеры дают кнопку только если механика не автоматизирована.
    if (meta.kind === 'miss' || meta.kind === 'reaction') continue;
    if (meta.kind === 'hit' && meta.automated) continue;
    const costs: ActionCost[] = meta.kind === 'bonus' ? ['bonus'] : ['special'];
    const targeting: ActionTargeting | undefined =
      meta.kind === 'bonus' && meta.rangeFeet
        ? { kind: 'creature', range: meta.rangeFeet }
        : undefined;
    out.push({
      id: maneuverActionId(meta.slug),
      name: meta.name,
      source: 'subclass',
      costs,
      ...(targeting ? { targeting } : {}),
      resourceKey: SUPERIORITY_RESOURCE,
      resourceAmount: 1,
      levelReq: 3,
    });
  }
  return out;
}
