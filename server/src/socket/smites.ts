import {
  actionSlotAvailable,
  automationForSpell,
  characterLevel,
  maxCastableLevel,
  SMITE_SPELLS,
  spellDamageExpression,
  type AttackEntry,
  type Token,
} from 'shared';
import { controllerIdOfToken } from '../rooms';
import type { Room } from '../roomTypes';
import { findSpell } from '../spells';
import type { ConnCtx } from './context';
import { applyEffectTo } from './effectsApply';
import { pushSaveMessage } from './messages';
import { spellClassFor, spellStatsFor } from './spellStats';

export interface SmiteOption {
  /** `smite:<ключ>@<круг ячейки>`. */
  id: string;
  spellKey: string;
  name: string;
  level: number;
}

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
 * бонусное действие, есть ячейка; Searing — только по оружию ближнего боя/безоружному удару.
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
  const out: SmiteOption[] = [];
  for (const key of SMITE_SPELLS) {
    if (key === 'XPHB:Searing Smite' && !melee) continue;
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
}

/**
 * Применяет смайт при попадании: бонусное действие + ячейка, эффект на цель.
 * Ensnaring Strike: спас STR при попадании, успех — эффекта нет (ячейка всё равно тратится).
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
  if (effectDef) {
    if (def.save) {
      const save = ctx.manager.rollSave(room, target, def.save.ability, dc, { conditionsAutoFail: true });
      pushSaveMessage(ctx, room, {
        author: attacker.name,
        subject: `${spell.name} · ${target.name}`,
        roll: save.roll,
        success: save.success,
      });
      if (!save.success) {
        applyEffectTo(ctx, room, {
          sourceKey: spellKey,
          sourceId: attacker.id,
          mapId,
          effectDef,
          target,
          untilSaveDc: dc,
          escapeDc: dc,
        });
      }
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
    }
  }

  const expression = spellDamageExpression(spell, level, characterLvl);
  const dice = spellKey === 'XPHB:Searing Smite' && expression ? typedDice(expression, 'fire') : '';
  ctx.systemMessage(room, {
    code: 'spells.smite',
    params: { name: attacker.name, spell: spell.name, level, target: target.name },
  });
  return { dice, note: `${attacker.name}: ${spell.name} (${level})` };
}
