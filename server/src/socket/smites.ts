import {
  actionSlotAvailable,
  automationForSpell,
  characterLevel,
  maxCastableLevel,
  SMITE_RANGE,
  SMITE_SPELLS,
  type AttackEntry,
  type AutomationDef,
  type AutomationEffect,
  type Spell,
  type Token,
} from 'shared';
import { controllerIdOfToken } from '../rooms';
import { creatureTypeOf } from '../room/actor';
import type { Room } from '../roomTypes';
import { findSpell } from '../spells';
import type { ConnCtx } from './context';
import { anchorConcentration, dropConcentration } from './automation';
import { applyEffectTo } from './effectsApply';
import { applyForcedMovement } from './force';
import { pushSaveMessage } from './messages';
import { spellClassFor, spellStatsFor } from './spellStats';

export interface SmiteOption {
  /** `smite:<ключ>@<круг ячейки>`. */
  id: string;
  spellKey: string;
  name: string;
  level: number;
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
  melee: boolean
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
    if (!sheet.spells.some((s) => s.key === key)) continue;
    const spell = findSpell(key);
    if (!spell) continue;
    const max = maxCastableLevel(spell, resources, undefined);
    for (let level = spell.level; level <= max; level++) {
      out.push({ id: `smite:${key}@${level}`, spellKey: key, name: spell.name, level });
    }
  }
  return out;
}

export interface SmiteResult {
  /** Доп. кости урона с типом (`1d6fire + 1d6fire`); '' — у смайта нет мгновенного урона. */
  dice: string;
  note: string;
  /** Отложенное после урона атаки (Banishing: изгнание при остатке ≤ 50 HP). */
  afterDamage?: () => void;
}

/**
 * Применяет смайт при попадании: бонусное действие + ячейка, доп. кости и эффект.
 * Спас при попадании (Ensnaring/Wrathful/…): успех — эффекта нет (ячейка тратится).
 * Затяжные смайты (Wrathful/Blinding/Shining/Banishing) ведут концентрацию кастера.
 */
export function applySmiteChoice(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  attacker: Token,
  target: Token,
  optionId: string
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

  const stats = spellStatsFor(room, attacker, spellClassFor(sheet, spellKey));
  const characterLvl = characterLevel(sheet.classes);
  const def = automationForSpell(spell, { castLevel: level, characterLevel: characterLvl, spellMod: stats?.mod });
  const dc = stats?.dc ?? 10;
  const effectDef = def.effects?.[0];

  let dice = def.damage ? typedDice(def.damage.dice, def.damage.types?.[0] ?? '') : '';
  if (spellKey === 'XPHB:Divine Smite' && DIVINE_EXTRA_TYPES.has(creatureTypeOf(room, target) ?? '')) {
    dice = dice ? `${dice} + 1d8radiant` : '1d8radiant';
  }

  const result: SmiteResult = { dice, note: `${attacker.name}: ${spell.name} (${level})` };
  if (def.concentration) dropConcentration(ctx, room, attacker);

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
        untilSaveDc: dc,
        escapeDc: dc,
      });
      if (def.concentration) anchorConcentration(ctx, room, attacker, mapId, def);
    }
  }
  if (def.force && failed) applyForcedMovement(ctx, room, mapId, attacker, target, def.force);

  ctx.systemMessage(room, {
    code: resisted ? 'spells.smiteResisted' : 'spells.smite',
    params: { name: attacker.name, spell: spell.name, level, target: target.name },
  });
  return result;
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
    untilSaveDc: dc,
    escapeDc: dc,
  });
  anchorConcentration(ctx, room, attacker, mapId, def);
}
