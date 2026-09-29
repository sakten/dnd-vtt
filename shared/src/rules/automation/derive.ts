import type { ActionDef } from '../../domain/actions';
import type { AutomationDef, AutomationDice } from '../../domain/automation';
import type { ClassLevel } from '../../domain/sheet';
import { AUTOMATION_ACTIONS } from '../automationActions';
import { invocationPatches } from '../invocations';
import { monsterAbilityAutomation } from '../monsterAbility';
import { isHealingSpell, spellAttackCount, spellDamageExpression, spellMaxRounds } from '../spellCast';
import type { Spell } from '../spells';
import { applyPatch, compileSpec, resolveSpec } from './compile';
import { AUTOMATION_SPECS } from './specs';
import { spellVariantDef } from './variants';
import type { AutomationOptions } from './variants';

/**
 * Определение автоматизации заклинания: спек → деривация из данных (атака/спас/автоурон)
 * → `manual`; после сборки — патчи выбранных инвокаций (Agonizing/Repelling/Spear).
 * Уровни уже применены к `dice`/`count`. Заклинаниям длительностью ровно 1 минута
 * проставляется лимит 10 раундов.
 */
export function automationForSpell(spell: Spell, opts: AutomationOptions = {}): AutomationDef {
  const def = withInvocationPatches(spell.key, buildSpellAutomation(spell, opts), opts.invocations);
  // Билдер мог задать лимит сам (в т.ч. `null` — апкаст Dominate без лимита 1 мин).
  if (def.maxRounds !== undefined) return def;
  const maxRounds = spellMaxRounds(spell);
  return maxRounds ? { ...def, maxRounds } : def;
}

/** Патчи инвокаций поверх дефа: пути `automation.*` (`damage.abilityMod`, `force`, …). */
function withInvocationPatches(spellKey: string, def: AutomationDef, invocations?: string[]): AutomationDef {
  const patches = invocationPatches(spellKey, invocations).filter((p) => p.automation);
  if (!patches.length) return def;
  const copy = structuredClone(def) as unknown as Record<string, unknown>;
  for (const patch of patches) applyPatch(copy, patch.automation!, { add: true });
  return copy as unknown as AutomationDef;
}

function buildSpellAutomation(spell: Spell, opts: AutomationOptions): AutomationDef {
  const spec = AUTOMATION_SPECS[spell.key];
  if (spec) return compileSpec(resolveSpec(spec), { spell, opts });

  const castLevel = opts.castLevel ?? Math.max(1, spell.level);
  const characterLevel = opts.characterLevel ?? 1;
  const expression = spellDamageExpression(spell, castLevel, characterLevel);
  const concentration = spell.concentration === true || undefined;
  const base: AutomationDef = {
    key: spell.key,
    name: spell.name,
    resolution: 'manual',
    concentration,
  };
  if (!expression) return base;

  const types = spell.damage?.types ?? [];
  const dice = { dice: expression, ...(types.length ? { types } : {}) };
  const rolled = isHealingSpell(spell) ? { heal: dice } : { damage: dice };
  const count = spellAttackCount(spell, castLevel, characterLevel);
  if (spell.spellAttack) {
    return {
      ...base,
      resolution: 'attack',
      attack: { rangeType: spell.spellAttack },
      count,
      ...rolled,
    };
  }
  if (spell.save?.length && spell.save[0]) {
    return {
      ...base,
      resolution: 'save',
      save: { ability: spell.save[0], half: spell.saveHalf === true },
      ...rolled,
    };
  }
  return { ...base, resolution: 'auto', count, ...rolled };
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
export function spellTempHp(spell: Spell, castLevel?: number, characterLevel?: number): string | undefined {
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
export function spellDamageParts(spell: Spell): { dice: string; types: string[] }[] | undefined {
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
  const options = spellVariantDef(spell.key)?.options;
  if (options) {
    for (const row of rows) {
      if (sameTypeSet(row.types, options)) row.types = [...options];
    }
  }
  return rows;
}

/**
 * Реализована ли механика заклинания: каталог (не `manual`) либо деривация из
 * данных (`automation: 'full'`). Остальным рисуем красный маркер на иконке.
 */
export function spellAutomated(spell: Pick<Spell, 'key' | 'automation'>): boolean {
  const spec = AUTOMATION_SPECS[spell.key];
  if (spec) return spec.primary !== 'manual';
  return spell.automation === 'full';
}

/** Ручная механика «ведёт мастер» (Charm Monster/Compulsion): красный маркер не рисуем. */
export function spellByDesign(spell: Pick<Spell, 'key'>): boolean {
  return AUTOMATION_SPECS[spell.key]?.manual?.byDesign === true;
}

/**
 * Заклинание-бафф оружия (Shillelagh): кости в данных описывают кость оружия по
 * тирам, а не урон заклинания. Карточкам/тултипам такую строку «Урон» показывать нельзя.
 */
export function spellWeaponOverride(spell: Spell): boolean {
  return automationForSpell(spell).effects?.some((e) => e.weaponOverride) === true;
}
