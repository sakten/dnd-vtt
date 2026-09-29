import type { ActionDef } from '../../domain/actions';
import type { AutomationDef, AutomationDice } from '../../domain/automation';
import type { ClassLevel } from '../../domain/sheet';
import { AUTOMATION_ACTIONS } from '../automationActions';
import { invocationPatches } from '../invocations';
import { monsterAbilityAutomation } from '../monsterAbility';
import { applyPatch, compileSpec } from './compile';
import type { SpellAuto } from './materialize';
import { spellVariantDef } from './variants';
import type { AutomationOptions } from './variants';

/**
 * Определение автоматизации заклинания (R16 шаг 4): каноническая запись несёт спек
 * (`spell.automation`) — компилируется без реестра, поверх — патчи инвокаций
 * (Agonizing/Repelling/Spear). Уровни/лимит раундов резолвит `compileSpec`.
 */
export function automationForSpell(spell: SpellAuto, opts: AutomationOptions = {}): AutomationDef {
  const automation = spell.automation;
  if (!automation) throw new Error(`automationForSpell: у ${spell.key} нет записи automation`);
  const spec = { ...automation, key: spell.key, name: spell.name };
  return withInvocationPatches(spell.key, compileSpec(spec, { spell, opts }), opts.invocations);
}

/** Патчи инвокаций поверх дефа: пути `automation.*` (`damage.abilityMod`, `force`, …). */
function withInvocationPatches(spellKey: string, def: AutomationDef, invocations?: string[]): AutomationDef {
  const patches = invocationPatches(spellKey, invocations).filter((p) => p.automation);
  if (!patches.length) return def;
  const copy = structuredClone(def) as unknown as Record<string, unknown>;
  for (const patch of patches) applyPatch(copy, patch.automation!, { add: true });
  return copy as unknown as AutomationDef;
}

export interface ActionAutomationOptions {
  /** Классы персонажа — для скейла по уровню (`classLevelBonus`). */
  classes?: ClassLevel[];
}

/**
 * Определение автоматизации действия (базовое/классовая черта): строка каталога
 * со скейлом по уровню класса. undefined — механики нет (заглушка на сервере).
 */
export function automationForAction(action: ActionDef, opts: ActionAutomationOptions = {}): AutomationDef | undefined {
  if (action.ability) return monsterAbilityAutomation(action);
  const base = AUTOMATION_ACTIONS[action.id];
  if (!base) return undefined;
  const classes = opts.classes;
  if (!classes?.length) return base;
  const scale = (dice?: AutomationDice): AutomationDice | undefined => {
    const bonus = dice?.classLevelBonus;
    if (!dice || !bonus) return dice;
    const level = classes.find((c) => c.className === bonus.className)?.level ?? 1;
    const { classLevelBonus: _drop, ...rest } = dice;
    return { ...rest, dice: `${dice.dice}+${Math.max(1, Math.round(level)) * (bonus.per ?? 1)}` };
  };
  return { ...base, damage: scale(base.damage), heal: scale(base.heal) };
}

/**
 * Временные хиты заклинания (False Life): выражение костей со скейлом
 * (2к4 + 4 + 5/круг); undefined — заклинание не даёт врем. хитов.
 */
export function spellTempHp(spell: SpellAuto, castLevel?: number, characterLevel?: number): string | undefined {
  const def = automationForSpell(spell, { castLevel, characterLevel });
  return def.utility?.kind === 'tempHp' ? def.utility.dice : undefined;
}

/** Совпадают ли наборы типов (порядок не важен). */
function sameTypeSet(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().join('\u0000') === [...b].sort().join('\u0000');
}

/**
 * Части урона для карточек/тултипов: смысл костей — роли частей данных.
 * Составной — все `main` (Flame Strike); иначе одна `main` + `trigger` другого типа
 * (Ice Knife — всплеск, Wall of Thorns — стена). Меньше двух строк — undefined:
 * карточка показывает данные заклинания, как и раньше.
 */
export function spellDamageParts(spell: SpellAuto): { dice: string; types: string[] }[] | undefined {
  const parts = spell.damage?.parts ?? [];
  const mains = parts.filter((p) => p.role === 'main');
  let rows: { dice: string; types: string[] }[];
  if (mains.length >= 2) {
    rows = mains.map((p) => ({ dice: p.dice, types: [...p.types] }));
  } else if (mains.length === 1) {
    const main = mains[0]!;
    const extra = parts.filter((p) => p.role === 'trigger' && !sameTypeSet(p.types, main.types));
    rows = extra.length
      ? [{ dice: main.dice, types: [...main.types] }, ...extra.map((p) => ({ dice: p.dice, types: [...p.types] }))]
      : [];
  } else {
    rows = [];
  }
  if (rows.length < 2) return undefined;
  // Типы-выборы (Destructive Wave: излучение/некротика) — в порядке спековых `choices`.
  const options = spellVariantDef(spell)?.options;
  if (options) {
    for (const row of rows) {
      if (sameTypeSet(row.types, options)) row.types = [...options];
    }
  }
  return rows;
}

/**
 * Реализована ли механика заклинания: `primary` канонической записи (не `manual`).
 * Остальным рисуем красный маркер на иконке.
 */
export function spellAutomated(spell: SpellAuto): boolean {
  return spell.automation ? spell.automation.primary !== 'manual' : false;
}

/** Ручная механика «ведёт мастер» (Charm Monster/Compulsion): красный маркер не рисуем. */
export function spellByDesign(spell: SpellAuto): boolean {
  return spell.automation?.manual?.byDesign === true;
}

/**
 * Заклинание-бафф оружия (Shillelagh): кости в данных описывают кость оружия по
 * тирам, а не урон заклинания. Карточкам/тултипам такую строку «Урон» показывать нельзя.
 */
export function spellWeaponOverride(spell: SpellAuto): boolean {
  return automationForSpell(spell).effects?.some((e) => e.weaponOverride) === true;
}

export type { SpellAuto };
