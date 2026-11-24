import {
  automationDamageTypes,
  damageTypeHooksFor,
  rollDice,
  type AutomationDef,
  type Token,
} from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { sheetOfToken } from '../room/helpers';
import { turnForToken } from '../room/combat';
import { pushRollMessage } from './messages';

/** Хук Spellfire Adept: Fueled Spellfire — выбор 1–2 костей хитов. */
export const SPELLFIRE_FEAT = 'FRHoF:spellfireAdept';

/** Сколько костей хитов можно потратить под этот каст; null — окно не нужно. */
export function spellfireOptions(
  room: Room,
  mapId: string,
  token: Token,
  def: AutomationDef,
  variant?: string
): number[] | null {
  const { controllerId, sheet } = sheetOfToken(room, token);
  if (!controllerId || !sheet) return null;
  const damageTypes = automationDamageTypes(def);
  if (variant === 'radiant') damageTypes.push('radiant');
  for (const effect of token.effects) {
    if (effect.extraDamageDealt?.damageType) damageTypes.push(effect.extraDamageDealt.damageType);
  }
  if (!damageTypeHooksFor(sheet.choices, damageTypes).some((h) => h.key === SPELLFIRE_FEAT)) {
    return null;
  }
  // Бонус добавляется к одному броску урона; составные/многолучевые пока не трогаем.
  const singleRoll =
    typeof def.damage?.dice === 'string' ||
    typeof def.weaponAttack?.riderDice === 'string' ||
    (!!def.weaponAttack && variant === 'radiant');
  if (!singleRoll || (def.count ?? 1) > 1) return null;
  if (turnForToken(room, mapId, token)?.spellfireUsed) return null;
  const available = (room.resources[controllerId]?.hitDice ?? []).reduce(
    (sum, die) => sum + Math.max(0, die.current),
    0
  );
  if (available <= 0) return null;
  return available >= 2 ? [1, 2] : [1];
}

/** Тратит кости хитов (от больших к меньшим) и возвращает сумму броска; null — не удалось. */
export function applySpellfire(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  token: Token,
  count: number
): number | null {
  const { controllerId, sheet } = sheetOfToken(room, token);
  if (!controllerId || !sheet) return null;
  if (!damageTypeHooksFor(sheet.choices, ['radiant']).some((h) => h.key === SPELLFIRE_FEAT)) return null;
  const turn = turnForToken(room, mapId, token);
  if (turn?.spellfireUsed) return null;
  const res = room.resources[controllerId];
  if (!res) return null;
  const picks: number[] = [];
  for (const die of [...res.hitDice].sort((a, b) => b.die - a.die)) {
    while (picks.length < count && die.current > 0) {
      die.current -= 1;
      picks.push(die.die);
    }
    if (picks.length >= count) break;
  }
  if (picks.length < count) return null;
  const roll = rollDice(picks.map((die) => `1d${die}`).join(' + '));
  if (turn) turn.spellfireUsed = true;
  ctx.emitResources(room, controllerId);
  pushRollMessage(ctx, room, {
    author: token.name,
    roll,
    kind: 'plain',
    params: { subject: `Питаемое пламя (${count} к.х.)` },
  });
  return roll.total;
}
