import { randomUUID } from 'node:crypto';
import { abilityMod, attackRidersFor, type AbilityKey, type AttackRiderDef, type Token } from 'shared';
import { controllerIdOfToken, hasResourceFor } from '../rooms';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';

const USED_PREFIX = 'rider-used:';
const RAGE_KEY = 'class:barbarian:rage';
const RECKLESS_KEY = 'class:barbarian:recklessAttack';

export interface AppliedRiders {
  /** Дополнительное выражение урона ('1d6+5+2'), пустая строка — нет наездников. */
  expr: string;
  /** Сообщения в чат для сработавших наездников. */
  notes: string[];
}

/**
 * Применяет бонусные черты при попадании оружием: условия (ярость/безрассудство/метка),
 * расход ресурса, учёт «раз в ход» скрытой меткой. Вызывается перед броском урона.
 */
export function applyAttackRiders(ctx: ConnCtx, room: Room, attacker: Token, mapId: string): AppliedRiders {
  const cid = controllerIdOfToken(room, attacker);
  const sheet = cid ? room.sheets[cid] : undefined;
  if (!cid || !sheet) return { expr: '', notes: [] };

  const abilities = ctx.manager.abilitiesForToken(room, attacker) ?? {};
  const level = (className: string) => sheet.classes.find((c) => c.className === className)?.level ?? 0;
  const hasEffect = (key: string) => attacker.effects.some((e) => e.sourceKey === key);

  const parts: string[] = [];
  const notes: string[] = [];
  for (const rider of attackRidersFor(sheet.classes)) {
    if (rider.requiresRage && !hasEffect(RAGE_KEY)) continue;
    if (rider.requiresReckless && !hasEffect(RECKLESS_KEY)) continue;
    if (rider.requiresMarker && !hasEffect(rider.requiresMarker)) continue;
    if (hasEffect(`${USED_PREFIX}${rider.id}`)) continue;
    if (rider.resourceKey && !hasResourceFor(room, cid, rider.resourceKey, rider.resourceAmount ?? 1)) continue;

    const expr = riderExpression(rider, level, abilities);
    if (!expr) continue;

    if (rider.resourceKey) {
      ctx.manager.spendResource(room, cid, rider.resourceKey, rider.resourceAmount ?? 1);
      ctx.emitResources(room, cid);
    }
    parts.push(expr);
    notes.push(`${attacker.name}: ${rider.name} (+${expr})`);
    markUsed(ctx, room, mapId, attacker, rider);
  }
  return { expr: parts.join('+'), notes };
}

function riderExpression(
  rider: AttackRiderDef,
  level: (className: string) => number,
  abilities: Partial<Record<AbilityKey, number>>
): string {
  const parts: string[] = [];
  if (rider.rageDamageDice) parts.push(level('barbarian') >= 9 ? '3d6' : '2d6');
  if (rider.dice) parts.push(rider.dice);
  if (rider.halfLevelBonus) {
    const flat = Math.ceil(level(rider.halfLevelBonus) / 2);
    if (flat) parts.push(String(flat));
  }
  if (rider.abilityBonus) {
    const mod = abilityMod(abilities[rider.abilityBonus] ?? 10);
    if (mod) parts.push(String(mod));
  }
  return parts.join('+');
}

/** Ставит скрытую метку «использовано до конца хода» и снимает метку-активатор. */
function markUsed(ctx: ConnCtx, room: Room, mapId: string, attacker: Token, rider: AttackRiderDef): void {
  const usedKey = `${USED_PREFIX}${rider.id}`;
  if (rider.requiresMarker) {
    for (const effect of attacker.effects.filter((e) => e.sourceKey === rider.requiresMarker)) {
      ctx.manager.removeEffect(room, attacker, effect.id);
    }
  }
  ctx.manager.applyEffect(room, attacker, {
    id: randomUUID(),
    name: `${rider.name}: использовано`,
    sourceKey: usedKey,
    sourceId: attacker.id,
    duration: { type: 'endOfTurn', of: 'target' },
    modifiers: [],
    hidden: true,
  });
  ctx.emitToken(room, 'token:update', mapId, attacker);
}
