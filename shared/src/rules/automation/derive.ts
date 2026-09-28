import type { ActionDef } from '../../domain/actions';
import type { AutomationDef, AutomationDice } from '../../domain/automation';
import type { ClassLevel } from '../../domain/sheet';
import { AUTOMATION_ACTIONS } from '../automationActions';
import { eldritchBlastMods } from '../invocations';
import { monsterAbilityAutomation } from '../monsterAbility';
import { isHealingSpell, spellAttackCount, spellDamageExpression, spellMaxRounds } from '../spellCast';
import type { Spell } from '../spells';
import { summonSpellDef } from '../summons';
import { COMPOSITE_CONFIGS } from './helpers';
import { AUTOMATION_SPELLS } from './catalog';
import { compileSpec, resolveSpec } from './compile';
import { AUTOMATION_SPECS } from './specs';
import { spellVariantDef } from './variants';
import type { AutomationOptions } from './variants';

/**
 * Определение автоматизации заклинания: спек → строка каталога → деривация из данных
 * (атака/спасбросок/автоурон) → `manual`. Уровни уже применены к `dice`/`count`.
 * Заклинаниям длительностью ровно 1 минута проставляется лимит 10 раундов.
 */
export function automationForSpell(spell: Spell, opts: AutomationOptions = {}): AutomationDef {
  const def = buildSpellAutomation(spell, opts);
  // Билдер мог задать лимит сам (в т.ч. `null` — апкаст Dominate без лимита 1 мин).
  if (def.maxRounds !== undefined) return def;
  const maxRounds = spellMaxRounds(spell);
  return maxRounds ? { ...def, maxRounds } : def;
}

function buildSpellAutomation(spell: Spell, opts: AutomationOptions): AutomationDef {
  const spec = AUTOMATION_SPECS[spell.key];
  if (spec) return compileSpec(resolveSpec(spec), { spell, opts });

  const catalog = AUTOMATION_SPELLS[spell.key];
  if (catalog) return catalog;

  const summon = summonSpellDef(spell.key);
  if (summon) {
    const castLevel = Math.max(summon.baseLevel, opts.castLevel ?? Math.max(1, spell.level));
    return {
      key: spell.key,
      name: spell.name,
      resolution: 'summon',
      concentration: spell.concentration === true || undefined,
      summon: {
        ...(summon.template ? { creature: summon.template } : {}),
        ...(summon.fromFamiliar ? { choices: [] } : {}),
        count: summon.count ?? 1,
        duration: spell.concentration ? { type: 'concentration' } : summon.duration ?? { type: 'permanent' },
        initiative: summon.initiative,
        level: castLevel,
        spellAttack: true,
        spellDc: true,
      },
    };
  }

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

  const dice = { dice: expression, types: spell.damage?.types ?? [] };
  const rolled = isHealingSpell(spell) ? { heal: dice } : { damage: dice };
  const count = spellAttackCount(spell, castLevel, characterLevel);
  if (spell.spellAttack) {
    return withBlastMods(
      spell,
      {
        ...base,
        resolution: 'attack',
        attack: { rangeType: spell.spellAttack },
        count,
        ...rolled,
      },
      opts.invocations
    );
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

  /** Модификаторы Eldritch Blast от инвокаций: Agonizing (+мод. характеристики) и Repelling (толчок). */
function withBlastMods(spell: Spell, def: AutomationDef, invocations?: string[]): AutomationDef {
  if (spell.key !== 'XPHB:Eldritch Blast' || !invocations?.length) return def;
  const mods = eldritchBlastMods({ invocations });
  let out = def;
  if (mods.agonizing && out.damage) out = { ...out, damage: { ...out.damage, abilityMod: true } };
  if (mods.repelling) out = { ...out, force: { kind: 'push', feet: 10, maxSize: 'large' } };
  return out;
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

/**
 * Части составного урона заклинания для карточек/тултипов (Wall of Thorns — обе
 * порции: появление и вход/конец хода). undefined — у заклинания обычная строка данных.
 */
export function spellDamageParts(spell: Spell): { dice: string; types: string[] }[] | undefined {
  const cfg = COMPOSITE_CONFIGS[spell.key];
  if (cfg) {
    const variant = spellVariantDef(spell.key);
    return cfg.parts.map((part, i) => ({
      dice: part.dice,
      types: cfg.variantPart === i && variant ? [...variant.options] : [part.type],
    }));
  }
  if (spell.key === 'XPHB:Wall of Thorns') {
    return [
      { dice: '7d8', types: ['piercing'] },
      { dice: '7d8', types: ['slashing'] },
    ];
  }
  // Ice Knife: атака колющим + взрыв холодом вокруг цели (не один броском).
  if (spell.key === 'XPHB:Ice Knife') {
    return [
      { dice: '1d10', types: ['piercing'] },
      { dice: '2d6', types: ['cold'] },
    ];
  }
  // Jallarzi's Storm of Radiance: 2d10 излучением + 2d10 звуком одним броском.
  if (spell.key === "XPHB:Jallarzi's Storm of Radiance") {
    return [
      { dice: '2d10', types: ['radiant'] },
      { dice: '2d10', types: ['thunder'] },
    ];
  }
  return undefined;
}

/**
 * Реализована ли механика заклинания: каталог (не `manual`) либо деривация из
 * данных (`automation: 'full'`). Остальным рисуем красный маркер на иконке.
 */
export function spellAutomated(spell: Pick<Spell, 'key' | 'automation'>): boolean {
  const spec = AUTOMATION_SPECS[spell.key];
  if (spec) return spec.primary !== 'manual';
  const def = AUTOMATION_SPELLS[spell.key];
  if (def) return def.resolution !== 'manual';
  if (summonSpellDef(spell.key)) return true;
  return spell.automation === 'full';
}

/** Ручная механика «ведёт мастер» (Charm Monster/Compulsion): красный маркер не рисуем. */
export function spellByDesign(spell: Pick<Spell, 'key'>): boolean {
  return AUTOMATION_SPELLS[spell.key]?.byDesign === true;
}

/**
 * Заклинание-бафф оружия (Shillelagh): кости в данных описывают кость оружия по
 * тирам, а не урон заклинания. Карточкам/тултипам такую строку «Урон» показывать нельзя.
 */
export function spellWeaponOverride(spell: Spell): boolean {
  return automationForSpell(spell).effects?.some((e) => e.weaponOverride) === true;
}
