import {
  actionSlotAvailable,
  automationForSpell,
  characterLevel,
  gridOfMap,
  isBanished,
  maxCastableLevel,
  SMITE_ON_MISS,
  SMITE_RANGE,
  SMITE_SPELLS,
  tokensNearFeet,
  type AttackEntry,
  type AutomationDef,
  type AutomationEffect,
  type Spell,
  type SpellStats,
  type Token,
} from 'shared';
import { controllerIdOfToken } from '../rooms';
import { creatureTypeOf } from '../room/actor';
import type { Room } from '../roomTypes';
import { findSpell } from '../spells';
import type { ConnCtx } from './context';
import { anchorConcentration, dropConcentration, executeAutomation } from './automation';
import { applyEffectTo } from './effectsApply';
import { applyForcedMovement } from './force';
import { pushSaveMessage } from './messages';
import { casterStatsFor } from './spellStats';

export interface SmiteOption {
  /** `smite:<ключ>@<круг ячейки>` — базовый круг; выше — по `levels`. */
  id: string;
  spellKey: string;
  name: string;
  level: number;
  /** Все доступные круги ячейки (в окне — один пункт с выбором круга). */
  levels: number[];
}

/** Divine Smite: доп. 1d8 излучением против этих типов существ (XPHB 2024). */
const DIVINE_EXTRA_TYPES = new Set(['fiend', 'undead']);

/** Banishing Smite: изгнание — только если после урона осталось не больше HP. */
const BANISH_HP = 50;

/** Разбор id опции смайта; undefined — не смайт/битый id. */
export function parseSmiteOption(id: string): { spellKey: string; level: number } | undefined {
  if (!id.startsWith('smite:')) return undefined;
  const body = id.slice('smite:'.length);
  const at = body.lastIndexOf('@');
  if (at <= 0) return undefined;
  const level = Number(body.slice(at + 1));
  if (!Number.isFinite(level) || level < 1 || level > 9) return undefined;
  return { spellKey: body.slice(0, at), level };
}

/** Типизирует кости выражения урона (`1d6 + 1d6` → `1d6fire + 1d6fire`), числа не трогает. */
export function typedDice(expr: string, type: string): string {
  return expr
    .split('+')
    .map((term) => {
      const t = term.trim();
      if (!t) return t;
      return /\d*d\d+/i.test(t) ? `${t}${type}` : t;
    })
    .join(' + ');
}

/**
 * Смайты, доступные атакующему после попадания: заклинание подготовлено, свободно
 * бонусное действие, есть ячейка; вид оружия — по `SMITE_RANGE` (Searing/Divine/…
 * только ближний бой, Ensnaring — только дальний).
 */
export function availableSmites(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  attacker: Token,
  attack: AttackEntry | undefined,
  melee: boolean,
  opts: { onMiss?: boolean } = {}
): SmiteOption[] {
  const cid = controllerIdOfToken(room, attacker);
  const sheet = cid ? room.sheets[cid] : undefined;
  if (!cid || !sheet || !attack) return [];
  const turn = ctx.manager.turnForToken(room, mapId, attacker);
  if (turn && !actionSlotAvailable(turn, 'bonus')) return [];
  const resources = room.resources[cid] ?? null;
  const wanted = melee ? 'melee' : 'ranged';
  const out: SmiteOption[] = [];
  for (const key of SMITE_SPELLS) {
    if (SMITE_RANGE[key] !== wanted) continue;
    // После промаха доступны только смайты «после попадания или промаха» (Lightning Arrow).
    if (opts.onMiss && !SMITE_ON_MISS.has(key)) continue;
    if (!sheet.spells.some((s) => s.key === key)) continue;
    const spell = findSpell(key);
    if (!spell) continue;
    const max = maxCastableLevel(spell, resources, undefined);
    const levels: number[] = [];
    for (let level = spell.level; level <= max; level++) levels.push(level);
    if (!levels.length) continue;
    out.push({ id: `smite:${key}@${levels[0]}`, spellKey: key, name: spell.name, level: levels[0]!, levels });
  }
  return out;
}

export interface SmiteResult {
  /** Доп. кости урона с типом (`1d6fire + 1d6fire`); '' — у смайта нет мгновенного урона. */
  dice: string;
  note: string;
  /** Отложенное после урона атаки (Banishing: изгнание при остатке ≤ 50 HP). */
  afterDamage?: () => void;
  /** Lightning Arrow: урон оружия заменяется этими костями (промах — половина). */
  replaceDamage?: { expr: string; damageType: string; half: boolean };
}

/**
 * Применяет смайт при попадании (Lightning Arrow — и при промахе): бонусное действие +
 * ячейка, доп. кости и эффект. Спас при попадании (Ensnaring/Wrathful/…): успех — эффекта
 * нет (ячейка тратится). Затяжные смайты ведут концентрацию кастера; Hail of Thorns и
 * Lightning Arrow бьют спасом по области вокруг цели.
 */
