import {
  featSpellGrants,
  grantedSpells,
  maxCastableLevel,
  reactionFeatures,
  reactionSpellTrigger,
  restrictionsFor,
  type Token,
} from 'shared';
import type { Room } from '../../roomTypes';
import { isDmViewer, type ConnCtx } from '../context';
import { findSpell } from '../../spells';
import { controllerIdOfToken, hasResourceFor, sheetOfToken } from '../../rooms';

export interface ReactionChoice {
  tokenId: string;
  mapId: string;
  optionId: string | null;
}

/** Кто контролирует токен (игроки), иначе — все DM-зрители (в тестовом режиме все). */
export function audienceOf(ctx: ConnCtx, room: Room, mapId: string, token: Token): string[] {
  const byControl = room.players
    .filter((p) => ctx.manager.controlsToken(room, mapId, p.id, token))
    .map((p) => p.id);
  if (byControl.length) return byControl;
  return room.players.filter((p) => isDmViewer(room, p.id)).map((p) => p.id);
}

export function reactionSlotFree(manager: ConnCtx['manager'], room: Room, mapId: string, token: Token): boolean {
  if (restrictionsFor(token.conditions, token.effects).noReactions) return false;
  const turn = manager.turnStateFor(room, mapId, token);
  return !turn || !turn.reactionUsed;
}

/** Заклинания токена: лист персонажа/выданные или список статблока. */
export function knownSpellKeys(room: Room, token: Token): string[] {
  const { sheet } = sheetOfToken(room, token);
  if (sheet) {
    const keys = new Set<string>();
    for (const s of sheet.spells) keys.add(s.key);
    for (const g of grantedSpells(sheet.classes)) keys.add(g.key);
    for (const g of featSpellGrants(sheet.choices)) keys.add(g.key);
    return [...keys];
  }
  return token.statblock?.spellcasting?.spells ?? [];
}

export function spellPayable(room: Room, token: Token, spellLevel: number, spellKey: string): boolean {
  const cid = controllerIdOfToken(room, token);
  if (cid) {
    const spell = findSpell(spellKey);
    if (!spell) return false;
    return maxCastableLevel(spell, room.resources[cid] ?? null) >= spellLevel;
  }
  const spell = findSpell(spellKey);
  if (!spell) return false;
  return maxCastableLevel(spell, null, token.statblock?.spellcasting?.slots) >= spellLevel;
}

/** Есть ли у токена оплачиваемый спец-вариант реакции (для решения «окно или авто-OA»). */
export function hasPayableSpecial(manager: ConnCtx['manager'], room: Room, mapId: string, token: Token): boolean {
  if (!reactionSlotFree(manager, room, mapId, token)) return false;
  for (const key of knownSpellKeys(room, token)) {
    const trigger = reactionSpellTrigger(key);
    const spell = findSpell(key);
    if (trigger && spell && spellPayable(room, token, spell.level, key)) return true;
  }
  // Реакционные черты (Рипост, Парирование, Невероятное уклонение…) — тоже варианты:
  // окно открываем, чтобы игрок мог отказаться от OA и сохранить реакцию.
  const { controllerId: cid, sheet } = sheetOfToken(room, token);
  if (!cid || !sheet) return false;
  return reactionFeatures(sheet.classes).some(
    (def) => !def.resourceKey || hasResourceFor(room, cid, def.resourceKey, def.resourceAmount ?? 1)
  );
}

/** Токен, выбравший вариант в окне реакции. */
export function choiceToken(ctx: ConnCtx, room: Room, choice: ReactionChoice): Token | null {
  return ctx.manager.findToken(room, choice.mapId, choice.tokenId);
}

export function classLevelOf(room: Room, token: Token, className: string): number {
  const { sheet } = sheetOfToken(room, token);
  return sheet?.classes.find((c) => c.className === className)?.level ?? 0;
}

/** Максимум костей 'NdM' — проверка, сможет ли бонус к AC спасти от попадания. */
export function diceMax(expr?: string): number {
  const match = expr?.match(/^\s*(\d+)d(\d+)\s*$/);
  return match ? Number(match[1]) * Number(match[2]) : 0;
}