export function applySmiteChoice(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  attacker: Token,
  target: Token,
  optionId: string,
  opts: { onMiss?: boolean } = {}
): SmiteResult | undefined {
  const parsed = parseSmiteOption(optionId);
  if (!parsed) return undefined;
  const { spellKey, level } = parsed;
  const cid = controllerIdOfToken(room, attacker);
  const sheet = cid ? room.sheets[cid] : undefined;
  if (!cid || !sheet || !sheet.spells.some((s) => s.key === spellKey)) return undefined;
  const spell = findSpell(spellKey);
  if (!spell) return undefined;

  if (!ctx.manager.spendSpellSlot(room, cid, level)) return undefined;
  ctx.emitResources(room, cid);
  ctx.manager.spendSlot(room, mapId, attacker, 'bonus');
  ctx.syncCombat(room, mapId);

  const stats = casterStatsFor(room, attacker, spellKey);
  const characterLvl = characterLevel(sheet.classes);
  const def = automationForSpell(spell, { castLevel: level, characterLevel: characterLvl, spellMod: stats?.mod });
  const dc = stats?.dc ?? 10;
  const effectDef = def.effects?.[0];
  const author = room.players.find((p) => p.id === cid)?.name ?? attacker.name;
  const result: SmiteResult = { dice: '', note: `${attacker.name}: ${spell.name} (${level})` };

  const finish = (resisted: boolean): SmiteResult => {
    ctx.systemMessage(room, {
      code: resisted ? 'spells.smiteResisted' : 'spells.smite',
      params: { name: attacker.name, spell: spell.name, level, target: target.name },
    });
    return result;
  };

  // Hail of Thorns / Lightning Arrow: спас всех существ вокруг цели после урона атаки.
  const secondary = def.weaponAttack?.secondary;
  if (secondary?.save) {
    result.afterDamage = () =>
      runBurst(ctx, room, mapId, attacker, target, spell, secondary, stats, author);
    // Lightning Arrow: кости заменяют урон оружия; при промахе — половина.
    if (def.weaponAttack?.replace && def.damage) {
      const type = def.damage.types?.[0] ?? 'lightning';
      result.replaceDamage = { expr: typedDice(def.damage.dice, type), damageType: type, half: opts.onMiss === true };
    }
    return finish(false);
  }

  if (def.concentration) dropConcentration(ctx, room, attacker);

  let dice = def.damage ? typedDice(def.damage.dice, def.damage.types?.[0] ?? '') : '';
  if (spellKey === 'XPHB:Divine Smite' && DIVINE_EXTRA_TYPES.has(creatureTypeOf(room, target) ?? '')) {
    dice = dice ? `${dice} + 1d8radiant` : '1d8radiant';
  }
  result.dice = dice;

  let failed = true;
  let resisted = false;
  if (effectDef && def.save) {
    const save = ctx.manager.rollSave(room, target, def.save.ability, dc, {
      conditionsAutoFail: true,
      condition: effectDef.conditions?.[0],
      // Ensnaring Strike: Large или больше имеет преимущество на спас Силы (XPHB 2024).
      ...(spellKey === 'XPHB:Ensnaring Strike' && target.cells > 1 ? { advantage: true } : {}),
    });
    pushSaveMessage(ctx, room, {
      author: attacker.name,
      subject: `${spell.name} · ${target.name}`,
      roll: save.roll,
      success: save.success,
    });
    failed = !save.success;
    if (save.success) resisted = true;
  }

  if (effectDef && failed) {
    if (effectDef.banish) {
      // Banishing Smite: спас CHA и изгнание — только если после урона осталось ≤ 50 HP.
      result.afterDamage = () => applyBanishing(ctx, room, mapId, attacker, target, spell, effectDef, def, dc);
    } else {
      applyEffectTo(ctx, room, {
        sourceKey: spellKey,
        sourceId: attacker.id,
        mapId,
        effectDef,
        target,
        maxRounds: def.maxRounds,
        untilSaveDc: dc,
        escapeDc: dc,
      });
      if (def.concentration) anchorConcentration(ctx, room, attacker, mapId, def);
    }
  }
  if (def.force && failed) applyForcedMovement(ctx, room, mapId, attacker, target, def.force);

  return finish(resisted);
}

/** Вторичный спас смайта вокруг цели (Hail of Thorns — 5 фт, Lightning Arrow — 10 фт). */
function runBurst(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  attacker: Token,
  center: Token,
  spell: Spell,
  secondary: NonNullable<NonNullable<AutomationDef['weaponAttack']>['secondary']>,
  stats: SpellStats | null,
  author: string
): void {
  const save = secondary.save;
  if (!save) return;
  const map = ctx.manager.findMap(room, mapId);
  if (!map) return;
  const grid = gridOfMap(map, room.scene.grid);
  const targets = tokensNearFeet(map.tokens, center, secondary.rangeFeet, grid.size).filter(
    (t) => (secondary.includePrimary === true || t.id !== center.id) && !isBanished(t)
  );
  if (!targets.length) return;
  const burst: AutomationDef = {
    key: spell.key,
    name: spell.name,
    resolution: 'save',
    save: { ability: save.ability, half: save.half !== false },
    ...(secondary.dice ? { damage: { dice: secondary.dice, types: [secondary.damageType] } } : {}),
  };
  executeAutomation(ctx, { caster: attacker, mapId, def: burst, targets, stats, author });
}

/** Banishing Smite: после урона атаки — спас CHA цели при остатке ≤ 50 HP; провал — изгнание. */
function applyBanishing(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  attacker: Token,
  target: Token,
  spell: Spell,
  effectDef: AutomationEffect,
  def: AutomationDef,
  dc: number
): void {
  if (target.hpCurrent > BANISH_HP) return;
  const save = ctx.manager.rollSave(room, target, 'cha', dc);
  pushSaveMessage(ctx, room, {
    author: attacker.name,
    subject: `${spell.name} · ${target.name}`,
    roll: save.roll,
    success: save.success,
  });
  if (save.success) return;
  applyEffectTo(ctx, room, {
    sourceKey: spell.key,
    sourceId: attacker.id,
    mapId,
    effectDef,
    target,
    maxRounds: def.maxRounds,
    untilSaveDc: dc,
    escapeDc: dc,
  });
  anchorConcentration(ctx, room, attacker, mapId, def);
}
